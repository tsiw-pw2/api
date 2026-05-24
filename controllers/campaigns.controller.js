import { Op, QueryTypes } from "sequelize"
import {
  sequelize,
  Beach,
  BeachLocation,
  Campaign,
  CampaignBeach,
  Comment,
  Registration,
  User,
  Waste,
  WasteCollection,
  WasteType
} from "../models/db.config.js"
import {
  forwardControllerError,
  createError,
  missingFieldsValidationError,
  validationError,
  notFoundError,
  conflictError,
  isUuidParam
} from "../utils/error.utils.js"
import {
  CAMPAIGNS_BASE,
  listResponse,
  withResourceLinks,
  parsePaginationQuery,
  parseCampaignListFilters,
  buildCampaignListWhere,
  districtCodeFromLabel,
  districtLabelFromCode,
  isValidDistrictCode,
  toIsoDateOnly,
  assertEligibleForCampaignEnrollment
} from "../utils/hateoas.utils.js"

function collectionActualWeightKg(row) {
  if (row?.actualWeightKg == null) return 0
  const n = Number(row.actualWeightKg)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function collectionEstimatedWeightKg(row, waste) {
  const grams = waste?.averageWeightGrams
  if (grams == null) return 0
  const g = Number(grams)
  if (!Number.isFinite(g) || g <= 0) return 0
  const qty = Number(row?.unitQuantity) || 0
  if (qty <= 0) return 0
  return (qty * g) / 1000
}

function collectionImpactWeightKg(row, waste) {
  const actual = collectionActualWeightKg(row)
  if (actual > 0) return actual
  return collectionEstimatedWeightKg(row, waste)
}

function aggregateWasteByType(collections) {
  const byType = new Map()

  for (const row of collections) {
    const waste = row.waste
    const typeName = waste?.wasteType?.name ?? "Outros"
    const units = Number(row.unitQuantity) || 0
    const weightKg = collectionImpactWeightKg(row, waste)

    const prev = byType.get(typeName) ?? { typeName, units: 0, weightKg: 0 }
    prev.units += units
    prev.weightKg += weightKg
    byType.set(typeName, prev)
  }

  return [...byType.values()]
    .map((entry) => ({
      typeName: entry.typeName,
      units: entry.units,
      weightKg: Math.round(entry.weightKg * 1000) / 1000
    }))
    .sort((a, b) => b.weightKg - a.weightKg)
}

function computeWasteImpactTotals(collections) {
  let totalActualWeightKg = 0
  let totalImpactWeightKg = 0

  for (const row of collections) {
    const waste = row.waste
    totalActualWeightKg += collectionActualWeightKg(row)
    totalImpactWeightKg += collectionImpactWeightKg(row, waste)
  }

  return {
    totalActualWeightKg: Math.round(totalActualWeightKg * 1000) / 1000,
    totalImpactWeightKg: Math.round(totalImpactWeightKg * 1000) / 1000,
    wasteByType: aggregateWasteByType(collections)
  }
}

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
const MAX_UNIT_QUANTITY = 100_000_000
const MAX_WEIGHT_KG = 1_000_000

function parseFlexibleDate(raw) {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s
  }
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(s)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return null
  }
  const mmStr = String(mm).padStart(2, "0")
  const ddStr = String(dd).padStart(2, "0")
  return `${yyyy}-${mmStr}-${ddStr}`
}

function formatDatePt(value) {
  const d = typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value
  if (Number.isNaN(d.getTime())) return ""
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function toIsoDateString(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
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
    endDate: end,
    statusKey: editStatusKeyFromDbStatus(c.status),
    districtCode: c.districtCode ?? null
  }
}

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

function mapCommentRow(c, isAdminViewer) {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    user: c.user ? { id: c.user.id, name: c.user.name } : null,
    ...(isAdminViewer ? { isVisible: Boolean(c.isVisible) } : {})
  }
}

function mapCollectionRow(w) {
  const estimated =
    w.actualWeightKg == null && w.waste
      ? collectionEstimatedWeightKg(w, w.waste)
      : 0
  const estimatedWeightKg =
    estimated > 0 ? String(Math.round(estimated * 1000) / 1000) : null

  return {
    id: w.id,
    unitQuantity: w.unitQuantity,
    actualWeightKg: w.actualWeightKg != null ? String(w.actualWeightKg) : null,
    estimatedWeightKg,
    createdAt: w.createdAt.toISOString(),
    beach: w.beach ? { id: w.beach.id, name: w.beach.name } : null,
    waste: w.waste ? { id: w.waste.id, name: w.waste.name } : null,
    recordedBy: w.recordedBy ? { id: w.recordedBy.id, name: w.recordedBy.name } : null
  }
}

function formatPtLongDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d)
}

function missingCampaignPutFields(body) {
  const raw = body && typeof body === "object" ? body : {}
  const missing = []
  if (!raw.title || typeof raw.title !== "string" || !raw.title.trim()) missing.push("Title")
  if (!raw.startDate || typeof raw.startDate !== "string" || !raw.startDate.trim()) {
    missing.push("StartDate")
  }
  if (!raw.status || typeof raw.status !== "string" || !raw.status.trim()) missing.push("Status")
  if (raw.meetingTime === undefined || raw.meetingTime === null || raw.meetingTime === "") {
    missing.push("MeetingTime")
  }
  return missing
}

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

