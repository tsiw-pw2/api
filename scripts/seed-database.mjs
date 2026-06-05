#!/usr/bin/env node
/**
 * Seed de desenvolvimento — apaga dados da app e repõe um conjunto de demonstração.
 *
 * Uso (na pasta api/):
 *   pnpm run db:seed
 *
 * Password: SEED_DEFAULT_PASSWORD no .env (por defeito Demo2026!)
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

const ACCOUNTS = [
  { email: "admin@demo.pt", role: "Administrador" },
  { email: "organizador@demo.pt", role: "Organizador" },
  { email: "voluntario1@demo.pt", role: "Voluntário" },
  { email: "voluntario2@demo.pt", role: "Voluntário" },
  { email: "bloqueado@demo.pt", role: "Bloqueado (login falha)" }
]

function assertSeedAllowed() {
  if (process.env.SEED_ALLOW === "1") return
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Seed recusado em NODE_ENV=production. Define SEED_ALLOW=1 se tiveres a certeza."
    )
    process.exit(1)
  }
}

async function main() {
  assertSeedAllowed()

  const password = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
  if (!password || password.length < 8) {
    console.error("SEED_DEFAULT_PASSWORD deve ter pelo menos 8 caracteres.")
    process.exit(1)
  }

  const { sequelize } = await import("../models/sequelize.js")
  await import("../models/db.config.js")
  const { clearDatabase } = await import("./seed/clear-database.mjs")
  const { seedCatalog } = await import("./seed/seed-catalog.mjs")
  const { seedCampaigns } = await import("./seed/seed-campaigns.mjs")
  const { hashSeedPassword, seedUsers } = await import("./seed/seed-users.mjs")

  console.log("A ligar à base de dados…")
  await sequelize.authenticate()

  console.log("A limpar tabelas…")
  await clearDatabase()

  console.log("A inserir dados de demonstração…")
  const passwordHash = await hashSeedPassword(password)
  await seedUsers(passwordHash)
  await seedCatalog()
  await seedCampaigns()

  console.log("\n✓ Seed concluído.\n")
  console.log(`Password para todas as contas (excepto bloqueada): ${password}\n`)
  console.log("Contas:")
  for (const row of ACCOUNTS) {
    console.log(`  • ${row.email.padEnd(22)} — ${row.role}`)
  }
  console.log("\nCampanhas de exemplo:")
  console.log("  • Inscrições abertas — Limpeza Espinho")
  console.log("  • Em progresso — Limpeza Norte (comentários para admin)")
  console.log("  • Concluída — Limpeza Primavera (recolhas para dashboard)")
  console.log("\nPara testar inscrição de voluntário:")
  console.log("  • voluntario2@demo.pt na campanha «Limpeza Espinho — Inscrições abertas»")
  console.log("  • voluntario1@demo.pt já está inscrito na mesma campanha (cancelar inscrição)")
  console.log("")

  await sequelize.close()
}

main().catch((err) => {
  console.error("Erro no seed:", err)
  process.exit(1)
})
