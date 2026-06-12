import express from "express"
import { getAllBeaches, getBeachById, createBeach, updateBeach, deleteBeach } from "../controllers/beaches.controller.js"
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

router.get("/", getAllBeaches)
router.get("/:id", getBeachById)
router.post("/", createBeach)
router.patch("/:id", updateBeach)
router.delete("/:id", deleteBeach)

export default router
