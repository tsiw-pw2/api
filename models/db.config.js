// Agregar modelos, testar ligação e sincronizar a BD — separado de sequelize.js para quebrar imports circulares.
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

// Reexportar a instância para controladores que precisam de funções Sequelize (ex.: LOWER no login).
export { sequelize }

// Verificar credenciais e conectividade antes de registar rotas; falhar cedo se a BD estiver inacessível.
try {
  await sequelize.authenticate()
  console.log("Connection has been established successfully.")
} catch (error) {
  console.error("Unable to connect to the database:", error)
  process.exit(1)
}

// Criar tabelas em falta conforme os modelos.
// alter:true duplica índices UNIQUE no MySQL — só activar com DB_SYNC_ALTER=1 se souberes o que fazes.
try {
  const syncOptions =
    process.env.DB_SYNC_ALTER === "1" && process.env.NODE_ENV !== "production"
      ? { alter: true }
      : {}
  await sequelize.sync(syncOptions)
  console.log("All models were synchronized successfully.")
} catch (error) {
  console.error("Error synchronizing models:", error)
  process.exit(1)
}

// Ponto único de importação de modelos na API (evitar importar ficheiros .model.js directamente).
export { User, BeachLocation, Beach, WasteType, Waste, CampaignBeach, Campaign, Registration, Comment, WasteCollection, RefreshToken }
