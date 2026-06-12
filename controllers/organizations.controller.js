import bcrypt from "bcryptjs"
import { Organization, User, UserOrganization } from "../models/db.config.js"
import {
  createError,
  notFoundError,
  passControllerError,
  validationError,
  isUuidParam
} from "../utils/error.utils.js"
import { parseProfileBirthDateField } from "../utils/domain.utils.js"
import { bumpUserTokenVersion } from "../utils/auth.js"
import { ORGANIZATIONS_BASE, withResourceLinks } from "../utils/response.utils.js"
import { orgMemberItemActions } from "../utils/hypermedia.permissions.js"

const BCRYPT_ROUNDS = 10
const MAX_BLOCK_REASON_LENGTH = 2000
const MAX_ORG_NAME_LENGTH = 255
const MAX_MUNICIPALITY_LENGTH = 128
const MAX_EMAIL_LENGTH = 255

function mapOrganizationRow(org, memberCount = 0) {
  return {
    id: org.id,
    name: org.name,
    municipality: org.municipality,
    contactEmail: org.contactEmail ?? null,
    memberCount,
    createdAt: org.createdAt ? org.createdAt.toISOString() : null,
    updatedAt: org.updatedAt ? org.updatedAt.toISOString() : null
  }
}

function mapMemberRow(row) {
  const user = row.user
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    isOrgAdmin: Boolean(row.isOrgAdmin),
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          isOrganizer: Boolean(user.isOrganizer),
          isBlocked: Boolean(user.isBlocked)
        }
      : null
  }
}

function parseOrganizationBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const municipality = typeof raw.municipality === "string" ? raw.municipality.trim() : ""
  const contactEmailRaw = typeof raw.contactEmail === "string" ? raw.contactEmail.trim() : ""
  const contactEmail = contactEmailRaw.length > 0 ? contactEmailRaw.toLowerCase() : null

  if (!name || !municipality) {
    throw validationError({
      ...(!name ? { name: ["Name is required"] } : {}),
      ...(!municipality ? { municipality: ["Municipality is required"] } : {})
    })
  }
  if (name.length > MAX_ORG_NAME_LENGTH || municipality.length > MAX_MUNICIPALITY_LENGTH) {
    throw validationError({ name: ["Name or municipality too long"] })
  }
  if (contactEmail && (contactEmail.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
    throw validationError({ contactEmail: ["Invalid contact email"] })
  }

  return { name, municipality, contactEmail }
}

function parseMemberCreateBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : ""
  const password = typeof raw.password === "string" ? raw.password : ""
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : null

  if (!name || !email || password.length < 8) {
    throw validationError({ credentials: ["Invalid name, email or password"] })
  }

  let birthDate
  try {
    birthDate = parseProfileBirthDateField(raw.birthDate)
  } catch (error) {
    throw error
  }

  const isOrgAdmin = raw.isOrgAdmin === true

  return { name, email, password, birthDate, phone, isOrgAdmin }
}

async function loadOrganizationOrThrow(id) {
  if (!isUuidParam(id)) {
    throw validationError(["Invalid id"])
  }
  const org = await Organization.findByPk(id)
  if (!org) {
    throw notFoundError("Organization", id)
  }
  return org
}

/**
 * Listar organizações (root).
 * Método: GET
 * Rota: /organizations
 */
export const listOrganizations = async (_req, res, next) => {
  try {
    const rows = await Organization.findAll({ order: [["name", "ASC"]] })
    const memberCounts = await UserOrganization.findAll({
      attributes: ["organizationId"],
      raw: true
    })
    const countByOrg = new Map()
    for (const row of memberCounts) {
      const key = row.organizationId
      countByOrg.set(key, (countByOrg.get(key) ?? 0) + 1)
    }
    const items = rows.map((org) => mapOrganizationRow(org, countByOrg.get(org.id) ?? 0))
    res.json({
      items,
      links: {
        self: { href: ORGANIZATIONS_BASE, method: "GET" },
        create: { href: ORGANIZATIONS_BASE, method: "POST" }
      }
    })
  } catch (error) {
    passControllerError(error, next, "Error listing organizations")
  }
}

/**
 * Criar organização (root).
 * Método: POST
 * Rota: /organizations
 */
