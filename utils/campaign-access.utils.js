import { Op } from "sequelize"
import { Campaign, Registration, User } from "../models/db.config.js"
import { createError, isUuidParam, notFoundError } from "./error.utils.js"

// Garante que o utilizador pode ver dados de participantes da campanha (organizador, admin ou inscrito).
export async function assertCanAccessCampaignParticipantData(actorUserId, campaignId) {
  if (!isUuidParam(campaignId) || !isUuidParam(actorUserId)) {
    throw createError(403, "Forbidden")
  }

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId"]
  })
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  if (campaign.organizerId === actorUserId) {
    return campaign
  }

  const user = await User.findByPk(actorUserId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return campaign
  }

  const reg = await Registration.findOne({
    where: { campaignId, userId: actorUserId, status: { [Op.in]: [0, 1] } },
    attributes: ["id"]
  })
  if (reg) {
    return campaign
  }

  throw createError(403, "Forbidden")
}

// Garante que o utilizador pode ver dados de resíduos da campanha (organizador, admin ou participante confirmado).
export async function assertCanAccessCampaignWasteData(actorUserId, campaignId) {
  if (!isUuidParam(campaignId) || !isUuidParam(actorUserId)) {
    throw createError(403, "Forbidden")
  }

  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId"]
  })
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  if (campaign.organizerId === actorUserId) {
    return campaign
  }

  const user = await User.findByPk(actorUserId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return campaign
  }

  const reg = await Registration.findOne({
    where: { campaignId, userId: actorUserId, status: 1 },
    attributes: ["id"]
  })
  if (reg) {
    return campaign
  }

  throw createError(403, "Forbidden")
}

// Verifica se o utilizador é organizador, administrador ou participante confirmado da campanha.
export async function isCampaignParticipantOrManager(actorUserId, campaign) {
  if (campaign.organizerId === actorUserId) {
    return true
  }
  const user = await User.findByPk(actorUserId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return true
  }
  const reg = await Registration.findOne({
    where: { campaignId: campaign.id, userId: actorUserId, status: 1 },
    attributes: ["id"]
  })
  return Boolean(reg)
}
