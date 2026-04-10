const mysql = require("mysql2/promise")

let pool = null

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            namedPlaceholders: false,
        })
    }
    return pool
}

async function ping() {
    const p = getPool()
    await p.query("SELECT 1")
}

module.exports = { getPool, ping }
