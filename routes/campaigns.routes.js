import express from "express"
import {
  getAllCampaigns,
  createCampaignHandler,
  getCampaignById,
  updateCampaignHandler,
  deleteCampaignHandler,
  getPublicActiveCampaigns,
  getCampaignReport,
  getCampaignReportPdf
} from "../controllers/campaigns.controller.js"
import { getAllRegistrations, createRegistrationHandler, updateRegistrationHandler } from "../controllers/campaign-registrations.controller.js"
import { getAllComments, createCommentHandler, updateCommentHandler, deleteCommentHandler } from "../controllers/campaign-comments.controller.js"
import { getAllWasteCollections, createWasteCollectionHandler, updateWasteCollectionHandler, deleteWasteCollectionHandler } from "../controllers/campaign-waste-collections.controller.js"
import {
  verifyToken,
  denyRoot,
  requireOrgStaff,
  resolveOrganization,
  enrichOrgContext
} from "../middlewares/auth.middlewares.js"

const router = express.Router()

router.get("/public/active", getPublicActiveCampaigns)

router.use(verifyToken)
router.use(resolveOrganization)
router.use(enrichOrgContext)

router.get("/", getAllCampaigns)
router.post("/", denyRoot, requireOrgStaff, createCampaignHandler)

router.get("/:id/registrations", getAllRegistrations)
router.post("/:id/registrations", denyRoot, createRegistrationHandler)
router.patch("/:id/registrations/:registrationId", denyRoot, updateRegistrationHandler)

router.get("/:id/comments", getAllComments)
router.post("/:id/comments", denyRoot, createCommentHandler)
router.patch("/:id/comments/:commentId", denyRoot, updateCommentHandler)
router.delete("/:id/comments/:commentId", denyRoot, deleteCommentHandler)

router.get("/:id/report.pdf", denyRoot, requireOrgStaff, getCampaignReportPdf)
router.get("/:id/report", denyRoot, requireOrgStaff, getCampaignReport)

router.get("/:id/waste-collections", getAllWasteCollections)
router.post("/:id/waste-collections", denyRoot, createWasteCollectionHandler)
router.patch("/:id/waste-collections/:collectionId", denyRoot, updateWasteCollectionHandler)
router.delete("/:id/waste-collections/:collectionId", denyRoot, deleteWasteCollectionHandler)

router.get("/:id", getCampaignById)
router.patch("/:id", denyRoot, requireOrgStaff, updateCampaignHandler)
router.delete("/:id", denyRoot, requireOrgStaff, deleteCampaignHandler)

export default router
