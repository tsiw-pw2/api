import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const UPLOADS_ROOT = path.join(__dirname, "../../uploads")

export const AVATAR_UPLOAD_DIR = path.join(UPLOADS_ROOT, "avatars")

fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true })
