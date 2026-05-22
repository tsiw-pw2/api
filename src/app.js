import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import { UPLOADS_ROOT } from "./config/paths.js"
import { apiV1Router } from "./api/v1/routes/index.js"
import { globalLimiter } from "./middlewares/rate-limit.middleware.js"
import { errorHandler } from "./middlewares/error-handler.middleware.js"

const app = express()

function buildAllowedClientOrigins() {
  const primary = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "")
  const alternate =
    primary.includes("localhost") === true
      ? primary.replace("localhost", "127.0.0.1")
      : primary.includes("127.0.0.1") === true
        ? primary.replace("127.0.0.1", "localhost")
        : null
  const set = new Set([primary])
  if (alternate != null) {
    set.add(alternate)
  }
  return [...set]
}

const allowedClientOrigins = buildAllowedClientOrigins()

app.use(
  cors({
    origin(origin, callback) {
      if (typeof origin !== "string" || origin.length === 0) {
        callback(null, true)
        return
      }
      if (allowedClientOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true
  })
)

app.use(helmet())
app.use("/uploads", express.static(UPLOADS_ROOT))
app.use(express.json({ limit: "512kb" }))
app.use(express.urlencoded({ extended: true, limit: "512kb" }))
app.use(cookieParser())

app.use("/api/v1", globalLimiter)
app.use("/api/v1", apiV1Router)

app.use(errorHandler)

export default app
