import { Campaign, Comment, Registration, User } from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"
import { isUuidParam } from "../../../utils/uuid-param.js"
import { Op } from "sequelize"

async function assertOrganizerOrAdminForCampaign(userId, campaign) {
  if (campaign.organizerId === userId) {
    return
  }
  const user = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return
  }
  throw ApiError.forbidden()
}

async function assertAdmin(userId) {
  const user = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (!user?.isAdmin) {
    throw ApiError.forbidden()
  }
}

function mapCommentRow(c, isAdminViewer) {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    user: c.user ? { id: c.user.id, name: c.user.name } : null,
    ...(isAdminViewer ? { isVisible: Boolean(c.isVisible) } : {})
  }
}

export async function listCampaignComments(campaignId, viewerUserId, pagination) {
  if (!isUuidParam(campaignId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw ApiError.notFound()
  }

  const viewer =
    typeof viewerUserId === "string" && isUuidParam(viewerUserId)
      ? await User.findByPk(viewerUserId, { attributes: ["isAdmin"] })
      : null
  const isAdminViewer = Boolean(viewer?.isAdmin)

  const { offset, limit, page, pageSize } = pagination
  const where = isAdminViewer
    ? { campaignId }
    : { campaignId, isVisible: true }

  const total = await Comment.count({ where })
  const rows = await Comment.findAll({
    where,
    include: [{ model: User, as: "user", attributes: ["id", "name"] }],
    order: [["createdAt", "DESC"]],
    limit,
    offset
  })

  return {
    items: rows.map((c) => mapCommentRow(c, isAdminViewer)),
    total,
    page,
    pageSize
  }
}

export async function createCampaignComment(campaignId, userId, body) {
  if (!isUuidParam(campaignId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const text = typeof body?.body === "string" ? body.body.trim() : ""
  if (text.length === 0 || text.length > 8000) {
    throw ApiError.badRequest("Invalid request")
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw ApiError.notFound()
  }

  const now = new Date()

  if (campaign.organizerId === userId) {
    await Comment.create({
      campaignId,
      userId,
      body: text,
      isVisible: true,
      createdAt: now,
      updatedAt: now
    })
    return { ok: true }
  }

  const requester = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (requester?.isAdmin) {
    await Comment.create({
      campaignId,
      userId,
      body: text,
      isVisible: true,
      createdAt: now,
      updatedAt: now
    })
    return { ok: true }
  }

  const registration = await Registration.findOne({
    where: {
      campaignId,
      userId,
      status: { [Op.ne]: 2 }
    }
  })

  if (!registration) {
    throw ApiError.forbidden()
  }

  await Comment.create({
    campaignId,
    userId,
    body: text,
    isVisible: true,
    createdAt: now,
    updatedAt: now
  })

  return { ok: true }
}

export async function updateCommentVisibility(commentId, requesterId, body) {
  if (!isUuidParam(commentId)) {
    throw ApiError.badRequest("Invalid id")
  }

  if (typeof body?.isVisible !== "boolean") {
    throw ApiError.badRequest("Invalid request")
  }

  const comment = await Comment.findByPk(commentId)

  if (!comment) {
    throw ApiError.notFound()
  }

  await assertAdmin(requesterId)

  comment.isVisible = body.isVisible
  await comment.save()

  return { ok: true }
}

export async function deleteComment(commentId, requesterId) {
  if (!isUuidParam(commentId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const comment = await Comment.findByPk(commentId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!comment) {
    throw ApiError.notFound()
  }

  const campaign = comment.campaign
  if (!campaign) {
    throw ApiError.notFound()
  }

  if (comment.userId === requesterId) {
    await comment.destroy()
    return
  }

  await assertOrganizerOrAdminForCampaign(requesterId, campaign)
  await comment.destroy()
}
