import { Router } from "express"
import {
  avatarUpload,
  deleteExistingAvatarsBeforeUpload,
  optionalAvatarFieldForPatch
} from "../../../middlewares/avatar-upload.middleware.js"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import * as meController from "../controllers/me.controller.js"

export const usersRouter = Router()

usersRouter.use(authenticate)

usersRouter.get("/me", meController.getMe)
usersRouter.patch("/me", optionalAvatarFieldForPatch, meController.patchMe)
usersRouter.post(
  "/me/avatar",
  deleteExistingAvatarsBeforeUpload,
  avatarUpload.single("avatar"),
  meController.postAvatar
)