const WASTE_COLLECTION_LIST_INCLUDE = [
  { model: Beach, as: "beach", attributes: ["id", "name"] },
  { model: Waste, as: "waste", attributes: ["id", "name", "averageWeightGrams"] },
  { model: User, as: "recordedBy", attributes: ["id", "name"] }
]

const DASHBOARD_WASTE_INCLUDE = [
  { model: Beach, as: "beach", attributes: ["id", "name"], required: false },
  {
    model: Waste,
    as: "waste",
    attributes: ["id", "name", "averageWeightGrams"],
    required: false,
    include: [
      { model: WasteType, as: "wasteType", attributes: ["id", "name"], required: false }
    ]
  }
]

async function assertOrganizerOrAdminForCampaign(requesterId, campaign) {
  if (campaign.organizerId === requesterId) {
    return
  }
  const user = await User.findByPk(requesterId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return
  }
  throw createError(403, "Forbidden")
}

async function assertCanManageCampaign(actorUserId, campaign) {
  await assertOrganizerOrAdminForCampaign(actorUserId, campaign)
}

async function assertCanInteractWithCampaignCollections(actorId, campaignId) {
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  if (campaign.organizerId === actorId) {
    return campaign
  }

  const user = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return campaign
  }

  const reg = await Registration.findOne({
    where: { campaignId, userId: actorId, status: { [Op.in]: [0, 1] } }
  })

  if (reg) {
    return campaign
  }

  throw createError(403, "Forbidden")
}

async function assertCanModifyCollection(actorId, collection) {
  const campaign = await Campaign.findByPk(collection.campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  if (campaign.organizerId === actorId) {
    return
  }

  const user = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return
  }

  if (collection.recordedByUserId === actorId) {
    return
  }

  const reg = await Registration.findOne({
    where: { campaignId: collection.campaignId, userId: actorId, status: { [Op.in]: [0, 1] } }
  })

  if (reg) {
    return
  }

  throw createError(403, "Forbidden")
}

async function assertRegistrationInCampaign(campaignId, registrationId) {
  if (!isUuidParam(campaignId) || !isUuidParam(registrationId)) {
    throw validationError(["Invalid id"])
  }
  const row = await Registration.findByPk(registrationId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Registration")
  }
}

async function assertCommentInCampaign(campaignId, commentId) {
  if (!isUuidParam(campaignId) || !isUuidParam(commentId)) {
    throw validationError(["Invalid id"])
  }
  const row = await Comment.findByPk(commentId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Comment")
  }
}

