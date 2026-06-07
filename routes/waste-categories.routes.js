import express from "express"
import { createWasteCategory, deleteWasteCategory, getAllWasteCategories, getWasteCategoryById, updateWasteCategory } from "../controllers/waste-categories.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middlewares.js"

const router = express.Router()

// Montagem: todas as rotas exigem verifyToken (router.use).
// Escrita (POST/PATCH/DELETE): requireRole(admin) apenas.

router.use(verifyToken)

router.get("/", getAllWasteCategories)
router.get("/:id", getWasteCategoryById)
router.post("/", requireRole("admin"), createWasteCategory)
router.patch("/:id", requireRole("admin"), updateWasteCategory)
router.delete("/:id", requireRole("admin"), deleteWasteCategory)

export default router
