import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import * as commentsController from "../controllers/comments.controller.js"

export const commentMutationsRouter = Router()

commentMutationsRouter.patch(
  "/comments/:id",
  authenticate,
  commentsController.updateVisibility
)
commentMutationsRouter.delete(
  "/comments/:id",
  authenticate,
  commentsController.remove
)
