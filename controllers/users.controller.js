import bcrypt from "bcryptjs"
import multer from "multer"
import { Op } from "sequelize"
import { User, Registration, Campaign, Beach, WasteCollection } from "../models/db.config.js"
import {
  attachAuthSession,
  sessionResourceLinks,
  signAccessToken
} from "../utils/auth.js"
import {
  createError,
  forwardControllerError,
  notFoundError,
  validationError,
  isUuidParam
} from "../utils/error.utils.js"
import {
  parseProfileBirthDateField,
  parsePaginationQuery,
  SESSIONS_BASE,
  toIsoDateOnly,
  USERS_BASE,
  listResponse,
  withResourceLinks
} from "../utils/hateoas.utils.js"
import {
  deleteCloudinaryAvatar,
  isCloudinaryAvatarUrlForUser,
  isStoredCloudinaryAvatarUrl,
  uploadAvatarBuffer
} from "../services/cloudinaryAvatar.service.js"
import {
  cloudinaryEnvStatus,
  isAvatarUploadDebugEnabled,
  logAvatarUpload,
  logAvatarUploadError
} from "../utils/avatarUploadDebug.js"

async function removeStoredAvatarAsset(userId, avatarUrl) {
  if (!avatarUrl || !isStoredCloudinaryAvatarUrl(avatarUrl)) return
  await deleteCloudinaryAvatar(userId)
}

// Valido a assinatura do ficheiro (magic bytes), não confio só no mimetype do cliente
function isAllowedAvatarImageMagic(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 3) {
    return false
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return true
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true
  }
  return false
}
const MAX_BLOCK_REASON_LENGTH = 2000
const BCRYPT_ROUNDS = 10
const USER_ROLES = new Set(["volunteer", "organizer", "admin"])

function resolveUserRoleKey(user) {
  if (user.isAdmin) return "admin"
  if (user.isOrganizer) return "organizer"
  return "volunteer"
}

function applyRoleToUser(user, role) {
  if (role === "admin") {
    user.isAdmin = true
    user.isOrganizer = false
    return
  }
  if (role === "organizer") {
    user.isAdmin = false
    user.isOrganizer = true
    return
  }
  user.isAdmin = false
  user.isOrganizer = false
}

export const createUser = async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!name || !email || password.length < 8) {
      return next(validationError({ credentials: ["Invalid name, email or password"] }))
    }

    const existing = await User.findOne({ where: { email } })
    if (existing) {
      return next(validationError({ credentials: ["Unable to create account"] }))
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const now = new Date()
    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      createdAt: now,
      updatedAt: now
    })

    await attachAuthSession(res, user)
    const token = signAccessToken(user)
    const resource = withResourceLinks(USERS_BASE, toProfileDto(user), {
      updateMethod: "PATCH"
    })
    resource.links.session = { href: SESSIONS_BASE, method: "POST" }
    resource.session = {
      id: "current",
      token,
      links: sessionResourceLinks()
    }
    res.status(201).location(`${USERS_BASE}/${user.id}`).json(resource)
  } catch (error) {
    forwardControllerError(error, next, "Error creating user")
  }
}

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    if (isAvatarUploadDebugEnabled()) {
      logAvatarUpload("multer_file_filter", {
        userId: _req.user?.sub ?? null,
        mimetype: file.mimetype,
        originalname: file.originalname,
        accepted: ok
      })
    }
    cb(ok ? null : validationError(["Invalid avatar file type"]), ok)
  }
})

export async function prepareAvatarUpload(req, res, next) {
  try {
    logAvatarUpload("prepare_start", {
      userId: req.user.sub,
      cloudinary: cloudinaryEnvStatus()
    })
    const user = await User.findByPk(req.user.sub, { attributes: ["id", "avatarUrl"] })
    if (user?.avatarUrl && isStoredCloudinaryAvatarUrl(user.avatarUrl)) {
      logAvatarUpload("prepare_remove_previous", {
        userId: user.id,
        previousAvatarUrl: user.avatarUrl,
        storage: "cloudinary"
      })
      await removeStoredAvatarAsset(user.id, user.avatarUrl)
    } else {
      logAvatarUpload("prepare_no_previous_cloudinary_avatar", {
        userId: req.user.sub,
        hadAvatarUrl: Boolean(user?.avatarUrl)
      })
    }
    next()
  } catch (error) {
    logAvatarUploadError("prepare_failed", error, { userId: req.user?.sub ?? null })
    forwardControllerError(error, next, "Error preparing avatar upload")
  }
}

