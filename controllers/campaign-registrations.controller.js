import { Campaign, Registration, User } from "../models/db.config.js"
import { createError, passControllerError, notFoundError, validationError, isUuidParam } from "../utils/error.utils.js"
import {
  assertEligibleForCampaignEnrollment,
  isCampaignOpenForSelfEnrollment
} from "../utils/domain.utils.js"
import {
  CAMPAIGNS_BASE,
  paginatedList,
  parsePaginationQuery,
  withRegistrationResourceLinks
} from "../utils/response.utils.js"
import {
  evaluateRegistrationCollectionCreate,
  loadActorContext,
  REGISTRATION_ENROLL_BLOCK_REASONS,
  registrationEnrollForbiddenError,
  registrationItemActions
} from "../utils/hypermedia.permissions.js"

// Mapeia um registo de inscrição para o DTO da API.
function toRegistrationDto(row) {
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    attendance: row.attendance,
    createdAt: row.createdAt.toISOString(),
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          phone: row.user.phone ?? null
        }
      : null
  }
}

// Garante que o pedido é do organizador da campanha ou de um administrador.
async function assertOrganizerOrAdminForCampaign(requesterId, campaign) {
  if (campaign.organizerId === requesterId) {
    return
  }
  const user = await User.findByPk(requesterId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return
  }
  throw createError(403, "Forbidden")
}

// Lista inscrições de uma campanha (organizador ou administrador).
export async function listRegistrationsForCampaign(
  campaignId,
  requesterId,
  pagination,
  listOptions = {}
) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  await assertOrganizerOrAdminForCampaign(requesterId, campaign)

  const { offset, limit, page, pageSize } = pagination
  const where = { campaignId }

  if (listOptions.status != null) {
    const s = Number(listOptions.status)
    if (s !== 0 && s !== 1 && s !== 2) {
      throw validationError(["Invalid request"])
    }
    where.status = s
  }

  const total = await Registration.count({ where })
  const rows = await Registration.findAll({
    where,
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ],
    order: [[{ model: User, as: "user" }, "name", "ASC"]],
    limit,
    offset
  })

  return {
    items: rows.map((r) => toRegistrationDto(r)),
    total,
    page,
    pageSize
  }
}

// Inscreve o utilizador autenticado na campanha (ou reactiva inscrição cancelada).
export async function createSelfRegistration(campaignId, userId) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  if (!isCampaignOpenForSelfEnrollment(campaign.status)) {
    throw validationError(["Invalid request"])
  }

  const user = await User.findByPk(userId, { attributes: ["isBlocked", "birthDate"] })
  if (!user || user.isBlocked) {
    throw validationError(["Invalid request"])
  }

  // Idade mínima 16 anos para auto-inscrição.
  assertEligibleForCampaignEnrollment(user.birthDate)

  // Incluir soft-deleted para permitir reactivar inscrição cancelada.
  const existing = await Registration.findOne({
    where: { campaignId, userId },
    paranoid: false
  })

  const now = new Date()

  if (existing) {
    if (!existing.deletedAt && existing.status !== 2) {
      throw registrationEnrollForbiddenError(REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED)
    }
    // Reactivar inscrição cancelada em vez de criar duplicado.
    existing.deletedAt = null
    existing.role = 0
    existing.status = 1
    existing.attendance = null
    existing.updatedAt = now
    await existing.save()
    const full = await Registration.findByPk(existing.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
      ]
    })
    if (!full) {
      throw notFoundError("Registration")
    }
    return toRegistrationDto(full)
  }

  const row = await Registration.create({
    campaignId,
    userId,
    role: 0,
    status: 1,
    createdAt: now,
    updatedAt: now
  })

  const full = await Registration.findByPk(row.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ]
  })

  if (!full) {
    throw notFoundError("Registration")
  }

  return toRegistrationDto(full)
}

// Actualiza papel, estado ou presença de uma inscrição consoante as permissões.
export async function updateRegistration(registrationId, requesterId, body) {
  if (!isUuidParam(registrationId)) {
    throw validationError(["Invalid id"])
  }

  const registration = await Registration.findByPk(registrationId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!registration) {
    throw notFoundError("Registration")
  }

  const campaign = registration.campaign
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const isSelf = registration.userId === requesterId
  const isOrgOrAdmin =
    campaign.organizerId === requesterId ||
    (await User.findByPk(requesterId, { attributes: ["isAdmin"] }))?.isAdmin

  if (!isSelf && !isOrgOrAdmin) {
    throw createError(403, "Forbidden")
  }

  // Voluntário só pode cancelar a própria inscrição (status=2).
  if (isSelf && !isOrgOrAdmin) {
    const nextStatus = Number(body?.status)
    if (nextStatus !== 2) {
      throw createError(403, "Forbidden")
    }
    registration.status = 2
    await registration.save()
    const full = await Registration.findByPk(registration.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
      ]
    })
    if (!full) {
      throw notFoundError("Registration")
    }
    return toRegistrationDto(full)
  }

  if (body.role !== undefined) {
    const r = Number(body.role)
    if (r !== 0 && r !== 1) {
      throw validationError(["Invalid request"])
    }
    registration.role = r
  }

  if (body.status !== undefined) {
    const s = Number(body.status)
    if (s !== 0 && s !== 1 && s !== 2) {
      throw validationError(["Invalid request"])
    }
    registration.status = s
  }

  if (body.attendance !== undefined) {
    if (body.attendance === null) {
      registration.attendance = null
    } else if (typeof body.attendance === "boolean") {
      registration.attendance = body.attendance
    } else {
      throw validationError(["Invalid request"])
    }
  }

  await registration.save()

  const full = await Registration.findByPk(registration.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ]
  })

  if (!full) {
    throw notFoundError("Registration")
  }

  return toRegistrationDto(full)
}

