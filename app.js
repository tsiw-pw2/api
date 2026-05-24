import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { env, validateEnv } from "./env.js"
import apiRouter from "./routes/index.js"
import { initDatabase } from "./models/db.config.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_ROOT = path.join(__dirname, "uploads")
const uploadsRoot = UPLOADS_ROOT

const app = express()

const clientUrl = env.clientUrl
const allowedOrigins = new Set([clientUrl])
if (clientUrl.includes("localhost")) {
  allowedOrigins.add(clientUrl.replace("localhost", "127.0.0.1"))
} else if (clientUrl.includes("127.0.0.1")) {
  allowedOrigins.add(clientUrl.replace("127.0.0.1", "localhost"))
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true
  })
)

app.use(helmet())
app.use("/uploads", express.static(uploadsRoot))
app.use(express.json({ limit: "512kb" }))
app.use(express.urlencoded({ extended: true, limit: "512kb" }))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
})
app.use(globalLimiter)
app.use(apiRouter)

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  const status = typeof err.status === "number" ? err.status : 500
  const body = {
    status,
    message: err.message || "Internal server error"
  }
  if (err.errors) {
    body.errors = err.errors
  }

  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json(body)
})

async function start() {
  validateEnv()
  await initDatabase()
  fs.mkdirSync(path.join(UPLOADS_ROOT, "avatars"), { recursive: true })

  const server = app.listen(env.port, "127.0.0.1")

  server.once("listening", () => {
    console.log(`API listening on http://127.0.0.1:${env.port}`)
  })

  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${env.port} is already in use. Stop the other process (lsof -i :${env.port}) or set PORT in .env and match VITE_DEV_API_PORT in web/.env.`
      )
    } else {
      console.error(err)
    }
    process.exit(1)
  })
}

void start()
