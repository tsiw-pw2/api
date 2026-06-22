import rateLimit, { ipKeyGenerator } from "express-rate-limit"

function rateLimitMessage(req) {
  const retryAfter = req.rateLimit?.resetTime
  if (retryAfter instanceof Date) {
    const minutes = Math.max(1, Math.ceil((retryAfter.getTime() - Date.now()) / 60_000))
    return {
      success: false,
      message: `Demasiadas tentativas. Tente novamente em cerca de ${minutes} minuto(s).`,
      errors: null
    }
  }
  return {
    success: false,
    message: "Demasiadas tentativas. Tente novamente mais tarde.",
    errors: null
  }
}

function clientIpKey(req) {
  return ipKeyGenerator(req.ip ?? "unknown")
}

export function createRateLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator ?? clientIpKey,
    handler: (req, res) => {
      res.status(429).json(rateLimitMessage(req))
    }
  })
}

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20
})

export const registrationEnrollIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30
})

export const registrationEnrollUserLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.sub ?? clientIpKey(req)
})
