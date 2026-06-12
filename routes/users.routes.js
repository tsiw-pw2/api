import express from "express"
import rateLimit from "express-rate-limit"
import {
  createUser,
  getMe,
  patchMe,
  patchMePassword,
  patchMeAvatar,
  deleteMe,
  prepareAvatarUpload,
  avatarUpload
} from "../controllers/users.controller.js"
import { verifyToken, resolveOrganization, enrichOrgContext } from "../middlewares/auth.middlewares.js"

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

router.get("/me", verifyToken, resolveOrganization, enrichOrgContext, getMe)
router.patch("/me/password", passwordChangeLimiter, verifyToken, patchMePassword)
router.patch(
  "/me/avatar",
  verifyToken,
  prepareAvatarUpload,
  avatarUpload.single("avatar"),
  patchMeAvatar
)
router.patch("/me", verifyToken, patchMe)
router.delete("/me", verifyToken, deleteMe)

export default router
