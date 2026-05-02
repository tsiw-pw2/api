import "dotenv/config"
import app from "./app.js"
import { sequelize } from "./models/index.js"

const port = Number(process.env.PORT ?? 3001)

async function start() {
  try {
    await sequelize.authenticate()
  } catch {
    console.error("Could not connect to the database.")
    process.exit(1)
  }

  app.listen(port, () => {
    console.log(`API listening on port ${port}`)
  })
}

void start()
