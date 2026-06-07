import express from "express"
import { getAllWasteItems, getWasteItemByIdHandler, createWasteItemHandler, updateWasteItemHandler, deleteWasteItemHandler } from "../controllers/waste-items.controller.js"
import { verifyToken, requireAnyRole } from "../middlewares/auth.middlewares.js"

const router = express.Router()

// Montagem: todas as rotas exigem verifyToken (router.use).
// Escrita (POST/PATCH/DELETE): requireAnyRole(admin, organizer).

router.use(verifyToken)

router.get("/", getAllWasteItems)
router.get("/:id", getWasteItemByIdHandler)
router.post("/", requireAnyRole("admin", "organizer"), createWasteItemHandler)
router.patch("/:id", requireAnyRole("admin", "organizer"), updateWasteItemHandler)
router.delete("/:id", requireAnyRole("admin", "organizer"), deleteWasteItemHandler)

export default router
