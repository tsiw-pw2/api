import { sequelize } from "../../../config/sequelize.js"
import {
  Beach,
  BeachLocation,
  Campaign,
  CampaignBeach,
  Comment,
  Registration,
  User,
  WasteCollection
} from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"
import { DISTRICT_CODE_TO_LABEL, districtCodeFromLabel } from "../../../utils/districts.js"
import { isUuidParam } from "../../../utils/uuid-param.js"
import {
  formatDatePt,
  parseFlexibleDate,
  toIsoDateString
} from "../../../utils/dates.js"

const STATUS_UI_TO_DB = {
  planeada: 0,
  aberta_inscricoes: 1,
  encerrada_inscricoes: 2,
  em_progresso: 3,
  concluida: 4,
  cancelada: 5,
  draft: 0,
  scheduled: 1,
  ongoing: 3,
  completed: 4
}

const MAX_CAMPAIGN_TITLE_LENGTH = 255
const MAX_CAMPAIGN_INFORMATION_LENGTH = 8000

const CAMPAIGN_LIST_BEACHES_INCLUDE = {
  model: Beach,
  as: "beaches",
  through: { attributes: [] },
  attributes: ["name"],
  required: false,
  include: [
    {
      model: BeachLocation,
      as: "beachLocation",
      attributes: ["municipality"]
    }
  ]
}

function meetingLocationFromDraft(information) {
  const t = information?.trim() ?? ""
  if (t.length === 0) return "Local a definir"
  return t.length > 255 ? t.slice(0, 255) : t
}

