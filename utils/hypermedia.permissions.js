// Permissões hipermedia: decidir quais links (create, update, delete, sub-recursos) incluir pelo utilizador autenticado e contexto.
import { Op } from "sequelize"
import { Campaign, Registration, User } from "../models/db.config.js"
import { roleHasCapability } from "../middlewares/auth.middlewares.js"
import { createError } from "./error.utils.js"
import { assertCanAccessCampaignParticipantData, assertCanAccessCampaignWasteData, isCampaignOpenForSelfEnrollment, isEligibleForCampaignEnrollment } from "./domain.utils.js"

const actorContextCache = new Map()

// Carregar indicadores do utilizador autenticado (memória intermédia por id na mesma invocação).
export async function loadActorContext(actorId) {
  if (!actorId) return null
  if (actorContextCache.has(actorId)) {
    return actorContextCache.get(actorId)
  }
  const user = await User.findByPk(actorId, {
    attributes: ["id", "isAdmin", "isOrganizer", "isBlocked"]
  })
  const ctx = {
    actorId,
    role: user?.isAdmin ? "admin" : user?.isOrganizer ? "organizer" : "volunteer",
    isAdmin: Boolean(user?.isAdmin),
    isOrganizer: Boolean(user?.isOrganizer),
    isBlocked: Boolean(user?.isBlocked)
  }
  actorContextCache.set(actorId, ctx)
  return ctx
}

export function clearActorContextCache() {
  actorContextCache.clear()
}

function isOrgOrAdmin(actor, campaign) {
  if (!actor || !campaign) return false
  if (campaign.organizerId === actor.actorId) return true
  return actor.isAdmin
}

// --- Campanha: acções no item e sub-recursos (inscrições, comentários, recolhas) ---

export function campaignItemActions(actor, campaign) {
  const actions = { self: true }
  if (isOrgOrAdmin(actor, campaign)) {
    actions.update = true
    actions.delete = true
  }
  return actions
}

export async function campaignSubresourceActions(actor, campaignId) {
  const extra = {}
  if (!actor?.actorId || !campaignId) return extra

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId"]
  })
  if (!campaign) return extra

  if (isOrgOrAdmin(actor, campaign)) {
    extra.registrations = true
  }

  try {
    await assertCanAccessCampaignParticipantData(actor.actorId, campaignId)
    extra.comments = true
  } catch {
    /* sem acesso */
  }

  try {
    await assertCanAccessCampaignWasteData(actor.actorId, campaignId)
    extra.wasteCollections = true
  } catch {
    /* sem acesso */
  }

  return extra
}

export function campaignCollectionCreateAllowed(actor) {
  return (
    actor &&
    (roleHasCapability(actor.role, "manageCampaigns") || actor.isAdmin || actor.isOrganizer)
  )
}

// --- Inscrição: acções no item e regras de auto-inscrição (POST /registrations) ---

export function registrationItemActions(actor, registration, campaign) {
  const actions = { self: true }
  if (!actor || !registration || !campaign) return actions

  const isSelf = registration.userId === actor.actorId
  const orgAdmin = isOrgOrAdmin(actor, campaign)

  if (orgAdmin) {
    actions.update = true
    return actions
  }

  // Voluntário só pode actualizar a própria inscrição se não estiver cancelada.
  if (isSelf && registration.status !== 2) {
    actions.update = true
  }

  return actions
}

export const REGISTRATION_ENROLL_BLOCK_REASONS = {
  NOT_ALLOWED: "not_allowed",
  CAMPAIGN_NOT_FOUND: "campaign_not_found",
  CAMPAIGN_CLOSED: "campaign_closed",
  BLOCKED: "blocked",
  ALREADY_ENROLLED: "already_enrolled",
  PROFILE_INCOMPLETE: "profile_incomplete"
}

const ENROLL_BLOCK_MESSAGES = {
  [REGISTRATION_ENROLL_BLOCK_REASONS.NOT_ALLOWED]: "Não foi possível concluir a inscrição.",
  [REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_NOT_FOUND]: "Campanha não encontrada.",
  [REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_CLOSED]:
    "As inscrições não estão abertas nesta campanha.",
  [REGISTRATION_ENROLL_BLOCK_REASONS.BLOCKED]: "A tua conta está bloqueada.",
  [REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED]:
    "Já tens uma inscrição nesta campanha.",
  [REGISTRATION_ENROLL_BLOCK_REASONS.PROFILE_INCOMPLETE]:
    "Indica a data de nascimento no perfil para te inscreveres numa campanha."
}

