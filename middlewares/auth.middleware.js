import jwt from "jsonwebtoken"
import { createError } from "../utils/error.utils.js"

// Deriva o papel do utilizador a partir dos flags da BD para o JWT e autorização de rotas.
export function roleFromUser(user) {
  if (user.isAdmin) return "admin"
  if (user.isOrganizer) return "organizer"
  return "volunteer"
}

// Valida o token Bearer JWT e preenche req.user com sub e role.
export function verifyToken(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    next(createError(401, "Unauthorized"))
    return
  }
  const token = header.slice(7).trim()
  if (!token) {
    next(createError(401, "Unauthorized"))
    return
  }
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    next(createError(500, "Internal server error"))
    return
  }
  try {
    // Fixo algorithms para rejeitar tokens com alg=none ou algoritmos inesperados
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] })
    if (typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
      next(createError(401, "Unauthorized"))
      return
    }
    req.user = { sub: decoded.sub, role: decoded.role }
    next()
  } catch {
    next(createError(401, "Unauthorized"))
  }
}

// Devolve middleware que exige um dos papéis indicados em req.user.role.
export function requireRole(...roles) {
  const allowed = new Set(roles)
  // Rejeita o pedido se o papel do utilizador autenticado não estiver na lista permitida.
  return (req, res, next) => {
    if (!req.user?.role || !allowed.has(req.user.role)) {
      next(createError(403, "Forbidden"))
      return
    }
    next()
  }
}

const CAPABILITY_ROLES = {
  dashboard: new Set(["admin", "organizer"]),
  settingsAdmin: new Set(["admin"])
}

// Verifica se o papel tem permissão para uma capacidade da aplicação.
export function roleHasCapability(role, capability) {
  const allowed = CAPABILITY_ROLES[capability]
  return typeof role === "string" && allowed != null && allowed.has(role)
}
