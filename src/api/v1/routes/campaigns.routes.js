import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import { requireOrganizerOrAdmin } from "../../../middlewares/require-organizer.middleware.js"
import * as campaignsController from "../controllers/campaigns.controller.js"
import * as registrationsController from "../controllers/registrations.controller.js"
import * as wasteCollectionsController from "../controllers/waste-collections.controller.js"
import * as commentsController from "../controllers/comments.controller.js"

export const campaignsRouter = Router()

campaignsRouter.use(authenticate)

campaignsRouter.get("/", campaignsController.list)
campaignsRouter.get("/:id", campaignsController.getById)

campaignsRouter.post("/", requireOrganizerOrAdmin, campaignsController.create)

campaignsRouter.get("/:campaignId/registrations", registrationsController.listByCampaign)
campaignsRouter.get(
  "/:campaignId/waste-collections",
  wasteCollectionsController.listByCampaign
)
campaignsRouter.get("/:campaignId/comments", commentsController.listByCampaign)
campaignsRouter.post(
  "/:campaignId/registrations",
  registrationsController.createForCampaign
)
campaignsRouter.post(
  "/:campaignId/waste-collections",
  wasteCollectionsController.createForCampaign
)
campaignsRouter.post(
  "/:campaignId/comments",
  commentsController.createForCampaign
)

campaignsRouter.patch("/:id", requireOrganizerOrAdmin, campaignsController.update)
campaignsRouter.delete("/:id", requireOrganizerOrAdmin, campaignsController.remove)
