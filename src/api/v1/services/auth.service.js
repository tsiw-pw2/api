const crypto = require("crypto")
const argon2 = require("argon2")
const { ApiError } = require("../../../utils/api-error")
const { signAccessToken, ACCESS_TTL_SEC } = require("../../../utils/jwt-access")
const {
    randomRefreshToken,
    hashRefreshToken,
    REFRESH_DAYS,
} = require("../../../utils/refresh-cookie")
const { Utilizador, RefreshSessao } = require("../../../db/models")

function argonParams() {
    return {
        type: argon2.argon2id,
        memoryCost: Number(process.env.ARGON_MEMORY_COST),
        timeCost: Number(process.env.ARGON_TIME_COST),
        parallelism: Number(process.env.ARGON_PARALLELISM),
        hashLength: Number(process.env.ARGON_HASH_LENGTH),
    }
}

async function deleteRefreshForUser(utilizadorId) {
    await RefreshSessao.destroy({ where: { utilizador_id: utilizadorId } })
}

async function createRefreshSession(utilizadorId) {
    await deleteRefreshForUser(utilizadorId)
    const raw = randomRefreshToken()
    const id = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000)
    await RefreshSessao.create({
        id,
        utilizador_id: utilizadorId,
        token_hash: hashRefreshToken(raw),
        expires_at: expiresAt,
    })
    return raw
}

async function login({ email, password }) {
    const u = await Utilizador.findOne({
        where: { email: email.trim().toLowerCase() },
        attributes: [
            "id",
            "palavra_passe",
            "is_blocked",
            "blocked_reason",
            "token_version",
            "is_admin",
            "is_organizer",
        ],
    })
    if (!u) {
        throw new ApiError(401, {
            description: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
        })
    }
    if (u.is_blocked) {
        throw new ApiError(403, {
            description: "Conta bloqueada.",
            code: "ACCOUNT_BLOCKED",
            blocked_reason: u.blocked_reason || undefined,
        })
    }
    let valid = false
    try {
        valid = await argon2.verify(u.palavra_passe, password)
    } catch {
        valid = false
    }
    if (!valid) {
        throw new ApiError(401, {
            description: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
        })
    }
    const accessToken = signAccessToken({
        userId: u.id,
        tokenVersion: u.token_version,
        isAdmin: u.is_admin,
        isOrganizer: u.is_organizer,
    })
    const refreshRaw = await createRefreshSession(u.id)
    return { accessToken, refreshRaw, expiresIn: ACCESS_TTL_SEC }
}

async function refresh({ rawToken }) {
    if (!rawToken) {
        throw ApiError.unauthorized("INVALID_REFRESH_TOKEN")
    }
    const h = hashRefreshToken(rawToken)
    const row = await RefreshSessao.findOne({
        where: { token_hash: h },
        include: [
            {
                model: Utilizador,
                as: "utilizador",
                required: true,
                attributes: [
                    "id",
                    "token_version",
                    "is_blocked",
                    "blocked_reason",
                    "is_admin",
                    "is_organizer",
                ],
            },
        ],
    })
    if (!row) {
        throw new ApiError(401, {
            description: "Refresh token inválido ou expirado.",
            code: "INVALID_REFRESH_TOKEN",
        })
    }
    const u = row.utilizador
    if (new Date(row.expires_at) < new Date()) {
        await RefreshSessao.destroy({ where: { id: row.id } })
        throw new ApiError(401, {
            description: "Refresh token inválido ou expirado.",
            code: "INVALID_REFRESH_TOKEN",
        })
    }
    if (u.is_blocked) {
        throw new ApiError(403, {
            description: "Conta bloqueada.",
            code: "ACCOUNT_BLOCKED",
            blocked_reason: u.blocked_reason || undefined,
        })
    }
    await RefreshSessao.destroy({ where: { id: row.id } })
    const accessToken = signAccessToken({
        userId: u.id,
        tokenVersion: u.token_version,
        isAdmin: u.is_admin,
        isOrganizer: u.is_organizer,
    })
    const refreshRaw = await createRefreshSession(u.id)
    return { accessToken, refreshRaw, expiresIn: ACCESS_TTL_SEC }
}

async function logout({ rawToken }) {
    if (!rawToken) return
    const h = hashRefreshToken(rawToken)
    await RefreshSessao.destroy({ where: { token_hash: h } })
}

module.exports = {
    argonParams,
    deleteRefreshForUser,
    createRefreshSession,
    login,
    refresh,
    logout,
}
