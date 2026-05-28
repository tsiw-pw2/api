import bcrypt from "bcryptjs"
import {
  Beach,
  BeachLocation,
  Campaign,
  CampaignBeach,
  Comment,
  Registration,
  User,
  Waste,
  WasteCollection,
  WasteType,
  initDatabase,
  sequelize,
} from "../../models/db.config.js"
import { buildDataset } from "./buildDataset.mjs"
import { clearDatabase } from "./clear.mjs"

const BCRYPT_ROUNDS = 10

export async function runSeed() {
  const plainPassword = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS)

  await initDatabase()
  const data = buildDataset({ passwordHash })

  console.log("A limpar base de dados…")
  await clearDatabase(sequelize)

  console.log("A inserir dados demo…")
  await User.bulkCreate(data.users)
  await BeachLocation.bulkCreate(data.beachLocations)
  await Beach.bulkCreate(data.beaches)
  await WasteType.bulkCreate(data.wasteTypes)
  await Waste.bulkCreate(data.wastes)
  await Campaign.bulkCreate(data.campaigns)
  await CampaignBeach.bulkCreate(data.campaignBeaches)
  await Registration.bulkCreate(data.registrations)
  await Comment.bulkCreate(data.comments)
  await WasteCollection.bulkCreate(data.wasteCollections)

  console.log("")
  console.log("Seed concluído com sucesso.")
  console.log("────────────────────────────────────────")
  console.log(`Utilizadores:     ${data.users.length}`)
  console.log(`Praias:           ${data.beaches.length}`)
  console.log(`Tipos de resíduo: ${data.wasteTypes.length}`)
  console.log(`Resíduos:         ${data.wastes.length}`)
  console.log(`Campanhas:        ${data.campaigns.length}`)
  console.log(`Inscrições:       ${data.registrations.length}`)
  console.log(`Comentários:      ${data.comments.length}`)
  console.log(`Recolhas:         ${data.wasteCollections.length}`)
  console.log("────────────────────────────────────────")
  console.log(`Password (todos): ${plainPassword}`)
  console.log(`Admin:            ${data.meta.accounts.admin}`)
  console.log(`Organizador:      ${data.meta.accounts.organizer}`)
  console.log(`Voluntário:       ${data.meta.accounts.volunteer}`)
  console.log(`Bloqueado:        ${data.meta.accounts.blocked}`)
  console.log("────────────────────────────────────────")
}
