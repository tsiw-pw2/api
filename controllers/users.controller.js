import multer from "multer"
import fs from "fs/promises"
import path from "path"
import bcrypt from "bcryptjs"
import { Op } from "sequelize"
import { fileURLToPath } from "url"
import { User, Registration, Campaign, Beach, WasteCollection } from "../models/db.config.js"
import { forwardControllerError, validationError, createError, notFoundError, isUuidParam } from "../utils/error.utils.js"
import { attachAuthSession, signAccessToken, sessionResourceLinks } from "../utils/auth.js"
import {
  CAMPAIGNS_BASE,
  SESSIONS_BASE,
  USERS_BASE,
  listResponse,
  listResponseWithItemBase,
  withResourceLinks,
  parsePaginationQuery,
  parseProfileBirthDateField,
  toIsoDateOnly
} from "../utils/hateoas.utils.js"

const UPLOADS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads")
const AVATAR_UPLOAD_DIR = path.join(UPLOADS_ROOT, "avatars")
const AVATAR_EXTENSIONS = [".jpg", ".png", ".webp"]
const MAX_BLOCK_REASON_LENGTH = 2000
const BCRYPT_ROUNDS = 10
const USER_ROLES = new Set(["volunteer", "organizer", "admin"])

function avatarBasenamesForUser(userId) {
  return AVATAR_EXTENSIONS.map((ext) => `${userId}${ext}`)
}

async function deleteAllAvatarFilesForUser(userId) {
  const names = avatarBasenamesForUser(userId)
  await Promise.all(
    names.map(async (name) => {
      try {
        await fs.unlink(path.join(AVATAR_UPLOAD_DIR, name))
      } catch {}
    })
  )
}

async function deleteSiblingAvatarFiles(userId, keepFilename) {
  const names = avatarBasenamesForUser(userId).filter((n) => n !== keepFilename)
  await Promise.all(
    names.map(async (name) => {
      try {
        await fs.unlink(path.join(AVATAR_UPLOAD_DIR, name))
      } catch {}
    })
  )
}

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

function isNonEmptyEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidHttpAvatarUrl(value) {
  if (typeof value !== "string") return false
  const t = value.trim()
  if (t.length === 0 || t.length > 2048) return false
  try {
    const u = new URL(t)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

function isOwnedUploadAvatarPath(value, userId) {
  const t = typeof value === "string" ? value.trim() : ""
  const allowed = [".jpg", ".png", ".webp"].map((ext) => `/uploads/avatars/${userId}${ext}`)
  return allowed.includes(t)
}

function isValidAvatarUrlInput(raw, userId) {
  return isValidHttpAvatarUrl(raw) || isOwnedUploadAvatarPath(raw, userId)
}

async function validateAndApplyUploadedAvatarFile(userId, user, file) {
  const absolutePath =
    typeof file.path === "string" && file.path.length > 0
      ? file.path
      : path.join(AVATAR_UPLOAD_DIR, file.filename)
  let head
  try {
    const fh = await fs.open(absolutePath, "r")
    try {
      const buf = Buffer.alloc(16)
      const { bytesRead } = await fh.read(buf, 0, 16, 0)
      head = buf.subarray(0, bytesRead)
    } finally {
      await fh.close()
    }
  } catch {
    try {
      await fs.unlink(absolutePath)
    } catch {}
    throw validationError(["Invalid avatar file"])
  }

  if (!isAllowedAvatarImageMagic(head)) {
    try {
      await fs.unlink(absolutePath)
    } catch {}
    throw validationError(["Invalid avatar file"])
  }

  await deleteSiblingAvatarFiles(userId, file.filename)
  user.avatarUrl = `/uploads/avatars/${file.filename}`
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

async function registerUser(body) {
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!name || !email || password.length < 8) {
    throw validationError({ credentials: ["Invalid name, email or password"] })
  }

  const existing = await User.findOne({ where: { email } })
  if (existing) {
    throw validationError({ credentials: ["Unable to create account"] })
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

  return user
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
    await validateAndApplyUploadedAvatarFile(userId, user, uploadedFile)
  } else if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") {
      user.avatarUrl = null
    } else if (typeof body.avatarUrl === "string") {
      const raw = body.avatarUrl.trim()
      if (raw.length === 0) {
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


async function changePasswordForUser(userId, currentPassword, newPassword) {
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

async function listUsersAdmin(pagination, volunteerOnly) {
  const { offset, limit, page, pageSize } = pagination
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
  return {
    items: rows.map((u) => toAdminUserRow(u)),
    page,
    pageSize,
    total: count
  }
}

async function patchUserByIdAdmin(actorId, targetId, body) {
  if (!isUuidParam(targetId)) {
    throw validationError({ id: ["Invalid user id"] })
  }
  if (actorId === targetId && body?.isBlocked !== undefined) {
    throw createError(403, "Forbidden")
  }
  const user = await User.findByPk(targetId)
  if (!user) {
    throw notFoundError("user", targetId)
  }
  if (body?.role !== undefined) {
    const role = typeof body.role === "string" ? body.role.trim() : ""
    if (!USER_ROLES.has(role)) {
      throw validationError({ role: ["Invalid role"] })
    }
    if (actorId === targetId && role !== "admin" && user.isAdmin) {
      throw createError(403, "Forbidden")
    }
    applyRoleToUser(user, role)
  }
  if (body?.isBlocked === true) {
    const reason =
      typeof body.blockedReason === "string" ? body.blockedReason.trim() : ""
    if (!reason || reason.length > MAX_BLOCK_REASON_LENGTH) {
      throw validationError({ blockedReason: ["Invalid blocked reason"] })
    }
    user.isBlocked = true
    user.blockedReason = reason
    user.blockedAt = new Date()
  } else if (body?.isBlocked === false) {
    user.isBlocked = false
    user.blockedReason = null
    user.blockedAt = null
  }

  if (body?.role !== undefined || body?.isBlocked !== undefined) {
    await user.save()
  }
  await user.reload()
  return toAdminUserRow(user)
}

async function fetchUserByIdAdmin(userId) {
  if (!isUuidParam(userId)) {
    throw validationError({ id: ["Invalid user id"] })
  }
  const user = await findAdminUserById(userId)
  const metrics = await userActivityMetrics(userId)
  return toAdminUserDetail(user, metrics)
}

async function getUserRegistrationsAdmin(userId, pagination) {
  if (!isUuidParam(userId)) {
    throw validationError({ id: ["Invalid user id"] })
  }
  await findAdminUserById(userId)
  const { offset, limit, page, pageSize } = pagination
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
  return {
    items: rows.map((row) => toUserRegistrationListItem(row)),
    page,
    pageSize,
    total
  }
}

async function getUserOrganizedCampaignsAdmin(userId, pagination) {
  if (!isUuidParam(userId)) {
    throw validationError({ id: ["Invalid user id"] })
  }
  await findAdminUserById(userId)
  const { offset, limit, page, pageSize } = pagination
  const where = { organizerId: userId }
  const total = await Campaign.count({ where })
  const rows = await Campaign.findAll({
    where,
    attributes: ["id", "title", "startDate", "endDate", "status", "districtCode"],
    order: [["startDate", "DESC"]],
    limit,
    offset
  })
  return {
    items: rows.map((row) => toUserOrganizedCampaignItem(row)),
    page,
    pageSize,
    total
  }
}

const avatarStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, AVATAR_UPLOAD_DIR)
  },
  filename(req, file, cb) {
    const ext =
      file.mimetype === "image/jpeg"
        ? ".jpg"
        : file.mimetype === "image/png"
          ? ".png"
          : file.mimetype === "image/webp"
            ? ".webp"
            : ""
    cb(null, `${req.user.sub}${ext}`)
  }
})

export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    cb(ok ? null : validationError(["Invalid avatar file type"]), ok)
  }
})

