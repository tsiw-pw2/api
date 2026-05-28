function isEnabled() {
  return process.env.DEBUG_AVATAR_UPLOAD === "1"
}

function summarizeAvatarUrl(url) {
  if (typeof url !== "string" || url.trim().length === 0) return null
  const t = url.trim()
  try {
    const parsed = new URL(t)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return "(invalid-url)"
  }
}

export function isAvatarUploadDebugEnabled() {
  return isEnabled()
}

export function logAvatarUpload(step, details = {}) {
  if (!isEnabled()) return
  const payload = { step, at: new Date().toISOString(), ...details }
  if (payload.previousAvatarUrl !== undefined) {
    payload.previousAvatarUrl = summarizeAvatarUrl(payload.previousAvatarUrl)
  }
  if (payload.newAvatarUrl !== undefined) {
    payload.newAvatarUrl = summarizeAvatarUrl(payload.newAvatarUrl)
  }
  if (payload.avatarUrl !== undefined) {
    payload.avatarUrl = summarizeAvatarUrl(payload.avatarUrl)
  }
  console.log("[avatar-upload]", JSON.stringify(payload))
}

export function logAvatarUploadError(step, error, details = {}) {
  if (!isEnabled()) return
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : "Error"
  console.error(
    "[avatar-upload]",
    JSON.stringify({
      step,
      level: "error",
      at: new Date().toISOString(),
      errorName: name,
      errorMessage: message,
      ...details
    })
  )
}

export function cloudinaryEnvStatus() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? ""
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? ""
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? ""
  return {
    cloudNameSet: cloudName.length > 0,
    apiKeySet: apiKey.length > 0,
    apiSecretSet: apiSecret.length > 0,
    cloudName
  }
}
