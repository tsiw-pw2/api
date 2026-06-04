import express from "express"
import { getAllBeaches, getBeachById, createBeach, updateBeach, deleteBeach } from "../controllers/beaches.controller.js"
import { verifyToken, requireAnyRole } from "../middlewares/auth.middlewares.js"

const router = express.Router()

router.use(verifyToken)

router.get("/", getAllBeaches)
router.get("/:id", getBeachById)
router.post("/", requireAnyRole("admin", "organizer"), createBeach)
router.patch("/:id", updateBeach)
router.delete("/:id", deleteBeach)

export default router
