/**
 * Intermediário de autenticação e autorização JWT (Mariva).
 *
 * - optionalVerifyToken: validar Bearer se existir, sem falhar (índice GET /).
 * - verifyToken: exigir Bearer válido; sincronizar papel e tokenVersion com a BD; recusar contas bloqueadas.
 * - requireRole / requireAnyRole: autorização por papel (organizer | volunteer).
 * - requireOrgStaff / requireOrgAdmin: staff municipal com contexto de organização.
 * - requireRoot: operações de plataforma (root).
 *
 * Erros 401/403 usam envelope { success, message, errors, links? } (links.login em 401).
 */
import jwt from "jsonwebtoken"
import { User } from "../models/db.config.js"
import {
  isOrgAdminFor,
  resolveRequestOrganizationId,
  userBelongsToOrganization
} from "../utils/organization.utils.js"
import { passControllerError } from "../utils/error.utils.js"

const SESSIONS_PATH = "/sessions"

function authError(res, status, message, req) {
  const body = {
    success: false,
    message,
    errors: null
  }
  const links = {}
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

export const optionalVerifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next()
  }
  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] })
    if (typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
      return next()
    }
    const user = await User.findByPk(decoded.sub, {
      attributes: ["id", "tokenVersion", "isBlocked", "isOrganizer", "isRoot", "deletedAt"]
    })
    if (!user || user.deletedAt || user.isBlocked) {
      return next()
    }
    const tokenVersion = Number(decoded.tokenVersion ?? 0)
    if (tokenVersion !== Number(user.tokenVersion ?? 0)) {
      return next()
    }
    req.user = {
      ...decoded,
      role: roleFromUser(user),
      isRoot: Boolean(user.isRoot)
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
    const user = await User.findByPk(decoded.sub, {
      attributes: ["id", "tokenVersion", "isBlocked", "isOrganizer", "isRoot", "deletedAt"]
    })
    if (!user) {
      return authError(res, 401, "Token invalid or expired", req)
    }
    if (user.deletedAt) {
      return authError(res, 401, "Token invalid or expired", req)
    }
    if (user.isBlocked) {
      return authError(res, 403, "Account blocked", req)
    }
    const tokenVersion = Number(decoded.tokenVersion ?? 0)
    if (tokenVersion !== Number(user.tokenVersion ?? 0)) {
      return authError(res, 401, "Token invalid or expired", req)
    }
    req.user = {
      ...decoded,
      role: roleFromUser(user),
      isRoot: Boolean(user.isRoot)
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
  if (user?.isOrganizer) return "organizer"
  return "volunteer"
}

export function roleHasCapability(role, capability, isOrgAdmin = false) {
  const caps = {
    organizer: ["dashboard", "manageCampaigns", "manageBeaches", "manageWasteCatalog"],
    volunteer: []
  }
  const base = caps[role] ?? []
  if (isOrgAdmin && role === "organizer") {
    return [...base, "manageOrgTeam"].includes(capability)
  }
  return base.includes(capability)
}

export const resolveOrganization = async (req, res, next) => {
  try {
    const organizationId = await resolveRequestOrganizationId(req)
    req.organizationId = organizationId ?? null
    next()
  } catch (error) {
    passControllerError(error, next, "Organization context error")
  }
}

export const enrichOrgContext = async (req, res, next) => {
  try {
    if (req.organizationId && req.user?.sub) {
      req.isOrgAdmin = await isOrgAdminFor(req.user.sub, req.organizationId)
    } else {
      req.isOrgAdmin = false
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Organization context error")
  }
}

async function loadActiveStaffUser(userId) {
  return User.findByPk(userId, {
    attributes: ["id", "isOrganizer", "isRoot", "isBlocked", "deletedAt"]
  })
}

export const requireOrgStaff = async (req, res, next) => {
  try {
    const user = await loadActiveStaffUser(req.user?.sub)
    if (!user || user.deletedAt || user.isBlocked || user.isRoot) {
      return authError(res, 403, "Forbidden", req)
    }
    if (!user.isOrganizer) {
      return authError(res, 403, "Insufficient permissions", req)
    }
    if (!req.organizationId) {
      return authError(res, 400, "Organization context required", req)
    }
    const ok = await userBelongsToOrganization(req.user.sub, req.organizationId)
    if (!ok) {
      return authError(res, 403, "Forbidden", req)
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Organization authorization error")
  }
}

export const requireOrgAdmin = async (req, res, next) => {
  try {
    const user = await loadActiveStaffUser(req.user?.sub)
    if (!user || user.deletedAt || user.isBlocked || user.isRoot) {
      return authError(res, 403, "Forbidden", req)
    }
    if (!user.isOrganizer) {
      return authError(res, 403, "Insufficient permissions", req)
    }
    if (!req.organizationId) {
      return authError(res, 400, "Organization context required", req)
    }
    const isAdmin = await isOrgAdminFor(req.user.sub, req.organizationId)
    if (!isAdmin) {
      return authError(res, 403, "Forbidden", req)
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Organization admin authorization error")
  }
}

export const denyRoot = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user?.sub, { attributes: ["id", "isRoot", "deletedAt"] })
    if (user?.isRoot) {
      return authError(res, 403, "Forbidden", req)
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Authorization error")
  }
}

export const requireRoot = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user?.sub, { attributes: ["id", "isRoot", "deletedAt"] })
    if (!user || user.deletedAt || !user.isRoot) {
      return authError(res, 403, "Forbidden", req)
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Root authorization error")
  }
}

export const requireRootOrOrgAdmin = async (req, res, next) => {
  try {
    const organizationId = req.params.id || req.params.organizationId || req.organizationId
    const user = await User.findByPk(req.user?.sub, { attributes: ["id", "isRoot", "deletedAt"] })
    if (!user || user.deletedAt) {
      return authError(res, 403, "Forbidden", req)
    }
    if (user.isRoot) {
      return next()
    }
    if (!organizationId) {
      return authError(res, 403, "Forbidden", req)
    }
    const isAdmin = await isOrgAdminFor(req.user.sub, organizationId)
    if (!isAdmin) {
      return authError(res, 403, "Forbidden", req)
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Root or org admin authorization error")
  }
}

export const requireSelfOrAdmin = (req, res, next) => {
  const targetId = req.params.id
  if (req.user.sub === targetId) {
    return next()
  }
  return authError(res, 403, "Forbidden", req)
}
