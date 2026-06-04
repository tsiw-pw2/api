import express from "express"
import { getAllCampaigns, createCampaignHandler, getCampaignById, updateCampaignHandler, deleteCampaignHandler } from "../controllers/campaigns.controller.js"
import { getAllRegistrations, createRegistrationHandler, updateRegistrationHandler, deleteRegistrationHandler } from "../controllers/campaign-registrations.controller.js"
import { getAllComments, createCommentHandler, updateCommentHandler, deleteCommentHandler } from "../controllers/campaign-comments.controller.js"
import { getAllWasteCollections, createWasteCollectionHandler, updateWasteCollectionHandler, deleteWasteCollectionHandler } from "../controllers/campaign-waste-collections.controller.js"
import { verifyToken, requireRole, requireAnyRole } from "../middlewares/auth.middlewares.js"

const router = express.Router()

router.use(verifyToken)

router.get("/", getAllCampaigns)
router.post("/", requireAnyRole("admin", "organizer"), createCampaignHandler)

router.get("/:id/registrations", getAllRegistrations)
router.post("/:id/registrations", createRegistrationHandler)
router.patch("/:id/registrations/:registrationId", updateRegistrationHandler)
router.delete("/:id/registrations/:registrationId", deleteRegistrationHandler)

router.get("/:id/comments", getAllComments)
router.post("/:id/comments", createCommentHandler)
router.patch("/:id/comments/:commentId", updateCommentHandler)
router.delete("/:id/comments/:commentId", deleteCommentHandler)

router.get("/:id/waste-collections", getAllWasteCollections)
router.post("/:id/waste-collections", createWasteCollectionHandler)
router.patch("/:id/waste-collections/:collectionId", updateWasteCollectionHandler)
router.delete("/:id/waste-collections/:collectionId", deleteWasteCollectionHandler)

router.get("/:id", getCampaignById)
router.patch("/:id", requireAnyRole("admin", "organizer"), updateCampaignHandler)
router.delete("/:id", requireAnyRole("admin", "organizer"), deleteCampaignHandler)

export default router
