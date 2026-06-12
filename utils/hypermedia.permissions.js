// Permissões hipermedia: decidir quais links (create, update, delete, sub-recursos) incluir pelo utilizador autenticado e contexto.
import { Op } from "sequelize"
import { Campaign, Registration, User, UserOrganization } from "../models/db.config.js"
import { roleFromUser, roleHasCapability } from "../middlewares/auth.middlewares.js"
import { createError } from "./error.utils.js"
import { assertCanAccessCampaignParticipantData, assertCanAccessCampaignWasteData, isCampaignOpenForSelfEnrollment, isCampaignTerminalForOperations, isEligibleForCampaignEnrollment } from "./domain.utils.js"

const actorContextCache = new Map()

// Carregar indicadores do utilizador autenticado (memória intermédia por id na mesma invocação).
export async function loadActorContext(actorId) {
  if (!actorId) return null
  if (actorContextCache.has(actorId)) {
    return actorContextCache.get(actorId)
  }
  const user = await User.findByPk(actorId, {
    attributes: ["id", "isOrganizer", "isBlocked", "isRoot"]
  })
  const membershipRows = await UserOrganization.findAll({
    where: { userId: actorId, isOrgAdmin: true },
    attributes: ["organizationId"]
  })
  const role = roleFromUser(user)
  const ctx = {
    actorId,
    role,
    isRoot: Boolean(user?.isRoot),
    isOrganizer: Boolean(user?.isOrganizer),
    isBlocked: Boolean(user?.isBlocked),
    orgAdminOrgIds: new Set(membershipRows.map((row) => row.organizationId))
  }
  actorContextCache.set(actorId, ctx)
  return ctx
}

export function clearActorContextCache() {
  actorContextCache.clear()
}

function canManageCampaign(actor, campaign) {
  if (!actor || !campaign || actor.isRoot) return false
  if (campaign.organizerId === actor.actorId) return true
  if (campaign.organizationId && actor.orgAdminOrgIds?.has(campaign.organizationId)) {
    return true
  }
  return false
}

// --- Campanha: acções no item e sub-recursos (inscrições, comentários, recolhas) ---

export function campaignItemActions(actor, campaign) {
  const actions = { self: true }
  if (canManageCampaign(actor, campaign)) {
    actions.update = true
    actions.delete = true
  }
  return actions
}

export async function campaignSubresourceActions(actor, campaignId) {
  const extra = {}
  if (!actor?.actorId || !campaignId) return extra

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId", "organizationId"]
  })
  if (!campaign) return extra

  if (canManageCampaign(actor, campaign)) {
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
  return actor && roleHasCapability(actor.role, "manageCampaigns")
}

// --- Inscrição: acções no item e regras de auto-inscrição (POST /registrations) ---

export function registrationItemActions(actor, registration, campaign) {
  const actions = { self: true }
  if (!actor || !registration || !campaign) return actions

  if (isCampaignTerminalForOperations(campaign.status)) {
    return actions
  }

  const isSelf = registration.userId === actor.actorId
  const manager = canManageCampaign(actor, campaign)

  if (manager) {
    actions.update = true
    return actions
  }

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
  if (actor.isRoot) {
    return { allowed: false, reason: REGISTRATION_ENROLL_BLOCK_REASONS.NOT_ALLOWED }
  }

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

  if (canManageCampaign(actor, campaign)) {
    actions.update = true
  }

  const isAuthor = comment.userId === actor.actorId
  if (isAuthor || canManageCampaign(actor, campaign)) {
    actions.delete = true
  }

  return actions
}

export async function commentCollectionCreateAllowed(actor, campaignId) {
  if (!actor?.actorId || !campaignId) return false

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId", "organizationId"]
  })
  if (!campaign) return false

  if (canManageCampaign(actor, campaign)) return true

  const reg = await Registration.findOne({
    where: { campaignId, userId: actor.actorId, status: { [Op.ne]: 2 } },
    attributes: ["id"]
  })
  return Boolean(reg)
}

// --- Recolha de resíduos ---

export function wasteCollectionItemActions(actor, collection, campaign) {
  const actions = { self: true }
  if (!actor || !collection || !campaign) return actions

  if (isCampaignTerminalForOperations(campaign.status)) {
    return actions
  }

  if (canManageCampaign(actor, campaign)) {
    actions.update = true
    actions.delete = true
  }

  return actions
}

export async function wasteCollectionCollectionCreateAllowed(actor, campaignId) {
  if (!actor?.actorId || !campaignId) return false

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId", "organizationId", "status"]
  })
  if (!campaign) return false

  if (isCampaignTerminalForOperations(campaign.status)) {
    return false
  }

  return canManageCampaign(actor, campaign)
}

// --- Praia: gestão reservada a staff municipal ---

export function beachItemActions(actor, beach) {
  const actions = { self: true }
  if (!actor || !beach) return actions
  if (actor.isRoot) return actions

  if (actor.isOrganizer) {
    actions.update = true
    actions.delete = true
  }

  return actions
}

export function beachCollectionCreateAllowed(actor) {
  if (actor?.isRoot) return false
  return Boolean(actor?.isOrganizer)
}

// --- Catálogo de resíduos: itens (staff municipal) e categorias (só root) ---

export function wasteItemActions(actor) {
  const actions = { self: true }
  if (actor?.isRoot) return actions
  if (actor?.isOrganizer) {
    actions.update = true
    actions.delete = true
  }
  return actions
}

export function wasteItemCollectionCreateAllowed(actor) {
  if (actor?.isRoot) return false
  return Boolean(actor?.isOrganizer)
}

export function wasteCategoryActions(actor) {
  const actions = { self: true }
  if (actor?.isRoot) return actions
  if (actor?.orgAdminOrgIds?.size > 0) {
    actions.update = true
    actions.delete = true
  }
  return actions
}

export function wasteCategoryCollectionCreateAllowed(actor) {
  if (actor?.isRoot) return false
  return Boolean(actor?.orgAdminOrgIds?.size > 0)
}

// --- Equipa da organização (admin org) ---

export function orgMemberItemActions() {
  return { self: true, update: true, delete: true }
}