async function assertCollectionInCampaign(campaignId, collectionId) {
  if (!isUuidParam(campaignId) || !isUuidParam(collectionId)) {
    throw validationError(["Invalid id"])
  }
  const row = await WasteCollection.findByPk(collectionId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Waste collection")
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

async function listCampaigns(pagination, filters, userId) {
  const { offset, limit, page, pageSize } = pagination
  const where = await buildCampaignListWhere(filters, userId)
  const total = await Campaign.count({ where })
  const rows = await Campaign.findAll({
    where,
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

async function createCampaign(actorUserId, body) {
  const title = body.title?.trim()
  const meetingTimeRaw = body.meetingTime
  const startRaw = body.startDate?.trim()
  const endRaw = body.endDate?.trim()
  const statusUi = body.status?.trim()
  const information = body.information?.trim() ?? ""
  const districtRaw = typeof body.district === "string" ? body.district.trim() : ""

  if (!title || !startRaw || !statusUi || !districtRaw) {
    throw validationError(["Invalid request"])
  }

  if (!isValidDistrictCode(districtRaw)) {
    throw validationError(["Invalid request"])
  }

  const beachIds = parseCreateCampaignBeachIds(body)
  if (!beachIds) {
    throw validationError(["Invalid request"])
  }

  if (title.length > MAX_CAMPAIGN_TITLE_LENGTH || information.length > MAX_CAMPAIGN_INFORMATION_LENGTH) {
    throw validationError(["Invalid request"])
  }

  const meetingTime = formatMeetingTimeForDb(meetingTimeRaw)
  if (!meetingTime) {
    throw validationError(["Invalid request"])
  }

  const startDate = parseFlexibleDate(startRaw)
  if (!startDate) {
    throw validationError(["Invalid request"])
  }

  let endDate = endRaw?.trim() ? parseFlexibleDate(endRaw.trim()) : startDate
  if (endRaw?.trim() && !endDate) {
    throw validationError(["Invalid request"])
  }
  if (!endDate) {
    endDate = startDate
  }

  const statusDb = STATUS_UI_TO_DB[statusUi]
  if (statusDb === undefined) {
    throw validationError(["Invalid request"])
  }

  const beaches = await Beach.findAll({
    where: { id: beachIds },
    include: [{ model: BeachLocation, as: "beachLocation", attributes: ["district"] }]
  })

  if (beaches.length !== beachIds.length) {
    throw validationError(["Invalid request"])
  }

  // Exijo que todas as praias escolhidas pertençam ao distrito indicado
  for (const b of beaches) {
    const label = b.beachLocation?.district?.trim() ?? ""
    const code = districtCodeFromLabel(label)
    if (code !== districtRaw) {
      throw validationError(["Invalid request"])
    }
  }

  // Crio campanha e ligações às praias numa transação atómica
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
    throw notFoundError("Campaign")
  }

  return mapCampaignToListItem(created)
}

async function updateCampaign(actorUserId, campaignId, body) {
  const campaign = await Campaign.findByPk(campaignId, {
    include: [CAMPAIGN_LIST_BEACHES_INCLUDE]
  })

  if (!campaign) {
    throw notFoundError("Campaign")
  }

  await assertCanManageCampaign(actorUserId, campaign)

  const title = body.title?.trim()
  const meetingTimeRaw = body.meetingTime
  const startRaw = body.startDate?.trim()
  const endRaw = body.endDate?.trim()
  const statusUi = body.status?.trim()
  const information = body.information?.trim() ?? ""

  if (!title || !startRaw || !statusUi) {
    throw validationError(["Invalid request"])
  }

  if (title.length > MAX_CAMPAIGN_TITLE_LENGTH || information.length > MAX_CAMPAIGN_INFORMATION_LENGTH) {
    throw validationError(["Invalid request"])
  }

  const meetingTime = formatMeetingTimeForDb(meetingTimeRaw)
  if (!meetingTime) {
    throw validationError(["Invalid request"])
  }

  const startDate = parseFlexibleDate(startRaw)
  if (!startDate) {
    throw validationError(["Invalid request"])
  }

  let endDate = endRaw?.trim() ? parseFlexibleDate(endRaw.trim()) : startDate
  if (endRaw?.trim() && !endDate) {
    throw validationError(["Invalid request"])
  }
  if (!endDate) {
    endDate = startDate
  }

  const statusDb = STATUS_UI_TO_DB[statusUi]
  if (statusDb === undefined) {
    throw validationError(["Invalid request"])
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
    throw notFoundError("Campaign")
  }

  return mapCampaignToListItem(updated)
}

async function deleteCampaign(actorUserId, campaignId) {
  const campaign = await Campaign.findByPk(campaignId)

  if (!campaign) {
    throw notFoundError("Campaign")
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
  // Não permito comentários de inscritos cancelados (status 2)
  return viewerRegistration != null && viewerRegistration.status !== 2
}

async function getCampaignDetails(campaignId, viewerUserId) {
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
    throw notFoundError("Campaign")
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
  // Conto comentários ocultos só para admins na listagem pública
  const commentsCountWhere = isAdminViewer
    ? { campaignId }
    : { campaignId, isVisible: true }

  const WASTE_METRICS_INCLUDE = [
    {
      model: Waste,
      as: "waste",
      attributes: ["id", "averageWeightGrams"],
      required: false,
      include: [
        {
          model: WasteType,
          as: "wasteType",
          attributes: ["id", "name"],
          required: false
        }
      ]
    }
  ]

  const [
    registrationsCount,
    pendingRegistrationsCount,
    commentsCount,
    wasteCollectionsCount,
    totalWasteUnits,
    wasteRowsForMetrics,
    viewerRegistration
  ] = await Promise.all([
    Registration.count({ where: { campaignId } }),
    Registration.count({ where: { campaignId, status: 0 } }),
    Comment.count({ where: commentsCountWhere }),
    WasteCollection.count({ where: wasteWhere }),
    WasteCollection.sum("unitQuantity", { where: wasteWhere }),
    WasteCollection.findAll({
      where: wasteWhere,
      attributes: ["unitQuantity", "actualWeightKg"],
      include: WASTE_METRICS_INCLUDE
    }),
    resolveViewerRegistration(campaignId, viewerUserId)
  ])

  const wasteImpact = computeWasteImpactTotals(wasteRowsForMetrics)

  const viewerCanPostComment = resolveViewerCanPostComment(
    campaign,
    viewerUserId,
    isAdminViewer,
    viewerRegistration
  )

  const metrics = {
    beachesCount: beaches.length,
    registrationsCount,
    pendingRegistrationsCount,
    commentsCount,
    wasteCollectionsCount,
    totalWasteUnits: Number(totalWasteUnits ?? 0),
    totalWasteWeightKg: wasteImpact.totalImpactWeightKg,
    totalActualWeightKg: wasteImpact.totalActualWeightKg,
    totalImpactWeightKg: wasteImpact.totalImpactWeightKg,
    wasteByType: wasteImpact.wasteByType
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

const ENROLLABLE_CAMPAIGN_STATUSES = new Set([1, 2, 3])

async function listRegistrationsForCampaign(
  campaignId,
  requesterId,
  pagination,
  listOptions = {}
) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  await assertOrganizerOrAdminForCampaign(requesterId, campaign)

  const { offset, limit, page, pageSize } = pagination
  const where = { campaignId }

  if (listOptions.status != null) {
    const s = Number(listOptions.status)
    if (s !== 0 && s !== 1 && s !== 2) {
      throw validationError(["Invalid request"])
    }
    where.status = s
  }

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

async function createSelfRegistration(campaignId, userId) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const dbStatus = Number(campaign.status)
  if (!ENROLLABLE_CAMPAIGN_STATUSES.has(dbStatus)) {
    throw validationError(["Invalid request"])
  }

  const user = await User.findByPk(userId, { attributes: ["isBlocked", "birthDate"] })
  if (!user || user.isBlocked) {
    throw validationError(["Invalid request"])
  }

  assertEligibleForCampaignEnrollment(user.birthDate)

  const existing = await Registration.findOne({
    where: { campaignId, userId }
  })

  const now = new Date()

  if (existing) {
    if (existing.status !== 2) {
      throw validationError(["Invalid request"])
    }
    existing.role = 0
    existing.status = 1
    existing.attendance = null
    existing.updatedAt = now
    await existing.save()
    const full = await Registration.findByPk(existing.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
      ]
    })
    if (!full) {
    throw notFoundError("Registration")
    }
    return toRegistrationDto(full)
  }

  const row = await Registration.create({
    campaignId,
    userId,
    role: 0,
    status: 1,
    createdAt: now,
    updatedAt: now
  })

  const full = await Registration.findByPk(row.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ]
  })

  if (!full) {
    throw notFoundError("Registration")
  }

  return toRegistrationDto(full)
}

async function updateRegistration(registrationId, requesterId, body) {
  if (!isUuidParam(registrationId)) {
    throw validationError(["Invalid id"])
  }

  const registration = await Registration.findByPk(registrationId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!registration) {
    throw notFoundError("Registration")
  }

  const campaign = registration.campaign
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const isSelf = registration.userId === requesterId
  const isOrgOrAdmin =
    campaign.organizerId === requesterId ||
    (await User.findByPk(requesterId, { attributes: ["isAdmin"] }))?.isAdmin

  if (!isSelf && !isOrgOrAdmin) {
    throw createError(403, "Forbidden")
  }

  if (isSelf && !isOrgOrAdmin) {
    // Como voluntário só permito cancelar a própria inscrição (status → 2)
    const nextStatus = Number(body?.status)
    if (nextStatus !== 2) {
      throw createError(403, "Forbidden")
    }
    registration.status = 2
    await registration.save()
    const full = await Registration.findByPk(registration.id, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
      ]
    })
    if (!full) {
    throw notFoundError("Registration")
    }
    return toRegistrationDto(full)
  }

  if (body.role !== undefined) {
    const r = Number(body.role)
    if (r !== 0 && r !== 1) {
      throw validationError(["Invalid request"])
    }
    registration.role = r
  }

  if (body.status !== undefined) {
    const s = Number(body.status)
    if (s !== 0 && s !== 1 && s !== 2) {
      throw validationError(["Invalid request"])
    }
    registration.status = s
  }

  if (body.attendance !== undefined) {
    if (body.attendance === null) {
      registration.attendance = null
    } else if (typeof body.attendance === "boolean") {
      registration.attendance = body.attendance
    } else {
      throw validationError(["Invalid request"])
    }
  }

  await registration.save()

  const full = await Registration.findByPk(registration.id, {
    include: [
      { model: User, as: "user", attributes: ["id", "name", "email", "phone"] }
    ]
  })

  if (!full) {
    throw notFoundError("Registration")
  }

  return toRegistrationDto(full)
}

