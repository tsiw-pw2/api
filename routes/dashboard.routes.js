import express from "express"
import { getDashboard } from "../controllers/dashboard.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js"

const router = express.Router()

router.use(verifyToken)
router.get("/", requireRole("admin", "organizer"), getDashboard)

export default router
