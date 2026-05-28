import { Op } from "sequelize"
import { Campaign, Comment, Registration, User } from "../models/db.config.js"
import {
  createError,
  forwardControllerError,
  notFoundError,
  validationError,
  isUuidParam
} from "../utils/error.utils.js"
import {
  CAMPAIGNS_BASE,
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

async function assertCommentInCampaign(campaignId, commentId) {
  if (!isUuidParam(campaignId) || !isUuidParam(commentId)) {
    throw validationError(["Invalid id"])
  }
  const row = await Comment.findByPk(commentId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Comment")
  }
}

async function assertAdmin(userId) {
  const user = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (!user?.isAdmin) {
    throw createError(403, "Forbidden")
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
    throw validationError(["Invalid id"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const viewer =
    typeof viewerUserId === "string" && isUuidParam(viewerUserId)
      ? await User.findByPk(viewerUserId, { attributes: ["isAdmin"] })
      : null
  const isAdminViewer = Boolean(viewer?.isAdmin)

  const { offset, limit, page, pageSize } = pagination
// Para não-admins filtro comentários com isVisible=true
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

async function loadCreatedCommentDto(commentId, viewerUserId) {
  const full = await Comment.findByPk(commentId, {
    include: [{ model: User, as: "user", attributes: ["id", "name"] }]
  })
  if (!full) {
    throw notFoundError("Comment")
  }
  const viewer =
    typeof viewerUserId === "string" && isUuidParam(viewerUserId)
      ? await User.findByPk(viewerUserId, { attributes: ["isAdmin"] })
      : null
  return mapCommentRow(full, Boolean(viewer?.isAdmin))
}

export async function createCampaignComment(campaignId, userId, body) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const text = typeof body?.body === "string" ? body.body.trim() : ""
  if (text.length === 0 || text.length > 8000) {
    throw validationError(["Invalid request"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const now = new Date()

  if (campaign.organizerId !== userId) {
    const requester = await User.findByPk(userId, { attributes: ["isAdmin"] })
    if (!requester?.isAdmin) {
      const registration = await Registration.findOne({
        where: {
          campaignId,
          userId,
          status: { [Op.ne]: 2 }
        }
      })
      if (!registration) {
        throw createError(403, "Forbidden")
      }
    }
  }

  const row = await Comment.create({
    campaignId,
    userId,
    body: text,
    isVisible: true,
    createdAt: now,
    updatedAt: now
  })

  return loadCreatedCommentDto(row.id, userId)
}

export async function updateCommentVisibility(commentId, requesterId, body) {
  if (!isUuidParam(commentId)) {
    throw validationError(["Invalid id"])
  }

  if (typeof body?.isVisible !== "boolean") {
    throw validationError(["Invalid request"])
  }

  const comment = await Comment.findByPk(commentId)

  if (!comment) {
    throw notFoundError("Comment")
  }

  await assertAdmin(requesterId)

  // Restringo alteração de visibilidade ao admin; o organizador não modera comentários de terceiros
  comment.isVisible = body.isVisible
  await comment.save()

  return { ok: true }
}

export async function deleteComment(commentId, requesterId) {
  if (!isUuidParam(commentId)) {
    throw validationError(["Invalid id"])
  }

  const comment = await Comment.findByPk(commentId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!comment) {
    throw notFoundError("Comment")
  }

  const campaign = comment.campaign
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  if (comment.userId === requesterId) {
    await comment.destroy()
    return
  }

  await assertOrganizerOrAdminForCampaign(requesterId, campaign)
  await comment.destroy()
}

export const getAllComments = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/comments`
    const data = await listCampaignComments(
      req.params.campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {})
    )
    res.json(paginatedHateoas(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching comments")
  }
}

export const createCommentHandler = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/comments`
    const data = await createCampaignComment(req.params.campaignId, req.user.sub, req.body ?? {})
    const response = withResourceLinks(base, data, { updateMethod: "PATCH" })
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating comment")
  }
}

export const updateCommentHandler = async (req, res, next) => {
  try {
    await assertCommentInCampaign(req.params.campaignId, req.params.commentId)
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/comments`
    const data = await updateCommentVisibility(
      req.params.commentId,
      req.user.sub,
      req.body ?? {}
    )
    res.json(withResourceLinks(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating comment")
  }
}

export const deleteCommentHandler = async (req, res, next) => {
  try {
    await assertCommentInCampaign(req.params.campaignId, req.params.commentId)
    await deleteComment(req.params.commentId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting comment")
  }
}
