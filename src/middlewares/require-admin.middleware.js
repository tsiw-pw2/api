import { User } from "../models/index.js"
import { ApiError } from "../utils/api-error.js"

/**
 * @type {import("express").RequestHandler}
 */
export async function requireAdmin(req, res, next) {
  try {
    const user = await User.findByPk(req.auth.userId, {
      attributes: ["isAdmin"]
    })
    if (!user?.isAdmin) {
      throw ApiError.forbidden()
    }
    next()
  } catch (e) {
    next(e)
  }
}
