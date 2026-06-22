#!/usr/bin/env node
/**
 * Seed de pitch  -  apaga dados da app e repõe demonstração realista.
 *
 * Uso (na pasta api/):
 *   pnpm run db:seed
 *
 * Password: SEED_DEFAULT_PASSWORD no .env (por defeito Demo2026!)
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { IDS } from "./seed/ids.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

function assertSeedAllowed() {
  if (process.env.SEED_ALLOW === "1") return
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Seed recusado em NODE_ENV=production. Define SEED_ALLOW=1 se tiveres a certeza."
    )
    process.exit(1)
  }
}

function printGuide() {
  console.log("--- Guia rápido (pitch) ---\n")
  console.log("Campanhas de referência:")
  console.log(`  • Inscrição aberta  -  «Limpeza de Verão  -  Espinho» (${IDS.campaigns.open})`)
  console.log(`  • Inscrições encerradas  -  «Limpeza Costeira  -  Matosinhos» (${IDS.campaigns.closed})`)
  console.log(`  • Em curso (recolhas)  -  «Limpeza da Foz do Ave  -  Em curso» (${IDS.campaigns.inProgress})`)
  console.log(`  • Concluída (comentários + impacto)  -  «Limpeza de Primavera  -  Vila do Conde» (${IDS.campaigns.completed})`)
  console.log(`  • Vazia  -  «Campanha de demonstração  -  Sem dados» (${IDS.campaigns.empty})`)
  console.log("\nAuto-inscrição (botão «Inscrever-me»):")
  console.log("  • Só na campanha Espinho (estado aberta a inscrições)")
  console.log("  • voluntario2 → pode inscrever-se em Espinho")
  console.log("  • voluntario1 → já inscrita em Espinho")
  console.log("  • Comentários → só na campanha concluída (Vila do Conde)\n")
  console.log("Contagens aproximadas:")
  console.log("  • 22 utilizadores · 6 praias · 9 resíduos · 7 campanhas")
  console.log("  • ~40 inscrições · 10 comentários · 18 recolhas\n")
}

async function main() {
  assertSeedAllowed()

  const password = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
  if (!password || password.length < 8) {
    console.error("SEED_DEFAULT_PASSWORD deve ter pelo menos 8 caracteres.")
    process.exit(1)
  }

  const { sequelize } = await import("../models/db.config.js")
  const { clearDatabase } = await import("./seed/clear-database.mjs")
  const { runSeed } = await import("./seed/seed.mjs")

  console.log("A limpar tabelas…")
  await clearDatabase()

  console.log("A inserir dados de pitch…")
  const { accounts } = await runSeed(password)

  console.log("\n✓ Seed concluído.\n")
  console.log(`Password (excepto bloqueado@demo.pt): ${password}\n`)
  const coreCount = 5
  console.log("Contas principais:")
  for (const row of accounts.slice(0, coreCount)) {
    console.log(`  • ${row.email.padEnd(24)} - ${row.role}`)
  }
  if (accounts.length > coreCount) {
    console.log("\nContas extra (mesma password):")
    for (const row of accounts.slice(coreCount)) {
      console.log(`  • ${row.email.padEnd(24)} - ${row.role}`)
    }
  }

  printGuide()
  await sequelize.close()
}

main().catch((err) => {
  console.error("Erro no seed:", err)
  process.exit(1)
})
