const { verifyAccessToken } = require("../utils/jwt-access")
const { ApiError } = require("../utils/api-error")
const { getPool } = require("../config/db")

async function requireAuth(req, res, next) {
    try {
        const h = req.headers.authorization
        if (!h || !h.startsWith("Bearer ")) {
            throw ApiError.unauthorized()
        }
        const token = h.slice(7)
        const payload = verifyAccessToken(token)
        const [rows] = await getPool().query(
            "SELECT id, token_version, is_blocked, blocked_reason, is_admin, is_organizer FROM utilizador WHERE id = ? LIMIT 1",
            [payload.userId],
        )
        const u = rows[0]
        if (!u) throw ApiError.unauthorized()
        if (u.is_blocked) {
            throw new ApiError(403, {
                description: "Conta bloqueada.",
                code: "ACCOUNT_BLOCKED",
                blocked_reason: u.blocked_reason || undefined,
            })
        }
        if (Number(payload.tokenVersion) !== Number(u.token_version)) {
            throw ApiError.unauthorized("INVALID_TOKEN_VERSION")
        }
        req.user = {
            id: u.id,
            isAdmin: Boolean(u.is_admin),
            isOrganizer: Boolean(u.is_organizer),
        }
        next()
    } catch (e) {
        next(e)
    }
}

module.exports = { requireAuth }
