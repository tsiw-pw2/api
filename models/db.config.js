import { sequelize } from "./sequelize.js"
import { User } from "./user.model.js"
import { BeachLocation } from "./beach_location.model.js"
import { Beach } from "./beach.model.js"
import { WasteType } from "./waste_type.model.js"
import { Waste } from "./waste.model.js"
import { CampaignBeach } from "./campaign_beach.model.js"
import { Campaign } from "./campaign.model.js"
import { Registration } from "./registration.model.js"
import { Comment } from "./comment.model.js"
import { WasteCollection } from "./waste_collection.model.js"
import { RefreshToken } from "./refresh_token.model.js"

export { sequelize }

export {
  User,
  BeachLocation,
  Beach,
  WasteType,
  Waste,
  CampaignBeach,
  Campaign,
  Registration,
  Comment,
  WasteCollection,
  RefreshToken
}

let databaseReady = false

// Autentica a ligação à BD, sincroniza modelos e marca a base de dados como pronta.
export async function initDatabase() {
  if (databaseReady) return

  try {
    await sequelize.authenticate()
    console.log("Connection has been established successfully.")
  } catch (error) {
    console.error("Unable to connect to the database:", error)
    process.exit(1)
  }

  const syncForce = process.env.DB_SYNC_FORCE === "1"
  const syncAlter = process.env.DB_SYNC_ALTER === "1"
  const syncOptions = syncForce ? { force: true } : syncAlter ? { alter: true } : {}

  try {
    await sequelize.sync(syncOptions)
    console.log("All models were synchronized successfully.")
  } catch (error) {
    console.error("Error synchronizing models:", error)
    process.exit(1)
  }

  databaseReady = true
}
