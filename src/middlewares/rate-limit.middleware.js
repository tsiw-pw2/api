import rateLimit from "express-rate-limit"

function shouldApplyRateLimits() {
  const env = (process.env.NODE_ENV ?? "").trim().toLowerCase()
  if (env === "production") return true
  const flag = process.env.RATE_LIMIT_ENABLED?.trim().toLowerCase()
  if (flag === "1" || flag === "true" || flag === "yes") return true
  return false
}

function passThrough(req, res, next) {
  next()
}

function createLimiter(options) {
  if (!shouldApplyRateLimits()) {
    return passThrough
  }
  return rateLimit(options)
}

export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
})

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
})
