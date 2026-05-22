import fs from "fs/promises"
import path from "path"
import { Op } from "sequelize"
import { AVATAR_UPLOAD_DIR } from "../../../config/paths.js"
import { User } from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"
import { deleteSiblingAvatarFiles } from "../../../utils/avatar-files.js"
import { isAllowedAvatarImageMagic } from "../../../utils/image-magic-bytes.js"

export function toProfileDto(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    isAdmin: user.isAdmin,
    isOrganizer: user.isOrganizer,
    isBlocked: user.isBlocked
  }
}

export async function getProfile(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["passwordHash"] }
  })
  if (!user) {
    throw ApiError.notFound()
  }
  return toProfileDto(user)
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

/**
 * @param {string} userId
 * @param {{ avatarUrl?: string | null }} user
 * @param {import("multer").File} file
 */
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
    } catch {
      /* ignore */
    }
    throw ApiError.badRequest("Invalid request")
  }

  if (!isAllowedAvatarImageMagic(head)) {
    try {
      await fs.unlink(absolutePath)
    } catch {
      /* ignore */
    }
    throw ApiError.badRequest("Invalid request")
  }

  await deleteSiblingAvatarFiles(userId, file.filename)
  user.avatarUrl = `/uploads/avatars/${file.filename}`
}

/**
 * @param {string} userId
 * @param {import("multer").File} file
 */
export async function finalizeUploadedAvatar(userId, file) {
  const user = await User.findByPk(userId)
  if (!user) {
    throw ApiError.notFound()
  }
  if (user.isBlocked) {
    throw ApiError.forbidden()
  }

  await validateAndApplyUploadedAvatarFile(userId, user, file)
  await user.save()
  return getProfile(userId)
}

/**
 * @param {string} userId
 * @param {{ name?: string, email?: string, phone?: string | null, avatarUrl?: string | null }} body
 * @param {import("multer").File | null} [uploadedFile]
 */
export async function updateProfile(userId, body, uploadedFile = null) {
  const user = await User.findByPk(userId)
  if (!user) {
    throw ApiError.notFound()
  }
  if (user.isBlocked) {
    throw ApiError.forbidden()
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (name.length === 0 || name.length > 150) {
      throw ApiError.badRequest("Invalid request")
    }
    user.name = name
  }

  if (body.email !== undefined) {
    const raw = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!isNonEmptyEmail(raw)) {
      throw ApiError.badRequest("Invalid request")
    }
    const existing = await User.findOne({
      where: {
        email: raw,
        id: { [Op.ne]: userId }
      }
    })
    if (existing) {
      throw ApiError.badRequest("Invalid request")
    }
    user.email = raw
  }

  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === "") {
      user.phone = null
    } else if (typeof body.phone === "string") {
      const phone = body.phone.trim()
      if (phone.length > 32) {
        throw ApiError.badRequest("Invalid request")
      }
      user.phone = phone.length > 0 ? phone : null
    } else {
      throw ApiError.badRequest("Invalid request")
    }
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
        throw ApiError.badRequest("Invalid request")
      } else {
        user.avatarUrl = raw
      }
    } else {
      throw ApiError.badRequest("Invalid request")
    }
  }

  await user.save()
  return getProfile(userId)
}
