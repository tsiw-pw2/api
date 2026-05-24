import express from "express"
import { getAllCampaigns, createCampaignHandler, getAllRegistrations, createRegistrationHandler, updateRegistrationHandler, deleteRegistrationHandler, getAllComments, createCommentHandler, updateCommentHandler, deleteCommentHandler, getAllWasteCollections, createWasteCollectionHandler, updateWasteCollectionHandler, deleteWasteCollectionHandler, getCampaignById, updateCampaignHandler, deleteCampaignHandler } from "../controllers/campaigns.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js"

const router = express.Router()

// Exijo JWT em todas as rotas; restrinjo mutações a admin/organizador onde aplicável
router.use(verifyToken)

router.get("/", getAllCampaigns)
router.post("/", requireRole("admin", "organizer"), createCampaignHandler)

// Registo rotas aninhadas (:campaignId/...) antes de /:id para evitar colisão de params
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
