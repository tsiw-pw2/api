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

// Testar ligação à BD
try {
  await sequelize.authenticate()
  console.log("Connection has been established successfully.")
} catch (error) {
  console.error("Unable to connect to the database:", error)
  process.exit(1)
}

// Sincronizar modelos com a BD
try {
  await sequelize.sync() // { alter: true } não usar em prod
  console.log("All models were synchronized successfully.")
} catch (error) {
  console.error("Error synchronizing models:", error)
  process.exit(1)
}

export { User, BeachLocation, Beach, WasteType, Waste, CampaignBeach, Campaign, Registration, Comment, WasteCollection, RefreshToken }
