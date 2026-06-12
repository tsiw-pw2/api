import express from "express"
import { getDashboard } from "../controllers/dashboard.controller.js"
import {
  verifyToken,
  denyRoot,
  resolveOrganization,
  enrichOrgContext
} from "../middlewares/auth.middlewares.js"

const router = express.Router()

router.use(verifyToken)
router.use(denyRoot)
router.use(resolveOrganization)
router.use(enrichOrgContext)
router.get("/overview", getDashboard)
router.get("/", getDashboard)

export default router
