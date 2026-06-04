import express from "express"
import { getAllWasteItems, getWasteItemByIdHandler, createWasteItemHandler, updateWasteItemHandler, deleteWasteItemHandler } from "../controllers/waste-items.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js"

const router = express.Router()

router.use(verifyToken)

router.get("/", getAllWasteItems)
router.get("/:id", getWasteItemByIdHandler)
router.post("/", requireRole("admin", "organizer"), createWasteItemHandler)
router.patch("/:id", requireRole("admin", "organizer"), updateWasteItemHandler)
router.delete("/:id", requireRole("admin", "organizer"), deleteWasteItemHandler)

export default router
