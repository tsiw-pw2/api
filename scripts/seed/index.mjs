import "dotenv/config"
import bcrypt from "bcryptjs"
import {
  sequelize,
  User,
  BeachLocation,
  Beach,
  WasteType,
  Waste,
  Campaign,
  CampaignBeach,
  Registration,
  Comment,
  WasteCollection,
} from "../../models/db.config.js"
import { buildIds } from "./ids.mjs"
import { buildSeedDates } from "./dates.mjs"
import { clearDatabase } from "./clear.mjs"
import { buildDataset } from "./buildDataset.mjs"

const BCRYPT_ROUNDS = 10
const DEFAULT_PASSWORD =
  typeof process.env.SEED_DEFAULT_PASSWORD === "string" && process.env.SEED_DEFAULT_PASSWORD.length >= 8
    ? process.env.SEED_DEFAULT_PASSWORD
    : "Demo2026!"

async function applyDataset(dataset) {
  await User.bulkCreate(dataset.users)
  await BeachLocation.bulkCreate(dataset.beachLocations)
  await Beach.bulkCreate(dataset.beaches)
  await WasteType.bulkCreate(dataset.wasteTypes)
  await Waste.bulkCreate(dataset.wastes)
  await Campaign.bulkCreate(dataset.campaigns)
  await CampaignBeach.bulkCreate(dataset.campaignBeaches)
  await Registration.bulkCreate(dataset.registrations)
  await Comment.bulkCreate(dataset.comments)
  await WasteCollection.bulkCreate(dataset.wasteCollections)
}

function printSummary(password, dataset) {
  const { stats } = dataset
  console.log("Base de dados limpa e seed aplicado.")
  console.log("")
  console.log("Resumo:")
  console.log(`  Utilizadores:     ${stats.users}`)
  console.log(`  Praias:           ${stats.beaches}`)
  console.log(`  Campanhas:        ${stats.campaigns}`)
  console.log(`  Inscrições:       ${stats.registrations}`)
  console.log(`  Comentários:      ${stats.comments}`)
  console.log(`  Recolhas:         ${stats.wasteCollections}`)
  console.log("")
  console.log(`Password (todas as contas activas): ${password}`)
  console.log("")
  console.log("Contas:")
  for (const row of dataset.accounts) {
    console.log(`  ${row.email.padEnd(28)} — ${row.role}`)
  }
  console.log("")
  console.log("Cenários incluídos:")
  console.log("  • Campanha com inscrições abertas, pendentes e comentários (paginação)")
  console.log("  • Campanha em progresso com recolhas activas")
  console.log("  • Campanhas concluídas com métricas para dashboard")
  console.log("  • Estados: planeada, inscrições encerradas, cancelada")
  console.log("  • Praias em vários distritos; resíduos unit e peso")
  console.log("  • Conta bloqueada para testar acesso")
}

export async function runSeed() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS)
  const ids = buildIds()
  const dates = buildSeedDates()
  const dataset = buildDataset(ids, dates, passwordHash)

  await sequelize.authenticate()
  await sequelize.sync()
  await clearDatabase(sequelize)
  await applyDataset(dataset)
  printSummary(DEFAULT_PASSWORD, dataset)
}

const isMain = import.meta.url === new URL(process.argv[1], "file:").href

if (isMain) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .finally(async () => {
      await sequelize.close()
    })
}
