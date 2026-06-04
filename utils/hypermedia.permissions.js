import { Op } from "sequelize"
import { Campaign, Registration, User } from "../models/db.config.js"
import { roleHasCapability } from "../middlewares/auth.middlewares.js"
import {
  assertCanAccessCampaignParticipantData,
  assertCanAccessCampaignWasteData
} from "./domain.utils.js"

const ENROLLABLE_CAMPAIGN_STATUSES = new Set([1, 2, 3])

const actorContextCache = new Map()

// Carregar flags do actor (cache por id na mesma invocação).
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

// --- Campanha ---

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

// --- Inscrição ---

export function registrationItemActions(actor, registration, campaign) {
  const actions = { self: true }
  if (!actor || !registration || !campaign) return actions

  const isSelf = registration.userId === actor.actorId
  const orgAdmin = isOrgOrAdmin(actor, campaign)

  if (orgAdmin) {
    actions.update = true
    actions.delete = true
    return actions
  }

  if (isSelf) {
    if (registration.status !== 2) {
      actions.update = true
    }
    actions.delete = true
  }

  return actions
}

export async function registrationCollectionCreateAllowed(actor, campaignId) {
  if (!actor?.actorId || !campaignId) return false

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "status", "organizerId"]
  })
  if (!campaign) return false

  if (isOrgOrAdmin(actor, campaign)) return false

  const dbStatus = Number(campaign.status)
  if (!ENROLLABLE_CAMPAIGN_STATUSES.has(dbStatus)) return false
  if (actor.isBlocked) return false

  const existing = await Registration.findOne({
    where: { campaignId, userId: actor.actorId },
    attributes: ["status"]
  })
  if (existing && existing.status !== 2) return false

  return true
}

export function viewerRegistrationActions(actor, registration, campaign) {
  if (!registration) return { self: false }
  return registrationItemActions(
    actor,
    { ...registration, userId: actor?.actorId },
    campaign
  )
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

// --- Recolha de resíduos ---

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

  if (isOrgOrAdmin(actor, campaign)) return true

  const reg = await Registration.findOne({
    where: { campaignId, userId: actor.actorId, status: 1 },
    attributes: ["id"]
  })
  return Boolean(reg)
}

// --- Praia ---

export function beachItemActions(actor, beach) {
  const actions = { self: true }
  if (!actor || !beach) return actions

  if (beach.createdByUserId === actor.actorId || actor.isAdmin) {
    actions.update = true
    actions.delete = true
  }

  return actions
}

export function beachCollectionCreateAllowed(actor) {
  return actor && (actor.isAdmin || actor.isOrganizer)
}

// --- Catálogo de resíduos ---

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
