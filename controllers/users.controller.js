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
  passControllerError,
  notFoundError,
  validationError,
  isUuidParam
} from "../utils/error.utils.js"
import { parsePhoneField, toIsoDateOnly } from "../utils/domain.utils.js"
import {
  CAMPAIGNS_BASE,
  SESSIONS_BASE,
  USERS_BASE,
  listResponse,
  parsePaginationQuery,
  userSubResourcePath,
  withCampaignResourceLinks,
  withEmbeddedCampaignLinks,
  withMeResourceLinks,
  withRegistrationResourceLinks,
  withResourceLinks
} from "../utils/response.utils.js"
import { adminUserItemActions } from "../utils/hypermedia.permissions.js"
import {
  deleteCloudinaryAvatar,
  isCloudinaryAvatarUrlForUser,
  isStoredCloudinaryAvatarUrl,
  uploadAvatarBuffer
} from "../services/cloudinaryAvatar.service.js"

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
    const resource = withMeResourceLinks(toProfileDto(user))
    resource.links.session = { href: SESSIONS_BASE, method: "POST" }
    resource.session = {
      id: "current",
      token,
      links: sessionResourceLinks()
    }
    res.status(201).location(`${USERS_BASE}/${user.id}`).json(resource)
  } catch (error) {
    passControllerError(error, next, "Error creating user")
  }
}

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    cb(ok ? null : validationError(["Invalid avatar file type"]), ok)
  }
})

export async function prepareAvatarUpload(req, res, next) {
  try {
    const user = await User.findByPk(req.user.sub, { attributes: ["id", "avatarUrl"] })
    if (user?.avatarUrl && isStoredCloudinaryAvatarUrl(user.avatarUrl)) {
      await removeStoredAvatarAsset(user.id, user.avatarUrl)
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Error preparing avatar upload")
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
  const buffer = file.buffer
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw validationError(["Invalid avatar file"])
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 16))
  if (!isAllowedAvatarImageMagic(head)) {
    throw validationError(["Invalid avatar file"])
  }
  try {
    const result = await uploadAvatarBuffer(userId, buffer)
    user.avatarUrl = result.secure_url
  } catch {
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
    user.phone = parsePhoneField(body.phone)
  }

  if (uploadedFile != null) {
    await validateAndApplyUploadedAvatarFile(userId, user, uploadedFile)
  } else if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") {
      await removeStoredAvatarAsset(userId, user.avatarUrl)
      user.avatarUrl = null
    } else if (typeof body.avatarUrl === "string") {
      const raw = body.avatarUrl.trim()
      if (raw.length === 0) {
        await removeStoredAvatarAsset(userId, user.avatarUrl)
        user.avatarUrl = null
      } else if (!isValidAvatarUrlInput(raw, userId)) {
        throw validationError(["Invalid avatar URL"])
      } else {
        user.avatarUrl = raw
      }
    } else {
      throw validationError(["Invalid avatar URL"])
    }
  }

  await user.save()
  return getProfile(userId)
}

// Actualizar palavra-passe via PATCH /users/me (corpo JSON com currentPassword e newPassword).
async function applyPasswordChange(userId, body) {
  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""
  if (!currentPassword || newPassword.length < 8) {
    throw validationError({ password: ["Invalid password"] })
  }
  const user = await User.findByPk(userId)
  if (!user) {
    throw createError(401, "Unauthorized")
  }
  if (user.isBlocked) {
    throw createError(403, "Forbidden")
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    throw createError(401, "Invalid credentials")
  }
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await user.save()
  return user
}

export const getMe = async (req, res, next) => {
  try {
    const data = await getProfile(req.user.sub)
    const extraLinks =
      req.user.role === "admin"
        ? { allUsers: { href: USERS_BASE, method: "GET" } }
        : {}
    res.json(withMeResourceLinks(data, { extraLinks }))
  } catch (error) {
    passControllerError(error, next, "Error fetching profile")
  }
}

