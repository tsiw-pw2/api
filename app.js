import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import path from "path"
import { fileURLToPath } from "url"
import apiRouter from "./routes/index.js"
import { initDatabase } from "./models/db.config.js"
import { requireJsonRestNegotiation } from "./middlewares/rest.middleware.js"
import { httpRouteDebugMiddleware, isHttpRouteDebugEnabled } from "./utils/httpRouteDebug.js"
import { API_ROOT, hateoasLink } from "./utils/hateoas.utils.js"

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
    // Valida se a origem do pedido CORS está na lista de origens permitidas.
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
    preflightContinue: true
  })
)

app.use(helmet())
app.use(express.json({ limit: "512kb" }))
app.use(express.urlencoded({ extended: true, limit: "512kb" }))
app.use(httpRouteDebugMiddleware)

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
)
app.use(requireJsonRestNegotiation)
app.use(apiRouter)

// Converte rotas não encontradas num erro 404 para o handler global.
app.use((req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`)
  error.status = 404
  next(error)
})

// Responde com JSON de erro REST, incluindo erros de validação e payloads JSON inválidos.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    err.message = "Invalid JSON payload"
    err.status = 400
  }

  const status = err.status || 500
  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json({
    description: err.message || "Internal server error",
    error_description: err.message || "Internal server error",
    ...(err.errors && { errors: err.errors }),
    _links: { api: hateoasLink(API_ROOT, "GET", "api") }
  })
})

// Devolve a instância Express configurada da API.
export function createApp() {
  return app
}

const port = Number(process.env.PORT ?? 3000)

// Inicializa a base de dados e arranca o servidor HTTP na porta configurada.
async function start() {
  await initDatabase()

  const server = app.listen(port, "127.0.0.1")

  // Mensagem de arranque e aviso de depuração de rotas quando o servidor está à escuta.
  server.once("listening", () => {
    console.log(`API listening on http://127.0.0.1:${port}`)
    if (isHttpRouteDebugEnabled()) {
      console.log("[http] route debug ON — cada pedido aparece no terminal (desliga com DEBUG_HTTP_ROUTES=0)")
    }
  })

  // Trata erro de arranque (porta ocupada ou outro) e termina o processo.
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