// Avaliar se o utilizador autenticado pode auto-inscrever-se e devolve o motivo de bloqueio.
export async function evaluateRegistrationCollectionCreate(actor, campaignId) {
  if (!actor?.actorId || !campaignId) {
    return { allowed: false, reason: REGISTRATION_ENROLL_BLOCK_REASONS.NOT_ALLOWED }
  }

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "status", "organizerId"]
  })
  if (!campaign) {
    return { allowed: false, reason: REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_NOT_FOUND }
  }

  if (!isCampaignOpenForSelfEnrollment(campaign.status)) {
    return { allowed: false, reason: REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_CLOSED }
  }
  if (actor.isBlocked) {
    return { allowed: false, reason: REGISTRATION_ENROLL_BLOCK_REASONS.BLOCKED }
  }

  // Incluir registos eliminados logicamente: permitir reactivar inscrição cancelada (estado 2).
  const existing = await Registration.findOne({
    where: { campaignId, userId: actor.actorId },
    attributes: ["status", "deletedAt"],
    paranoid: false
  })
  if (existing && !existing.deletedAt && existing.status !== 2) {
    return { allowed: false, reason: REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED }
  }

  const user = await User.findByPk(actor.actorId, { attributes: ["birthDate"] })
  if (!isEligibleForCampaignEnrollment(user?.birthDate)) {
    return { allowed: false, reason: REGISTRATION_ENROLL_BLOCK_REASONS.PROFILE_INCOMPLETE }
  }

  return { allowed: true, reason: null }
}

export function registrationEnrollBlockMessage(reason) {
  return (
    ENROLL_BLOCK_MESSAGES[reason] ??
    ENROLL_BLOCK_MESSAGES[REGISTRATION_ENROLL_BLOCK_REASONS.NOT_ALLOWED]
  )
}

// Erro 403 com código estável para o cliente mapear notificações de auto-inscrição.
export function registrationEnrollForbiddenError(reason) {
  const code =
    reason && ENROLL_BLOCK_MESSAGES[reason]
      ? reason
      : REGISTRATION_ENROLL_BLOCK_REASONS.NOT_ALLOWED
  return createError({
    status: 403,
    description: registrationEnrollBlockMessage(code),
    errors: { code: [code] }
  })
}

export async function registrationCollectionCreateAllowed(actor, campaignId) {
  const result = await evaluateRegistrationCollectionCreate(actor, campaignId)
  return result.allowed
}

export function viewerRegistrationActions(actor, registration, campaign) {
  if (!registration) return { self: false }
  return registrationItemActions(actor, registration, campaign)
}

// --- Comentário ---

export function commentItemActions(actor, comment, campaign) {
  const actions = { self: true }
  if (!actor || !comment || !campaign) return actions

  if (isOrgOrAdmin(actor, campaign)) {
    actions.update = true
  }

  const isAuthor = comment.userId === actor.actorId
  if (isAuthor || isOrgOrAdmin(actor, campaign)) {
    actions.delete = true
  }

  return actions
}

export async function commentCollectionCreateAllowed(actor, campaignId) {
  if (!actor?.actorId || !campaignId) return false

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId"]
  })
  if (!campaign) return false

  if (isOrgOrAdmin(actor, campaign)) return true

  const reg = await Registration.findOne({
    where: { campaignId, userId: actor.actorId, status: { [Op.ne]: 2 } },
    attributes: ["id"]
  })
  return Boolean(reg)
}

// --- Recolha de resíduos: registo limitado a organizador/admin; edição pelo autor ou gestor ---

export function wasteCollectionItemActions(actor, collection, campaign) {
  const actions = { self: true }
  if (!actor || !collection || !campaign) return actions

  if (isOrgOrAdmin(actor, campaign)) {
    actions.update = true
    actions.delete = true
    return actions
  }

  if (collection.recordedByUserId === actor.actorId) {
    actions.update = true
    actions.delete = true
    return actions
  }

  return actions
}

export async function wasteCollectionCollectionCreateAllowed(actor, campaignId) {
  if (!actor?.actorId || !campaignId) return false

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId"]
  })
  if (!campaign) return false

  // Registar recolhas: apenas organizador da campanha ou administrador.
  return isOrgOrAdmin(actor, campaign)
}

// --- Praia: gestão reservada a admin e organizador ---

export function beachItemActions(actor, beach) {
  const actions = { self: true }
  if (!actor || !beach) return actions

  if (actor.isAdmin || actor.isOrganizer) {
    actions.update = true
    actions.delete = true
  }

  return actions
}

export function beachCollectionCreateAllowed(actor) {
  return actor && (actor.isAdmin || actor.isOrganizer)
}

// --- Catálogo de resíduos: itens (admin/organizador) e categorias (só admin) ---

export function wasteItemActions(actor) {
  const actions = { self: true }
  if (actor && (actor.isAdmin || actor.isOrganizer)) {
    actions.update = true
    actions.delete = true
  }
  return actions
}

export function wasteItemCollectionCreateAllowed(actor) {
  return actor && (actor.isAdmin || actor.isOrganizer)
}

export function wasteCategoryActions(actor) {
  const actions = { self: true }
  if (actor?.isAdmin) {
    actions.update = true
    actions.delete = true
  }
  return actions
}

export function wasteCategoryCollectionCreateAllowed(actor) {
  return Boolean(actor?.isAdmin)
}

// --- Utilizador (admin) ---

export function adminUserItemActions() {
  return { self: true, update: true }
}
