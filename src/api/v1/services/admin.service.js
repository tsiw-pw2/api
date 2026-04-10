const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { parsePagination } = require("../../../utils/pagination")
const { fmtDateTime } = require("./campaign.service")

function resolvePeriod(query) {
    const now = new Date()
    let from
    let to = now.toISOString().slice(0, 10)
    if (query.from && query.to) {
        from = query.from
        to = query.to
    } else if (query.period === "90d") {
        const d = new Date(now)
        d.setDate(d.getDate() - 90)
        from = d.toISOString().slice(0, 10)
    } else if (query.period === "year") {
        const d = new Date(now.getFullYear(), 0, 1)
        from = d.toISOString().slice(0, 10)
    } else {
        const d = new Date(now)
        d.setDate(d.getDate() - 30)
        from = d.toISOString().slice(0, 10)
    }
    return { from, to }
}

async function dashboard(query) {
    const pool = getPool()
    const { from, to } = resolvePeriod(query)
    const [[campanhasAtivas]] = await pool.query(
        `SELECT COUNT(*) AS n FROM campanha
     WHERE deleted_at IS NULL AND estado IN (1, 2, 3)
       AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
        [from, to],
    )
    const [[inscricoes]] = await pool.query(
        `SELECT COUNT(*) AS n FROM inscricao
     WHERE estado = 1 AND deleted_at IS NULL
       AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
        [from, to],
    )
    const [[peso]] = await pool.query(
        `SELECT COALESCE(SUM(peso_real_kg), 0) AS s FROM recolha_residuo
     WHERE deleted_at IS NULL
       AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
        [from, to],
    )
    const [[recolhas]] = await pool.query(
        `SELECT COUNT(*) AS n FROM recolha_residuo
     WHERE deleted_at IS NULL
       AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
        [from, to],
    )
    const [[users]] = await pool.query("SELECT COUNT(*) AS n FROM utilizador")
    return {
        campanhas_ativas: Number(campanhasAtivas.n),
        inscricoes_confirmadas: Number(inscricoes.n),
        peso_total_kg: Number(peso.s),
        recolhas_registadas: Number(recolhas.n),
        utilizadores_total: Number(users.n),
        periodo: { from, to },
    }
}

async function listUsers(query) {
    const { page, limit, offset } = parsePagination(query)
    const pool = getPool()
    const conds = ["1=1"]
    const params = []
    if (query.is_blocked !== undefined && query.is_blocked !== "") {
        conds.push("is_blocked = ?")
        params.push(Number(query.is_blocked))
    }
    if (query.is_admin !== undefined && query.is_admin !== "") {
        conds.push("is_admin = ?")
        params.push(Number(query.is_admin))
    }
    const where = conds.join(" AND ")
    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS n FROM utilizador WHERE ${where}`,
        params,
    )
    const total = Number(countRows[0]?.n || 0)
    const [rows] = await pool.query(
        `SELECT id, nome, email, is_admin, is_organizer, is_blocked, created_at
     FROM utilizador WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
        [...params, limit, offset],
    )
    return {
        data: rows.map((r) => ({
            id: r.id,
            nome: r.nome,
            email: r.email,
            is_admin: r.is_admin ? 1 : 0,
            is_organizer: r.is_organizer ? 1 : 0,
            is_blocked: r.is_blocked ? 1 : 0,
            created_at: fmtDateTime(r.created_at),
        })),
        meta: { page, total },
    }
}

async function getUserAdmin(id) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT id, nome, email, telefone, data_nascimento, is_admin, is_organizer, is_blocked,
            blocked_reason, blocked_at, created_at
     FROM utilizador WHERE id = ? LIMIT 1`,
        [id],
    )
    const r = rows[0]
    if (!r) throw ApiError.notFound("Utilizador não encontrado.", "USER_NOT_FOUND")
    return {
        id: r.id,
        nome: r.nome,
        email: r.email,
        telefone: r.telefone,
        data_nascimento: r.data_nascimento
            ? r.data_nascimento instanceof Date
                ? r.data_nascimento.toISOString().slice(0, 10)
                : String(r.data_nascimento).slice(0, 10)
            : null,
        is_admin: r.is_admin ? 1 : 0,
        is_organizer: r.is_organizer ? 1 : 0,
        is_blocked: r.is_blocked ? 1 : 0,
        blocked_reason: r.blocked_reason,
        blocked_at: r.blocked_at ? fmtDateTime(r.blocked_at) : null,
        created_at: fmtDateTime(r.created_at),
    }
}

async function blockUser(targetId, adminId, blockedReason) {
    if (targetId === adminId) {
        throw ApiError.forbidden("Não é permitido bloquear este utilizador.", "FORBIDDEN")
    }
    const pool = getPool()
    const [rows] = await pool.query("SELECT id FROM utilizador WHERE id = ? LIMIT 1", [targetId])
    if (!rows.length) throw ApiError.notFound("Utilizador não encontrado.", "USER_NOT_FOUND")
    await pool.query(
        `UPDATE utilizador SET is_blocked = 1, blocked_reason = ?, blocked_at = CURRENT_TIMESTAMP,
       token_version = token_version + 1
     WHERE id = ?`,
        [blockedReason, targetId],
    )
    await pool.query("DELETE FROM refresh_sessao WHERE utilizador_id = ?", [targetId])
    const [out] = await pool.query(
        "SELECT id, is_blocked, blocked_reason, blocked_at FROM utilizador WHERE id = ?",
        [targetId],
    )
    const u = out[0]
    return {
        id: u.id,
        is_blocked: 1,
        blocked_reason: u.blocked_reason,
        blocked_at: fmtDateTime(u.blocked_at),
    }
}

async function unblockUser(targetId) {
    const pool = getPool()
    const [rows] = await pool.query("SELECT id FROM utilizador WHERE id = ? LIMIT 1", [targetId])
    if (!rows.length) throw ApiError.notFound("Utilizador não encontrado.", "USER_NOT_FOUND")
    await pool.query(
        `UPDATE utilizador SET is_blocked = 0, blocked_reason = NULL, blocked_at = NULL WHERE id = ?`,
        [targetId],
    )
    const [out] = await pool.query(
        "SELECT id, is_blocked, blocked_reason, blocked_at FROM utilizador WHERE id = ?",
        [targetId],
    )
    const u = out[0]
    return {
        id: u.id,
        is_blocked: 0,
        blocked_reason: null,
        blocked_at: null,
    }
}

module.exports = {
    dashboard,
    listUsers,
    getUserAdmin,
    blockUser,
    unblockUser,
}
