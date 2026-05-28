import { Op } from "sequelize"
import { Campaign, Registration, User } from "../models/db.config.js"
import {
  createError,
  forwardControllerError,
  notFoundError,
  validationError,
  isUuidParam
} from "../utils/error.utils.js"
import {
  CAMPAIGNS_BASE,
  assertEligibleForCampaignEnrollment,
  listResponse,
  parsePaginationQuery,
  withResourceLinks
} from "../utils/hateoas.utils.js"

function paginatedHateoas(basePath, data, options = {}) {
  return listResponse(
    basePath,
    data.items,
    { page: data.page, pageSize: data.pageSize, total: data.total },
    options
  )
}

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

const ENROLLABLE_CAMPAIGN_STATUSES = new Set([1, 2, 3])

export async function createSelfRegistration(campaignId, userId) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const dbStatus = Number(campaign.status)
  if (!ENROLLABLE_CAMPAIGN_STATUSES.has(dbStatus)) {
    throw validationError(["Invalid request"])
  }

  const user = await User.findByPk(userId, { attributes: ["isBlocked", "birthDate"] })
  if (!user || user.isBlocked) {
    throw validationError(["Invalid request"])
  }

  assertEligibleForCampaignEnrollment(user.birthDate)

  const existing = await Registration.findOne({
    where: { campaignId, userId }
  })

  const now = new Date()

  if (existing) {
    if (existing.status !== 2) {
      throw validationError(["Invalid request"])
    }
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

export async function deleteRegistration(registrationId, requesterId) {
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
  const user = await User.findByPk(requesterId, { attributes: ["isAdmin"] })
  const isOrg = campaign.organizerId === requesterId

  if (!isSelf && !isOrg && !user?.isAdmin) {
    throw createError(403, "Forbidden")
  }

  await registration.destroy()
}

async function assertRegistrationInCampaign(campaignId, registrationId) {
  if (!isUuidParam(campaignId) || !isUuidParam(registrationId)) {
    throw validationError(["Invalid id"])
  }
  const row = await Registration.findByPk(registrationId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Registration")
  }
}

export const getAllRegistrations = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/registrations`
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
      req.params.campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {}),
      { status: statusFilter }
    )
    res.json(paginatedHateoas(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching registrations")
  }
}

export const createRegistrationHandler = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/registrations`
    const data = await createSelfRegistration(req.params.campaignId, req.user.sub)
    const response = withResourceLinks(base, data, { updateMethod: "PATCH" })
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating registration")
  }
}

export const updateRegistrationHandler = async (req, res, next) => {
  try {
    await assertRegistrationInCampaign(req.params.campaignId, req.params.registrationId)
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/registrations`
    const data = await updateRegistration(
      req.params.registrationId,
      req.user.sub,
      req.body ?? {}
    )
    res.json(withResourceLinks(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating registration")
  }
}

export const deleteRegistrationHandler = async (req, res, next) => {
  try {
    await assertRegistrationInCampaign(req.params.campaignId, req.params.registrationId)
    await deleteRegistration(req.params.registrationId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting registration")
  }
}
