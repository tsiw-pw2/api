import "dotenv/config"
import { runLimpezaPraiasSeed } from "./seeds/limpeza-praias.mjs"

runLimpezaPraiasSeed().catch((e) => {
  console.error(e)
  process.exit(1)
})
