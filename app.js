import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import path from "path"
import { fileURLToPath } from "url"
import apiRouter from "./routes/index.js"
import { initDatabase } from "./models/db.config.js"
import { httpRouteDebugMiddleware, isHttpRouteDebugEnabled } from "./utils/httpRouteDebug.js"

export const app = express()

const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "")
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
app.use(express.json({ limit: "512kb" }))
app.use(express.urlencoded({ extended: true, limit: "512kb" }))
app.use(httpRouteDebugMiddleware)

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
})
app.use(globalLimiter)

app.use(apiRouter)

app.use((req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`)
  error.status = 404
  next(error)
})

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    err.message = "Invalid JSON payload"
    err.status = 400
  }

  const status = typeof err.status === "number" ? err.status : 500
  const body = { message: err.message || "Internal server error" }
  if (err.errors) {
    body.errors = err.errors
  }

  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json(body)
})

export function createApp() {
  return app
}

const port = Number(process.env.PORT ?? 3000)

async function start() {
  await initDatabase()

  const server = app.listen(port, "127.0.0.1")

  server.once("listening", () => {
    console.log(`API listening on http://127.0.0.1:${port}`)
    if (isHttpRouteDebugEnabled()) {
      console.log("[http] route debug ON — cada pedido aparece no terminal (desliga com DEBUG_HTTP_ROUTES=0)")
    }
  })

  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Stop the other process (lsof -i :${port}) or set PORT in .env and match VITE_DEV_API_PORT in web/.env.`
      )
    } else {
      console.error(err)
    }
    process.exit(1)
  })
}

const isMainModule =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  void start()
}
