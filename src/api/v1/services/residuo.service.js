const crypto = require("crypto")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { parsePagination } = require("../../../utils/pagination")
const { fmtDateTime } = require("./campaign.service")

async function listTipos(query) {
    const { page, limit, offset } = parsePagination(query)
    const pool = getPool()
    const [countRows] = await pool.query(
        "SELECT COUNT(*) AS n FROM tipo_residuo WHERE deleted_at IS NULL",
    )
    const total = Number(countRows[0]?.n || 0)
    const [rows] = await pool.query(
        `SELECT id, nome, created_at FROM tipo_residuo
     WHERE deleted_at IS NULL
     ORDER BY nome
     LIMIT ? OFFSET ?`,
        [limit, offset],
    )
    return {
        data: rows.map((r) => ({
            id: r.id,
            nome: r.nome,
            created_at: fmtDateTime(r.created_at),
        })),
        meta: { page, total },
    }
}

async function listResiduos(query) {
    const { page, limit, offset } = parsePagination(query)
    const pool = getPool()
    const conds = ["r.deleted_at IS NULL"]
    const params = []
    if (query.tipo_residuo_id) {
        conds.push("r.tipo_residuo_id = ?")
        params.push(query.tipo_residuo_id)
    }
    const where = conds.join(" AND ")
    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS n FROM residuo r WHERE ${where}`,
        params,
    )
    const total = Number(countRows[0]?.n || 0)
    const [rows] = await pool.query(
        `SELECT r.id, r.tipo_residuo_id, r.nome, r.peso_medio_gramas
     FROM residuo r
     WHERE ${where}
     ORDER BY r.nome
     LIMIT ? OFFSET ?`,
        [...params, limit, offset],
    )
    return {
        data: rows.map((r) => ({
            id: r.id,
            tipo_residuo_id: r.tipo_residuo_id,
            nome: r.nome,
            peso_medio_gramas: r.peso_medio_gramas,
        })),
        meta: { page, total },
    }
}

async function createTipo(body) {
    const pool = getPool()
    try {
        const id = crypto.randomUUID()
        await pool.query("INSERT INTO tipo_residuo (id, nome) VALUES (?, ?)", [id, body.nome])
        const [rows] = await pool.query(
            "SELECT id, nome, created_at FROM tipo_residuo WHERE id = ?",
            [id],
        )
        const r = rows[0]
        return { id: r.id, nome: r.nome, created_at: fmtDateTime(r.created_at) }
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") {
            throw ApiError.conflict("Já existe um tipo com este nome.", "DUPLICATE_NAME")
        }
        throw e
    }
}

async function createResiduo(body) {
    const pool = getPool()
    const [t] = await pool.query(
        "SELECT id FROM tipo_residuo WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [body.tipo_residuo_id],
    )
    if (!t.length) {
        throw ApiError.badRequest("Falha na validação.", {
            tipo_residuo_id: ["Tipo de resíduo inválido."],
        })
    }
    try {
        const id = crypto.randomUUID()
        await pool.query(
            `INSERT INTO residuo (id, tipo_residuo_id, nome, peso_medio_gramas)
       VALUES (?, ?, ?, ?)`,
            [id, body.tipo_residuo_id, body.nome, body.peso_medio_gramas ?? null],
        )
        const [rows] = await pool.query(
            `SELECT id, tipo_residuo_id, nome, peso_medio_gramas, created_at FROM residuo WHERE id = ?`,
            [id],
        )
        const r = rows[0]
        return {
            id: r.id,
            tipo_residuo_id: r.tipo_residuo_id,
            nome: r.nome,
            peso_medio_gramas: r.peso_medio_gramas,
            created_at: fmtDateTime(r.created_at),
        }
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") {
            throw ApiError.conflict(
                "Nome de resíduo já existe (uk_residuo_nome).",
                "DUPLICATE_WASTE_NAME",
            )
        }
        throw e
    }
}

async function patchTipo(id, body) {
    const pool = getPool()
    const [cur] = await pool.query("SELECT id FROM tipo_residuo WHERE id = ? LIMIT 1", [id])
    if (!cur.length) {
        throw ApiError.notFound("Tipo de resíduo não encontrado.", "NOT_FOUND")
    }
    const updates = []
    const vals = []
    if (body.nome !== undefined) {
        updates.push("nome = ?")
        vals.push(body.nome)
    }
    if (body.deleted_at !== undefined) {
        updates.push("deleted_at = ?")
        vals.push(body.deleted_at === null ? null : body.deleted_at)
    }
    if (updates.length) {
        try {
            vals.push(id)
            await pool.query(`UPDATE tipo_residuo SET ${updates.join(", ")} WHERE id = ?`, vals)
        } catch (e) {
            if (e.code === "ER_DUP_ENTRY") {
                throw ApiError.conflict("Já existe um tipo com este nome.", "DUPLICATE_NAME")
            }
            throw e
        }
    }
    const [rows] = await pool.query(
        "SELECT id, nome, updated_at, deleted_at FROM tipo_residuo WHERE id = ?",
        [id],
    )
    const r = rows[0]
    return {
        id: r.id,
        nome: r.nome,
        updated_at: r.updated_at ? fmtDateTime(r.updated_at) : null,
        deleted_at: r.deleted_at ? fmtDateTime(r.deleted_at) : null,
    }
}

async function patchResiduo(id, body) {
    const pool = getPool()
    const [cur] = await pool.query("SELECT id FROM residuo WHERE id = ? LIMIT 1", [id])
    if (!cur.length) {
        throw ApiError.notFound("Resíduo não encontrado.", "NOT_FOUND")
    }
    if (body.tipo_residuo_id) {
        const [t] = await pool.query(
            "SELECT id FROM tipo_residuo WHERE id = ? AND deleted_at IS NULL LIMIT 1",
            [body.tipo_residuo_id],
        )
        if (!t.length) {
            throw ApiError.badRequest("Falha na validação.", {
                tipo_residuo_id: ["Tipo de resíduo inválido."],
            })
        }
    }
    const updates = []
    const vals = []
    for (const f of ["nome", "tipo_residuo_id", "peso_medio_gramas"]) {
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
        try {
            vals.push(id)
            await pool.query(`UPDATE residuo SET ${updates.join(", ")} WHERE id = ?`, vals)
        } catch (e) {
            if (e.code === "ER_DUP_ENTRY") {
                throw ApiError.conflict(
                    "Nome de resíduo já existe (uk_residuo_nome).",
                    "DUPLICATE_WASTE_NAME",
                )
            }
            throw e
        }
    }
    const [rows] = await pool.query(
        `SELECT id, tipo_residuo_id, nome, peso_medio_gramas, updated_at, deleted_at FROM residuo WHERE id = ?`,
        [id],
    )
    const r = rows[0]
    return {
        id: r.id,
        tipo_residuo_id: r.tipo_residuo_id,
        nome: r.nome,
        peso_medio_gramas: r.peso_medio_gramas,
        updated_at: r.updated_at ? fmtDateTime(r.updated_at) : null,
        deleted_at: r.deleted_at ? fmtDateTime(r.deleted_at) : null,
    }
}

module.exports = {
    listTipos,
    listResiduos,
    createTipo,
    createResiduo,
    patchTipo,
    patchResiduo,
}
