const crypto = require("crypto")
const argon2 = require("argon2")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")
const { argonParams } = require("./auth.service")

function ageFromBirthDate(isoDate) {
    const d = new Date(isoDate)
    if (Number.isNaN(d.getTime())) return null
    const today = new Date()
    let age = today.getFullYear() - d.getFullYear()
    const m = today.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1
    return age
}

async function registerUser({ nome, email, password, data_nascimento, telefone }) {
    if (password.length < 10) {
        throw ApiError.badRequest("Falha na validação.", {
            password: ["A palavra-passe deve ter pelo menos 10 caracteres."],
        })
    }
    if (data_nascimento) {
        const age = ageFromBirthDate(data_nascimento)
        if (age == null || age < 14) {
            throw ApiError.badRequest("Falha na validação.", {
                data_nascimento: ["É necessário ter pelo menos 14 anos."],
            })
        }
    }
    const pool = getPool()
    const em = email.trim().toLowerCase()
    const [dup] = await pool.query("SELECT id FROM utilizador WHERE email = ? LIMIT 1", [em])
    if (dup.length) {
        throw ApiError.conflict("O endereço de email já está registado.", "EMAIL_NOT_UNIQUE")
    }
    const hash = await argon2.hash(password, argonParams())
    const id = crypto.randomUUID()
    await pool.query(
        `INSERT INTO utilizador (id, nome, email, palavra_passe, data_nascimento, telefone)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [id, nome.trim(), em, hash, data_nascimento || null, telefone || null],
    )
    return { id, nome: nome.trim(), email: em }
}

function mapUserPublic(row) {
    if (!row) return null
    return {
        id: row.id,
        nome: row.nome,
        email: row.email,
        telefone: row.telefone,
        data_nascimento: row.data_nascimento ? row.data_nascimento.toISOString?.().slice(0, 10) || String(row.data_nascimento).slice(0, 10) : null,
        is_admin: row.is_admin ? 1 : 0,
        is_organizer: row.is_organizer ? 1 : 0,
        is_blocked: row.is_blocked ? 1 : 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

async function getUserById(id) {
    const [rows] = await getPool().query(
        `SELECT id, nome, email, telefone, data_nascimento, is_admin, is_organizer, is_blocked, created_at, updated_at
     FROM utilizador WHERE id = ? LIMIT 1`,
        [id],
    )
    return mapUserPublic(rows[0])
}

async function updateUserProfile(userId, body) {
    const pool = getPool()
    const [curRows] = await pool.query(
        "SELECT id, palavra_passe, token_version FROM utilizador WHERE id = ? LIMIT 1",
        [userId],
    )
    const cur = curRows[0]
    if (!cur) throw ApiError.notFound("Utilizador não encontrado.", "USER_NOT_FOUND")

    const updates = []
    const vals = []
    if (body.nome != null) {
        updates.push("nome = ?")
        vals.push(String(body.nome).trim())
    }
    if (body.telefone !== undefined) {
        updates.push("telefone = ?")
        vals.push(body.telefone || null)
    }
    if (body.data_nascimento !== undefined) {
        if (body.data_nascimento) {
            const age = ageFromBirthDate(body.data_nascimento)
            if (age == null || age < 14) {
                throw ApiError.badRequest("Falha na validação.", {
                    data_nascimento: ["É necessário ter pelo menos 14 anos."],
                })
            }
        }
        updates.push("data_nascimento = ?")
        vals.push(body.data_nascimento || null)
    }
    if (body.password != null && body.password !== "") {
        if (!body.current_password) {
            throw ApiError.badRequest("Falha na validação.", {
                current_password: ["A palavra-passe atual é obrigatória."],
            })
        }
        let ok = false
        try {
            ok = await argon2.verify(cur.palavra_passe, body.current_password)
        } catch {
            ok = false
        }
        if (!ok) {
            throw ApiError.badRequest("Falha na validação.", {
                password: ["A palavra-passe atual está incorreta."],
            })
        }
        if (body.password.length < 10) {
            throw ApiError.badRequest("Falha na validação.", {
                password: ["A palavra-passe deve ter pelo menos 10 caracteres."],
            })
        }
        const hash = await argon2.hash(body.password, argonParams())
        updates.push("palavra_passe = ?")
        vals.push(hash)
        updates.push("token_version = token_version + 1")
    }
    if (!updates.length) {
        return getUserById(userId)
    }
    vals.push(userId)
    await pool.query(`UPDATE utilizador SET ${updates.join(", ")} WHERE id = ?`, vals)
    return getUserById(userId)
}

module.exports = { registerUser, getUserById, updateUserProfile, mapUserPublic }
