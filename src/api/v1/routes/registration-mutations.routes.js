import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import * as registrationsController from "../controllers/registrations.controller.js"

export const registrationMutationsRouter = Router()

registrationMutationsRouter.patch(
  "/registrations/:id",
  authenticate,
  registrationsController.update
)
registrationMutationsRouter.delete(
  "/registrations/:id",
  authenticate,
  registrationsController.remove
)
