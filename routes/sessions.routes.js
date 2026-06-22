import express from "express"
import { createSession, deleteCurrentSession, getCurrentSession, patchCurrentSession } from "../controllers/sessions.controller.js"
import { verifyToken } from "../middlewares/auth.middlewares.js"
import { loginLimiter } from "../utils/rate-limit.js"

const router = express.Router()

// Rate limit: 20 tentativas / 15 min em POST, PATCH e DELETE (login, refresh, logout).

router.post("/", loginLimiter, createSession)
router.get("/current", verifyToken, getCurrentSession)
router.patch("/current", loginLimiter, patchCurrentSession)
router.delete("/current", loginLimiter, deleteCurrentSession)

export default router
