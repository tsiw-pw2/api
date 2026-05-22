import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import { requireOrganizerOrAdmin } from "../../../middlewares/require-organizer.middleware.js"
import * as wasteCatalogController from "./waste-catalog.controller.js"

export const wasteRouter = Router()

wasteRouter.use(authenticate)

wasteRouter.get("/", wasteCatalogController.list)
wasteRouter.get("/:id", wasteCatalogController.getById)

wasteRouter.post("/", requireOrganizerOrAdmin, wasteCatalogController.create)
wasteRouter.patch("/:id", requireOrganizerOrAdmin, wasteCatalogController.update)
wasteRouter.delete("/:id", requireOrganizerOrAdmin, wasteCatalogController.remove)
