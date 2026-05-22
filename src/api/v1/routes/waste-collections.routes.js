import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import * as wasteCollectionsController from "../controllers/waste-collections.controller.js"

export const wasteCollectionsRouter = Router()

wasteCollectionsRouter.patch(
  "/waste-collections/:id",
  authenticate,
  wasteCollectionsController.update
)
wasteCollectionsRouter.delete(
  "/waste-collections/:id",
  authenticate,
  wasteCollectionsController.remove
)
