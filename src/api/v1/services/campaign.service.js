const crypto = require("crypto")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { parsePagination } = require("../../../utils/pagination")

function fmtDate(d) {
    if (!d) return null
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    return String(d).slice(0, 10)
}

function fmtDateTime(d) {
    if (!d) return null
    if (d instanceof Date) return d.toISOString()
    return String(d)
}

function fmtTime(t) {
    if (t == null) return null
    const s = String(t)
    return s.length >= 8 ? s.slice(0, 8) : s
}

function mapCampaignListRow(row, praiaIds = []) {
    return {
        id: row.id,
        titulo: row.titulo,
        data_inicio: fmtDate(row.data_inicio),
        data_fim: fmtDate(row.data_fim),
        estado: row.estado,
        local_encontro: row.local_encontro,
        hora_encontro: fmtTime(row.hora_encontro),
        organizador_id: row.organizador_id,
        praia_ids: praiaIds,
    }
}

function mapCampaignDetail(row, praias = []) {
    return {
        id: row.id,
        titulo: row.titulo,
        descricao: row.descricao,
        local_encontro: row.local_encontro,
        hora_encontro: fmtTime(row.hora_encontro),
        data_inicio: fmtDate(row.data_inicio),
        data_fim: fmtDate(row.data_fim),
        estado: row.estado,
        organizador_id: row.organizador_id,
        created_at: fmtDateTime(row.created_at),
        praias,
    }
}

function mapPraiaBrief(row) {
    return {
        id: row.id,
        nome: row.nome,
        latitude: row.latitude != null ? Number(row.latitude) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
    }
}

async function listPublicCampaigns(query) {
    const { page, limit, offset } = parsePagination(query)
    const pool = getPool()
    const conds = ["c.deleted_at IS NULL"]
    const params = []
    if (query.estado !== undefined && query.estado !== "") {
        conds.push("c.estado = ?")
        params.push(Number(query.estado))
    }
    if (query.from) {
        conds.push("c.data_fim >= ?")
        params.push(query.from)
    }
    if (query.to) {
        conds.push("c.data_inicio <= ?")
        params.push(query.to)
    }
    const where = conds.join(" AND ")
    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS n FROM campanha c WHERE ${where}`,
        params,
    )
    const total = Number(countRows[0]?.n || 0)
    const [rows] = await pool.query(
        `SELECT c.id, c.titulo, c.data_inicio, c.data_fim, c.estado, c.local_encontro, c.hora_encontro, c.organizador_id
     FROM campanha c
     WHERE ${where}
     ORDER BY c.data_inicio DESC, c.id
     LIMIT ? OFFSET ?`,
        [...params, limit, offset],
    )
    const ids = rows.map((r) => r.id)
    const praiaByCamp = new Map()
    if (ids.length) {
        const ph = ids.map(() => "?").join(",")
        const [cpRows] = await pool.query(
            `SELECT campanha_id, praia_id FROM campanha_praia
         WHERE campanha_id IN (${ph}) AND deleted_at IS NULL`,
            ids,
        )
        for (const row of cpRows) {
            const list = praiaByCamp.get(row.campanha_id) || []
            list.push(row.praia_id)
            praiaByCamp.set(row.campanha_id, list)
        }
    }
    return {
        data: rows.map((r) => mapCampaignListRow(r, praiaByCamp.get(r.id) || [])),
        meta: { page, limit, total },
    }
}

async function getCampaignById(id, { includeBeaches = true } = {}) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT id, titulo, descricao, local_encontro, hora_encontro, data_inicio, data_fim, estado, organizador_id, created_at, deleted_at
     FROM campanha WHERE id = ? LIMIT 1`,
        [id],
    )
    const row = rows[0]
    if (!row || row.deleted_at) {
        throw ApiError.notFound("Campanha não encontrada.", "CAMPAIGN_NOT_FOUND")
    }
    let praias = []
    if (includeBeaches) {
        const [pr] = await pool.query(
            `SELECT p.id, p.nome, p.latitude, p.longitude
       FROM campanha_praia cp
       INNER JOIN praia p ON p.id = cp.praia_id AND p.deleted_at IS NULL
       WHERE cp.campanha_id = ? AND cp.deleted_at IS NULL`,
            [id],
        )
        praias = pr.map(mapPraiaBrief)
    }
    return mapCampaignDetail(row, praias)
}

async function loadCampaignRow(pool, id) {
    const [rows] = await pool.query(
        "SELECT * FROM campanha WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [id],
    )
    return rows[0]
}

function assertCanManageCampaign(user, campanha) {
    if (!campanha) throw ApiError.notFound("Campanha não encontrada.", "CAMPAIGN_NOT_FOUND")
    if (user.isAdmin) return
    if (campanha.organizador_id === user.id) return
    throw ApiError.forbidden(
        "Só o organizador da campanha ou um administrador pode editar.",
        "FORBIDDEN",
    )
}

