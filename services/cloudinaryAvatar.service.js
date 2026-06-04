import { v2 as cloudinary } from "cloudinary"
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
    throw createError(503, "Service unavailable")
  }
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
          reject(error)
          return
        }
        if (!result?.secure_url) {
          reject(new Error("Cloudinary upload returned no URL"))
          return
        }
        resolve(result)
      }
    )
    upload.end(buffer)
  })
}

// Remove o avatar do utilizador no Cloudinary, ignorando falhas silenciosamente.
export async function deleteCloudinaryAvatar(userId) {
  const { cloudName } = readCloudinaryEnv()
  if (!cloudName) return
  ensureCloudinaryConfigured()
  const publicId = avatarPublicId(userId)
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" })
  } catch {
    // Ignorar falha ao apagar avatar antigo
  }
}
