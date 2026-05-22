import * as wasteCollectionsService from "../services/waste-collections.service.js"
import { parsePaginationQuery } from "../../../utils/pagination-query.js"
import { isUuidParam } from "../../../utils/uuid-param.js"
import { ApiError } from "../../../utils/api-error.js"

/**
 * @type {import("express").RequestHandler}
 */
export async function listByCampaign(req, res, next) {
  try {
    const campaignId = req.params.campaignId
    if (!isUuidParam(campaignId)) {
      throw ApiError.badRequest("Invalid id")
    }
    const pagination = parsePaginationQuery(req.query ?? {})
    const beachIdRaw = req.query?.beachId
    const beachId =
      typeof beachIdRaw === "string" && beachIdRaw.trim().length > 0
        ? beachIdRaw.trim()
        : undefined
    const data = await wasteCollectionsService.listWasteCollectionsForCampaign(
      campaignId,
      pagination,
      beachId
    )
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function createForCampaign(req, res, next) {
  try {
    const campaignId = req.params.campaignId
    if (!isUuidParam(campaignId)) {
      throw ApiError.badRequest("Invalid id")
    }
    const data = await wasteCollectionsService.createWasteCollection(
      campaignId,
      req.auth.userId,
      req.body ?? {}
    )
    res.status(201).json({ success: true, data })
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
    const data = await wasteCollectionsService.updateWasteCollection(
      id,
      req.auth.userId,
      req.body ?? {}
    )
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
    await wasteCollectionsService.deleteWasteCollection(id, req.auth.userId)
    res.json({ success: true, data: null })
  } catch (e) {
    next(e)
  }
}
