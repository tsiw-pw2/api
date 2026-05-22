import "dotenv/config"
import { runQualityEdgeDemoSeed } from "./seeds/quality-edge-demo.mjs"

runQualityEdgeDemoSeed().catch((e) => {
  console.error(e)
  process.exit(1)
})
