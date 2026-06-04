import jwt from "jsonwebtoken"

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

// Anexar req.user se o Bearer for válido; continuar sem erro se ausente ou inválido
export const optionalVerifyToken = (req, res, next) => {
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

// Verificar token Bearer e anexar payload a req.user
export const verifyToken = (req, res, next) => {
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
    req.user = decoded
    next()
  } catch {
    return authError(res, 401, "Token invalid or expired", req)
  }
}

// Exigir um papel específico (autorização)
export const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return authError(res, 403, `${role} role required`, req)
    }
    next()
  }
}

// Permitir vários papéis (extensão Mariva para rotas com admin ou organizador)
export const requireAnyRole = (...roles) => {
  const allowed = new Set(roles)
  return (req, res, next) => {
    if (!req.user?.role || !allowed.has(req.user.role)) {
      return authError(res, 403, "Insufficient permissions", req)
    }
    next()
  }
}

// Mapear flags do utilizador para o papel usado no JWT e nas regras de autorização.
export function roleFromUser(user) {
  if (user?.isAdmin) return "admin"
  if (user?.isOrganizer) return "organizer"
  return "volunteer"
}

// Verificar se o papel tem uma capacidade de domínio (ex.: dashboard, gerir campanhas).
export function roleHasCapability(role, capability) {
  const caps = {
    admin: ["dashboard", "manageUsers", "manageWasteCatalog", "manageCampaigns", "manageBeaches"],
    organizer: ["dashboard", "manageCampaigns", "manageBeaches", "manageWasteCatalog"],
    volunteer: []
  }
  return (caps[role] ?? []).includes(capability)
}

// Permitir aceder ao recurso se for o próprio utilizador ou admin.
export const requireSelfOrAdmin = (req, res, next) => {
  const targetId = req.params.id
  if (req.user.role === "admin" || req.user.sub === targetId) {
    return next()
  }
  return authError(res, 403, "Forbidden", req)
}
