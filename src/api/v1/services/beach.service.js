const crypto = require("crypto")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { parsePagination } = require("../../../utils/pagination")

function fmtDateTime(d) {
    if (!d) return null
    if (d instanceof Date) return d.toISOString()
    return String(d)
}

async function listBeaches(query) {
    const { page, limit, offset } = parsePagination(query)
    const pool = getPool()
    const conds = ["p.deleted_at IS NULL"]
    const params = []
    if (query.distrito) {
        conds.push("l.distrito LIKE ?")
        params.push(`%${query.distrito}%`)
    }
    if (query.concelho) {
        conds.push("l.concelho LIKE ?")
        params.push(`%${query.concelho}%`)
    }
    if (query.nome) {
        conds.push("p.nome LIKE ?")
        params.push(`%${query.nome}%`)
    }
    const where = conds.join(" AND ")
    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS n FROM praia p
     INNER JOIN localizacao_praia l ON l.id = p.localizacao_praia_id AND l.deleted_at IS NULL
     WHERE ${where}`,
        params,
    )
    const total = Number(countRows[0]?.n || 0)
    const [rows] = await pool.query(
        `SELECT p.id, p.nome, p.latitude, p.longitude, p.descricao, p.localizacao_praia_id, p.criado_por_utilizador_id,
            l.distrito AS loc_distrito, l.concelho AS loc_concelho, l.freguesia AS loc_freguesia, l.codigo_nuts AS loc_codigo_nuts
     FROM praia p
     INNER JOIN localizacao_praia l ON l.id = p.localizacao_praia_id AND l.deleted_at IS NULL
     WHERE ${where}
     ORDER BY p.nome
     LIMIT ? OFFSET ?`,
        [...params, limit, offset],
    )
    return {
        data: rows.map((r) => ({
            id: r.id,
            nome: r.nome,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            descricao: r.descricao,
            localizacao_praia_id: r.localizacao_praia_id,
            criado_por_utilizador_id: r.criado_por_utilizador_id,
            localizacao: {
                id: r.localizacao_praia_id,
                distrito: r.loc_distrito,
                concelho: r.loc_concelho,
                freguesia: r.loc_freguesia,
                codigo_nuts: r.loc_codigo_nuts,
            },
        })),
        meta: { page, limit, total },
    }
}

async function getBeachById(id) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT p.id, p.nome, p.latitude, p.longitude, p.descricao, p.localizacao_praia_id, p.criado_por_utilizador_id
     FROM praia p WHERE p.id = ? AND p.deleted_at IS NULL LIMIT 1`,
        [id],
    )
    const p = rows[0]
    if (!p) throw ApiError.notFound("Praia não encontrada.", "BEACH_NOT_FOUND")
    const [lrows] = await pool.query(
        `SELECT id, distrito, concelho, freguesia, codigo_nuts FROM localizacao_praia
     WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [p.localizacao_praia_id],
    )
    const l = lrows[0]
    if (!l) throw ApiError.notFound("Praia não encontrada.", "BEACH_NOT_FOUND")
    return {
        id: p.id,
        nome: p.nome,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        descricao: p.descricao,
        localizacao_praia_id: p.localizacao_praia_id,
        criado_por_utilizador_id: p.criado_por_utilizador_id,
        localizacao: {
            id: l.id,
            distrito: l.distrito,
            concelho: l.concelho,
            freguesia: l.freguesia,
            codigo_nuts: l.codigo_nuts,
        },
    }
}

async function createLocation(body) {
    const pool = getPool()
    const id = crypto.randomUUID()
    await pool.query(
        `INSERT INTO localizacao_praia (id, distrito, concelho, freguesia, codigo_nuts)
     VALUES (?, ?, ?, ?, ?)`,
        [id, body.distrito, body.concelho, body.freguesia, body.codigo_nuts],
    )
    const [rows] = await pool.query(
        "SELECT id, distrito, concelho, freguesia, codigo_nuts, created_at FROM localizacao_praia WHERE id = ?",
        [id],
    )
    const r = rows[0]
    return {
        id: r.id,
        distrito: r.distrito,
        concelho: r.concelho,
        freguesia: r.freguesia,
        codigo_nuts: r.codigo_nuts,
        created_at: fmtDateTime(r.created_at),
    }
}

async function createBeach(adminUserId, body) {
    const pool = getPool()
    const [loc] = await pool.query(
        "SELECT id FROM localizacao_praia WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [body.localizacao_praia_id],
    )
    if (!loc.length) {
        throw ApiError.notFound("Localização não encontrada.", "NOT_FOUND")
    }
    const id = crypto.randomUUID()
    await pool.query(
        `INSERT INTO praia (id, localizacao_praia_id, criado_por_utilizador_id, nome, latitude, longitude, descricao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            body.localizacao_praia_id,
            adminUserId,
            body.nome,
            body.latitude,
            body.longitude,
            body.descricao ?? null,
        ],
    )
    return getBeachById(id)
}

async function patchAdminBeach(beachId, body) {
    const pool = getPool()
    const [cur] = await pool.query("SELECT id FROM praia WHERE id = ? LIMIT 1", [beachId])
    if (!cur.length) throw ApiError.notFound("Praia não encontrada.", "BEACH_NOT_FOUND")
    if (body.localizacao_praia_id) {
        const [loc] = await pool.query(
            "SELECT id FROM localizacao_praia WHERE id = ? AND deleted_at IS NULL LIMIT 1",
            [body.localizacao_praia_id],
        )
        if (!loc.length) throw ApiError.notFound("Localização não encontrada.", "NOT_FOUND")
    }
    const updates = []
    const vals = []
    for (const f of ["nome", "latitude", "longitude", "descricao", "localizacao_praia_id"]) {
        if (body[f] !== undefined) {
            updates.push(`${f} = ?`)
            vals.push(body[f])
        }
    }
    if (body.deleted_at !== undefined) {
        updates.push("deleted_at = ?")
        vals.push(body.deleted_at === null ? null : body.deleted_at)
    }
    if (updates.length) {
        vals.push(beachId)
        await pool.query(`UPDATE praia SET ${updates.join(", ")} WHERE id = ?`, vals)
    }
    const [rows] = await pool.query(
        `SELECT id, nome, latitude, longitude, localizacao_praia_id, criado_por_utilizador_id, deleted_at, created_at, updated_at
     FROM praia WHERE id = ? LIMIT 1`,
        [beachId],
    )
    const p = rows[0]
    return {
        id: p.id,
        nome: p.nome,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        localizacao_praia_id: p.localizacao_praia_id,
        criado_por_utilizador_id: p.criado_por_utilizador_id,
        descricao: p.descricao,
        deleted_at: p.deleted_at ? fmtDateTime(p.deleted_at) : null,
        created_at: fmtDateTime(p.created_at),
        updated_at: p.updated_at ? fmtDateTime(p.updated_at) : null,
    }
}

module.exports = {
    listBeaches,
    getBeachById,
    createLocation,
    createBeach,
    patchAdminBeach,
}
