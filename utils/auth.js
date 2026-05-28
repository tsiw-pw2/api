import crypto from "crypto"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { Op } from "sequelize"
import { sequelize, RefreshToken, User } from "../models/db.config.js"
import { createError, validationError } from "./error.utils.js"
import { roleFromUser } from "../middlewares/auth.middleware.js"
import { SESSIONS_BASE, USERS_BASE, withResourceLinks } from "./hateoas.utils.js"

export const REFRESH_COOKIE_NAME = "refresh_token"
export const SESSION_CURRENT_PATH = `${SESSIONS_BASE}/current`

const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function refreshTokenPepper() {
  const secret = process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw createError(500, "Internal server error")
  }
  return secret
}

export function hashRefreshToken(raw) {
  return crypto.createHmac("sha256", refreshTokenPepper()).update(raw).digest("hex")
}

function readRefreshCookie(req) {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(";")) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const name = trimmed.slice(0, eq)
    if (name !== REFRESH_COOKIE_NAME) continue
    const value = trimmed.slice(eq + 1)
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return null
}

function isCookieSecure() {
  if (process.env.COOKIE_SECURE === "1") return true
  if (process.env.COOKIE_SECURE === "0") return false
  const clientUrl = process.env.CLIENT_URL || ""
  return clientUrl.startsWith("https://")
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(REFRESH_MAX_AGE_MS / 1000)
  }
}

function setRefreshCookie(res, rawToken) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, refreshCookieOptions())
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "strict",
    path: "/"
  })
}

export function signAccessToken(user) {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw createError(500, "Internal server error")
  }
  const expiresIn = process.env.JWT_EXPIRES_IN?.trim() || "15m"
  return jwt.sign(
    {
      sub: user.id,
      role: roleFromUser(user),
      tokenVersion: Number(user.tokenVersion ?? 0)
    },
    secret,
    { algorithm: "HS256", expiresIn }
  )
}

export async function revokeUserRefreshTokens(userId) {
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } }
  )
}

export async function bumpUserTokenVersion(user) {
  user.tokenVersion = Number(user.tokenVersion ?? 0) + 1
  await user.save({ fields: ["tokenVersion", "updatedAt"] })
  await revokeUserRefreshTokens(user.id)
}

async function createRefreshTokenRecord(userId) {
  const raw = crypto.randomBytes(32).toString("base64url")
  const hash = hashRefreshToken(raw)
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_MS)
  const now = new Date()
  await RefreshToken.create({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hash,
    expiresAt,
    createdAt: now
  })
  return raw
}

export async function attachAuthSession(res, user) {
  await revokeUserRefreshTokens(user.id)
  const rawToken = await createRefreshTokenRecord(user.id)
  setRefreshCookie(res, rawToken)
}

export async function rotateAuthSession(req, res) {
  const raw = readRefreshCookie(req)
  if (!raw) {
    throw createError(401, "Invalid credentials")
  }
  const hash = hashRefreshToken(raw)
  const row = await RefreshToken.findOne({
    where: {
      tokenHash: hash,
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() }
    }
  })
  if (!row) {
    throw createError(401, "Invalid credentials")
  }
  const user = await User.findByPk(row.userId)
  if (!user) {
    throw createError(401, "Invalid credentials")
  }
  if (user.isBlocked) {
    throw createError(403, "Account blocked")
  }
  await row.update({ revokedAt: new Date() })
  const newRaw = await createRefreshTokenRecord(user.id)
  setRefreshCookie(res, newRaw)
  return signAccessToken(user)
}

export async function clearAuthSession(req, res) {
  const raw = readRefreshCookie(req)
  if (raw) {
    const hash = hashRefreshToken(raw)
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { tokenHash: hash, revokedAt: null } }
    )
  }
  clearRefreshCookie(res)
}

export function publicUserDto(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: roleFromUser(user)
  }
}

export function sessionResourceLinks(extra = {}) {
  return {
    self: { href: SESSION_CURRENT_PATH, method: "GET" },
    refresh: { href: SESSION_CURRENT_PATH, method: "PATCH" },
    delete: { href: SESSION_CURRENT_PATH, method: "DELETE" },
    ...extra
  }
}

export function buildSessionResource(token, user, extraLinks = {}) {
  const userResource = withResourceLinks(USERS_BASE, publicUserDto(user), {
    updateMethod: "PATCH"
  })
  return {
    id: "current",
    token,
    user: userResource,
    links: sessionResourceLinks({
      user: { href: `${USERS_BASE}/${user.id}`, method: "GET" },
      ...extraLinks
    })
  }
}

export function buildSessionTokenResource(token) {
  return {
    id: "current",
    token,
    links: sessionResourceLinks()
  }
}

export function parseSessionCredentials(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  if (!email || !password) {
    throw validationError({ credentials: ["Invalid credentials"] })
  }
  return { email, password }
}

export async function authenticateUser(email, password) {
  const user = await User.findOne({
    where: sequelize.where(sequelize.fn("LOWER", sequelize.col("email")), email)
  })

  let valid = false
  if (user?.passwordHash) {
    valid = await bcrypt.compare(password, user.passwordHash)
  }

  if (!valid || !user) {
    throw createError(401, "Invalid credentials")
  }

  if (user.isBlocked) {
    const reason =
      typeof user.blockedReason === "string" && user.blockedReason.trim().length > 0
        ? user.blockedReason.trim()
        : "Account blocked"
    throw createError(403, reason)
  }

  return user
}

export async function findActiveUserById(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["passwordHash"] }
  })
  if (!user) {
    throw createError(401, "Unauthorized")
  }
  if (user.isBlocked) {
    throw createError(403, "Account blocked")
  }
  return user
}
