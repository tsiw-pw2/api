/**
 * Middleware de autenticação e autorização JWT (Mariva).
 *
 * - optionalVerifyToken: validar Bearer se existir, sem falhar (índice GET /).
 * - verifyToken: exigir Bearer válido; sincronizar role e tokenVersion com a BD; recusar contas bloqueadas.
 * - requireRole / requireAnyRole: autorização por papel (admin | organizer | volunteer).
 * - requireSelfOrAdmin: permitir o próprio utilizador ou administrador no :id.
 *
 * Erros 401/403 usam envelope { success, message, errors, links? } (links.login em 401).
 */
import jwt from "jsonwebtoken"
import { User } from "../models/db.config.js"

const SESSIONS_PATH = "/sessions"

function authError(res, status, message, req) {
  const body = {
    success: false,
    message,
    errors: null
  }
  const links = {}
  // Hypermedia de recuperação: login em 401; self do recurso pedido em 403.
  if (status === 401) {
    links.login = { href: SESSIONS_PATH, method: "POST" }
  }
  if (status === 403 && req?.originalUrl) {
    const path = req.originalUrl.split("?")[0]
    if (path && path !== "/") {
      links.self = { href: path, method: req.method }
    }
  }
  if (Object.keys(links).length > 0) {
    body.links = links
  }
  return res.status(status).json(body)
}

export const optionalVerifyToken = (req, res, next) => {
  // Sem Bearer: continuar anónimo (índice GET / com links públicos).
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next()
  }
  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] })
    if (typeof decoded.sub === "string" && typeof decoded.role === "string") {
      req.user = decoded
    }
  } catch {
    /* ignorar token inválido no índice público */
  }
  next()
}

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return authError(res, 401, "Token missing or invalid", req)
  }
  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] })
    if (typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
      return authError(res, 401, "Token invalid or expired", req)
    }
    // Sincronizar JWT com estado actual da BD (bloqueio, token_version, papel).
    const user = await User.findByPk(decoded.sub, {
      attributes: ["id", "tokenVersion", "isBlocked", "isAdmin", "isOrganizer"]
    })
    if (!user) {
      return authError(res, 401, "Token invalid or expired", req)
    }
    if (user.isBlocked) {
      return authError(res, 403, "Account blocked", req)
    }
    const tokenVersion = Number(decoded.tokenVersion ?? 0)
    if (tokenVersion !== Number(user.tokenVersion ?? 0)) {
      return authError(res, 401, "Token invalid or expired", req)
    }
    // Substituir role do payload pelo derivado de is_admin/is_organizer na BD.
    req.user = {
      ...decoded,
      role: roleFromUser(user)
    }
    next()
  } catch {
    return authError(res, 401, "Token invalid or expired", req)
  }
}

export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return authError(res, 403, `${role} role required`, req)
    }
    next()
  }
}

export const requireAnyRole = (...roles) => {
  const allowed = new Set(roles)
  return (req, res, next) => {
    if (!req.user?.role || !allowed.has(req.user.role)) {
      return authError(res, 403, "Insufficient permissions", req)
    }
    next()
  }
}

export function roleFromUser(user) {
  if (user?.isAdmin) return "admin"
  if (user?.isOrganizer) return "organizer"
  return "volunteer"
}

export function roleHasCapability(role, capability) {
  const caps = {
    admin: ["dashboard", "manageUsers", "manageWasteCatalog", "manageCampaigns", "manageBeaches"],
    organizer: ["dashboard", "manageCampaigns", "manageBeaches", "manageWasteCatalog"],
    volunteer: []
  }
  return (caps[role] ?? []).includes(capability)
}

export const requireSelfOrAdmin = (req, res, next) => {
  const targetId = req.params.id
  if (req.user.role === "admin" || req.user.sub === targetId) {
    return next()
  }
  return authError(res, 403, "Forbidden", req)
}
