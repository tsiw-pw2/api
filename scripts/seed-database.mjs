import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const { runSeed } = await import("./seed/index.mjs")

runSeed().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
