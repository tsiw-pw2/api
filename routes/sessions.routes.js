import express from "express"
import rateLimit from "express-rate-limit"
import { createSession, deleteCurrentSession, getCurrentSession, patchCurrentSession } from "../controllers/sessions.controller.js"
import { verifyToken } from "../middlewares/auth.middlewares.js"

const router = express.Router()

const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
})

router.post("/", sessionLimiter, createSession)
router.get("/current", verifyToken, getCurrentSession)
router.patch("/current", sessionLimiter, patchCurrentSession)
router.delete("/current", sessionLimiter, deleteCurrentSession)

export default router
