import express from "express"
import rateLimit from "express-rate-limit"
import { createUser, getMe, patchMe, changePasswordMe, getAllUsers, getUserById, getUserRegistrations, getUserOrganizedCampaigns, patchUserById, prepareAvatarUpload, avatarUpload } from "../controllers/users.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middleware.js"

const router = express.Router()

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
})

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
})

router.post("/", registrationLimiter, createUser)

router.get("/me", verifyToken, getMe)
router.patch(
  "/me",
  verifyToken,
  prepareAvatarUpload,
  avatarUpload.single("avatar"),
  patchMe
)
router.patch("/me/password", passwordChangeLimiter, verifyToken, changePasswordMe)

router.get("/", verifyToken, requireRole("admin"), getAllUsers)
router.get("/:id/registrations", verifyToken, requireRole("admin"), getUserRegistrations)
router.get("/:id/campaigns", verifyToken, requireRole("admin"), getUserOrganizedCampaigns)
router.get("/:id", verifyToken, requireRole("admin"), getUserById)
router.patch("/:id", verifyToken, requireRole("admin"), patchUserById)

export default router