async function deleteRegistration(registrationId, requesterId) {
  if (!isUuidParam(registrationId)) {
    throw validationError(["Invalid id"])
  }

  const registration = await Registration.findByPk(registrationId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!registration) {
    throw notFoundError("Registration")
  }

  const campaign = registration.campaign
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const isSelf = registration.userId === requesterId
  const user = await User.findByPk(requesterId, { attributes: ["isAdmin"] })
  const isOrg = campaign.organizerId === requesterId

  if (!isSelf && !isOrg && !user?.isAdmin) {
    throw createError(403, "Forbidden")
  }

  await registration.destroy()
}

async function assertAdmin(userId) {
  const user = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (!user?.isAdmin) {
    throw createError(403, "Forbidden")
  }
}

async function listCampaignComments(campaignId, viewerUserId, pagination) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const viewer =
    typeof viewerUserId === "string" && isUuidParam(viewerUserId)
      ? await User.findByPk(viewerUserId, { attributes: ["isAdmin"] })
      : null
  const isAdminViewer = Boolean(viewer?.isAdmin)

  const { offset, limit, page, pageSize } = pagination
// Para não-admins filtro comentários com isVisible=true
  const where = isAdminViewer
    ? { campaignId }
    : { campaignId, isVisible: true }

  const total = await Comment.count({ where })
  const rows = await Comment.findAll({
    where,
    include: [{ model: User, as: "user", attributes: ["id", "name"] }],
    order: [["createdAt", "DESC"]],
    limit,
    offset
  })

  return {
    items: rows.map((c) => mapCommentRow(c, isAdminViewer)),
    total,
    page,
    pageSize
  }
}

