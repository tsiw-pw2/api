const crypto = require("crypto")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { parsePagination } = require("../../../utils/pagination")
const { loadCampaignRow } = require("./campaign.service")
const { fmtDateTime } = require("./campaign.service")

async function assertCanComment(pool, campanhaId, utilizadorId) {
    const [ins] = await pool.query(
        `SELECT id FROM inscricao
     WHERE campanha_id = ? AND utilizador_id = ? AND estado = 1 AND deleted_at IS NULL
     LIMIT 1`,
        [campanhaId, utilizadorId],
    )
    if (!ins.length) {
        throw ApiError.forbidden(
            "Não tem permissão para comentar nesta campanha.",
            "COMMENT_NOT_ALLOWED",
        )
    }
}

async function listComments(campanhaId, query) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campanhaId)
    if (!campanha) throw ApiError.notFound("Campanha não encontrada.", "CAMPAIGN_NOT_FOUND")
    const { page, limit, offset } = parsePagination(query)
    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS n FROM comentario c
     WHERE c.campanha_id = ? AND c.deleted_at IS NULL AND c.is_visible = 1`,
        [campanhaId],
    )
    const total = Number(countRows[0]?.n || 0)
    const [rows] = await pool.query(
        `SELECT c.id, c.campanha_id, c.utilizador_id, u.nome AS autor_nome, c.comentario, c.is_visible, c.created_at
     FROM comentario c
     INNER JOIN utilizador u ON u.id = c.utilizador_id
     WHERE c.campanha_id = ? AND c.deleted_at IS NULL AND c.is_visible = 1
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
        [campanhaId, limit, offset],
    )
    return {
        data: rows.map((r) => ({
            id: r.id,
            campanha_id: r.campanha_id,
            utilizador_id: r.utilizador_id,
            autor_nome: r.autor_nome,
            comentario: r.comentario,
            is_visible: r.is_visible ? 1 : 0,
            created_at: fmtDateTime(r.created_at),
        })),
        meta: { page, total },
    }
}

async function createComment(campanhaId, utilizadorId, texto) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campanhaId)
    if (!campanha) throw ApiError.notFound("Campanha não encontrada.", "CAMPAIGN_NOT_FOUND")
    await assertCanComment(pool, campanhaId, utilizadorId)
    const id = crypto.randomUUID()
    await pool.query(
        `INSERT INTO comentario (id, campanha_id, utilizador_id, comentario, is_visible)
     VALUES (?, ?, ?, ?, 1)`,
        [id, campanhaId, utilizadorId, texto],
    )
    const [rows] = await pool.query(
        `SELECT id, campanha_id, utilizador_id, comentario, is_visible, created_at
     FROM comentario WHERE id = ?`,
        [id],
    )
    const r = rows[0]
    return {
        id: r.id,
        campanha_id: r.campanha_id,
        utilizador_id: r.utilizador_id,
        comentario: r.comentario,
        is_visible: r.is_visible ? 1 : 0,
        created_at: fmtDateTime(r.created_at),
    }
}

async function softDeleteComment(commentId, utilizadorId) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT id, utilizador_id FROM comentario WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [commentId],
    )
    const r = rows[0]
    if (!r) {
        throw ApiError.notFound("Comentário não encontrado.", "COMMENT_NOT_FOUND")
    }
    if (r.utilizador_id !== utilizadorId) {
        throw ApiError.forbidden("Só o autor pode apagar o comentário.", "FORBIDDEN")
    }
    await pool.query("UPDATE comentario SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [
        commentId,
    ])
}

async function patchAdminComment(commentId, isVisible) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT id, campanha_id FROM comentario WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [commentId],
    )
    const r = rows[0]
    if (!r) {
        throw ApiError.notFound("Comentário não encontrado.", "COMMENT_NOT_FOUND")
    }
    await pool.query(
        "UPDATE comentario SET is_visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [isVisible ? 1 : 0, commentId],
    )
    const [out] = await pool.query(
        `SELECT id, campanha_id, is_visible, updated_at FROM comentario WHERE id = ?`,
        [commentId],
    )
    const x = out[0]
    return {
        id: x.id,
        campanha_id: x.campanha_id,
        is_visible: x.is_visible ? 1 : 0,
        updated_at: fmtDateTime(x.updated_at),
    }
}

module.exports = {
    listComments,
    createComment,
    softDeleteComment,
    patchAdminComment,
}
