import express from "express"
import cors from "cors"

const app = express()

const corsOrigin = process.env.CLIENT_URL ?? "http://localhost:3000"

app.use(cors({ origin: corsOrigin }))

app.use(express.json())

export default app
