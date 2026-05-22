import { User } from "../models/index.js"
import { ApiError } from "../utils/api-error.js"
import { verifyAccessToken } from "../utils/access-token.js"

/**
 * @type {import("express").RequestHandler}
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith("Bearer ")) {
      throw ApiError.unauthorized()
    }
    const token = header.slice(7).trim()
    if (!token) {
      throw ApiError.unauthorized()
    }

    let decoded
    try {
      decoded = verifyAccessToken(token)
    } catch {
      throw ApiError.unauthorized()
    }

    const user = await User.findByPk(decoded.userId, {
      attributes: ["id", "tokenVersion", "isBlocked"]
    })

    if (!user?.id || user.isBlocked) {
      throw ApiError.unauthorized()
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      throw ApiError.unauthorized()
    }

    req.auth = { userId: user.id, tokenVersion: user.tokenVersion }
    next()
  } catch (e) {
    next(e)
  }
}