// Confirma que a inscrição pertence à campanha indicada no URL.
async function assertRegistrationInCampaign(campaignId, registrationId) {
  if (!isUuidParam(campaignId) || !isUuidParam(registrationId)) {
    throw validationError(["Invalid id"])
  }
  const row = await Registration.findByPk(registrationId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Registration")
  }
}

/**
 * Listar inscrições de uma campanha.
 * Método: GET
 * Rota: /campaigns/:id/registrations
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Organizador da campanha ou admin vê lista completa; filtro opcional status (0|1|2).
 * - Voluntário inscrito pode ver conforme hypermedia.permissions.
 *
 * Notas técnicas:
 * - Inscrição única por (campanha_id, utilizador_id); estado e presença em inscricao.
 */
export const getAllRegistrations = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    const base = `${CAMPAIGNS_BASE}/${campaignId}/registrations`
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign"))
    }
    let statusFilter = null
    const statusRaw = req.query?.status
    if (statusRaw != null && statusRaw !== "") {
      const s = Number(statusRaw)
      if (s !== 0 && s !== 1 && s !== 2) {
        return next(validationError(["Invalid request"]))
      }
      statusFilter = s
    }
    const data = await listRegistrationsForCampaign(
      campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {}),
      { status: statusFilter }
    )
    res.json(
      paginatedList(base, data, {
        query: req.query,
        omitCreate: true,
        mapItem: (item) =>
          withRegistrationResourceLinks(
            campaignId,
            { ...item, userId: item.user?.id },
            registrationItemActions(actor, { ...item, userId: item.user?.id }, campaign)
          )
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching registrations")
  }
}

/**
 * Auto-inscrição do utilizador autenticado na campanha.
 * Método: POST
 * Rota: /campaigns/:id/registrations
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Campanha em estado aberta_inscricoes; idade mínima 16 (birthDate).
 * - Reactivar inscrição cancelada em vez de duplicar; role voluntário por defeito.
 *
 * Notas técnicas:
 * - evaluateRegistrationCollectionCreate valida elegibilidade antes de criar.
 */
export const createRegistrationHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    const base = `${CAMPAIGNS_BASE}/${campaignId}/registrations`
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign"))
    }
    // Validar elegibilidade (estado da campanha, perfil, inscrição existente) antes de criar.
    const enrollCheck = await evaluateRegistrationCollectionCreate(actor, campaignId)
    if (!enrollCheck.allowed) {
      return next(registrationEnrollForbiddenError(enrollCheck.reason))
    }
    const data = await createSelfRegistration(campaignId, req.user.sub)
    const actions = registrationItemActions(
      actor,
      { ...data, userId: req.user.sub },
      campaign
    )
    const response = withRegistrationResourceLinks(campaignId, data, actions)
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating registration")
  }
}

/**
 * Actualizar inscrição (estado, função, presença).
 * Método: PATCH
 * Rota: /campaigns/:id/registrations/:registrationId
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Organizador/admin: confirmar, cancelar, marcar presença, alterar função.
 * - Voluntário: cancelar apenas a própria inscrição (status=2).
 *
 * Notas técnicas:
 * - status: 0 pendente, 1 confirmada, 2 cancelada; presenca booleana opcional.
 */
export const updateRegistrationHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    await assertRegistrationInCampaign(campaignId, req.params.registrationId)
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign"))
    }
    const data = await updateRegistration(
      req.params.registrationId,
      req.user.sub,
      req.body ?? {}
    )
    const regRow = await Registration.findByPk(req.params.registrationId, {
      attributes: ["userId", "status"]
    })
    const actions = registrationItemActions(
      actor,
      { id: data.id, userId: regRow?.userId, status: data.status },
      campaign
    )
    res.json(withRegistrationResourceLinks(campaignId, data, actions))
  } catch (error) {
    passControllerError(error, next, "Error updating registration")
  }
}

