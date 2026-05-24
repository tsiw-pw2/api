function requireMinLengthSecret(name, value) {
  if (!value || value.length < 32) {
    throw new Error(`${name} must be at least 32 characters`)
  }
}

export function validateEnv() {
  const jwtSecret = process.env.JWT_SECRET
  requireMinLengthSecret("JWT_SECRET", jwtSecret)

  const refreshSecret = process.env.REFRESH_TOKEN_SECRET ?? jwtSecret
  requireMinLengthSecret("REFRESH_TOKEN_SECRET", refreshSecret)

  const clientUrl = process.env.CLIENT_URL
  if (clientUrl) {
    let parsed
    try {
      parsed = new URL(clientUrl)
    } catch {
      throw new Error("CLIENT_URL must be a valid http or https URL")
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("CLIENT_URL must be a valid http or https URL")
    }
  }
}

const DEFAULT_CLIENT_URL = "http://localhost:5173"
const DEFAULT_JWT_EXPIRES_IN = "15m"

export const env = {
  get port() {
    return Number(process.env.PORT ?? 3000)
  },
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development"
  },
  get clientUrl() {
    return (process.env.CLIENT_URL ?? DEFAULT_CLIENT_URL).replace(/\/$/, "")
  },
  get jwtSecret() {
    return process.env.JWT_SECRET
  },
  get refreshTokenSecret() {
    return process.env.REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET
  },
  get jwtExpiresIn() {
    const raw = process.env.JWT_EXPIRES_IN
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim()
    }
    return DEFAULT_JWT_EXPIRES_IN
  },
  get cookieSecure() {
    if (process.env.COOKIE_SECURE === "1") return true
    if (process.env.COOKIE_SECURE === "0") return false
    return env.clientUrl.startsWith("https://")
  },
  db: {
    get name() {
      return process.env.DB_NAME
    },
    get user() {
      return process.env.DB_USER
    },
    get password() {
      return process.env.DB_PASSWORD
    },
    get host() {
      return process.env.DB_HOST
    },
    get port() {
      return Number(process.env.DB_PORT ?? 3306)
    },
    get dialect() {
      return process.env.DB_DIALECT ?? "mysql"
    },
    get logSql() {
      return process.env.DB_LOG_SQL === "1"
    },
    get syncForce() {
      return process.env.DB_SYNC_FORCE === "1"
    },
    get syncAlter() {
      return process.env.DB_SYNC_ALTER === "1"
    }
  }
}
