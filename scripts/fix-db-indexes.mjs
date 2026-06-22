#!/usr/bin/env node
/**
 * Remove índices UNIQUE duplicados em utilizador.email (bug de sync alter:true).
 *
 * Uso: pnpm run db:fix-indexes
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

const KEEP_INDEX = "uk_utilizador_email"

async function main() {
  const { sequelize } = await import("../models/sequelize.js")

  await sequelize.authenticate()

  const [indexes] = await sequelize.query("SHOW INDEX FROM utilizador WHERE Column_name = 'email'")
  const indexNames = [...new Set(indexes.map((row) => row.Key_name))]

  const toDrop = indexNames.filter((name) => name !== "PRIMARY" && name !== KEEP_INDEX)

  if (toDrop.length === 0) {
    console.log("Nenhum índice duplicado em utilizador.email.")
    await sequelize.close()
    return
  }

  console.log(`A remover ${toDrop.length} índice(s) duplicado(s)…`)
  for (const name of toDrop) {
    await sequelize.query(`ALTER TABLE utilizador DROP INDEX \`${name}\``)
    console.log(`  • removido: ${name}`)
  }

  const remaining = indexNames.filter((name) => name !== "PRIMARY")
  if (!remaining.includes(KEEP_INDEX)) {
    console.log(`A criar índice ${KEEP_INDEX}…`)
    await sequelize.query(
      `ALTER TABLE utilizador ADD CONSTRAINT uk_utilizador_email UNIQUE (email)`
    )
  }

  console.log("\n✓ Índices corrigidos. Podes correr pnpm run db:seed")
  await sequelize.close()
}

main().catch((err) => {
  console.error("Erro:", err)
  process.exit(1)
})
