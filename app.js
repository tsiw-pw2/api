import express from "express"
import "dotenv/config"

import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"
import "./models/db.config.js"
import apiRouter from "./routes/index.js"
import { SESSIONS_BASE } from "./utils/response.utils.js"
import { clearActorContextCache } from "./utils/hypermedia.permissions.js"

export const app = express()

const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "")
const corsOrigins = [clientUrl]
if (clientUrl.includes("localhost")) {
  corsOrigins.push(clientUrl.replace("localhost", "127.0.0.1"))
}

app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(express.json())
// Limpar cache de papel do actor no início de cada pedido (hypermedia.permissions).
app.use((req, res, next) => {
  clearActorContextCache()
  next()
})
app.use(apiRouter)

app.use((req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`)
  error.status = 404
  next(error)
})

// Handler global: envelope { success, message, errors, links? } em todos os erros HTTP.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    err.message = "Invalid JSON payload"
    err.status = 400
  }

  const status = err.status || 500
  if (status >= 500) console.error(err)

  const body = {
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors ?? null
  }

  // Links de navegação REST: login (401), índice (404), self do recurso (403).
  const links = {}
  if (status === 401) {
    links.login = { href: SESSIONS_BASE, method: "POST" }
  }
  if (status === 404) {
    links.index = { href: "/", method: "GET" }
  }
  if (status === 403 && req.originalUrl) {
    const path = req.originalUrl.split("?")[0]
    if (path && path !== "/") {
      links.self = { href: path, method: req.method }
    }
  }
  if (Object.keys(links).length > 0) {
    body.links = links
  }

  res.status(status).json(body)
})

const port = Number(process.env.PORT ?? 3000)
const isMain =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  app.listen(port, "127.0.0.1", () => {
    console.log(`API listening on http://127.0.0.1:${port}`)
  })
}
