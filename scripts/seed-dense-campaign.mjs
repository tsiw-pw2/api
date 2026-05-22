import "dotenv/config"
import { runDenseCampaignDemoSeed } from "./seeds/dense-campaign-demo.mjs"

runDenseCampaignDemoSeed().catch((e) => {
  console.error(e)
  process.exit(1)
})
