import "dotenv/config"
import { validateEnv } from "./config/env.js"
import app from "./app.js"
import { sequelize } from "./models/index.js"

validateEnv()

const port = Number(process.env.PORT ?? 3000)

async function start() {
  try {
    await sequelize.authenticate()
  } catch (e) {
    console.error("Could not connect to the database.")
    console.error(e)
    process.exit(1)
  }

  app.listen(port, () => {
    console.log(`API listening on port ${port}`)
  })
}

void start()
