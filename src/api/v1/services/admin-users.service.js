import { User, Registration } from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"

export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isOrganizer: user.isOrganizer,
    isBlocked: user.isBlocked,
    blockedReason: user.blockedReason,
    blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null
  }
}

/**
 * @param {{ offset: number, limit: number, page: number, pageSize: number }} pagination
 * @param {{ role?: "volunteer" | null }} [filters]
 */
export async function listUsersForAdmin(pagination, filters = {}) {
  const { offset, limit, page, pageSize } = pagination
  const volunteerOnly = filters.role === "volunteer"
  const include = volunteerOnly
    ? [
        {
          model: Registration,
          as: "registrations",
          attributes: [],
          required: true
        }
      ]
    : undefined

  const base = {
    attributes: { exclude: ["passwordHash"] },
    order: [["createdAt", "DESC"]],
    limit,
    offset
  }
  if (volunteerOnly) {
    Object.assign(base, {
      include,
      distinct: true,
      subQuery: false,
      col: "User.id"
    })
  }

  const { count, rows } = await User.findAndCountAll(base)

  return {
    items: rows.map((u) => toPublicUser(u)),
    total: count,
    page,
    pageSize
  }
}

/**
 * @param {string} actorUserId
 * @param {string} targetUserId
 * @param {string} reason
 */
const MAX_BLOCK_REASON_LENGTH = 2000

export async function blockUserAsAdmin(actorUserId, targetUserId, reason) {
  const trimmed = typeof reason === "string" ? reason.trim() : ""
  if (!trimmed || trimmed.length > MAX_BLOCK_REASON_LENGTH) {
    throw ApiError.badRequest("Invalid request")
  }

  if (actorUserId === targetUserId) {
    throw ApiError.forbidden()
  }

  const user = await User.findByPk(targetUserId)
  if (!user) {
    throw ApiError.notFound()
  }

  await user.update({
    isBlocked: true,
    blockedReason: trimmed,
    blockedAt: new Date()
  })

  return toPublicUser(user)
}

/**
 * @param {string} actorUserId
 * @param {string} targetUserId
 */
export async function unblockUserAsAdmin(actorUserId, targetUserId) {
  if (actorUserId === targetUserId) {
    throw ApiError.forbidden()
  }

  const user = await User.findByPk(targetUserId)
  if (!user) {
    throw ApiError.notFound()
  }

  await user.update({
    isBlocked: false,
    blockedReason: null,
    blockedAt: null
  })

  return toPublicUser(user)
}