async function loadCreatedCommentDto(commentId, viewerUserId) {
  const full = await Comment.findByPk(commentId, {
    include: [{ model: User, as: "user", attributes: ["id", "name"] }]
  })
  if (!full) {
    throw notFoundError("Comment")
  }
  const viewer =
    typeof viewerUserId === "string" && isUuidParam(viewerUserId)
      ? await User.findByPk(viewerUserId, { attributes: ["isAdmin"] })
      : null
  return mapCommentRow(full, Boolean(viewer?.isAdmin))
}

async function createCampaignComment(campaignId, userId, body) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  const text = typeof body?.body === "string" ? body.body.trim() : ""
  if (text.length === 0 || text.length > 8000) {
    throw validationError(["Invalid request"])
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  const now = new Date()

  if (campaign.organizerId !== userId) {
    const requester = await User.findByPk(userId, { attributes: ["isAdmin"] })
    if (!requester?.isAdmin) {
      const registration = await Registration.findOne({
        where: {
          campaignId,
          userId,
          status: { [Op.ne]: 2 }
        }
      })
      if (!registration) {
        throw createError(403, "Forbidden")
      }
    }
  }

  const row = await Comment.create({
    campaignId,
    userId,
    body: text,
    isVisible: true,
    createdAt: now,
    updatedAt: now
  })

  return loadCreatedCommentDto(row.id, userId)
}

async function updateCommentVisibility(commentId, requesterId, body) {
  if (!isUuidParam(commentId)) {
    throw validationError(["Invalid id"])
  }

  if (typeof body?.isVisible !== "boolean") {
    throw validationError(["Invalid request"])
  }

  const comment = await Comment.findByPk(commentId)

  if (!comment) {
    throw notFoundError("Comment")
  }

  await assertAdmin(requesterId)

  // Restringo alteração de visibilidade ao admin; o organizador não modera comentários de terceiros
  comment.isVisible = body.isVisible
  await comment.save()

  return { ok: true }
}

async function deleteComment(commentId, requesterId) {
  if (!isUuidParam(commentId)) {
    throw validationError(["Invalid id"])
  }

  const comment = await Comment.findByPk(commentId, {
    include: [{ model: Campaign, as: "campaign" }]
  })

  if (!comment) {
    throw notFoundError("Comment")
  }

  const campaign = comment.campaign
  if (!campaign) {
    throw notFoundError("Campaign")
  }

  if (comment.userId === requesterId) {
    await comment.destroy()
    return
  }

  await assertOrganizerOrAdminForCampaign(requesterId, campaign)
  await comment.destroy()
}

function mapCollectionRowFromEntity(w) {
  return mapCollectionRow(w)
}

async function listWasteCollectionsForCampaign(
  campaignId,
  requesterId,
  pagination,
  beachId
) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  await assertCanInteractWithCampaignCollections(requesterId, campaignId)

  const { offset, limit, page, pageSize } = pagination
  const where = { campaignId, deletedAt: null }

  if (beachId != null && beachId !== "") {
    if (!isUuidParam(beachId)) {
      throw validationError(["Invalid request"])
    }
    const linked = await CampaignBeach.findOne({
      where: { campaignId, beachId }
    })
    if (!linked) {
      throw validationError(["Invalid request"])
    }
    where.beachId = beachId
  }

  const total = await WasteCollection.count({ where })
  const rows = await WasteCollection.findAll({
    where,
    include: WASTE_COLLECTION_LIST_INCLUDE,
    order: [["createdAt", "DESC"]],
    limit,
    offset
  })

  return {
    items: rows.map((w) => mapCollectionRowFromEntity(w)),
    total,
    page,
    pageSize
  }
}

async function loadCollectionMapped(id) {
  const w = await WasteCollection.findByPk(id, {
    include: [
      { model: Beach, as: "beach", attributes: ["id", "name"] },
      { model: Waste, as: "waste", attributes: ["id", "name"] },
      { model: User, as: "recordedBy", attributes: ["id", "name"] }
    ]
  })

  if (!w) {
    throw notFoundError("Waste collection")
  }

  return mapCollectionRowFromEntity(w)
}

