import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import { requireAdmin } from "../../../middlewares/require-admin.middleware.js"
import * as adminUsersController from "../controllers/admin-users.controller.js"

export const adminUsersRouter = Router()

adminUsersRouter.use(authenticate)
adminUsersRouter.use(requireAdmin)

adminUsersRouter.get("/", adminUsersController.list)
adminUsersRouter.patch("/:id/block", adminUsersController.block)
adminUsersRouter.patch("/:id/unblock", adminUsersController.unblock)
