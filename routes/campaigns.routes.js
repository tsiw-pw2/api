import express from "express"
import {
  getAllCampaigns,
  createCampaignHandler,
  getCampaignById,
  updateCampaignHandler,
  deleteCampaignHandler
} from "../controllers/campaigns.controller.js"
import {
  getAllRegistrations,
  createRegistrationHandler,
  updateRegistrationHandler,
  deleteRegistrationHandler
} from "../controllers/campaign-registrations.controller.js"
import {
  getAllComments,
  createCommentHandler,
  updateCommentHandler,
  deleteCommentHandler
} from "../controllers/campaign-comments.controller.js"
import {
  getAllWasteCollections,
  createWasteCollectionHandler,
  updateWasteCollectionHandler,
  deleteWasteCollectionHandler
} from "../controllers/campaign-waste-collections.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js"

const router = express.Router()

router.use(verifyToken)

router.get("/", getAllCampaigns)
router.post("/", requireRole("admin", "organizer"), createCampaignHandler)

router.get("/:campaignId/registrations", getAllRegistrations)
router.post("/:campaignId/registrations", createRegistrationHandler)
router.patch(
  "/:campaignId/registrations/:registrationId",
  updateRegistrationHandler
)
router.delete(
  "/:campaignId/registrations/:registrationId",
  deleteRegistrationHandler
)

router.get("/:campaignId/comments", getAllComments)
router.post("/:campaignId/comments", createCommentHandler)
router.patch("/:campaignId/comments/:commentId", updateCommentHandler)
router.delete("/:campaignId/comments/:commentId", deleteCommentHandler)

router.get("/:campaignId/waste-collections", getAllWasteCollections)
router.post("/:campaignId/waste-collections", createWasteCollectionHandler)
router.patch(
  "/:campaignId/waste-collections/:collectionId",
  updateWasteCollectionHandler
)
router.delete(
  "/:campaignId/waste-collections/:collectionId",
  deleteWasteCollectionHandler
)

router.get("/:id", getCampaignById)
router.put("/:id", requireRole("admin", "organizer"), updateCampaignHandler)
router.delete("/:id", requireRole("admin", "organizer"), deleteCampaignHandler)

export default router