async function createWasteCollectionForCampaign(campaignId, actorId, body) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  await assertCanInteractWithCampaignCollections(actorId, campaignId)

  const beachId = body.beachId
  const wasteId = body.wasteId
  const unitQuantity = Number(body.unitQuantity)

  if (
    !beachId ||
    !wasteId ||
    !Number.isFinite(unitQuantity) ||
    unitQuantity < 1 ||
    unitQuantity > MAX_UNIT_QUANTITY
  ) {
    throw validationError(["Invalid request"])
  }

  if (!isUuidParam(beachId) || !isUuidParam(wasteId)) {
    throw validationError(["Invalid request"])
  }

  const link = await CampaignBeach.findOne({
    where: { campaignId, beachId }
  })

  if (!link) {
    throw validationError(["Invalid request"])
  }

  const waste = await Waste.findByPk(wasteId)
  if (!waste) {
    throw validationError(["Invalid request"])
  }

  const beach = await Beach.findByPk(beachId)
  if (!beach) {
    throw validationError(["Invalid request"])
  }

  const existing = await WasteCollection.findOne({
    where: { campaignId, beachId, wasteId },
    paranoid: false
  })

  const weight =
    body.actualWeightKg !== undefined && body.actualWeightKg !== null
      ? Number(body.actualWeightKg)
      : null

  if (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT_KG)) {
    throw validationError(["Invalid request"])
  }

  if (existing) {
    if (existing.deletedAt) {
      existing.deletedAt = null
      existing.unitQuantity = unitQuantity
      existing.actualWeightKg =
        weight != null && Number.isFinite(weight) && weight <= MAX_WEIGHT_KG ? weight : null
      existing.recordedByUserId = actorId
      await existing.save()
      return loadCollectionMapped(existing.id)
    }
    const nextQty = existing.unitQuantity + unitQuantity
    if (nextQty > MAX_UNIT_QUANTITY) {
      throw validationError(["Invalid request"])
    }
    existing.unitQuantity = nextQty
    if (weight != null && Number.isFinite(weight)) {
      const prev =
        existing.actualWeightKg != null ? Number(existing.actualWeightKg) : 0
      const nextW = prev + weight
      if (nextW > MAX_WEIGHT_KG) {
        throw validationError(["Invalid request"])
      }
      existing.actualWeightKg = nextW
    }
    await existing.save()
    return loadCollectionMapped(existing.id)
  }

  const now = new Date()
  const row = await WasteCollection.create({
    campaignId,
    beachId,
    wasteId,
    recordedByUserId: actorId,
    unitQuantity,
    actualWeightKg:
      weight != null && Number.isFinite(weight) && weight <= MAX_WEIGHT_KG ? weight : null,
    createdAt: now,
    updatedAt: now
  })

  return loadCollectionMapped(row.id)
}

async function updateWasteCollectionRecord(collectionId, actorId, body) {
  if (!isUuidParam(collectionId)) {
    throw validationError(["Invalid id"])
  }

  const collection = await WasteCollection.findByPk(collectionId)
  if (!collection) {
    throw notFoundError("Waste collection")
  }

  await assertCanModifyCollection(actorId, collection)

  if (body.unitQuantity !== undefined) {
    const n = Number(body.unitQuantity)
    if (!Number.isFinite(n) || n < 1 || n > MAX_UNIT_QUANTITY) {
      throw validationError(["Invalid request"])
    }
    collection.unitQuantity = n
  }

  if (body.actualWeightKg !== undefined) {
    if (body.actualWeightKg === null) {
      collection.actualWeightKg = null
    } else {
      const n = Number(body.actualWeightKg)
      if (!Number.isFinite(n) || n < 0 || n > MAX_WEIGHT_KG) {
        throw validationError(["Invalid request"])
      }
      collection.actualWeightKg = n
    }
  }

  await collection.save()
  return loadCollectionMapped(collection.id)
}

async function deleteWasteCollectionRecord(collectionId, actorId) {
  if (!isUuidParam(collectionId)) {
    throw validationError(["Invalid id"])
  }

  const collection = await WasteCollection.findByPk(collectionId)
  if (!collection) {
    throw notFoundError("Waste collection")
  }

  await assertCanModifyCollection(actorId, collection)
  await collection.destroy()
}

const NEXT_CAMPAIGN_STATUS_WHERE = {
  deletedAt: null,
  status: { [Op.in]: [1, 2, 3] }
}

async function findNextNearestCampaign(todayStr) {
  const upcoming = await Campaign.findOne({
    where: {
      ...NEXT_CAMPAIGN_STATUS_WHERE,
      startDate: { [Op.gte]: todayStr }
    },
    order: [["startDate", "ASC"]]
  })
  if (upcoming) return upcoming

  return Campaign.findOne({
    where: {
      ...NEXT_CAMPAIGN_STATUS_WHERE,
      startDate: { [Op.lte]: todayStr },
      endDate: { [Op.gte]: todayStr }
    },
    order: [["endDate", "ASC"], ["startDate", "ASC"]]
  })
}

