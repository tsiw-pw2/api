import jwt from "jsonwebtoken"

/**
 * @param {{ userId: string, tokenVersion: number }} payload
 */
export function signAccessToken(payload) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not configured")
  }
  return jwt.sign(
    {
      userId: payload.userId,
      tokenVersion: payload.tokenVersion
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "15m"
    }
  )
}

/**
 * @param {string} token
 */
export function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not configured")
  }
  return jwt.verify(token, secret, { algorithms: ["HS256"] })
}
