const express = require("express")
const helmet = require("helmet")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const { globalLimiter } = require("./middlewares/rate-limit")
const { errorHandler } = require("./middlewares/error-handler")
const v1 = require("./api/v1/routes")

const isProd = process.env.NODE_ENV === "production"
const corsAllowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((s) => s.trim()).filter(Boolean)
    : null
if (isProd && (!corsAllowedOrigins || !corsAllowedOrigins.length)) {
    throw new Error("CLIENT_URL must be set in production (comma-separated for multiple origins)")
}

const app = express()

app.use(helmet())
app.use(
    cors({
        credentials: true,
        origin(origin, callback) {
            if (!isProd && !corsAllowedOrigins) {
                return callback(null, true)
            }
            if (!origin) {
                return callback(null, true)
            }
            if (corsAllowedOrigins && corsAllowedOrigins.includes(origin)) {
                return callback(null, true)
            }
            return callback(null, false)
        },
    }),
)
app.use(globalLimiter)
app.use(express.json())
app.use(cookieParser())
app.use("/api/v1", v1)
app.use(errorHandler)

module.exports = app
