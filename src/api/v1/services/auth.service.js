import argon2 from "argon2"
import { sequelize, RefreshToken, User } from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"
import { signAccessToken } from "../../../utils/access-token.js"
import {
  generateOpaqueRefreshToken,
  hashRefreshToken
} from "../../../utils/refresh-token-crypto.js"
import { getArgonOptions } from "../../../config/env.js"

let warnedNonArgonPasswordHash = false

/**
 * @param {string} email
 * @param {string} password
 */
export async function loginWithEmailPassword(email, password) {
  const normalized = email.trim().toLowerCase()
  const user = await User.findOne({
    where: sequelize.where(sequelize.fn("LOWER", sequelize.col("email")), normalized)
  })

  let valid = false
  if (user) {
    const storedHash = user.passwordHash
    const looksLikeArgon2 =
      typeof storedHash === 'string' &&
      storedHash.startsWith('$argon2') &&
      storedHash.length > 30
    if (looksLikeArgon2) {
      try {
        valid = await argon2.verify(storedHash, password)
      } catch {
        valid = false
      }
    } else if (
      process.env.NODE_ENV !== 'production' &&
      warnedNonArgonPasswordHash === false
    ) {
      warnedNonArgonPasswordHash = true
      console.warn(
        '[auth] palavra_passe na BD não é um hash Argon2 completo (ex.: texto plano ou placeholder); o login falhará até atualizares o campo com um hash Argon2id gerado com os ARGON_* do .env'
      )
    }
  }

  if (!valid || !user) {
    throw ApiError.invalidCredentials()
  }

  if (user.isBlocked) {
    throw ApiError.accountBlocked(user.blockedReason ?? "")
  }

  await RefreshToken.destroy({ where: { userId: user.id } })

  const rawRefresh = generateOpaqueRefreshToken()
  const tokenHash = hashRefreshToken(rawRefresh)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await RefreshToken.create({
    userId: user.id,
    tokenHash,
    expiresAt
  })

  const accessToken = signAccessToken({
    userId: user.id,
    tokenVersion: user.tokenVersion
  })

  return { accessToken, refreshCookieValue: rawRefresh }
}

/**
 * @param {string | undefined} rawCookie
 */
export async function refreshSession(rawCookie) {
  if (!rawCookie) {
    throw ApiError.unauthorized()
  }

  const hash = hashRefreshToken(rawCookie)

  return sequelize.transaction(async (t) => {
    const row = await RefreshToken.findOne({
      where: {
        tokenHash: hash,
        revokedAt: null
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    })

    if (!row) {
      throw ApiError.unauthorized()
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw ApiError.unauthorized()
    }

    await row.update({ revokedAt: new Date() }, { transaction: t })

    const user = await User.findByPk(row.userId, {
      attributes: ["id", "tokenVersion", "isBlocked"],
      transaction: t
    })

    if (!user || user.isBlocked) {
      throw ApiError.unauthorized()
    }

    const newRaw = generateOpaqueRefreshToken()
    const newHash = hashRefreshToken(newRaw)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await RefreshToken.create(
      {
        userId: user.id,
        tokenHash: newHash,
        expiresAt
      },
      { transaction: t }
    )

    const accessToken = signAccessToken({
      userId: user.id,
      tokenVersion: user.tokenVersion
    })

    return { accessToken, refreshCookieValue: newRaw }
  })
}

/**
 * @param {string | undefined} rawCookie
 */
export async function logoutSession(rawCookie) {
  if (!rawCookie) {
    return
  }
  const hash = hashRefreshToken(rawCookie)
  const row = await RefreshToken.findOne({
    where: {
      tokenHash: hash,
      revokedAt: null
    }
  })
  if (!row) {
    return
  }
  await RefreshToken.destroy({ where: { userId: row.userId } })
}

/**
 * @param {string} plainPassword
 */
export async function hashPassword(plainPassword) {
  const opts = getArgonOptions()
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: opts.memoryCost,
    timeCost: opts.timeCost,
    parallelism: opts.parallelism,
    hashLength: opts.hashLength
  })
}
