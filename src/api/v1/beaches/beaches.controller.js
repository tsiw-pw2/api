import { ApiError } from "../../../utils/api-error.js"
import { parsePaginationQuery } from "../../../utils/pagination-query.js"
import { isUuidParam } from "../../../utils/uuid-param.js"
import * as beachesService from "./beaches.service.js"

export async function list(req, res, next) {
	try {
		const pagination = parsePaginationQuery(req.query ?? {})
		const data = await beachesService.listBeaches(pagination)
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
		const data = await beachesService.getBeachById(id)
		res.json({ success: true, data })
	} catch (e) {
		next(e)
	}
}

export async function create(req, res, next) {
	try {
		const data = await beachesService.createBeach(req.auth.userId, req.body ?? {})
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
		const data = await beachesService.updateBeach(req.auth.userId, id, req.body ?? {})
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
		await beachesService.deleteBeach(req.auth.userId, id)
		res.json({ success: true, data: null })
	} catch (e) {
		next(e)
	}
}
