import express from "express"
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  listOrganizationMembers,
  createOrganizationMember,
  updateOrganizationMember,
  deleteOrganizationMember
} from "../controllers/organizations.controller.js"
import { verifyToken, requireRoot, requireRootOrOrgAdmin } from "../middlewares/auth.middlewares.js"

const router = express.Router()

router.use(verifyToken)

router.get("/", requireRoot, listOrganizations)
router.post("/", requireRoot, createOrganization)
router.patch("/:id", requireRoot, updateOrganization)

router.get("/:id/members", requireRootOrOrgAdmin, listOrganizationMembers)
router.post("/:id/members", requireRootOrOrgAdmin, createOrganizationMember)
router.patch("/:id/members/:userId", requireRootOrOrgAdmin, updateOrganizationMember)
router.delete("/:id/members/:userId", requireRootOrOrgAdmin, deleteOrganizationMember)

export default router
