#!/usr/bin/env node
/**
 * Remove índices UNIQUE duplicados criados por sync({ alter: true }) repetido.
 * Mantém uk_utilizador_email (ou o primeiro índice em email) e apaga email_2…email_N.
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

const KEEP = new Set(["PRIMARY", "uk_utilizador_email", "email"])

async function main() {
  const { sequelize } = await import("../models/sequelize.js")
  const [rows] = await sequelize.query("SHOW INDEX FROM utilizador")
  const toDrop = [...new Set(rows.map((r) => r.Key_name))].filter((name) => !KEEP.has(name))

  if (toDrop.length === 0) {
    console.log("Nenhum índice duplicado em utilizador.")
    await sequelize.close()
    return
  }

  console.log(`A remover ${toDrop.length} índice(s) duplicado(s) em utilizador…`)
  for (const name of toDrop) {
    await sequelize.query(`ALTER TABLE utilizador DROP INDEX \`${name}\``)
    console.log(`  • ${name}`)
  }

  const [after] = await sequelize.query("SHOW INDEX FROM utilizador")
  console.log(`\n✓ Índices restantes: ${after.length}`)
  await sequelize.close()
}

main().catch((err) => {
  console.error("Erro ao corrigir índices:", err)
  process.exit(1)
})
