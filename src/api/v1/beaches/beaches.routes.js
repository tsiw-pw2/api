import { Router } from "express"
import { authenticate } from "../../../middlewares/authenticate.middleware.js"
import * as beachesController from "./beaches.controller.js"

export const beachesRouter = Router()

beachesRouter.use(authenticate)

beachesRouter.get("/", beachesController.list)
beachesRouter.get("/:id", beachesController.getById)
beachesRouter.post("/", beachesController.create)
beachesRouter.patch("/:id", beachesController.update)
beachesRouter.delete("/:id", beachesController.remove)