async function createCampaign(userId, body) {
    if (new Date(body.data_fim) < new Date(body.data_inicio)) {
        throw ApiError.badRequest("Falha na validação.", {
            data_fim: ["Deve ser ≥ data_inicio."],
        })
    }
    const pool = getPool()
    const id = crypto.randomUUID()
    const estado = body.estado !== undefined ? body.estado : 0
    await pool.query(
        `INSERT INTO campanha (id, titulo, descricao, local_encontro, hora_encontro, data_inicio, data_fim, estado, organizador_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            body.titulo,
            body.descricao ?? null,
            body.local_encontro,
            body.hora_encontro ?? null,
            body.data_inicio,
            body.data_fim,
            estado,
            userId,
        ],
    )
    const [rows] = await pool.query(
        "SELECT id, titulo, organizador_id, data_inicio, data_fim, estado, created_at FROM campanha WHERE id = ?",
        [id],
    )
    const r = rows[0]
    return {
        id: r.id,
        titulo: r.titulo,
        organizador_id: r.organizador_id,
        data_inicio: fmtDate(r.data_inicio),
        data_fim: fmtDate(r.data_fim),
        estado: r.estado,
        created_at: fmtDateTime(r.created_at),
    }
}

async function patchCampaign(campaignId, user, body) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campaignId)
    assertCanManageCampaign(user, campanha)
    if (body.data_inicio && body.data_fim) {
        if (new Date(body.data_fim) < new Date(body.data_inicio)) {
            throw ApiError.badRequest("Falha na validação.", {
                data_fim: ["Deve ser ≥ data_inicio."],
            })
        }
    } else if (body.data_fim) {
        if (new Date(body.data_fim) < new Date(campanha.data_inicio)) {
            throw ApiError.badRequest("Falha na validação.", {
                data_fim: ["Deve ser ≥ data_inicio."],
            })
        }
    } else if (body.data_inicio) {
        if (new Date(campanha.data_fim) < new Date(body.data_inicio)) {
            throw ApiError.badRequest("Falha na validação.", {
                data_inicio: ["Deve ser ≤ data_fim."],
            })
        }
    }
    const updates = []
    const vals = []
    const fields = [
        "titulo",
        "descricao",
        "local_encontro",
        "hora_encontro",
        "data_inicio",
        "data_fim",
        "estado",
    ]
    for (const f of fields) {
        if (body[f] !== undefined) {
            updates.push(`${f} = ?`)
            vals.push(body[f])
        }
    }
    if (!updates.length) {
        return getCampaignById(campaignId)
    }
    vals.push(campaignId)
    await pool.query(`UPDATE campanha SET ${updates.join(", ")} WHERE id = ?`, vals)
    return getCampaignById(campaignId)
}

async function syncCampaignBeaches(campaignId, user, beachIds) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campaignId)
    assertCanManageCampaign(user, campanha)
    const unique = [...new Set(beachIds)]
    if (!unique.length) {
        await pool.query("DELETE FROM campanha_praia WHERE campanha_id = ?", [campaignId])
        return { campanha_id: campaignId, associacoes: [] }
    }
    const [beaches] = await pool.query(
        `SELECT id FROM praia WHERE id IN (${unique.map(() => "?").join(",")}) AND deleted_at IS NULL`,
        unique,
    )
    if (beaches.length !== unique.length) {
        throw ApiError.badRequest("Lista beach_ids inválida ou praia inexistente.", "VALIDATION_ERROR")
    }
    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()
        await conn.query("DELETE FROM campanha_praia WHERE campanha_id = ?", [campaignId])
        const associacoes = []
        for (const bid of unique) {
            const cpid = crypto.randomUUID()
            await conn.query(
                "INSERT INTO campanha_praia (id, campanha_id, praia_id) VALUES (?, ?, ?)",
                [cpid, campaignId, bid],
            )
            const [ins] = await conn.query(
                "SELECT id, praia_id, created_at FROM campanha_praia WHERE id = ?",
                [cpid],
            )
            associacoes.push({
                id: ins[0].id,
                praia_id: ins[0].praia_id,
                created_at: fmtDateTime(ins[0].created_at),
            })
        }
        await conn.commit()
        return { campanha_id: campaignId, associacoes }
    } catch (e) {
        await conn.rollback()
        throw e
    } finally {
        conn.release()
    }
}

async function assertPraiaLinkedToCampanha(pool, campanhaId, praiaId) {
    const [r] = await pool.query(
        `SELECT id FROM campanha_praia WHERE campanha_id = ? AND praia_id = ? AND deleted_at IS NULL LIMIT 1`,
        [campanhaId, praiaId],
    )
    if (!r.length) {
        throw ApiError.notFound(
            "Campanha, praia ou resíduo não encontrado, ou praia não associada à campanha.",
            "NOT_FOUND",
        )
    }
}

async function softDeleteCampaign(campaignId, user) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campaignId)
    assertCanManageCampaign(user, campanha)
    await pool.query("UPDATE campanha SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [campaignId])
}

module.exports = {
    listPublicCampaigns,
    getCampaignById,
    createCampaign,
    patchCampaign,
    syncCampaignBeaches,
    softDeleteCampaign,
    loadCampaignRow,
    assertCanManageCampaign,
    assertPraiaLinkedToCampanha,
    mapCampaignDetail,
    fmtDateTime,
}
