import { Router } from "express"
import { buildApiRootResource } from "../utils/hateoas.utils.js"
import sessionsRoutes from "./sessions.routes.js"
import usersRoutes from "./users.routes.js"
import beachesRoutes from "./beaches.routes.js"
import campaignsRoutes from "./campaigns.routes.js"
import wasteCategoriesRoutes from "./waste-categories.routes.js"
import wasteItemsRoutes from "./waste-items.routes.js"
import dashboardRoutes from "./dashboard.routes.js"

const router = Router()

// Devolve o índice HATEOAS da API (descoberta de recursos).
router.get("/", (_req, res) => {
  res.json(buildApiRootResource())
})

router.use("/sessions", sessionsRoutes)
router.use("/users", usersRoutes)
router.use("/beaches", beachesRoutes)
router.use("/dashboard", dashboardRoutes)
router.use("/campaigns", campaignsRoutes)
router.use("/waste-categories", wasteCategoriesRoutes)
router.use("/waste-items", wasteItemsRoutes)

export default router
