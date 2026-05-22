import * as campaignsService from "../services/campaigns.service.js"
import { ApiError } from "../../../utils/api-error.js"
import { parsePaginationQuery } from "../../../utils/pagination-query.js"
import { isUuidParam } from "../../../utils/uuid-param.js"

/**
 * @type {import("express").RequestHandler}
 */
export async function list(req, res, next) {
  try {
    const pagination = parsePaginationQuery(req.query ?? {})
    const data = await campaignsService.listCampaigns(pagination)
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function create(req, res, next) {
  try {
    const data = await campaignsService.createCampaign(req.auth.userId, req.body ?? {})
    res.status(201).json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function getById(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    const data = await campaignsService.getCampaignDetails(id, req.auth.userId)
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function update(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    const data = await campaignsService.updateCampaign(req.auth.userId, id, req.body ?? {})
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function remove(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    await campaignsService.deleteCampaign(req.auth.userId, id)
    res.json({ success: true, data: null })
  } catch (e) {
    next(e)
  }
}
