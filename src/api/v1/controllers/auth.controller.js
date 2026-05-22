import {
  clearRefreshCookie,
  setRefreshCookie
} from "../../../utils/refresh-cookie.js"
import { REFRESH_COOKIE_NAME } from "../../../utils/refresh-token-crypto.js"
import * as authService from "../services/auth.service.js"

/**
 * @type {import("express").RequestHandler}
 */
export async function login(req, res, next) {
  try {
    const email = req.body?.email
    const password = req.body?.password
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid request"
      })
      return
    }
    const result = await authService.loginWithEmailPassword(email, password)
    setRefreshCookie(res, result.refreshCookieValue)
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken
      }
    })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME]
    const result = await authService.refreshSession(raw)
    setRefreshCookie(res, result.refreshCookieValue)
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken
      }
    })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function logout(req, res, next) {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME]
  try {
    await authService.logoutSession(raw)
    clearRefreshCookie(res)
    res.json({
      success: true,
      data: null
    })
  } catch (e) {
    clearRefreshCookie(res)
    next(e)
  }
}