export async function deleteExistingAvatarsBeforeUpload(req, res, next) {
  await deleteAllAvatarFilesForUser(req.user.sub)
  next()
}

export const createUser = async (req, res, next) => {
  try {
    const user = await registerUser(req.body ?? {})
    await attachAuthSession(res, user)
    const token = signAccessToken(user)
    const profile = toProfileDto(user)
    const resource = withResourceLinks(USERS_BASE, profile, { updateMethod: "PATCH" })
    resource.links = {
      ...resource.links,
      ...sessionResourceLinks({ session: { href: SESSIONS_BASE + "/current", method: "GET" } })
    }
    res.status(201).location(`${USERS_BASE}/${user.id}`).json({ ...resource, token })
  } catch (error) {
    forwardControllerError(error, next, "Error creating user")
  }
}

export const changePasswordMe = async (req, res, next) => {
  try {
    await changePasswordForUser(req.user.sub, req.body ?? {})
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error changing password")
  }
}

export const getMe = async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.sub)
    res.json(withResourceLinks(USERS_BASE, profile, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching profile")
  }
}

export const patchMe = async (req, res, next) => {
  try {
    const profile = await updateProfile(req.user.sub, req.body ?? {})
    res.json(withResourceLinks(USERS_BASE, profile, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating profile")
  }
}

export const getAllUsers = async (req, res, next) => {
  try {
    const data = await listUsersAdmin(parsePaginationQuery(req.query ?? {}))
    res.json(
      listResponse(USERS_BASE, data.items, {
        page: data.page,
        pageSize: data.pageSize,
        total: data.total
      })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching users")
  }
}

export const patchUserById = async (req, res, next) => {
  try {
  const id = req.params.id
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    const resource = await patchUserByIdAdmin(req.user.sub, id, req.body ?? {})
    res.json(withResourceLinks(USERS_BASE, resource, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating user")
  }
}

export const getUserById = async (req, res, next) => {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    const resource = await fetchUserByIdAdmin(id)
    res.json(withResourceLinks(USERS_BASE, resource, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching user")
  }
}

export const getUserRegistrations = async (req, res, next) => {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    const data = await getUserRegistrationsAdmin(id, parsePaginationQuery(req.query ?? {}))
    res.json(
      listResponseWithItemBase(
        data.items,
        (item) => `${USERS_BASE}/${id}/registrations/${item.id}`,
        { page: data.page, pageSize: data.pageSize, total: data.total },
        { updateMethod: "PATCH", collectionBase: `${USERS_BASE}/${id}/registrations` }
      )
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching user registrations")
  }
}

export const getUserOrganizedCampaigns = async (req, res, next) => {
  try {
    const id = req.params.id
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid user id"] }))
    }
    const data = await getUserOrganizedCampaignsAdmin(
      id,
      parsePaginationQuery(req.query ?? {})
    )
    res.json(
      listResponseWithItemBase(
        data.items,
        () => CAMPAIGNS_BASE,
        { page: data.page, pageSize: data.pageSize, total: data.total },
        { updateMethod: "PUT" }
      )
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching user campaigns")
  }
}
