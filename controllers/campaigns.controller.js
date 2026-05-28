import { Op } from "sequelize"
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
  createError,
  forwardControllerError,
  missingFieldsValidationError,
  notFoundError,
  validationError,
  isUuidParam
} from "../utils/error.utils.js"
import {
  buildCampaignListWhere,
  CAMPAIGNS_BASE,
  computeWasteImpactTotals,
  districtCodeFromLabel,
  isValidDistrictCode,
  listResponse,
  parseCampaignListFilters,
  parsePaginationQuery,
  withResourceLinks
} from "../utils/hateoas.utils.js"


// Aceito ISO (YYYY-MM-DD) ou formato PT (DD/MM/YYYY) vindos do cliente
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

// Mapeio chaves UI (web) e legado inglês para o status numérico na BD
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

// Agrupo estados da BD em 3 fases no detalhe (0=planeada, 1=ativa, 2=concluída)
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

export async function listCampaigns(pagination, filters, userId) {
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

// Permito gestão ao organizador da campanha ou ao admin
async function assertCanManageCampaign(actorUserId, campaign) {
  if (campaign.organizerId === actorUserId) {
    return
  }
  const user = await User.findByPk(actorUserId, { attributes: ["isAdmin"] })
  if (!user?.isAdmin) {
    throw createError(403, "Forbidden")
  }
}

export async function updateCampaign(actorUserId, campaignId, body) {
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

export async function deleteCampaign(actorUserId, campaignId) {
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

function paginatedHateoas(basePath, data, options = {}) {
  return listResponse(
    basePath,
    data.items,
    { page: data.page, pageSize: data.pageSize, total: data.total },
    options
  )
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

export const getAllCampaigns = async (req, res, next) => {
  try {
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
