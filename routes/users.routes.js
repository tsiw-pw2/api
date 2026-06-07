import express from "express"
import rateLimit from "express-rate-limit"
import {
  createUser,
  getMe,
  patchMe,
  patchMePassword,
  patchMeAvatar,
  getAllUsers,
  getUserById,
  getUserRegistrations,
  getUserOrganizedCampaigns,
  patchUserById,
  prepareAvatarUpload,
  avatarUpload
} from "../controllers/users.controller.js"
import { verifyToken, requireRole } from "../middlewares/auth.middlewares.js"

const router = express.Router()

// Ordem: /me e sub-recursos (/me/password, /me/avatar) antes de /:id.
// Rate limit: registo (POST /) e alteração de palavra-passe (10 / 15 min).
// Admin: GET/PATCH /:id e sub-recursos registrations/organized-campaigns com requireRole.

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
router.patch("/me/password", passwordChangeLimiter, verifyToken, patchMePassword)
router.patch(
  "/me/avatar",
  verifyToken,
  prepareAvatarUpload,
  avatarUpload.single("avatar"),
  patchMeAvatar
)
router.patch("/me", verifyToken, patchMe)

router.get("/", verifyToken, requireRole("admin"), getAllUsers)
router.get("/:id/registrations", verifyToken, requireRole("admin"), getUserRegistrations)
router.get("/:id/organized-campaigns", verifyToken, requireRole("admin"), getUserOrganizedCampaigns)
router.get("/:id", verifyToken, requireRole("admin"), getUserById)
router.patch("/:id", verifyToken, requireRole("admin"), patchUserById)

export default router