function toProfileDto(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    birthDate: toIsoDateOnly(user.birthDate),
    role: resolveUserRoleKey(user),
    isAdmin: user.isAdmin,
    isOrganizer: user.isOrganizer,
    isBlocked: user.isBlocked,
    blockedReason: user.blockedReason ?? null,
    blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null
  }
}

function toAdminUserRow(user) {
  return {
    ...toPublicUser(user),
    phone: user.phone ?? null,
    birthDate: toIsoDateOnly(user.birthDate),
    avatarUrl: user.avatarUrl ?? null,
    role: resolveUserRoleKey(user),
    createdAt: user.createdAt ? user.createdAt.toISOString() : null
  }
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isOrganizer: user.isOrganizer,
    isBlocked: user.isBlocked,
    blockedReason: user.blockedReason,
    blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null
  }
}

async function getProfile(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["passwordHash"] }
  })
  if (!user) {
    throw notFoundError("User", userId)
  }
  return toProfileDto(user)
}

function isNonEmptyEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidAvatarUrlInput(raw, userId) {
  return isCloudinaryAvatarUrlForUser(raw, userId)
}

async function validateAndApplyUploadedAvatarFile(userId, user, file) {
  logAvatarUpload("validate_file_start", {
    userId,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size ?? null,
    hasBuffer: Buffer.isBuffer(file.buffer)
  })
  const buffer = file.buffer
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    logAvatarUpload("validate_file_rejected", { userId, reason: "empty_buffer" })
    throw validationError(["Invalid avatar file"])
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 16))
  if (!isAllowedAvatarImageMagic(head)) {
    logAvatarUpload("validate_file_rejected", { userId, reason: "magic_bytes_mismatch" })
    throw validationError(["Invalid avatar file"])
  }
  try {
    const result = await uploadAvatarBuffer(userId, buffer)
    user.avatarUrl = result.secure_url
    logAvatarUpload("validate_file_saved", { userId, newAvatarUrl: user.avatarUrl })
  } catch (error) {
    logAvatarUploadError("validate_file_upload_failed", error, { userId })
    throw validationError(["Invalid avatar file"])
  }
}

async function updateProfile(userId, body, uploadedFile = null) {
  const user = await User.findByPk(userId)
  if (!user) {
    throw notFoundError("User", userId)
  }
  if (user.isBlocked) {
    throw createError(403, "Forbidden")
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (name.length === 0 || name.length > 150) {
      throw validationError(["Invalid name"])
    }
    user.name = name
  }

  if (body.email !== undefined) {
    const raw = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!isNonEmptyEmail(raw)) {
      throw validationError(["Invalid email"])
    }
    const existing = await User.findOne({
      where: { email: raw, id: { [Op.ne]: userId } }
    })
    if (existing) {
      throw validationError(["Email already in use"])
    }
    user.email = raw
  }

  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === "") {
      user.phone = null
    } else if (typeof body.phone === "string") {
      const phone = body.phone.trim()
      if (phone.length > 32) {
        throw validationError(["Invalid phone"])
      }
      user.phone = phone.length > 0 ? phone : null
    } else {
      throw validationError(["Invalid phone"])
    }
  }

  if (body.birthDate !== undefined) {
    user.birthDate = parseProfileBirthDateField(body.birthDate)
  }

  if (uploadedFile != null) {
    logAvatarUpload("update_profile_with_file", { userId })
    await validateAndApplyUploadedAvatarFile(userId, user, uploadedFile)
  } else if (body.avatarUrl !== undefined) {
    logAvatarUpload("update_profile_avatar_url_field", {
      userId,
      avatarUrlFieldEmpty: body.avatarUrl === null || body.avatarUrl === ""
    })
    if (body.avatarUrl === null || body.avatarUrl === "") {
      await removeStoredAvatarAsset(userId, user.avatarUrl)
      user.avatarUrl = null
      logAvatarUpload("update_profile_avatar_cleared", { userId })
    } else if (typeof body.avatarUrl === "string") {
      const raw = body.avatarUrl.trim()
      if (raw.length === 0) {
        await removeStoredAvatarAsset(userId, user.avatarUrl)
        user.avatarUrl = null
        logAvatarUpload("update_profile_avatar_cleared", { userId })
      } else if (!isValidAvatarUrlInput(raw, userId)) {
        logAvatarUpload("update_profile_avatar_url_rejected", { userId, reason: "invalid_url" })
        throw validationError(["Invalid avatar URL"])
      } else {
        user.avatarUrl = raw
        logAvatarUpload("update_profile_avatar_url_set", { userId, newAvatarUrl: raw })
      }
    } else {
      throw validationError(["Invalid avatar URL"])
    }
  }

  await user.save()
  return getProfile(userId)
}

