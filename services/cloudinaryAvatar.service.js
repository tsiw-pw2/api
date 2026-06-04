import { v2 as cloudinary } from "cloudinary"
import { cloudinaryEnvStatus, logAvatarUpload, logAvatarUploadError } from "../utils/avatarUploadDebug.js"
import { createError } from "../utils/error.utils.js"

let configured = false

// Lê credenciais Cloudinary das variáveis de ambiente.
function readCloudinaryEnv() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? ""
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? ""
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? ""
  return { cloudName, apiKey, apiSecret }
}

// Configura o SDK Cloudinary na primeira utilização ou devolve as credenciais em cache.
export function ensureCloudinaryConfigured() {
  if (configured) return readCloudinaryEnv()
  const { cloudName, apiKey, apiSecret } = readCloudinaryEnv()
  if (!cloudName || !apiKey || !apiSecret) {
    logAvatarUpload("cloudinary_config_missing", cloudinaryEnvStatus())
    throw createError(503, "Service unavailable")
  }
  logAvatarUpload("cloudinary_config_ok", { cloudName })
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  })
  configured = true
  return { cloudName, apiKey, apiSecret }
}

// Devolve o identificador público Cloudinary do avatar do utilizador.
export function avatarPublicId(userId) {
  return `avatars/${userId}`
}

// Verifica se o URL é um avatar hospedado no Cloudinary configurado.
export function isStoredCloudinaryAvatarUrl(url) {
  const { cloudName } = readCloudinaryEnv()
  if (!cloudName || typeof url !== "string") return false
  const trimmed = url.trim()
  if (trimmed.length === 0) return false
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "https:") return false
    if (parsed.hostname !== "res.cloudinary.com") return false
    return parsed.pathname.includes(`/${cloudName}/`)
  } catch {
    return false
  }
}

// Verifica se o URL Cloudinary pertence ao avatar do utilizador indicado.
export function isCloudinaryAvatarUrlForUser(url, userId) {
  if (!isStoredCloudinaryAvatarUrl(url)) return false
  const trimmed = url.trim()
  const marker = `/avatars/${userId}`
  return trimmed.includes(marker)
}

// Envia o buffer da imagem para o Cloudinary e devolve o resultado do upload.
export async function uploadAvatarBuffer(userId, buffer) {
  ensureCloudinaryConfigured()
  const publicId = avatarPublicId(userId)
  logAvatarUpload("cloudinary_upload_start", {
    userId,
    publicId,
    bytes: buffer.length
  })
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "avatars",
        public_id: userId,
        overwrite: true,
        resource_type: "image",
        invalidate: true
      },
      // Trata o resultado do upload Cloudinary (sucesso ou erro).
      (error, result) => {
        if (error) {
          logAvatarUploadError("cloudinary_upload_failed", error, { userId, publicId })
          reject(error)
          return
        }
        if (!result?.secure_url) {
          const noUrlError = new Error("Cloudinary upload returned no URL")
          logAvatarUploadError("cloudinary_upload_no_url", noUrlError, { userId, publicId })
          reject(noUrlError)
          return
        }
        logAvatarUpload("cloudinary_upload_ok", {
          userId,
          publicId: result.public_id ?? publicId,
          newAvatarUrl: result.secure_url
        })
        resolve(result)
      }
    )
    upload.end(buffer)
  })
}

// Remove o avatar do utilizador no Cloudinary, ignorando falhas silenciosamente.
export async function deleteCloudinaryAvatar(userId) {
  const { cloudName } = readCloudinaryEnv()
  if (!cloudName) {
    logAvatarUpload("cloudinary_delete_skipped", { userId, reason: "cloud_name_missing" })
    return
  }
  ensureCloudinaryConfigured()
  const publicId = avatarPublicId(userId)
  logAvatarUpload("cloudinary_delete_start", { userId, publicId })
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" })
    logAvatarUpload("cloudinary_delete_ok", { userId, publicId, result: result?.result ?? "unknown" })
  } catch (error) {
    logAvatarUploadError("cloudinary_delete_failed", error, { userId, publicId })
  }
}
