const requiredKeys = [
  "JWT_SECRET",
  "REFRESH_TOKEN_SECRET",
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "ARGON_MEMORY_COST",
  "ARGON_TIME_COST",
  "ARGON_PARALLELISM",
  "ARGON_HASH_LENGTH"
]

const MIN_SECRET_LENGTH = 32

function assertStrongSecret(key, value) {
  const t = value.trim()
  if (t.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${key} must be at least ${MIN_SECRET_LENGTH} characters (use a long random value)`
    )
  }
}

function assertClientUrlIfPresent() {
  const raw = process.env.CLIENT_URL
  if (raw == null || typeof raw !== "string") {
    return
  }
  const t = raw.trim()
  if (t.length === 0) {
    return
  }
  try {
    const u = new URL(t)
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("CLIENT_URL must use http or https")
    }
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error("CLIENT_URL must be a valid URL")
    }
    throw e
  }
}

export function validateEnv() {
  const missing = requiredKeys.filter((key) => {
    const v = process.env[key]
    return typeof v !== "string" || v.trim().length === 0
  })
  if (missing.length > 0) {
    throw new Error(`Missing or empty environment variables: ${missing.join(", ")}`)
  }

  assertStrongSecret("JWT_SECRET", process.env.JWT_SECRET)
  assertStrongSecret("REFRESH_TOKEN_SECRET", process.env.REFRESH_TOKEN_SECRET)
  assertClientUrlIfPresent()
}

export function getArgonOptions() {
  return {
    memoryCost: Number(process.env.ARGON_MEMORY_COST),
    timeCost: Number(process.env.ARGON_TIME_COST),
    parallelism: Number(process.env.ARGON_PARALLELISM),
    hashLength: Number(process.env.ARGON_HASH_LENGTH)
  }
}