function formatMeetingTimeForDb(t) {
  const s = (t ?? "").trim()
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`
  return s.length > 0 ? s : null
}

function mapStatusForDetailsUi(db) {
  if (db === 4) return 2
  if (db === 1 || db === 2 || db === 3) return 1
  return 0
}

function editStatusKeyFromDbStatus(db) {
  const n = Number(db)
  if (n === 1) return "aberta_inscricoes"
  if (n === 2) return "encerrada_inscricoes"
  if (n === 3) return "em_progresso"
  if (n === 4) return "concluida"
  if (n === 5) return "cancelada"
  return "planeada"
}

function firstMunicipalityFromCampaignBeaches(c) {
  for (const b of c.beaches ?? []) {
    const m = b.beachLocation?.municipality?.trim()
    if (m) return m
  }
  return null
}

function mapCampaignToListItem(c) {
  const beachNames = (c.beaches ?? []).map((b) => b.name).join(", ")
  const start = formatDatePt(c.startDate)
  const end = formatDatePt(c.endDate)
  const muni = firstMunicipalityFromCampaignBeaches(c) ?? "—"
  return {
    id: c.id,
    title: c.title,
    municipality: muni,
    beach: beachNames.length > 0 ? beachNames : "—",
    startDate: start,
    endDate: end
  }
}

export async function listCampaigns(pagination) {
  const { offset, limit, page, pageSize } = pagination
  const total = await Campaign.count()
  const rows = await Campaign.findAll({
    include: [CAMPAIGN_LIST_BEACHES_INCLUDE],
    order: [["startDate", "DESC"]],
    limit,
    offset
  })
  return {
    items: rows.map((c) => mapCampaignToListItem(c)),
    total,
    page,
    pageSize
  }
}

function parseCreateCampaignBeachIds(body) {
  const raw = body.beachIds
  if (!Array.isArray(raw)) {
    return null
  }
  const seen = new Set()
  const ids = []
  for (const item of raw) {
    if (typeof item !== "string") {
      return null
    }
    const id = item.trim()
    if (!isUuidParam(id) || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids.length > 0 ? ids : null
}

export async function createCampaign(actorUserId, body) {
  const title = body.title?.trim()
  const meetingTimeRaw = body.meetingTime
  const startRaw = body.startDate?.trim()
  const endRaw = body.endDate?.trim()
  const statusUi = body.status?.trim()
  const information = body.information?.trim() ?? ""
  const districtRaw = typeof body.district === "string" ? body.district.trim() : ""

  if (!title || !startRaw || !statusUi || !districtRaw) {
    throw ApiError.badRequest("Invalid request")
  }

  if (DISTRICT_CODE_TO_LABEL[districtRaw] === undefined) {
    throw ApiError.badRequest("Invalid request")
  }

  const beachIds = parseCreateCampaignBeachIds(body)
  if (!beachIds) {
    throw ApiError.badRequest("Invalid request")
  }

  if (title.length > MAX_CAMPAIGN_TITLE_LENGTH || information.length > MAX_CAMPAIGN_INFORMATION_LENGTH) {
    throw ApiError.badRequest("Invalid request")
  }

  const meetingTime = formatMeetingTimeForDb(meetingTimeRaw)
  if (!meetingTime) {
    throw ApiError.badRequest("Invalid request")
  }

  const startDate = parseFlexibleDate(startRaw)
  if (!startDate) {
    throw ApiError.badRequest("Invalid request")
  }

  let endDate = endRaw?.trim() ? parseFlexibleDate(endRaw.trim()) : startDate
  if (endRaw?.trim() && !endDate) {
    throw ApiError.badRequest("Invalid request")
  }
  if (!endDate) {
    endDate = startDate
  }

  const statusDb = STATUS_UI_TO_DB[statusUi]
  if (statusDb === undefined) {
    throw ApiError.badRequest("Invalid request")
  }

  const beaches = await Beach.findAll({
    where: { id: beachIds },
    include: [{ model: BeachLocation, as: "beachLocation", attributes: ["district"] }]
  })

  if (beaches.length !== beachIds.length) {
    throw ApiError.badRequest("Invalid request")
  }

  for (const b of beaches) {
    const label = b.beachLocation?.district?.trim() ?? ""
    const code = districtCodeFromLabel(label)
    if (code !== districtRaw) {
      throw ApiError.badRequest("Invalid request")
    }
  }

  const row = await sequelize.transaction(async (t) => {
    const now = new Date()
    const createdRow = await Campaign.create(
      {
        title,
        description: information.length > 0 ? information : null,
        meetingLocation: meetingLocationFromDraft(information),
        meetingTime,
        startDate,
        endDate,
        status: statusDb,
        organizerId: actorUserId,
        districtCode: districtRaw,
        createdAt: now,
        updatedAt: now
      },
      { transaction: t }
    )

    await CampaignBeach.bulkCreate(
      beachIds.map((beachId) => ({
        campaignId: createdRow.id,
        beachId,
        createdAt: now
      })),
      { transaction: t }
    )

    return createdRow
  })

  const created = await Campaign.findByPk(row.id, {
    include: [CAMPAIGN_LIST_BEACHES_INCLUDE]
  })

  if (!created) {
    throw ApiError.notFound()
  }

  return mapCampaignToListItem(created)
}

async function assertCanManageCampaign(actorUserId, campaign) {
  if (campaign.organizerId === actorUserId) {
    return
  }
  const user = await User.findByPk(actorUserId, { attributes: ["isAdmin"] })
  if (!user?.isAdmin) {
    throw ApiError.forbidden()
  }
}

export async function updateCampaign(actorUserId, campaignId, body) {
  const campaign = await Campaign.findByPk(campaignId, {
    include: [CAMPAIGN_LIST_BEACHES_INCLUDE]
  })

  if (!campaign) {
    throw ApiError.notFound()
  }

  await assertCanManageCampaign(actorUserId, campaign)

  const title = body.title?.trim()
  const meetingTimeRaw = body.meetingTime
  const startRaw = body.startDate?.trim()
  const endRaw = body.endDate?.trim()
  const statusUi = body.status?.trim()
  const information = body.information?.trim() ?? ""

  if (!title || !startRaw || !statusUi) {
    throw ApiError.badRequest("Invalid request")
  }

  if (title.length > MAX_CAMPAIGN_TITLE_LENGTH || information.length > MAX_CAMPAIGN_INFORMATION_LENGTH) {
    throw ApiError.badRequest("Invalid request")
  }

  const meetingTime = formatMeetingTimeForDb(meetingTimeRaw)
  if (!meetingTime) {
    throw ApiError.badRequest("Invalid request")
  }

  const startDate = parseFlexibleDate(startRaw)
  if (!startDate) {
    throw ApiError.badRequest("Invalid request")
  }

  let endDate = endRaw?.trim() ? parseFlexibleDate(endRaw.trim()) : startDate
  if (endRaw?.trim() && !endDate) {
    throw ApiError.badRequest("Invalid request")
  }
  if (!endDate) {
    endDate = startDate
  }

  const statusDb = STATUS_UI_TO_DB[statusUi]
  if (statusDb === undefined) {
    throw ApiError.badRequest("Invalid request")
  }

  campaign.title = title
  campaign.description = information.length > 0 ? information : null
  campaign.meetingLocation = meetingLocationFromDraft(information)
  campaign.meetingTime = meetingTime
  campaign.startDate = startDate
  campaign.endDate = endDate
  campaign.status = statusDb
  await campaign.save()

  const updated = await Campaign.findByPk(campaign.id, {
    include: [CAMPAIGN_LIST_BEACHES_INCLUDE]
  })

  if (!updated) {
    throw ApiError.notFound()
  }

  return mapCampaignToListItem(updated)
}

export async function deleteCampaign(actorUserId, campaignId) {
  const campaign = await Campaign.findByPk(campaignId)

  if (!campaign) {
    throw ApiError.notFound()
  }

  await assertCanManageCampaign(actorUserId, campaign)
  await campaign.destroy()
}

async function resolveViewerRegistration(campaignId, viewerUserId) {
  if (!viewerUserId || !isUuidParam(viewerUserId)) {
    return null
  }
  const row = await Registration.findOne({
    where: { campaignId, userId: viewerUserId },
    attributes: ["id", "role", "status", "attendance"]
  })
  if (!row) {
    return null
  }
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    attendance: row.attendance
  }
}

function resolveViewerCanPostComment(campaign, viewerUserId, isAdminViewer, viewerRegistration) {
  if (!viewerUserId || !isUuidParam(viewerUserId)) {
    return false
  }
  if (campaign.organizerId === viewerUserId) {
    return true
  }
  if (isAdminViewer) {
    return true
  }
  return viewerRegistration != null && viewerRegistration.status !== 2
}

export async function getCampaignDetails(campaignId, viewerUserId) {
  const viewer =
    typeof viewerUserId === "string" && isUuidParam(viewerUserId)
      ? await User.findByPk(viewerUserId, { attributes: ["isAdmin"] })
      : null
  const isAdminViewer = Boolean(viewer?.isAdmin)

  const campaign = await Campaign.findByPk(campaignId, {
    include: [
      { model: User, as: "organizer", attributes: ["id", "name", "email"] },
      {
        model: Beach,
        as: "beaches",
        through: { attributes: [] },
        include: [
          {
            model: BeachLocation,
            as: "beachLocation",
            attributes: ["district", "municipality", "parish"]
          }
        ]
      }
    ]
  })

  if (!campaign) {
    throw ApiError.notFound()
  }

  const beaches = (campaign.beaches ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    latitude: b.latitude != null ? String(b.latitude) : "",
    longitude: b.longitude != null ? String(b.longitude) : "",
    district: b.beachLocation?.district ?? null,
    municipality: b.beachLocation?.municipality ?? null,
    parish: b.beachLocation?.parish ?? null
  }))

  const wasteWhere = { campaignId, deletedAt: null }
  const commentsCountWhere = isAdminViewer
    ? { campaignId }
    : { campaignId, isVisible: true }

  const [
    registrationsCount,
    commentsCount,
    wasteCollectionsCount,
    totalWasteUnits,
    totalWasteWeightKg,
    viewerRegistration
  ] = await Promise.all([
    Registration.count({ where: { campaignId } }),
    Comment.count({ where: commentsCountWhere }),
    WasteCollection.count({ where: wasteWhere }),
    WasteCollection.sum("unitQuantity", { where: wasteWhere }),
    WasteCollection.sum("actualWeightKg", { where: wasteWhere }),
    resolveViewerRegistration(campaignId, viewerUserId)
  ])

  const viewerCanPostComment = resolveViewerCanPostComment(
    campaign,
    viewerUserId,
    isAdminViewer,
    viewerRegistration
  )

  const metrics = {
    beachesCount: beaches.length,
    registrationsCount,
    commentsCount,
    wasteCollectionsCount,
    totalWasteUnits: Number(totalWasteUnits ?? 0),
    totalWasteWeightKg: Number(totalWasteWeightKg ?? 0)
  }

  const mt = campaign.meetingTime
  const meetingTimeStr =
    mt == null || mt === ""
      ? null
      : String(mt).length >= 5
        ? String(mt).slice(0, 5)
        : String(mt)

  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    meetingLocation: campaign.meetingLocation,
    meetingTime: meetingTimeStr,
    startDate: toIsoDateString(campaign.startDate),
    endDate: toIsoDateString(campaign.endDate),
    districtCode: campaign.districtCode ?? null,
    status: mapStatusForDetailsUi(campaign.status),
    editStatus: editStatusKeyFromDbStatus(campaign.status),
    organizer: campaign.organizer
      ? {
          id: campaign.organizer.id,
          name: campaign.organizer.name,
          email: campaign.organizer.email
        }
      : null,
    beaches,
    metrics,
    viewerCanPostComment,
    viewerRegistration
  }
}
