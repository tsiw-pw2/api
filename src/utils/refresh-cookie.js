import { REFRESH_COOKIE_NAME } from "./refresh-token-crypto.js"

/**
 * @param {import("express").Response} res
 * @param {string} rawToken
 */
export function setRefreshCookie(res, rawToken) {
  const secure = process.env.NODE_ENV === "production"
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  })
}

/**
 * @param {import("express").Response} res
 */
export function clearRefreshCookie(res) {
  const secure = process.env.NODE_ENV === "production"
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/"
  })
}
