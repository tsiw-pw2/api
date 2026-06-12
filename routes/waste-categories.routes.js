import express from "express"
import { createWasteCategory, deleteWasteCategory, getAllWasteCategories, getWasteCategoryById, updateWasteCategory } from "../controllers/waste-categories.controller.js"
import {
  verifyToken,
  denyRoot,
  requireOrgAdmin,
  requireOrgStaff,
  resolveOrganization,
  enrichOrgContext
} from "../middlewares/auth.middlewares.js"

const router = express.Router()

router.use(verifyToken)
router.use(denyRoot)
router.use(resolveOrganization)
router.use(enrichOrgContext)
router.use(requireOrgStaff)

router.get("/", getAllWasteCategories)
router.get("/:id", getWasteCategoryById)

router.post("/", requireOrgAdmin, createWasteCategory)
router.patch("/:id", requireOrgAdmin, updateWasteCategory)
router.delete("/:id", requireOrgAdmin, deleteWasteCategory)

export default router