function buildMonthlyTrend(collections) {
  const monthMap = new Map()
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthMap.set(key, { month: key, weightKg: 0, units: 0 })
  }
  for (const row of collections) {
    const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
    if (Number.isNaN(created.getTime())) continue
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`
    if (!monthMap.has(key)) continue
    const entry = monthMap.get(key)
    entry.units += Number(row.unitQuantity) || 0
    entry.weightKg += collectionImpactWeightKg(row, row.waste)
  }
  return [...monthMap.values()].map((entry) => ({
    month: entry.month,
    units: entry.units,
    weightKg: Math.round(entry.weightKg * 1000) / 1000
  }))
}

function buildTopBeaches(collections) {
  const byBeach = new Map()
  for (const row of collections) {
    const beachId = row.beachId
    const name = row.beach?.name ?? "—"
    const prev = byBeach.get(beachId) ?? {
      beachId,
      name,
      collectionsCount: 0,
      weightKg: 0
    }
    prev.collectionsCount += 1
    prev.weightKg += collectionImpactWeightKg(row, row.waste)
    byBeach.set(beachId, prev)
  }
  return [...byBeach.values()]
    .map((entry) => ({
      beachId: entry.beachId,
      name: entry.name,
      collectionsCount: entry.collectionsCount,
      weightKg: Math.round(entry.weightKg * 1000) / 1000
    }))
    .sort((a, b) => b.collectionsCount - a.collectionsCount || b.weightKg - a.weightKg)
    .slice(0, 5)
}

export async function buildDashboardOverview() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  const todayStr = `${y}-${m}-${day}`

  const [
    campaignCount,
    beachCount,
    completedCampaigns,
    allCollections,
    nextCampaign
  ] = await Promise.all([
    Campaign.count({ where: { deletedAt: null } }),
    Beach.count({ where: { deletedAt: null } }),
    Campaign.count({ where: { deletedAt: null, status: 4 } }),
    WasteCollection.findAll({
      where: { deletedAt: null },
      attributes: ["id", "beachId", "unitQuantity", "actualWeightKg", "createdAt"],
      include: DASHBOARD_WASTE_INCLUDE
    }),
    findNextNearestCampaign(todayStr)
  ])

  const volunteerRows = await sequelize.query(
    "SELECT COUNT(DISTINCT utilizador_id) AS c FROM inscricao WHERE deleted_at IS NULL",
    { type: QueryTypes.SELECT }
  )
  const volunteerCount = Number(volunteerRows[0]?.c ?? 0)

  const wasteImpact = computeWasteImpactTotals(allCollections)
  const weightKg = wasteImpact.totalActualWeightKg
  const unitsTotal = allCollections.reduce(
    (sum, row) => sum + (Number(row.unitQuantity) || 0),
    0
  )

  const wasteByType = aggregateWasteByType(allCollections).slice(0, 5)
  const wasteByTypeRows = wasteByType.map((entry) => ({
    label: entry.typeName,
    value: `${Math.round(entry.weightKg)} kg · ${entry.units} un.`
  }))

  const agg = new Map()
  for (const row of allCollections) {
    const wid = row.wasteId
    const qty = Number(row.unitQuantity) || 0
    agg.set(wid, (agg.get(wid) ?? 0) + qty)
  }
  let topName = "—"
  let topQty = 0
  for (const row of allCollections) {
    const total = agg.get(row.wasteId) ?? 0
    if (total > topQty) {
      topQty = total
      topName = row.waste?.name ?? "—"
    }
  }
  if (topQty === 0) {
    topName = "—"
  }

  const monthlyTrend = buildMonthlyTrend(allCollections)
  const topBeaches = buildTopBeaches(allCollections)

  let nextCampaignRows = [
    { label: "Título", value: "—" },
    { label: "Data", value: "—" },
    { label: "Inscritos", value: "0" },
    { label: "Praias", value: "0" }
  ]

  if (nextCampaign) {
    const [inscCount, beachLinkCount] = await Promise.all([
      Registration.count({ where: { campaignId: nextCampaign.id } }),
      CampaignBeach.count({ where: { campaignId: nextCampaign.id } })
    ])
    nextCampaignRows = [
      { label: "Título", value: nextCampaign.title },
      { label: "Data", value: formatPtLongDate(nextCampaign.startDate) },
      { label: "Inscritos", value: String(inscCount) },
      { label: "Praias", value: String(beachLinkCount) }
    ]
  }

  return {
    metrics: {
      campaignCount,
      beachCount,
      volunteerCount
    },
    cleaningStatsRows: [
      { label: "Campanhas concluídas", value: String(completedCampaigns) },
      { label: "Kg pesados", value: String(Math.round(weightKg)) },
      { label: "Resíduos apanhados", value: String(Math.round(unitsTotal)) },
      { label: "Resíduo mais comum", value: topName }
    ],
    wasteByTypeRows,
    monthlyTrend,
    topBeaches,
    nextCampaignRows,
    nextCampaignId: nextCampaign?.id ?? null
  }
}

// Verifico que o recurso aninhado pertence à campanha do URL (anti-IDOR)

function paginatedHateoas(basePath, data, options = {}) {
  return listResponse(
    basePath,
    data.items,
    { page: data.page, pageSize: data.pageSize, total: data.total },
    options
  )
}

export const getAllCampaigns = async (req, res, next) => {
  try {
    const summaryRaw = req.query?.summary
    if (summaryRaw != null && String(summaryRaw).trim() !== "") {
      return next(validationError({ summary: ["Use GET /dashboard for overview"] }))
    }
    const filters = parseCampaignListFilters(req.query ?? {})
    const data = await listCampaigns(
      parsePaginationQuery(req.query ?? {}),
      filters,
      req.user?.sub
    )
    res.json(paginatedHateoas(CAMPAIGNS_BASE, data))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching campaigns")
  }
}

export const createCampaignHandler = async (req, res, next) => {
  try {
    const data = await createCampaign(req.user.sub, req.body ?? {})
    const response = withResourceLinks(CAMPAIGNS_BASE, data, { collection: "allCampaigns" })
    res.status(201).location(`${CAMPAIGNS_BASE}/${data.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating campaign")
  }
}

