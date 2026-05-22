import { Router } from "express"
import { authLimiter } from "../../../middlewares/rate-limit.middleware.js"
import * as authController from "../controllers/auth.controller.js"

export const authRouter = Router()

authRouter.post("/login", authLimiter, authController.login)
authRouter.post("/refresh", authController.refresh)
authRouter.post("/logout", authLimiter, authController.logout)
