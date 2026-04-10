const crypto = require("crypto")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { loadCampaignRow, fmtDateTime } = require("./campaign.service")

const ESTADO_ABERTA_INSCRICOES = 1

async function assertTargetUserExists(pool, userId) {
    const [u] = await pool.query("SELECT id FROM utilizador WHERE id = ? LIMIT 1", [userId])
    if (!u.length) {
        throw ApiError.notFound("Utilizador não encontrado.", "USER_NOT_FOUND")
    }
}

async function createInscricao(campanhaId, actor, body) {
    const funcao = body.funcao !== undefined ? body.funcao : 0
    const targetUserId = body.utilizador_id || actor.id
    const isSelf = targetUserId === actor.id
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campanhaId)
    if (!campanha) throw ApiError.notFound("Campanha não encontrada.", "CAMPAIGN_NOT_FOUND")

    if (!isSelf) {
        if (!actor.isAdmin && campanha.organizador_id !== actor.id) {
            throw ApiError.forbidden("Sem permissão para inscrever este utilizador.", "FORBIDDEN")
        }
        await assertTargetUserExists(pool, targetUserId)
    }

    if (isSelf && campanha.estado !== ESTADO_ABERTA_INSCRICOES) {
        throw ApiError.unprocessableEntity(
            "Inscrições não estão abertas para esta campanha.",
            "REGISTRATION_CLOSED",
        )
    }

    const estado = isSelf ? 1 : body.estado !== undefined ? body.estado : 1
    let presenca = null
    if (!isSelf && body.presenca !== undefined) {
        presenca = body.presenca === null ? null : body.presenca ? 1 : 0
    }

    try {
        const id = crypto.randomUUID()
        await pool.query(
            `INSERT INTO inscricao (id, campanha_id, utilizador_id, funcao, estado, presenca)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, campanhaId, targetUserId, funcao, estado, presenca],
        )
        const [rows] = await pool.query(
            `SELECT id, campanha_id, utilizador_id, funcao, estado, presenca, created_at
       FROM inscricao WHERE id = ?`,
            [id],
        )
        const r = rows[0]
        return mapRow(r)
    } catch (e) {
        if (e.code === "ER_DUP_ENTRY") {
            throw ApiError.conflict(
                "Já existe inscrição para esta campanha.",
                "REGISTRATION_DUPLICATE",
            )
        }
        throw e
    }
}

function mapRow(r) {
    return {
        id: r.id,
        campanha_id: r.campanha_id,
        utilizador_id: r.utilizador_id,
        funcao: r.funcao,
        estado: r.estado,
        presenca: r.presenca === null ? null : Boolean(r.presenca),
        created_at: fmtDateTime(r.created_at),
        updated_at: r.updated_at ? fmtDateTime(r.updated_at) : undefined,
    }
}

async function listInscricoesByCampaign(campanhaId, actor) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campanhaId)
    if (!campanha) throw ApiError.notFound("Campanha não encontrada.", "CAMPAIGN_NOT_FOUND")
    if (!actor.isAdmin && campanha.organizador_id !== actor.id) {
        throw ApiError.forbidden("Sem permissão para listar estas inscrições.", "FORBIDDEN")
    }
    const [rows] = await pool.query(
        `SELECT id, campanha_id, utilizador_id, funcao, estado, presenca, created_at, updated_at
     FROM inscricao WHERE campanha_id = ? AND deleted_at IS NULL
     ORDER BY created_at`,
        [campanhaId],
    )
    return rows.map(mapRow)
}

async function patchInscricao(inscricaoId, actor, body) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT i.id, i.campanha_id, i.utilizador_id, i.funcao, i.estado, i.presenca,
            c.organizador_id
     FROM inscricao i
     INNER JOIN campanha c ON c.id = i.campanha_id
     WHERE i.id = ? AND i.deleted_at IS NULL LIMIT 1`,
        [inscricaoId],
    )
    const r = rows[0]
    if (!r) {
        throw ApiError.notFound("Inscrição não encontrada.", "REGISTRATION_NOT_FOUND")
    }
    const canManage = actor.isAdmin || r.organizador_id === actor.id
    const isOwner = r.utilizador_id === actor.id

    if (!canManage) {
        if (!isOwner) {
            throw ApiError.forbidden(
                "Sem permissão para alterar esta inscrição.",
                "FORBIDDEN",
            )
        }
        if (body.estado !== 2 || body.funcao !== undefined || body.presenca !== undefined) {
            throw ApiError.badRequest("Falha na validação do corpo.", {
                estado: ["Apenas o cancelamento (estado 2) é permitido."],
            })
        }
        await pool.query(
            "UPDATE inscricao SET estado = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [inscricaoId],
        )
    } else {
        const updates = []
        const vals = []
        if (body.estado !== undefined) {
            updates.push("estado = ?")
            vals.push(body.estado)
        }
        if (body.funcao !== undefined) {
            updates.push("funcao = ?")
            vals.push(body.funcao)
        }
        if (body.presenca !== undefined) {
            updates.push("presenca = ?")
            vals.push(body.presenca === null ? null : body.presenca ? 1 : 0)
        }
        if (!updates.length) {
            const [cur] = await pool.query(
                `SELECT id, campanha_id, utilizador_id, estado, funcao, updated_at FROM inscricao WHERE id = ?`,
                [inscricaoId],
            )
            const x = cur[0]
            return {
                id: x.id,
                campanha_id: x.campanha_id,
                utilizador_id: x.utilizador_id,
                estado: x.estado,
                funcao: x.funcao,
                updated_at: fmtDateTime(x.updated_at),
            }
        }
        vals.push(inscricaoId)
        await pool.query(
            `UPDATE inscricao SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            vals,
        )
    }

    const [out] = await pool.query(
        `SELECT id, campanha_id, utilizador_id, estado, funcao, presenca, updated_at FROM inscricao WHERE id = ?`,
        [inscricaoId],
    )
    const x = out[0]
    return {
        id: x.id,
        campanha_id: x.campanha_id,
        utilizador_id: x.utilizador_id,
        estado: x.estado,
        funcao: x.funcao,
        presenca: x.presenca === null ? null : Boolean(x.presenca),
        updated_at: fmtDateTime(x.updated_at),
    }
}

module.exports = { createInscricao, patchInscricao, listInscricoesByCampaign }