export const getCampaignById = async (req, res, next) => {
  try {
    const data = await getCampaignDetails(req.params.id, req.user.sub)
    res.json(withResourceLinks(CAMPAIGNS_BASE, data, { collection: "allCampaigns" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching campaign")
  }
}

export const updateCampaignHandler = async (req, res, next) => {
  try {
    const missing = missingCampaignPutFields(req.body ?? {})
    if (missing.length > 0) {
      return next(missingFieldsValidationError(missing))
    }
    const data = await updateCampaign(req.user.sub, req.params.id, req.body ?? {})
    res.json(withResourceLinks(CAMPAIGNS_BASE, data, { collection: "allCampaigns" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating campaign")
  }
}

export const deleteCampaignHandler = async (req, res, next) => {
  try {
    await deleteCampaign(req.user.sub, req.params.id)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting campaign")
  }
}

export const getAllRegistrations = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/registrations`
    let statusFilter = null
    const statusRaw = req.query?.status
    if (statusRaw != null && statusRaw !== "") {
      const s = Number(statusRaw)
      if (s !== 0 && s !== 1 && s !== 2) {
        return next(validationError(["Invalid request"]))
      }
      statusFilter = s
    }
    const data = await listRegistrationsForCampaign(
      req.params.campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {}),
      { status: statusFilter }
    )
    res.json(paginatedHateoas(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching registrations")
  }
}

export const createRegistrationHandler = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/registrations`
    const data = await createSelfRegistration(req.params.campaignId, req.user.sub)
    const response = withResourceLinks(base, data, { updateMethod: "PATCH" })
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating registration")
  }
}

export const updateRegistrationHandler = async (req, res, next) => {
  try {
    await assertRegistrationInCampaign(req.params.campaignId, req.params.registrationId)
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/registrations`
    const data = await updateRegistration(
      req.params.registrationId,
      req.user.sub,
      req.body ?? {}
    )
    res.json(withResourceLinks(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating registration")
  }
}

export const deleteRegistrationHandler = async (req, res, next) => {
  try {
    await assertRegistrationInCampaign(req.params.campaignId, req.params.registrationId)
    await deleteRegistration(req.params.registrationId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting registration")
  }
}

export const getAllComments = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/comments`
    const data = await listCampaignComments(
      req.params.campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {})
    )
    res.json(paginatedHateoas(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching comments")
  }
}

export const createCommentHandler = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/comments`
    const data = await createCampaignComment(req.params.campaignId, req.user.sub, req.body ?? {})
    const response = withResourceLinks(base, data, { updateMethod: "PATCH" })
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating comment")
  }
}

export const updateCommentHandler = async (req, res, next) => {
  try {
    await assertCommentInCampaign(req.params.campaignId, req.params.commentId)
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/comments`
    const data = await updateCommentVisibility(
      req.params.commentId,
      req.user.sub,
      req.body ?? {}
    )
    res.json(withResourceLinks(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating comment")
  }
}

export const deleteCommentHandler = async (req, res, next) => {
  try {
    await assertCommentInCampaign(req.params.campaignId, req.params.commentId)
    await deleteComment(req.params.commentId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting comment")
  }
}

export const getAllWasteCollections = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/waste-collections`
    const beachId = typeof req.query?.beachId === "string" ? req.query.beachId : undefined
    const data = await listWasteCollectionsForCampaign(
      req.params.campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {}),
      beachId
    )
    res.json(paginatedHateoas(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching waste collections")
  }
}

export const createWasteCollectionHandler = async (req, res, next) => {
  try {
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/waste-collections`
    const data = await createWasteCollectionForCampaign(
      req.params.campaignId,
      req.user.sub,
      req.body ?? {}
    )
    const response = withResourceLinks(base, data, { updateMethod: "PATCH" })
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating waste collection")
  }
}

export const updateWasteCollectionHandler = async (req, res, next) => {
  try {
    await assertCollectionInCampaign(req.params.campaignId, req.params.collectionId)
    const base = `${CAMPAIGNS_BASE}/${req.params.campaignId}/waste-collections`
    const data = await updateWasteCollectionRecord(
      req.params.collectionId,
      req.user.sub,
      req.body ?? {}
    )
    res.json(withResourceLinks(base, data, { updateMethod: "PATCH" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating waste collection")
  }
}

export const deleteWasteCollectionHandler = async (req, res, next) => {
  try {
    await assertCollectionInCampaign(req.params.campaignId, req.params.collectionId)
    await deleteWasteCollectionRecord(req.params.collectionId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting waste collection")
  }
}
