// Ponto de entrada da API Express: CORS, JSON, rotas, manuseador global de erros.
import express from "express"
import "dotenv/config"

import cors from "cors"
import helmet from "helmet"
import { createRateLimiter } from "./utils/rate-limit.js"
import { fileURLToPath } from "url"
import path from "path"
// Efeito secundário: autenticar e sincronizar a BD antes de montar as rotas.
import "./models/db.config.js"
import apiRouter from "./routes/index.js"
import { SESSIONS_BASE } from "./utils/response.utils.js"
import { clearActorContextCache } from "./utils/hypermedia.permissions.js"

export const app = express()

const isProduction = process.env.NODE_ENV === "production"

if (isProduction) {
  app.use(helmet())
}

const globalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300
})

// Aceitar o cliente Vite em localhost e 127.0.0.1 (mesma origem lógica, host distinto no navegador).
const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "")
const corsOrigins = [clientUrl]
if (clientUrl.includes("localhost")) {
  corsOrigins.push(clientUrl.replace("localhost", "127.0.0.1"))
}

// credenciais: true para enviar o cookie httpOnly do token de actualização nas rotas de sessão.
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(express.json())
// Limpar memória intermédia de papel do utilizador autenticado no início de cada pedido (hipermedia.permissions).
app.use((req, res, next) => {
  clearActorContextCache()
  next()
})
app.use(globalApiLimiter)
app.use(apiRouter)

app.use((req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`)
  error.status = 404
  next(error)
})

// manuseador global: envelope { success, message, errors, links? } em todos os erros HTTP.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    err.message = "Invalid JSON payload"
    err.status = 400
  }

  const status = err.status || 500
  if (status >= 500) console.error(err)

  const clientMessage =
    status >= 500 && isProduction
      ? "Erro interno do servidor."
      : err.message || "Internal Server Error"

  const body = {
    success: false,
    message: clientMessage,
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
const host = process.env.HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1")
// Só arrancar o servidor quando este ficheiro é o módulo principal (node app.js), não em testes que importam app.
const isMain =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  app.listen(port, host, () => {
    console.log(`API listening on http://${host}:${port}`)
  })
}
