const crypto = require("crypto")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { loadCampaignRow, assertPraiaLinkedToCampanha, assertCanManageCampaign } = require("./campaign.service")
const { fmtDateTime } = require("./campaign.service")

async function upsertRecolha(campanhaId, praiaId, user, body) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campanhaId)
    assertCanManageCampaign(user, campanha)
    await assertPraiaLinkedToCampanha(pool, campanhaId, praiaId)
    const [resRows] = await pool.query(
        "SELECT id FROM residuo WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        [body.residuo_id],
    )
    if (!resRows.length) {
        throw ApiError.notFound(
            "Campanha, praia ou resíduo não encontrado, ou praia não associada à campanha.",
            "NOT_FOUND",
        )
    }
    const [existing] = await pool.query(
        `SELECT id FROM recolha_residuo
     WHERE campanha_id = ? AND praia_id = ? AND residuo_id = ? AND deleted_at IS NULL
     LIMIT 1`,
        [campanhaId, praiaId, body.residuo_id],
    )
    const uid = user.id
    if (existing.length) {
        const rid = existing[0].id
        await pool.query(
            `UPDATE recolha_residuo
       SET quantidade_unidades = ?, peso_real_kg = ?, registado_por_utilizador_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
            [body.quantidade_unidades, body.peso_real_kg ?? null, uid, rid],
        )
        const [out] = await pool.query(`SELECT * FROM recolha_residuo WHERE id = ?`, [rid])
        return mapRow(out[0])
    }
    const id = crypto.randomUUID()
    await pool.query(
        `INSERT INTO recolha_residuo (id, campanha_id, praia_id, residuo_id, registado_por_utilizador_id, quantidade_unidades, peso_real_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            campanhaId,
            praiaId,
            body.residuo_id,
            uid,
            body.quantidade_unidades,
            body.peso_real_kg ?? null,
        ],
    )
    const [out] = await pool.query(`SELECT * FROM recolha_residuo WHERE id = ?`, [id])
    return mapRow(out[0])
}

function mapRow(r) {
    return {
        id: r.id,
        campanha_id: r.campanha_id,
        praia_id: r.praia_id,
        residuo_id: r.residuo_id,
        quantidade_unidades: r.quantidade_unidades,
        peso_real_kg: r.peso_real_kg != null ? Number(r.peso_real_kg) : null,
        registado_por_utilizador_id: r.registado_por_utilizador_id,
        updated_at: fmtDateTime(r.updated_at),
    }
}

async function listRecolhasByCampaign(campanhaId, user) {
    const pool = getPool()
    const campanha = await loadCampaignRow(pool, campanhaId)
    assertCanManageCampaign(user, campanha)
    const [rows] = await pool.query(
        `SELECT * FROM recolha_residuo
     WHERE campanha_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
        [campanhaId],
    )
    return rows.map(mapRow)
}

async function softDeleteRecolha(recolhaId, user) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT r.*, c.organizador_id FROM recolha_residuo r
     INNER JOIN campanha c ON c.id = r.campanha_id
     WHERE r.id = ? AND r.deleted_at IS NULL LIMIT 1`,
        [recolhaId],
    )
    const row = rows[0]
    if (!row) {
        throw ApiError.notFound("Recolha não encontrada.", "NOT_FOUND")
    }
    assertCanManageCampaign(user, { organizador_id: row.organizador_id })
    await pool.query("UPDATE recolha_residuo SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [
        recolhaId,
    ])
}

module.exports = { upsertRecolha, listRecolhasByCampaign, softDeleteRecolha }
