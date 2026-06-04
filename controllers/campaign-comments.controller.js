import { Comment, Campaign, Registration, User } from "../models/db.config.js"
import { createError, passControllerError, notFoundError, validationError, isUuidParam } from "../utils/error.utils.js"
import { assertCanAccessCampaignParticipantData } from "../utils/domain.utils.js"
import {
  CAMPAIGNS_BASE,
  paginatedList,
  parsePaginationQuery,
  withResourceLinks
} from "../utils/response.utils.js"
import {
  commentCollectionCreateAllowed,
  commentItemActions,
  loadActorContext
} from "../utils/hypermedia.permissions.js"

const MAX_COMMENT_LENGTH = 8000

// Mapear comentário para DTO da API
function toCommentDto(row) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    isVisible: row.isVisible,
    user: row.user
      ? { id: row.user.id, name: row.user.name }
      : null
  }
}

// Verificar se o visitante pode publicar comentários
async function assertCanPostComment(campaignId, userId) {
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign", campaignId)
  }
  const user = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (campaign.organizerId === userId || user?.isAdmin) {
    return campaign
  }
  const reg = await Registration.findOne({
    where: { campaignId, userId },
    attributes: ["status"]
  })
  if (!reg || reg.status === 2) {
    throw createError(403, "Forbidden")
  }
  return campaign
}

// Listar comentários visíveis para participantes; admin vê todos
async function listCommentsForCampaign(campaignId, actorId, pagination) {
  await assertCanAccessCampaignParticipantData(actorId, campaignId)

  const user = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  const where = { campaignId }
  if (!user?.isAdmin) {
    where.isVisible = true
  }

  const { offset, limit, page, pageSize } = pagination
  const total = await Comment.count({ where })
  const rows = await Comment.findAll({
    where,
    include: [{ model: User, as: "user", attributes: ["id", "name"] }],
    order: [["createdAt", "DESC"]],
    limit,
    offset
  })

  return {
    items: rows.map(toCommentDto),
    total,
    page,
    pageSize
  }
}

// Criar comentário na campanha
async function createComment(campaignId, userId, bodyText) {
  await assertCanPostComment(campaignId, userId)
  const text = typeof bodyText === "string" ? bodyText.trim() : ""
  if (!text || text.length > MAX_COMMENT_LENGTH) {
    throw validationError({ body: ["Invalid comment body"] })
  }
  const now = new Date()
  const row = await Comment.create({
    campaignId,
    userId,
    body: text,
    isVisible: true,
    createdAt: now,
    updatedAt: now
  })
  const full = await Comment.findByPk(row.id, {
    include: [{ model: User, as: "user", attributes: ["id", "name"] }]
  })
  return toCommentDto(full)
}

// Actualizar visibilidade (organizador ou admin)
async function updateCommentVisibility(campaignId, commentId, actorId, body) {
  if (!isUuidParam(commentId)) {
    throw validationError({ id: ["Invalid comment id"] })
  }
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign", campaignId)
  }
  const actor = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  if (campaign.organizerId !== actorId && !actor?.isAdmin) {
    throw createError(403, "Forbidden")
  }
  const comment = await Comment.findByPk(commentId)
  if (!comment || comment.campaignId !== campaignId) {
    throw notFoundError("Comment", commentId)
  }
  if (typeof body?.isVisible !== "boolean") {
    throw validationError({ isVisible: ["isVisible must be a boolean"] })
  }
  comment.isVisible = body.isVisible
  comment.updatedAt = new Date()
  await comment.save()
  const full = await Comment.findByPk(comment.id, {
    include: [{ model: User, as: "user", attributes: ["id", "name"] }]
  })
  return toCommentDto(full)
}

// Eliminar comentário (autor, organizador ou admin)
async function deleteComment(campaignId, commentId, actorId) {
  if (!isUuidParam(commentId)) {
    throw validationError({ id: ["Invalid comment id"] })
  }
  const comment = await Comment.findByPk(commentId)
  if (!comment || comment.campaignId !== campaignId) {
    throw notFoundError("Comment", commentId)
  }
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign", campaignId)
  }
  const actor = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  const isAuthor = comment.userId === actorId
  const isOrg = campaign.organizerId === actorId
  if (!isAuthor && !isOrg && !actor?.isAdmin) {
    throw createError(403, "Forbidden")
  }
  await comment.destroy()
}

async function assertCommentInCampaign(campaignId, commentId) {
  if (!isUuidParam(campaignId) || !isUuidParam(commentId)) {
    throw validationError({ id: ["Invalid id"] })
  }
  const row = await Comment.findByPk(commentId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Comment", commentId)
  }
}

export const getAllComments = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    const base = `${CAMPAIGNS_BASE}/${campaignId}/comments`
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign", campaignId))
    }
    const data = await listCommentsForCampaign(
      campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {})
    )
    const includeCreate = await commentCollectionCreateAllowed(actor, campaignId)
    res.json(
      paginatedList(base, data, {
        query: req.query,
        includeCreate,
        mapItem: (item) =>
          withResourceLinks(base, item, {
            actions: commentItemActions(actor, { ...item, userId: item.user?.id }, campaign)
          })
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching comments")
  }
}

export const createCommentHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    const base = `${CAMPAIGNS_BASE}/${campaignId}/comments`
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign", campaignId))
    }
    const data = await createComment(campaignId, req.user.sub, req.body?.body)
    const response = withResourceLinks(base, data, {
      actions: commentItemActions(actor, { ...data, userId: req.user.sub }, campaign)
    })
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating comment")
  }
}

export const updateCommentHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    await assertCommentInCampaign(campaignId, req.params.commentId)
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign", campaignId))
    }
    const data = await updateCommentVisibility(
      campaignId,
      req.params.commentId,
      req.user.sub,
      req.body ?? {}
    )
    const commentRow = await Comment.findByPk(req.params.commentId, {
      attributes: ["userId"]
    })
    res.json(
      withResourceLinks(`${CAMPAIGNS_BASE}/${campaignId}/comments`, data, {
        actions: commentItemActions(
          actor,
          { ...data, userId: commentRow?.userId },
          campaign
        )
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error updating comment")
  }
}

export const deleteCommentHandler = async (req, res, next) => {
  try {
    await assertCommentInCampaign(req.params.id, req.params.commentId)
    await deleteComment(req.params.id, req.params.commentId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting comment")
  }
}
