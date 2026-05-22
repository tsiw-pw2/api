import { Campaign, Registration, User } from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"
import { isUuidParam } from "../../../utils/uuid-param.js"

function toRegistrationDto(row) {
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    attendance: row.attendance,
    createdAt: row.createdAt.toISOString(),
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          phone: row.user.phone ?? null
        }
      : null
  }
}

async function assertOrganizerOrAdminForCampaign(requesterId, campaign) {
  if (campaign.organizerId === requesterId) {
    return
  }
  const user = await User.findByPk(requesterId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return
  }
  throw ApiError.forbidden()
}

export async function listRegistrationsForCampaign(campaignId, pagination) {
  if (!isUuidParam(campaignId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw ApiError.notFound()
  }

  const { offset, limit, page, pageSize } = pagination
  const where = { campaignId }

  const total = await Registration.count({ where })
  const rows = await Registration.findAll({
    where,
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ],
    order: [[{ model: User, as: "user" }, "name", "ASC"]],
    limit,
    offset
  })

  return {
    items: rows.map((r) => toRegistrationDto(r)),
    total,
    page,
    pageSize
  }
}

const ENROLLABLE_CAMPAIGN_STATUSES = new Set([1, 2, 3])

export async function createSelfRegistration(campaignId, userId) {
  if (!isUuidParam(campaignId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw ApiError.notFound()
  }

  const dbStatus = Number(campaign.status)
  if (!ENROLLABLE_CAMPAIGN_STATUSES.has(dbStatus)) {
    throw ApiError.badRequest("Invalid request")
  }

  const user = await User.findByPk(userId, { attributes: ["isBlocked"] })
  if (!user || user.isBlocked) {
    throw ApiError.badRequest("Invalid request")
  }

  const existing = await Registration.findOne({
    where: { campaignId, userId }
  })

  const now = new Date()

  if (existing) {
    if (existing.status !== 2) {
      throw ApiError.badRequest("Invalid request")
    }
    existing.role = 0
    existing.status = 0
    existing.attendance = null
    existing.updatedAt = now
    await existing.save()
    const full = await Registration.findByPk(existing.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
      ]
    })
    if (!full) {
      throw ApiError.notFound()
    }
    return toRegistrationDto(full)
  }

  const row = await Registration.create({
    campaignId,
    userId,
    role: 0,
    status: 0,
    createdAt: now,
    updatedAt: now
  })

  const full = await Registration.findByPk(row.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ]
  })

  if (!full) {
    throw ApiError.notFound()
  }

  return toRegistrationDto(full)
}

export async function updateRegistration(registrationId, requesterId, body) {
  if (!isUuidParam(registrationId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const registration = await Registration.findByPk(registrationId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!registration) {
    throw ApiError.notFound()
  }

  const campaign = registration.campaign
  if (!campaign) {
    throw ApiError.notFound()
  }

  const isSelf = registration.userId === requesterId
  const isOrgOrAdmin =
    campaign.organizerId === requesterId ||
    (await User.findByPk(requesterId, { attributes: ["isAdmin"] }))?.isAdmin

  if (!isSelf && !isOrgOrAdmin) {
    throw ApiError.forbidden()
  }

  if (isSelf && !isOrgOrAdmin) {
    const nextStatus = Number(body?.status)
    if (nextStatus !== 2) {
      throw ApiError.forbidden()
    }
    registration.status = 2
    await registration.save()
    const full = await Registration.findByPk(registration.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
      ]
    })
    if (!full) {
      throw ApiError.notFound()
    }
    return toRegistrationDto(full)
  }

  if (body.role !== undefined) {
    const r = Number(body.role)
    if (r !== 0 && r !== 1) {
      throw ApiError.badRequest("Invalid request")
    }
    registration.role = r
  }

  if (body.status !== undefined) {
    const s = Number(body.status)
    if (s !== 0 && s !== 1 && s !== 2) {
      throw ApiError.badRequest("Invalid request")
    }
    registration.status = s
  }

  if (body.attendance !== undefined) {
    if (body.attendance === null) {
      registration.attendance = null
    } else if (typeof body.attendance === "boolean") {
      registration.attendance = body.attendance
    } else {
      throw ApiError.badRequest("Invalid request")
    }
  }

  await registration.save()

  const full = await Registration.findByPk(registration.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ]
  })

  if (!full) {
    throw ApiError.notFound()
  }

  return toRegistrationDto(full)
}

export async function deleteRegistration(registrationId, requesterId) {
  if (!isUuidParam(registrationId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const registration = await Registration.findByPk(registrationId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!registration) {
    throw ApiError.notFound()
  }

  const campaign = registration.campaign
  if (!campaign) {
    throw ApiError.notFound()
  }

  const isSelf = registration.userId === requesterId
  const user = await User.findByPk(requesterId, { attributes: ["isAdmin"] })
  const isOrg = campaign.organizerId === requesterId

  if (!isSelf && !isOrg && !user?.isAdmin) {
    throw ApiError.forbidden()
  }

  await registration.destroy()
}
