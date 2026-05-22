import multer from "multer"
import { AVATAR_UPLOAD_DIR } from "../config/paths.js"
import { deleteAllAvatarFilesForUser } from "../utils/avatar-files.js"

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

function extFromMime(mimetype) {
  if (mimetype === "image/jpeg") return ".jpg"
  if (mimetype === "image/png") return ".png"
  if (mimetype === "image/webp") return ".webp"
  return ""
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, AVATAR_UPLOAD_DIR)
  },
  filename(req, file, cb) {
    const ext = extFromMime(file.mimetype)
    const userId = req.auth.userId
    cb(null, `${userId}${ext}`)
  }
})

export async function deleteExistingAvatarsBeforeUpload(req, res, next) {
  try {
    const userId = req.auth?.userId
    if (typeof userId === "string" && userId.length > 0) {
      await deleteAllAvatarFilesForUser(userId)
    }
    next()
  } catch (e) {
    next(e)
  }
}

export const avatarUpload = multer({
  storage,
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(null, false)
  }
})

/**
 * @type {import("express").RequestHandler}
 */
export function optionalAvatarFieldForPatch(req, res, next) {
  const ct = req.headers["content-type"] || ""
  if (ct.toLowerCase().includes("multipart/form-data")) {
    const userId = req.auth?.userId
    const prepare =
      typeof userId === "string" && userId.length > 0
        ? deleteAllAvatarFilesForUser(userId)
        : Promise.resolve()
    return prepare.then(() => avatarUpload.single("avatar")(req, res, next))
  }
  next()
}
