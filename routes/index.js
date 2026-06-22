import { Router } from "express"
import sessionsRoutes from "./sessions.routes.js"
import usersRoutes from "./users.routes.js"
import beachesRoutes from "./beaches.routes.js"
import campaignsRoutes from "./campaigns.routes.js"
import wasteCategoriesRoutes from "./waste-categories.routes.js"
import wasteItemsRoutes from "./waste-items.routes.js"
import dashboardRoutes from "./dashboard.routes.js"
import { optionalVerifyToken } from "../middlewares/auth.middlewares.js"
import { clearActorContextCache } from "../utils/hypermedia.permissions.js"
import { apiRootResource } from "../utils/response.utils.js"

const router = Router()

// GET /: optionalVerifyToken — índice hypermedia filtrado por papel (links condicionais).
// Montagem: sub-routers em /sessions, /users, /beaches, /dashboards, /campaigns, /waste-*.

router.get("/", optionalVerifyToken, (_req, res) => {
  clearActorContextCache()
  res.json(apiRootResource(_req.user))
})

router.use("/sessions", sessionsRoutes)
router.use("/users", usersRoutes)
router.use("/beaches", beachesRoutes)
router.use("/dashboards", dashboardRoutes)
router.use("/campaigns", campaignsRoutes)
router.use("/waste-categories", wasteCategoriesRoutes)
router.use("/waste-items", wasteItemsRoutes)

export default router
