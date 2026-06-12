import { Organization, User, UserOrganization } from "../models/db.config.js"
import { createError } from "./error.utils.js"
import { roleFromUser } from "../middlewares/auth.middlewares.js"

export const ORG_HEADER_NAME = "x-org-id"

export async function listUserOrganizationIds(userId) {
  const rows = await UserOrganization.findAll({
    where: { userId },
    attributes: ["organizationId"]
  })
  return rows.map((r) => r.organizationId)
}

export async function userBelongsToOrganization(userId, organizationId) {
  if (!userId || !organizationId) return false
  const row = await UserOrganization.findOne({
    where: { userId, organizationId }
  })
  return Boolean(row)
}

export async function getOrgMembership(userId, organizationId) {
  if (!userId || !organizationId) return null
  return UserOrganization.findOne({
    where: { userId, organizationId }
  })
}

export async function isOrgAdminFor(userId, organizationId) {
  const row = await getOrgMembership(userId, organizationId)
  return Boolean(row?.isOrgAdmin)
}

export async function resolveLoginOrganizationId(user, requestedOrgId) {
  const memberships = await listUserOrganizationIds(user.id)
  const role = roleFromUser(user)

  if (role === "organizer") {
    if (memberships.length === 0) {
      throw createError(403, "No organization membership")
    }
    if (requestedOrgId) {
      if (!memberships.includes(requestedOrgId)) {
        throw createError(403, "Forbidden")
      }
      return requestedOrgId
    }
    if (memberships.length === 1) return memberships[0]
    throw createError(400, "organizationId required")
  }

  return null
}

export async function resolveRequestOrganizationId(req) {
  const userId = req.user?.sub
  if (!userId) return null

  const role = req.user?.role
  const headerOrg =
    typeof req.headers[ORG_HEADER_NAME] === "string" ? req.headers[ORG_HEADER_NAME].trim() : ""
  const tokenOrg = typeof req.user?.orgId === "string" ? req.user.orgId : null
  const candidate = headerOrg || tokenOrg || null

  if (role === "organizer") {
    if (!candidate) {
      throw createError(400, "Organization context required")
    }
    const ok = await userBelongsToOrganization(userId, candidate)
    if (!ok) {
      throw createError(403, "Forbidden")
    }
    return candidate
  }

  return null
}

export function organizationScopeWhere(organizationId) {
  if (organizationId) return { organizationId }
  return {}
}

export async function loadOrganizationById(organizationId) {
  if (!organizationId) return null
  return Organization.findByPk(organizationId, {
    attributes: ["id", "name", "contactEmail", "municipality"]
  })
}

export async function listUserOrganizations(userId) {
  const rows = await UserOrganization.findAll({
    where: { userId },
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "municipality"]
      }
    ],
    order: [["createdAt", "ASC"]]
  })
  return rows
    .map((row) => row.organization)
    .filter(Boolean)
    .map((org) => ({
      id: org.id,
      name: org.name,
      municipality: org.municipality
    }))
}

export async function assertRootOrOrgAdmin(req, organizationId) {
  const user = await User.findByPk(req.user?.sub, { attributes: ["id", "isRoot", "deletedAt"] })
  if (!user || user.deletedAt) {
    throw createError(403, "Forbidden")
  }
  if (user.isRoot) return true
  if (!organizationId) {
    throw createError(403, "Forbidden")
  }
  const isAdmin = await isOrgAdminFor(req.user.sub, organizationId)
  if (!isAdmin) {
    throw createError(403, "Forbidden")
  }
  return true
}
