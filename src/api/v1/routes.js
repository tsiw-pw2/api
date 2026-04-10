const express = require("express")
const { requireAuth } = require("../../middlewares/require-auth")
const { requireAdmin } = require("../../middlewares/require-admin")
const { requireOrganizerOrAdmin } = require("./middleware/require-organizer-or-admin")
const { authLimiter } = require("../../middlewares/rate-limit")

const auth = require("./controllers/auth.controller")
const users = require("./controllers/users.controller")
const campaigns = require("./controllers/campaigns.controller")
const beaches = require("./controllers/beaches.controller")
const registrations = require("./controllers/registrations.controller")
const comments = require("./controllers/comments.controller")
const catalog = require("./controllers/catalog.controller")
const admin = require("./controllers/admin.controller")

const router = express.Router()

router.get("/health", (req, res) => {
    res.json({ ok: true })
})

const authRoutes = express.Router()
authRoutes.use(authLimiter)
authRoutes.post("/login", auth.postLogin)
authRoutes.post("/refresh", auth.postRefresh)
authRoutes.post("/logout", auth.postLogout)

router.use("/auth", authRoutes)

router.post("/users", users.postUsers)
router.get("/users/me", requireAuth, users.getMe)
router.patch("/users/me", requireAuth, users.patchMe)

router.get("/campaigns", campaigns.getCampaigns)
router.get("/campaigns/:id/registrations", requireAuth, campaigns.listRegistrations)
router.get("/campaigns/:id/recolhas", requireAuth, campaigns.listRecolhas)
router.get("/campaigns/:id/comments", requireAuth, campaigns.getCampaignComments)
router.get("/campaigns/:id", campaigns.getCampaign)
router.post("/campaigns", requireAuth, requireOrganizerOrAdmin, campaigns.postCampaign)
router.patch("/campaigns/:id", requireAuth, campaigns.patchCampaignById)
router.delete("/campaigns/:id", requireAuth, campaigns.deleteCampaignById)
router.put("/campaigns/:id/beaches", requireAuth, campaigns.putCampaignBeaches)
router.put(
    "/campaigns/:id/beaches/:praiaId/collections",
    requireAuth,
    campaigns.putRecolha,
)
router.post("/campaigns/:id/registrations", requireAuth, campaigns.postRegistration)
router.post("/campaigns/:id/comments", requireAuth, campaigns.postCampaignComment)

router.delete("/recolhas/:id", requireAuth, campaigns.deleteRecolhaById)
router.patch("/registrations/:id", requireAuth, registrations.patchRegistration)
router.delete("/comments/:id", requireAuth, comments.deleteComment)

router.get("/beaches", beaches.getBeaches)
router.get("/beaches/:id", beaches.getBeach)

router.get("/waste-types", catalog.getWasteTypes)
router.get("/wastes", catalog.getWastes)
router.post("/waste-types", requireAuth, requireAdmin, catalog.postWasteType)
router.post("/wastes", requireAuth, requireAdmin, catalog.postWaste)
router.patch("/waste-types/:id", requireAuth, requireAdmin, catalog.patchWasteType)
router.patch("/wastes/:id", requireAuth, requireAdmin, catalog.patchWaste)

const adminRouter = express.Router()
adminRouter.get("/dashboard", admin.getDashboard)
adminRouter.get("/users", admin.getAdminUsers)
adminRouter.get("/users/:id", admin.getAdminUser)
adminRouter.patch("/users/:id/block", admin.patchBlockUser)
adminRouter.patch("/users/:id/unblock", admin.patchUnblockUser)
adminRouter.post("/locations", admin.postAdminLocation)
adminRouter.post("/beaches", admin.postAdminBeach)
adminRouter.patch("/beaches/:id", admin.patchAdminBeachById)
adminRouter.patch("/comments/:id", admin.patchAdminCommentById)

router.use("/admin", requireAuth, requireAdmin, adminRouter)

module.exports = router
