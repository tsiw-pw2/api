import crypto from "node:crypto"

export const REFRESH_COOKIE_NAME = "refresh_token"

/**
 * @param {string} rawToken
 */
export function hashRefreshToken(rawToken) {
  const secret = process.env.REFRESH_TOKEN_SECRET
  if (!secret) {
    throw new Error("REFRESH_TOKEN_SECRET is not configured")
  }
  return crypto.createHmac("sha256", secret).update(rawToken).digest("hex")
}

export function generateOpaqueRefreshToken() {
  return crypto.randomBytes(32).toString("base64url")
}
