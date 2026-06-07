import express from "express"
import { getAllBeaches, getBeachById, createBeach, updateBeach, deleteBeach } from "../controllers/beaches.controller.js"
import { verifyToken, requireAnyRole } from "../middlewares/auth.middlewares.js"

const router = express.Router()

// Montagem: todas as rotas exigem verifyToken (router.use).
// Escrita (POST/PATCH/DELETE): requireAnyRole(admin, organizer).

router.use(verifyToken)

router.get("/", getAllBeaches)
router.get("/:id", getBeachById)
router.post("/", requireAnyRole("admin", "organizer"), createBeach)
router.patch("/:id", requireAnyRole("admin", "organizer"), updateBeach)
router.delete("/:id", requireAnyRole("admin", "organizer"), deleteBeach)

export default router
