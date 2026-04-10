require("dotenv").config()

const argon2 = require("argon2")
const { randomUUID } = require("node:crypto")
const { getPool } = require("../src/config/db")

function requiredEnv(name) {
    const v = process.env[name]
    if (!v) throw new Error(`Falta ${name} no .env`)
    return v
}

async function hashPassword(password) {
    return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: Number(requiredEnv("ARGON_MEMORY_COST")),
        timeCost: Number(requiredEnv("ARGON_TIME_COST")),
        parallelism: Number(requiredEnv("ARGON_PARALLELISM")),
        hashLength: Number(requiredEnv("ARGON_HASH_LENGTH")),
    })
}

async function main() {
    const email = String(process.argv[2] || "").trim()
    const password = String(process.argv[3] || "")
    const nome = String(process.argv[4] || "Admin").trim()

    if (!email || !password) {
        console.error("Uso: pnpm -C api run admin:create <email> <password> [nome]")
        process.exit(1)
    }

    const pool = getPool()
    try {
        const [rows] = await pool.query("SELECT id FROM utilizador WHERE email = ? LIMIT 1", [email])
        const existingId = rows[0] && rows[0].id ? String(rows[0].id) : ""

        const passwordHash = await hashPassword(password)

        if (existingId) {
            await pool.query(
                `UPDATE utilizador
                 SET nome = ?, palavra_passe = ?, is_admin = 1, is_organizer = 1, is_blocked = 0,
                     blocked_reason = NULL, blocked_at = NULL, token_version = token_version + 1
                 WHERE id = ?`,
                [nome || "Admin", passwordHash, existingId],
            )
            await pool.query("DELETE FROM refresh_sessao WHERE utilizador_id = ?", [existingId])
            console.log("Conta atualizada para admin.")
            return
        }

        const id = randomUUID()
        await pool.query(
            `INSERT INTO utilizador (id, nome, email, palavra_passe, data_nascimento, telefone, is_admin, is_organizer, is_blocked, token_version)
             VALUES (?, ?, ?, ?, NULL, NULL, 1, 1, 0, 0)`,
            [id, nome || "Admin", email, passwordHash],
        )
        console.log("Conta admin criada.")
    } finally {
        await pool.end()
    }
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
})