export const patchMe = async (req, res, next) => {
  try {
    const body = req.body ?? {}
    if (body.currentPassword !== undefined || body.newPassword !== undefined) {
      throw validationError({
        password: ["Use PATCH /users/me/password to change password"]
      })
    }
    if ((req.headers["content-type"] || "").toLowerCase().includes("multipart/form-data")) {
      throw validationError({
        avatar: ["Use PATCH /users/me/avatar to upload an avatar file"]
      })
    }
    const data = await updateProfile(req.user.sub, body, null)
    const extraLinks =
      req.user.role === "admin"
        ? { allUsers: { href: USERS_BASE, method: "GET" } }
        : {}
    res.json(withMeResourceLinks(data, { extraLinks }))
  } catch (error) {
    passControllerError(error, next, "Error updating profile")
  }
}

export const patchMePassword = async (req, res, next) => {
  try {
    const user = await applyPasswordChange(req.user.sub, req.body ?? {})
    await attachAuthSession(res, user)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error updating password")
  }
}

export const patchMeAvatar = async (req, res, next) => {
  try {
    const body = {
      name: req.body?.name,
      email: req.body?.email,
      phone: req.body?.phone,
      avatarUrl: req.body?.avatarUrl
    }
    const data = await updateProfile(req.user.sub, body, req.file ?? null)
    const extraLinks =
      req.user.role === "admin"
        ? { allUsers: { href: USERS_BASE, method: "GET" } }
        : {}
    res.json(withMeResourceLinks(data, { extraLinks }))
  } catch (error) {
    passControllerError(error, next, "Error updating avatar")
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
      listResponse(USERS_BASE, items, { page, pageSize, total: count }, {
        updateMethod: "PATCH",
        query: req.query,
        omitCreate: true,
        mapItem: (item) =>
          withResourceLinks(USERS_BASE, item, {
            actions: adminUserItemActions(),
            collection: "allUsers"
          })
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching users")
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
    passControllerError(error, next, "Error updating user")
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
  const campaignDto = campaign
    ? withEmbeddedCampaignLinks({
        id: campaign.id,
        title: campaign.title,
        startDate: toIsoDateOnly(campaign.startDate),
        endDate: toIsoDateOnly(campaign.endDate),
        status: campaignStatusPhase(campaign.status)
      })
    : null
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    attendance: row.attendance,
    createdAt: row.createdAt.toISOString(),
    campaign: campaignDto
  }
}

function userAdminDetailLinks(userId) {
  return {
    registrations: {
      href: userSubResourcePath(userId, "registrations"),
      method: "GET"
    },
    organizedCampaigns: {
      href: userSubResourcePath(userId, "organized-campaigns"),
      method: "GET"
    }
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
      withResourceLinks(USERS_BASE, resource, {
        updateMethod: "PATCH",
        collection: "allUsers",
        extraLinks: userAdminDetailLinks(userId)
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching user")
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
    const collectionPath = userSubResourcePath(userId, "registrations")
    res.json(
      listResponse(collectionPath, rows, { page, pageSize, total }, {
        omitCreate: true,
        query: req.query,
        collectionLinks: {
          user: { href: `${USERS_BASE}/${userId}`, method: "GET" }
        },
        mapItem: (row) => {
          const dto = toUserRegistrationListItem(row)
          const campaignId = row.campaign?.id
          if (!campaignId) {
            return { ...dto, links: { self: { href: collectionPath, method: "GET" } } }
          }
          return withRegistrationResourceLinks(
            campaignId,
            dto,
            { self: true },
            {
              user: { href: `${USERS_BASE}/${userId}`, method: "GET" },
              campaign: { href: `${CAMPAIGNS_BASE}/${campaignId}`, method: "GET" }
            }
          )
        }
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching user registrations")
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
    const collectionPath = userSubResourcePath(userId, "organized-campaigns")
    res.json(
      listResponse(collectionPath, rows, { page, pageSize, total }, {
        omitCreate: true,
        query: req.query,
        collectionLinks: {
          user: { href: `${USERS_BASE}/${userId}`, method: "GET" },
          allCampaigns: { href: CAMPAIGNS_BASE, method: "GET" }
        },
        mapItem: (row) => withCampaignResourceLinks(toUserOrganizedCampaignItem(row))
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching user campaigns")
  }
}
