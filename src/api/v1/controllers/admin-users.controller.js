import * as adminUsersService from "../services/admin-users.service.js"
import { ApiError } from "../../../utils/api-error.js"
import { parsePaginationQuery } from "../../../utils/pagination-query.js"

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @type {import("express").RequestHandler}
 */
export async function list(req, res, next) {
  try {
    const pagination = parsePaginationQuery(req.query ?? {})
    let role = null
    const roleRaw = req.query?.role
    if (typeof roleRaw === "string" && roleRaw.trim().toLowerCase() === "volunteer") {
      role = "volunteer"
    }
    const data = await adminUsersService.listUsersForAdmin(pagination, { role })
    res.json({
      success: true,
      data
    })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function block(req, res, next) {
  try {
    const id = req.params.id
    if (!id || !uuidRe.test(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    const reason = req.body?.reason
    if (typeof reason !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid request"
      })
      return
    }
    const data = await adminUsersService.blockUserAsAdmin(req.auth.userId, id, reason)
    res.json({
      success: true,
      data
    })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function unblock(req, res, next) {
  try {
    const id = req.params.id
    if (!id || !uuidRe.test(id)) {
      throw ApiError.badRequest("Invalid id")
    }
    const data = await adminUsersService.unblockUserAsAdmin(req.auth.userId, id)
    res.json({
      success: true,
      data
    })
  } catch (e) {
    next(e)
  }
}
