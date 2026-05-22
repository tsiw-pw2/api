import { Router } from "express"
import { authRouter } from "./auth.routes.js"
import { usersRouter } from "./users.routes.js"
import { adminUsersRouter } from "./admin-users.routes.js"
import { beachesRouter } from "./beaches.routes.js"
import { campaignsRouter } from "./campaigns.routes.js"
import { wasteRouter } from "./waste.routes.js"
import { wasteCollectionsRouter } from "./waste-collections.routes.js"
import { registrationMutationsRouter } from "./registration-mutations.routes.js"
import { dashboardRouter } from "./dashboard.routes.js"
import { commentMutationsRouter } from "./comment-mutations.routes.js"

export const apiV1Router = Router()

apiV1Router.use("/auth", authRouter)
apiV1Router.use("/users", usersRouter)
apiV1Router.use("/admin/users", adminUsersRouter)
apiV1Router.use("/beaches", beachesRouter)
apiV1Router.use("/campaigns", campaignsRouter)
apiV1Router.use("/waste", wasteRouter)
apiV1Router.use(wasteCollectionsRouter)
apiV1Router.use(registrationMutationsRouter)
apiV1Router.use("/dashboard", dashboardRouter)
apiV1Router.use(commentMutationsRouter)
