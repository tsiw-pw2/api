import express from "express"
import rateLimit from "express-rate-limit"
import { createSession, deleteCurrentSession, getCurrentSession, patchCurrentSession } from "../controllers/sessions.controller.js"
import { verifyToken } from "../middlewares/auth.middleware.js"

const router = express.Router()

// Limito a 10 pedidos / 15 min (requisito anti brute-force de auth)
const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
})

router.post("/", sessionLimiter, createSession)
router.get("/current", verifyToken, getCurrentSession)
// PATCH /current sem verifyToken: renovo só com o refresh token do cookie
router.patch("/current", sessionLimiter, patchCurrentSession)
router.delete("/current", sessionLimiter, deleteCurrentSession)

export default router
