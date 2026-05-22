import * as commentsService from "../services/comments.service.js"
import { parsePaginationQuery } from "../../../utils/pagination-query.js"
import { isUuidParam } from "../../../utils/uuid-param.js"
import { ApiError } from "../../../utils/api-error.js"

export async function listByCampaign(req, res, next) {
  try {
    const campaignId = req.params.campaignId
    if (!isUuidParam(campaignId)) {
      throw ApiError.badRequest("Invalid id")
    }
    const pagination = parsePaginationQuery(req.query ?? {})
    const data = await commentsService.listCampaignComments(
      campaignId,
      req.auth.userId,
      pagination
    )
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

export async function createForCampaign(req, res, next) {
  try {
    const campaignId = req.params.campaignId
    if (!isUuidParam(campaignId)) {
      throw ApiError.badRequest("Invalid id")
    }
    const data = await commentsService.createCampaignComment(
      campaignId,
      req.auth.userId,
      req.body ?? {}
    )
    res.status(201).json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

export async function updateVisibility(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid request")
    }
    const data = await commentsService.updateCommentVisibility(
      id,
      req.auth.userId,
      req.body ?? {}
    )
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

export async function remove(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid request")
    }
    await commentsService.deleteComment(id, req.auth.userId)
    res.json({ success: true, data: null })
  } catch (e) {
    next(e)
  }
}
