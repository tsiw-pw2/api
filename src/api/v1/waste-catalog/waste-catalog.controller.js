import { ApiError } from "../../../utils/api-error.js"
import { parsePaginationQuery } from "../../../utils/pagination-query.js"
import { isUuidParam } from "../../../utils/uuid-param.js"
import * as wasteCatalogService from "./waste-catalog.service.js"

export async function list(req, res, next) {
  try {
    const pagination = parsePaginationQuery(req.query ?? {})
    const data = await wasteCatalogService.listWasteItems(pagination)
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

export async function getById(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    const data = await wasteCatalogService.getWasteItemById(id)
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

export async function create(req, res, next) {
  try {
    const data = await wasteCatalogService.createWasteItem(req.body ?? {})
    res.status(201).json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

export async function update(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    const data = await wasteCatalogService.updateWasteItem(id, req.body ?? {})
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

export async function remove(req, res, next) {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    await wasteCatalogService.deleteWasteItem(id)
    res.json({ success: true, data: null })
  } catch (e) {
    next(e)
  }
}