export const createOrganization = async (req, res, next) => {
  try {
    const { name, municipality, contactEmail } = parseOrganizationBody(req.body ?? {})
    const now = new Date()
    const org = await Organization.create({
      name,
      municipality,
      contactEmail,
      createdAt: now,
      updatedAt: now
    })
    const resource = mapOrganizationRow(org, 0)
    const response = withResourceLinks(ORGANIZATIONS_BASE, resource, {
      extraLinks: {
        members: { href: `${ORGANIZATIONS_BASE}/${org.id}/members`, method: "GET" }
      }
    })
    res.status(201).location(`${ORGANIZATIONS_BASE}/${org.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating organization")
  }
}

/**
 * Actualizar organização (root).
 * Método: PATCH
 * Rota: /organizations/:id
 */
export const updateOrganization = async (req, res, next) => {
  try {
    const org = await loadOrganizationOrThrow(req.params.id)
    const { name, municipality, contactEmail } = parseOrganizationBody(req.body ?? {})
    org.name = name
    org.municipality = municipality
    org.contactEmail = contactEmail
    org.updatedAt = new Date()
    await org.save()
    const memberCount = await UserOrganization.count({ where: { organizationId: org.id } })
    const resource = mapOrganizationRow(org, memberCount)
    res.json(
      withResourceLinks(`${ORGANIZATIONS_BASE}/${org.id}`, resource, {
        extraLinks: {
          members: { href: `${ORGANIZATIONS_BASE}/${org.id}/members`, method: "GET" }
        }
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error updating organization")
  }
}

/**
 * Listar membros de uma organização (root).
 * Método: GET
 * Rota: /organizations/:id/members
 */
export const listOrganizationMembers = async (req, res, next) => {
  try {
    await loadOrganizationOrThrow(req.params.id)
    const rows = await UserOrganization.findAll({
      where: { organizationId: req.params.id },
      include: [{ model: User, as: "user", attributes: ["id", "name", "email", "isOrganizer", "isBlocked"] }],
      order: [["createdAt", "ASC"]]
    })
    res.json({
      items: rows.map((row) =>
        withResourceLinks(`${ORGANIZATIONS_BASE}/${req.params.id}/members`, mapMemberRow(row), {
          actions: orgMemberItemActions(),
          updateMethod: "PATCH"
        })
      ),
      links: {
        self: { href: `${ORGANIZATIONS_BASE}/${req.params.id}/members`, method: "GET" },
        create: { href: `${ORGANIZATIONS_BASE}/${req.params.id}/members`, method: "POST" }
      }
    })
  } catch (error) {
    passControllerError(error, next, "Error listing organization members")
  }
}

/**
 * Criar conta de organizador e associar à organização (root).
 * Método: POST
 * Rota: /organizations/:id/members
 */
export const createOrganizationMember = async (req, res, next) => {
  try {
    const org = await loadOrganizationOrThrow(req.params.id)
    const { name, email, password, birthDate, phone, isOrgAdmin } = parseMemberCreateBody(req.body ?? {})

    const existing = await User.findOne({ where: { email } })
    if (existing) {
      throw validationError({ email: ["Email already in use"] })
    }

    const now = new Date()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await User.create({
      name,
      email,
      birthDate,
      phone,
      passwordHash,
      isAdmin: false,
      isRoot: false,
      isOrganizer: true,
      isBlocked: false,
      createdAt: now,
      updatedAt: now
    })

    const membership = await UserOrganization.create({
      userId: user.id,
      organizationId: org.id,
      isOrgAdmin,
      createdAt: now
    })

    const full = await UserOrganization.findByPk(membership.id, {
      include: [{ model: User, as: "user", attributes: ["id", "name", "email", "isOrganizer", "isBlocked"] }]
    })

    res
      .status(201)
      .location(`${ORGANIZATIONS_BASE}/${org.id}/members/${membership.id}`)
      .json(mapMemberRow(full))
  } catch (error) {
    passControllerError(error, next, "Error creating organization member")
  }
}

/**
 * Actualizar membro da organização (root ou admin da org).
 * Método: PATCH
 * Rota: /organizations/:id/members/:userId
 */
export const updateOrganizationMember = async (req, res, next) => {
  try {
    await loadOrganizationOrThrow(req.params.id)
    if (!isUuidParam(req.params.userId)) {
      throw validationError(["Invalid user id"])
    }

    const row = await UserOrganization.findOne({
      where: { organizationId: req.params.id, userId: req.params.userId },
      include: [{ model: User, as: "user" }]
    })
    if (!row) {
      throw notFoundError("Organization membership")
    }

    const targetUser = row.user
    if (!targetUser || targetUser.isRoot) {
      throw createError(403, "Forbidden")
    }

    if (req.user.sub === req.params.userId && req.body?.isBlocked === true) {
      throw createError(403, "Forbidden")
    }

    const body = req.body ?? {}
    if (body.isOrgAdmin !== undefined) {
      if (typeof body.isOrgAdmin !== "boolean") {
        throw validationError({ isOrgAdmin: ["isOrgAdmin must be a boolean"] })
      }
      if (req.user.sub === req.params.userId && body.isOrgAdmin === false && row.isOrgAdmin) {
        throw createError(403, "Forbidden")
      }
      row.isOrgAdmin = body.isOrgAdmin
      await row.save()
    }

    if (body.isBlocked === true) {
      const reason = typeof body.blockedReason === "string" ? body.blockedReason.trim() : ""
      if (!reason || reason.length > MAX_BLOCK_REASON_LENGTH) {
        throw validationError({ blockedReason: ["Invalid blocked reason"] })
      }
      targetUser.isBlocked = true
      targetUser.blockedReason = reason
      targetUser.blockedAt = new Date()
      await targetUser.save()
      await bumpUserTokenVersion(targetUser)
    } else if (body.isBlocked === false) {
      targetUser.isBlocked = false
      targetUser.blockedReason = null
      targetUser.blockedAt = null
      await targetUser.save()
      await bumpUserTokenVersion(targetUser)
    }

    const full = await UserOrganization.findByPk(row.id, {
      include: [{ model: User, as: "user", attributes: ["id", "name", "email", "isOrganizer", "isBlocked"] }]
    })

    res.json(
      withResourceLinks(`${ORGANIZATIONS_BASE}/${req.params.id}/members`, mapMemberRow(full), {
        actions: orgMemberItemActions(),
        updateMethod: "PATCH"
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error updating organization member")
  }
}

/**
 * Remover associação utilizador ↔ organização (root ou admin da org).
 * Método: DELETE
 * Rota: /organizations/:id/members/:userId
 */
export const deleteOrganizationMember = async (req, res, next) => {
  try {
    await loadOrganizationOrThrow(req.params.id)
    if (!isUuidParam(req.params.userId)) {
      throw validationError(["Invalid user id"])
    }

    const row = await UserOrganization.findOne({
      where: { organizationId: req.params.id, userId: req.params.userId }
    })
    if (!row) {
      throw notFoundError("Organization membership")
    }

    const targetUser = await User.findByPk(req.params.userId, { attributes: ["id", "isRoot"] })
    if (targetUser?.isRoot) {
      throw createError(403, "Forbidden")
    }

    await row.destroy()
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting organization member")
  }
}
