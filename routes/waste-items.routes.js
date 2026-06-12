import express from "express"
import { getAllWasteItems, getWasteItemByIdHandler, createWasteItemHandler, updateWasteItemHandler, deleteWasteItemHandler } from "../controllers/waste-items.controller.js"
import {
  verifyToken,
  denyRoot,
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

router.get("/", getAllWasteItems)
router.get("/:id", getWasteItemByIdHandler)
router.post("/", createWasteItemHandler)
router.patch("/:id", updateWasteItemHandler)
router.delete("/:id", deleteWasteItemHandler)

export default router
