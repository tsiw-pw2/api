import { Comment, Campaign, Registration, User } from "../models/db.config.js"
import { createError, passControllerError, notFoundError, validationError, isUuidParam } from "../utils/error.utils.js"
import { assertCanAccessCampaignParticipantData } from "../utils/domain.utils.js"
import { CAMPAIGNS_BASE, paginatedList, parsePaginationQuery, withResourceLinks } from "../utils/response.utils.js"
import { commentCollectionCreateAllowed, commentItemActions, loadActorContext } from "../utils/hypermedia.permissions.js"

// Limite alinhado com coluna corpo em comentario (textos de erro da API em inglês).
const MAX_COMMENT_LENGTH = 8000

// Mapear registo Sequelize (comentario + autor) para o formato JSON da API.
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

// Verificar se o visitante pode publicar comentários (organizador, admin ou inscrito activo).
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
  // Inscrição activa obrigatória; cancelados (estado 2) não podem comentar.
  if (!reg || reg.status === 2) {
    throw createError(403, "Forbidden")
  }
  return campaign
}

// Listar comentários visíveis para participantes; admin vê também os ocultos (moderação).
async function listCommentsForCampaign(campaignId, actorId, pagination) {
  await assertCanAccessCampaignParticipantData(actorId, campaignId)

  const user = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  const where = { campaignId }
  // Participantes vêem só comentários visíveis; admin vê também os ocultos (moderação).
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

// Criar comentário na campanha; is_visible=true por defeito (moderação posterior via PATCH).
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

// Actualizar visibilidade (organizador ou admin); autor não edita texto por este rota.
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

// Eliminar comentário (eliminação lógica; autor, organizador ou admin).
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
  // Autor, organizador da campanha ou admin podem eliminar.
  const isAuthor = comment.userId === actorId
  const isOrg = campaign.organizerId === actorId
  if (!isAuthor && !isOrg && !actor?.isAdmin) {
    throw createError(403, "Forbidden")
  }
  await comment.destroy()
}

// Confirmar que o comentário pertence à campanha indicada no URL (sub-recurso aninhado).
async function assertCommentInCampaign(campaignId, commentId) {
  if (!isUuidParam(campaignId) || !isUuidParam(commentId)) {
    throw validationError({ id: ["Invalid id"] })
  }
  const row = await Comment.findByPk(commentId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Comment", commentId)
  }
}

/**
 * Listar comentários de uma campanha.
 * Método: GET
 * Rota: /campaigns/:id/comments
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Voluntário inscrito vê comentários visíveis; organizador/admin vê todos.
 * - ligações de criação (create) só se o utilizador autenticado pode publicar comentários.
 *
 * Notas técnicas:
 * - eliminação lógica em comentario; is_visible para moderação.
 */
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
    // Hipermedia: ligação create só se o utilizador autenticado pode publicar (inscrição activa, organizador ou admin).
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

/**
 * Publicar comentário numa campanha.
 * Método: POST
 * Rota: /campaigns/:id/comments
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Exigir inscrição activa (não cancelada) ou papel organizador/admin.
 * - Comentário visível por defeito (is_visible=true).
 *
 * Notas técnicas:
 * - Corpo JSON com campo body (texto do comentário).
 */
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

/**
 * Moderar visibilidade de comentário.
 * Método: PATCH
 * Rota: /campaigns/:id/comments/:commentId
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Organizador da campanha ou admin alteram isVisible (ocultar/mostrar).
 *
 * Notas técnicas:
 * - Autor do comentário não usa este rota para editar texto (apenas DELETE próprio).
 */
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

/**
 * Eliminar comentário (eliminação lógica).
 * Método: DELETE
 * Rota: /campaigns/:id/comments/:commentId
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Autor pode remover o próprio comentário; organizador/admin podem remover qualquer um.
 *
 * Notas técnicas:
 * - Resposta 204; destroy() com eliminação lógica.
 */
export const deleteCommentHandler = async (req, res, next) => {
  try {
    await assertCommentInCampaign(req.params.id, req.params.commentId)
    await deleteComment(req.params.id, req.params.commentId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting comment")
  }
}
