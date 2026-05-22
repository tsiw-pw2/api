import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import * as dashboardController from "../controllers/dashboard.controller.js"

export const dashboardRouter = Router()

dashboardRouter.use(authenticate)

dashboardRouter.get("/overview", dashboardController.getOverview)
