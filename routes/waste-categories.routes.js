import express from "express"
import { createWasteCategory, deleteWasteCategory, getAllWasteCategories, getWasteCategoryById, updateWasteCategory } from "../controllers/waste-categories.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js"

const router = express.Router()

router.use(verifyToken)

router.get("/", getAllWasteCategories)
router.get("/:id", getWasteCategoryById)
// Reservo CRUD de categorias ao admin; leitura a utilizadores autenticados
router.post("/", requireRole("admin"), createWasteCategory)
router.put("/:id", requireRole("admin"), updateWasteCategory)
router.delete("/:id", requireRole("admin"), deleteWasteCategory)

export default router
