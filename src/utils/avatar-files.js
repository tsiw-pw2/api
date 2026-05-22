import fs from "fs/promises"
import path from "path"
import { AVATAR_UPLOAD_DIR } from "../config/paths.js"

const AVATAR_EXTENSIONS = [".jpg", ".png", ".webp"]

export function avatarBasenamesForUser(userId) {
  return AVATAR_EXTENSIONS.map((ext) => `${userId}${ext}`)
}

export async function deleteAllAvatarFilesForUser(userId) {
  const names = avatarBasenamesForUser(userId)
  await Promise.all(
    names.map(async (name) => {
      try {
        await fs.unlink(path.join(AVATAR_UPLOAD_DIR, name))
      } catch {
        /* ignore */
      }
    })
  )
}

export async function deleteSiblingAvatarFiles(userId, keepBasename) {
  const names = avatarBasenamesForUser(userId)
  await Promise.all(
    names.map(async (name) => {
      if (name === keepBasename) return
      try {
        await fs.unlink(path.join(AVATAR_UPLOAD_DIR, name))
      } catch {
        /* ignore */
      }
    })
  )
}