export const changePasswordMe = async (req, res, next) => {
  try {
    const currentPassword =
      typeof req.body?.currentPassword === "string" ? req.body.currentPassword : ""
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : ""
    if (!currentPassword || newPassword.length < 8) {
      return next(validationError({ password: ["Invalid password"] }))
    }
    const user = await User.findByPk(req.user.sub)
    if (!user) {
      return next(createError(401, "Unauthorized"))
    }
    if (user.isBlocked) {
      return next(createError(403, "Forbidden"))
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return next(createError(401, "Invalid credentials"))
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await user.save()
    await attachAuthSession(res, user)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error updating password")
  }
}

export const getMe = async (req, res, next) => {
  try {
    const data = await getProfile(req.user.sub)
    res.json(
      withResourceLinks(USERS_BASE, data, { updateMethod: "PATCH", collection: "allUsers" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching profile")
  }
}

export const patchMe = async (req, res, next) => {
  try {
    const multipart = (req.headers["content-type"] || "")
      .toLowerCase()
      .includes("multipart/form-data")
    const uploadedFile = multipart && req.file ? req.file : null
    logAvatarUpload("patch_me_start", {
      userId: req.user.sub,
      multipart,
      hasFile: uploadedFile != null,
      cloudinary: cloudinaryEnvStatus()
    })
    const body = multipart
      ? {
          name: req.body?.name,
          email: req.body?.email,
          phone: req.body?.phone,
          birthDate: req.body?.birthDate,
          avatarUrl: req.body?.avatarUrl
        }
      : (req.body ?? {})
    const data = await updateProfile(req.user.sub, body, uploadedFile)
    logAvatarUpload("patch_me_ok", {
      userId: req.user.sub,
      newAvatarUrl: data.avatarUrl
    })
    res.json(
      withResourceLinks(USERS_BASE, data, { updateMethod: "PATCH", collection: "allUsers" })
    )
  } catch (error) {
    logAvatarUploadError("patch_me_failed", error, { userId: req.user?.sub ?? null })
    forwardControllerError(error, next, "Error updating profile")
  }
}

export const getAllUsers = async (req, res, next) => {
  try {
    const { offset, limit, page, pageSize } = parsePaginationQuery(req.query ?? {})
    // Com role=volunteer filtro utilizadores com inscrição; uso distinct para não duplicar o count
    const volunteerOnly =
      typeof req.query?.role === "string" && req.query.role.trim().toLowerCase() === "volunteer"
    const include = volunteerOnly
      ? [{ model: Registration, as: "registrations", attributes: [], required: true }]
      : undefined
    const base = {
      attributes: { exclude: ["passwordHash"] },
      order: [["createdAt", "DESC"]],
      limit,
      offset
    }
    if (volunteerOnly) {
      Object.assign(base, { include, distinct: true, subQuery: false, col: "User.id" })
    }
    const { count, rows } = await User.findAndCountAll(base)
    const items = rows.map((u) => toAdminUserRow(u))
    res.json(
      listResponse(USERS_BASE, items, { page, pageSize, total: count }, { updateMethod: "PATCH" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching users")
  }
}

export const patchUserById = async (req, res, next) => {
  try {
    const targetId = req.params.id
    if (!isUuidParam(targetId)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    // Impeço que o admin se auto-bloqueie
    if (req.user.sub === targetId && req.body?.isBlocked !== undefined) {
      return next(createError(403, "Forbidden"))
    }
    const user = await User.findByPk(targetId)
    if (!user) {
      return next(notFoundError("user", targetId))
    }
    if (req.body?.role !== undefined) {
      const role = typeof req.body.role === "string" ? req.body.role.trim() : ""
      if (!USER_ROLES.has(role)) {
        return next(validationError({ role: ["Invalid role"] }))
      }
      if (req.user.sub === targetId && role !== "admin" && user.isAdmin) {
        return next(createError(403, "Forbidden"))
      }
      applyRoleToUser(user, role)
    }
    if (req.body?.isBlocked === true) {
      const reason =
        typeof req.body.blockedReason === "string" ? req.body.blockedReason.trim() : ""
      if (!reason || reason.length > MAX_BLOCK_REASON_LENGTH) {
        return next(validationError({ blockedReason: ["Invalid blocked reason"] }))
      }
      user.isBlocked = true
      user.blockedReason = reason
      user.blockedAt = new Date()
    } else if (req.body?.isBlocked === false) {
      user.isBlocked = false
      user.blockedReason = null
      user.blockedAt = null
    }

    if (req.body?.role !== undefined || req.body?.isBlocked !== undefined) {
      await user.save()
    }
    await user.reload()
    const resource = toAdminUserRow(user)
    res.json(
      withResourceLinks(USERS_BASE, resource, { updateMethod: "PATCH", collection: "allUsers" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error updating user")
  }
}

function campaignStatusPhase(dbStatus) {
  const db = Number(dbStatus)
  if (db === 4) return 2
  if (db === 1 || db === 2 || db === 3) return 1
  return 0
}

async function findAdminUserById(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["passwordHash"] }
  })
  if (!user) {
    throw notFoundError("User", userId)
  }
  return user
}

async function userActivityMetrics(userId) {
  const [registrationsCount, organizedCampaignsCount, wasteCollectionsCount, beachesCreatedCount] =
    await Promise.all([
      Registration.count({ where: { userId } }),
      Campaign.count({ where: { organizerId: userId } }),
      WasteCollection.count({ where: { recordedByUserId: userId } }),
      Beach.count({ where: { createdByUserId: userId } })
    ])
  return {
    registrationsCount,
    organizedCampaignsCount,
    wasteCollectionsCount,
    beachesCreatedCount
  }
}

function toAdminUserDetail(user, metrics) {
  return {
    ...toAdminUserRow(user),
    metrics
  }
}

function toUserRegistrationListItem(row) {
  const campaign = row.campaign
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    attendance: row.attendance,
    createdAt: row.createdAt.toISOString(),
    campaign: campaign
      ? {
          id: campaign.id,
          title: campaign.title,
          startDate: toIsoDateOnly(campaign.startDate),
          endDate: toIsoDateOnly(campaign.endDate),
          status: campaignStatusPhase(campaign.status)
        }
      : null
  }
}

function toUserOrganizedCampaignItem(campaign) {
  return {
    id: campaign.id,
    title: campaign.title,
    startDate: toIsoDateOnly(campaign.startDate),
    endDate: toIsoDateOnly(campaign.endDate),
    status: campaignStatusPhase(campaign.status),
    districtCode: campaign.districtCode ?? null
  }
}

export const getUserById = async (req, res, next) => {
  try {
    const userId = req.params.id
    if (!isUuidParam(userId)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    const user = await findAdminUserById(userId)
    const metrics = await userActivityMetrics(userId)
    const resource = toAdminUserDetail(user, metrics)
    res.json(
      withResourceLinks(USERS_BASE, resource, { updateMethod: "PATCH", collection: "allUsers" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching user")
  }
}

export const getUserRegistrations = async (req, res, next) => {
  try {
    const userId = req.params.id
    if (!isUuidParam(userId)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    await findAdminUserById(userId)
    const { offset, limit, page, pageSize } = parsePaginationQuery(req.query ?? {})
    const where = { userId }
    const total = await Registration.count({ where })
    const rows = await Registration.findAll({
      where,
      include: [
        {
          model: Campaign,
          as: "campaign",
          attributes: ["id", "title", "startDate", "endDate", "status"]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset
    })
    const items = rows.map((row) => toUserRegistrationListItem(row))
    res.json(
      listResponse(USERS_BASE, items, { page, pageSize, total }, { updateMethod: "PATCH" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching user registrations")
  }
}

export const getUserOrganizedCampaigns = async (req, res, next) => {
  try {
    const userId = req.params.id
    if (!isUuidParam(userId)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    await findAdminUserById(userId)
    const { offset, limit, page, pageSize } = parsePaginationQuery(req.query ?? {})
    const where = { organizerId: userId }
    const total = await Campaign.count({ where })
    const rows = await Campaign.findAll({
      where,
      attributes: ["id", "title", "startDate", "endDate", "status", "districtCode"],
      order: [["startDate", "DESC"]],
      limit,
      offset
    })
    const items = rows.map((row) => toUserOrganizedCampaignItem(row))
    res.json(
      listResponse(USERS_BASE, items, { page, pageSize, total }, { updateMethod: "PATCH" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching user campaigns")
  }
}
