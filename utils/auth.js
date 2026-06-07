import crypto from "crypto"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { Op } from "sequelize"
import { sequelize, RefreshToken, User } from "../models/db.config.js"
import { createError, validationError } from "./error.utils.js"
import { roleFromUser } from "../middlewares/auth.middlewares.js"
import {
  SESSION_CURRENT_PATH,
  USERS_ME_PATH,
  withMeResourceLinks
} from "./response.utils.js"

export { SESSION_CURRENT_PATH } from "./response.utils.js"

export const REFRESH_COOKIE_NAME = "refresh_token"

const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function refreshTokenPepper() {
  const secret = process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw createError(500, "Internal server error")
  }
  return secret
}

// Persistir apenas o hash HMAC do refresh; o valor em claro fica só no cookie httpOnly.
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
  // Incluir tokenVersion para invalidar JWT após mudança de papel ou bloqueio.
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
  // Incrementar versão invalida todos os JWT e refresh tokens em circulação.
  user.tokenVersion = Number(user.tokenVersion ?? 0) + 1
  await user.save({ fields: ["tokenVersion", "updatedAt"] })
  await revokeUserRefreshTokens(user.id)
}

async function createRefreshTokenRecord(userId) {
  const raw = crypto.randomBytes(32).toString("base64url")
  // Gravar só o hash na tabela refresh_token; devolver o valor bruto para o cookie.
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
  // Garantir uma única sessão refresh activa por utilizador (login ou registo).
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
  // Aceitar apenas refresh não revogado e dentro do prazo de validade.
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
  // Rotação atómica: invalidar o refresh usado antes de emitir um novo par cookie + JWT.
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
  const userResource = withMeResourceLinks(publicUserDto(user))
  return {
    id: "current",
    token,
    user: userResource,
    links: sessionResourceLinks({
      userMe: { href: USERS_ME_PATH, method: "GET" },
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
  // Comparar email case-insensitive; resposta genérica 401 para não revelar existência de conta.
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
