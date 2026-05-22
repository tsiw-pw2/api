import * as registrationsService from "../services/registrations.service.js"
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
    const data = await registrationsService.listRegistrationsForCampaign(
      campaignId,
      pagination
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
    const data = await registrationsService.createSelfRegistration(
      campaignId,
      req.auth.userId
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
      throw ApiError.badRequest("Invalid request")
    }
    const data = await registrationsService.updateRegistration(
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
      throw ApiError.badRequest("Invalid request")
    }
    await registrationsService.deleteRegistration(id, req.auth.userId)
    res.json({ success: true, data: null })
  } catch (e) {
    next(e)
  }
}
