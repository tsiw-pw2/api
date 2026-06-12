import PDFDocument from "pdfkit"
import { Op } from "sequelize"
import { sequelize, Beach, BeachLocation, Campaign, CampaignBeach, Comment, Organization, Registration, User, Waste, WasteCollection, WasteType } from "../models/db.config.js"
import { createError, passControllerError, missingFieldsValidationError, notFoundError, validationError, isUuidParam } from "../utils/error.utils.js"
import { assertCampaignEndOnOrAfterStart, buildCampaignListWhere, computeWasteImpactTotals, districtCodeFromLabel, isValidDistrictCode, parseCampaignListFilters } from "../utils/domain.utils.js"
import { CAMPAIGNS_BASE, paginatedList, parsePaginationQuery, withCampaignResourceLinksForActor, withRegistrationResourceLinks, withResourceLinks } from "../utils/response.utils.js"
import { campaignCollectionCreateAllowed, campaignItemActions, loadActorContext, registrationCollectionCreateAllowed, viewerRegistrationActions } from "../utils/hypermedia.permissions.js"

// --- Helpers de datas (API aceita ISO ou DD/MM/AAAA; BD guarda DATE como AAAA-MM-DD) ---

// Aceitar ISO (YYYY-MM-DD) ou formato PT (DD/MM/YYYY) vindos do cliente.
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

// Formatar uma data em texto DD/MM/AAAA (UTC) para a listagem.
function formatDatePt(value) {
  const d = typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value
  if (Number.isNaN(d.getTime())) return ""
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// Converter um valor de data para cadeia ISO AAAA-MM-DD (detalhe da campanha).
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

// --- Mapeamento de estado campanha (chaves UI → inteiro na BD) ---

// Mapear chaves UI (web) e legado inglês para o estado numérico em campanha.
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

// Incluir praias e município na listagem (N:N via campanha_praia).
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

// Derivar o local de encontro a partir do rascunho de informação (coluna local_encontro na BD).
function meetingLocationFromDraft(information) {
  const t = information?.trim() ?? ""
  if (t.length === 0) return "Local a definir"
  return t.length > 255 ? t.slice(0, 255) : t
}

// Normalizar a hora de encontro para guardar na base de dados (HH:MM → HH:MM:SS).
function formatMeetingTimeForDb(t) {
  const s = (t ?? "").trim()
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`
  return s.length > 0 ? s : null
}

// Agrupar estados da BD em 3 fases no detalhe (0=planeada, 1=ativa, 2=concluída).
function mapStatusForDetailsUi(db) {
  if (db === 4) return 2
  if (db === 1 || db === 2 || db === 3) return 1
  return 0
}

// Mapear o estado numérico da BD para a chave de edição na interface (statusKey / editStatus).
function editStatusKeyFromDbStatus(db) {
  const n = Number(db)
  if (n === 1) return "aberta_inscricoes"
  if (n === 2) return "encerrada_inscricoes"
  if (n === 3) return "em_progresso"
  if (n === 4) return "concluida"
  if (n === 5) return "cancelada"
  return "planeada"
}

// Obter o primeiro concelho associado às praias da campanha (para coluna municipality na listagem).
function firstMunicipalityFromCampaignBeaches(c) {
  for (const b of c.beaches ?? []) {
    const m = b.beachLocation?.municipality?.trim()
    if (m) return m
  }
  return null
}

// --- formato da API e listagem ---

// Transformar um registo de campanha no formato da API da listagem REST.
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
    districtCode: c.districtCode ?? null,
    organizerId: c.organizerId ?? null
  }
}

// Listar campanhas paginadas com filtros e praias associadas (âmbito depende do utilizador).
export async function listCampaigns(pagination, filters, userId, orgContext = null) {
  const { offset, limit, page, pageSize } = pagination
  const where = await buildCampaignListWhere(filters, userId, orgContext)
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

// --- Criação e actualização ---

// Validar e deduplicar os identificadores de praias no pedido de criação.
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

// Criar uma campanha e ligá-la às praias do distrito indicado (transacção campanha + campanha_praia).
export async function createCampaign(actorUserId, body, organizationId) {
  if (!organizationId) {
    throw validationError(["Organization required"])
  }
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

  assertCampaignEndOnOrAfterStart(startDate, endDate)

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

  // Exigir que todas as praias escolhidas pertençam ao distrito indicado (distrito_codigo na campanha).
  for (const b of beaches) {
    const label = b.beachLocation?.district?.trim() ?? ""
    const code = districtCodeFromLabel(label)
    if (code !== districtRaw) {
      throw validationError(["Invalid request"])
    }
  }

  // Criar campanha e ligações às praias numa transação atómica.
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
        organizationId,
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

// Garantir gestão ao organizador da campanha ou admin da org (defesa em profundidade).
async function assertCanManageCampaign(actorUserId, campaign, organizationId = null) {
  if (organizationId && campaign.organizationId && campaign.organizationId !== organizationId) {
    throw createError(403, "Forbidden")
  }
  const { actorCanManageCampaign } = await import("../utils/domain.utils.js")
  if (!(await actorCanManageCampaign(actorUserId, campaign))) {
    throw createError(403, "Forbidden")
  }
}

// Actualizar os dados de uma campanha existente (organizador ou administrador).
export async function updateCampaign(actorUserId, campaignId, body, organizationId = null) {
  const campaign = await Campaign.findByPk(campaignId, {
    include: [CAMPAIGN_LIST_BEACHES_INCLUDE]
  })

  if (!campaign) {
    throw notFoundError("Campaign")
  }

  await assertCanManageCampaign(actorUserId, campaign, organizationId)

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

  assertCampaignEndOnOrAfterStart(startDate, endDate)

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

// Eliminar uma campanha (eliminação lógica) após verificar permissões de gestão.
export async function deleteCampaign(actorUserId, campaignId, organizationId = null) {
  const campaign = await Campaign.findByPk(campaignId)

  if (!campaign) {
    throw notFoundError("Campaign")
  }

  await assertCanManageCampaign(actorUserId, campaign, organizationId)
  await campaign.destroy()
}

// --- Detalhe da campanha e contexto do visitante ---

// Carregar a inscrição do utilizador autenticado nesta campanha (para indicadores e ligações hipermedia).
async function resolveViewerRegistration(campaignId, viewerUserId) {
  if (!viewerUserId || !isUuidParam(viewerUserId)) {
    return null
  }
  const row = await Registration.findOne({
    where: { campaignId, userId: viewerUserId },
    attributes: ["id", "userId", "role", "status", "attendance"]
  })
  if (!row) {
    return null
  }
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    status: row.status,
    attendance: row.attendance
  }
}

// Indicar se o visitante pode publicar comentários na campanha (organizador, admin ou inscrito activo).
function resolveViewerCanPostComment(campaign, viewerUserId, isOrgAdminViewer, viewerRegistration) {
  if (!viewerUserId || !isUuidParam(viewerUserId)) {
    return false
  }
  if (campaign.organizerId === viewerUserId) {
    return true
  }
  if (isOrgAdminViewer) {
    return true
  }
  // Não permitir comentários de inscritos cancelados (estado 2).
  return viewerRegistration != null && viewerRegistration.status !== 2
}

// Devolver o detalhe da campanha com métricas agregadas e contexto do visitante.
export async function getCampaignDetails(campaignId, viewerUserId) {
  const { isOrgAdminFor } = await import("../utils/organization.utils.js")
  let isOrgAdminViewer = false
  if (typeof viewerUserId === "string" && isUuidParam(viewerUserId)) {
    const campaignOrgId = (
      await Campaign.findByPk(campaignId, { attributes: ["organizationId"] })
    )?.organizationId
    if (campaignOrgId) {
      isOrgAdminViewer = await isOrgAdminFor(viewerUserId, campaignOrgId)
    }
  }

  const campaign = await Campaign.findByPk(campaignId, {
    include: [
      { model: User, as: "organizer", attributes: ["id", "name"] },
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
  // Contar comentários ocultos só para admins na métrica do detalhe.
  const commentsCountWhere = isOrgAdminViewer
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
    isOrgAdminViewer,
    viewerRegistration
  )

  // Hipermedia: indicador para a interface saber se pode mostrar acção de auto-inscrição.
  let viewerCanEnroll = false
  if (typeof viewerUserId === "string" && isUuidParam(viewerUserId)) {
    const actor = await loadActorContext(viewerUserId)
    viewerCanEnroll = await registrationCollectionCreateAllowed(actor, campaignId)
  }

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
          name: campaign.organizer.name
        }
      : null,
    beaches,
    metrics,
    viewerCanPostComment,
    viewerCanEnroll,
    viewerRegistration
  }
}

// Listar campos obrigatórios em falta no corpo PATCH da campanha (corpo completo, não parcial campo a campo).
function missingCampaignPatchFields(body) {
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

/**
 * Listar campanhas com filtros e paginação.
 * Método: GET
 * Rota: /campaigns
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Filtros: scope, status (estado), district (código), datas, pesquisa q.
 * - Visibilidade e links dependem do papel do utilizador autenticado (hipermedia estrito).
 *
 * Notas técnicas:
 * - Eliminação lógica em campanha; organizador vê as suas campanhas.
 */
export const getAllCampaigns = async (req, res, next) => {
  try {
    // Carregar contexto do utilizador autenticado para filtrar âmbito e ligações hipermedia condicionais.
    const actor = await loadActorContext(req.user.sub)
    const filters = parseCampaignListFilters(req.query ?? {})
    const data = await listCampaigns(
      parsePaginationQuery(req.query ?? {}),
      filters,
      req.user?.sub,
      { organizationId: req.organizationId ?? null, role: req.user?.role }
    )
    res.json(
      paginatedList(CAMPAIGNS_BASE, data, {
        query: req.query,
        includeCreate: campaignCollectionCreateAllowed(actor),
        mapItem: (item) =>
          withResourceLinks(CAMPAIGNS_BASE, item, {
            actions: campaignItemActions(actor, {
              id: item.id,
              organizerId: item.organizerId,
              organizationId: item.organizationId
            }),
            collection: "allCampaigns"
          })
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching campaigns")
  }
}

/**
 * Criar campanha de limpeza.
 * Método: POST
 * Rota: /campaigns
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Exigir distrito_codigo válido e beachIds do mesmo distrito.
 * - Associar praias via tabela intermédia campanha_praia (N:N).
 * - Actor torna-se organizador_id da campanha criada.
 *
 * Notas técnicas:
 * - Transacção Sequelize para campanha + campanha_praia.
 */
export const createCampaignHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    // createCampaign corre em transacção (campanha + campanha_praia).
    const data = await createCampaign(req.user.sub, req.body ?? {}, req.organizationId)
    const response = await withCampaignResourceLinksForActor(data, actor, {
      organizerId: req.user.sub
    })
    res.status(201).location(`${CAMPAIGNS_BASE}/${data.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating campaign")
  }
}

/**
 * Detalhe de campanha com praias, métricas e contexto do visitante.
 * Método: GET
 * Rota: /campaigns/:id
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Incluir inscrição do visitante (viewerRegistration) e indicador viewerCanEnroll quando aplicável.
 * - Comentários ocultos (is_visible=0) só visíveis a organizador/admin.
 *
 * Notas técnicas:
 * - Agregar métricas de inscrições e recolhas; links para sub-recursos condicionais.
 */
export const getCampaignById = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const data = await getCampaignDetails(req.params.id, req.user.sub)
    const campaignRow = { id: data.id, organizerId: data.organizer?.id ?? null }
    // Enriquecer inscrição do visitante com ligações de acção (cancelar, etc.).
    if (data.viewerRegistration) {
      const regActions = viewerRegistrationActions(actor, data.viewerRegistration, campaignRow)
      data.viewerRegistration = withRegistrationResourceLinks(
        data.id,
        data.viewerRegistration,
        regActions
      )
    }
    const body = await withCampaignResourceLinksForActor(data, actor, {
      organizerId: campaignRow.organizerId
    })
    res.json(body)
  } catch (error) {
    passControllerError(error, next, "Error fetching campaign")
  }
}

/**
 * Actualizar campanha existente.
 * Método: PATCH
 * Rota: /campaigns/:id
 * Autenticação: sim (Bearer JWT, organizador dono ou admin)
 *
 * Regras de negócio:
 * - Apenas organizador da campanha ou administrador podem editar.
 * - Validar transição de estado, datas e local de encontro.
 *
 * Notas técnicas:
 * - PATCH parcial com campos obrigatórios validados no controlador.
 */
export const updateCampaignHandler = async (req, res, next) => {
  try {
    const missing = missingCampaignPatchFields(req.body ?? {})
    if (missing.length > 0) {
      return next(missingFieldsValidationError(missing))
    }
    const actor = await loadActorContext(req.user.sub)
    const data = await updateCampaign(req.user.sub, req.params.id, req.body ?? {}, req.organizationId)
    const body = await withCampaignResourceLinksForActor(data, actor, {
      organizerId: data.organizerId
    })
    res.json(body)
  } catch (error) {
    passControllerError(error, next, "Error updating campaign")
  }
}

/**
 * Eliminar campanha (eliminação lógica).
 * Método: DELETE
 * Rota: /campaigns/:id
 * Autenticação: sim (Bearer JWT, organizador dono ou admin)
 *
 * Regras de negócio:
 * - Apenas organizador da campanha ou administrador podem eliminar.
 *
 * Notas técnicas:
 * - destroy() com eliminação lógica preenche deleted_at; filhos RESTRICT impedem eliminação física.
 * - Resposta 204 sem corpo.
 */
export const deleteCampaignHandler = async (req, res, next) => {
  try {
    await deleteCampaign(req.user.sub, req.params.id, req.organizationId)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting campaign")
  }
}

function campaignReportReferenceCode(campaignId) {
  return String(campaignId).replace(/-/g, "").slice(0, 8).toUpperCase()
}

function formatReportMeetingTime(value) {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim())
  if (!match) return String(value).trim()
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

async function buildCampaignReportPayload(campaignId, organizationId = null) {
  const campaign = await Campaign.findOne({
    where: { id: campaignId, deletedAt: null },
    attributes: [
      "id",
      "title",
      "description",
      "startDate",
      "endDate",
      "meetingLocation",
      "meetingTime",
      "status",
      "organizationId"
    ],
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "municipality"]
      },
      {
        model: User,
        as: "organizer",
        attributes: ["id", "name"]
      },
      {
        model: Beach,
        as: "beaches",
        through: { attributes: [] },
        attributes: ["id", "name"],
        required: false,
        include: [
          {
            model: BeachLocation,
            as: "beachLocation",
            attributes: ["municipality", "district"]
          }
        ]
      }
    ]
  })
  if (!campaign) {
    throw notFoundError("Campaign", campaignId)
  }
  if (campaign.status !== 4) {
    throw createError(400, "Report only available for completed campaigns")
  }
  if (organizationId && campaign.organizationId !== organizationId) {
    throw createError(403, "Forbidden")
  }

  const [registrations, wasteRows] = await Promise.all([
    Registration.findAll({
      where: { campaignId, deletedAt: null },
      attributes: ["id", "status", "attendance"]
    }),
    WasteCollection.findAll({
      where: { campaignId, deletedAt: null },
      include: [
        { model: Beach, as: "beach", attributes: ["id", "name"] },
        { model: Waste, as: "waste", attributes: ["id", "name", "unit"], include: [{ model: WasteType, as: "wasteType", attributes: ["name"] }] }
      ]
    })
  ])

  const pendingCount = registrations.filter((r) => r.status === 0).length
  const confirmedRegs = registrations.filter((r) => r.status === 1)
  const cancelledCount = registrations.filter((r) => r.status === 2).length
  const presentCount = confirmedRegs.filter((r) => r.attendance === true).length
  const absentCount = confirmedRegs.filter((r) => r.attendance === false).length
  const attendanceRate =
    confirmedRegs.length > 0 ? Math.round((presentCount / confirmedRegs.length) * 100) : 0
  const wasteImpact = computeWasteImpactTotals(wasteRows)

  const beaches = (campaign.beaches ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    municipality: b.beachLocation?.municipality ?? null,
    district: b.beachLocation?.district ?? null
  }))

  const districtSet = new Set(beaches.map((b) => b.district).filter(Boolean))
  const district = districtSet.size > 0 ? [...districtSet].join(", ") : null

  const wasteByBeach = new Map()
  const wasteByType = new Map()
  for (const row of wasteRows) {
    const beachId = row.beachId
    const beachName = row.beach?.name ?? "—"
    if (!wasteByBeach.has(beachId)) {
      wasteByBeach.set(beachId, { beachId, beachName, collections: [], totalUnits: 0, totalWeightKg: 0 })
    }
    const entry = wasteByBeach.get(beachId)
    const units = Number(row.unitQuantity) || 0
    const weight = Number(row.actualWeightKg) || 0
    const wasteTypeName = row.waste?.wasteType?.name ?? "Sem classificação"
    entry.collections.push({
      wasteName: row.waste?.name ?? "—",
      wasteType: row.waste?.wasteType?.name ?? null,
      unitQuantity: units,
      actualWeightKg: weight
    })
    entry.totalUnits += units
    entry.totalWeightKg += weight

    if (!wasteByType.has(wasteTypeName)) {
      wasteByType.set(wasteTypeName, { wasteType: wasteTypeName, totalUnits: 0, totalWeightKg: 0 })
    }
    const typeEntry = wasteByType.get(wasteTypeName)
    typeEntry.totalUnits += units
    typeEntry.totalWeightKg += weight
  }

  return {
    id: campaign.id,
    referenceCode: campaignReportReferenceCode(campaign.id),
    title: campaign.title,
    statusLabel: "Concluída",
    organizationName: campaign.organization?.name ?? null,
    organizationMunicipality: campaign.organization?.municipality ?? null,
    organizerName: campaign.organizer?.name ?? null,
    district,
    description: campaign.description?.trim() || null,
    startDate: toIsoDateString(campaign.startDate),
    endDate: toIsoDateString(campaign.endDate),
    meetingLocation: campaign.meetingLocation,
    meetingTime: formatReportMeetingTime(campaign.meetingTime),
    beaches,
    volunteers: {
      total: registrations.length,
      pending: pendingCount,
      confirmed: confirmedRegs.length,
      cancelled: cancelledCount,
      present: presentCount,
      absent: absentCount,
      attendanceRate
    },
    waste: {
      totalUnits: wasteRows.reduce((sum, r) => sum + (Number(r.unitQuantity) || 0), 0),
      totalActualWeightKg: wasteImpact.totalActualWeightKg,
      totalImpactWeightKg: wasteImpact.totalImpactWeightKg,
      byType: [...wasteByType.values()].sort((a, b) => b.totalWeightKg - a.totalWeightKg),
      byBeach: [...wasteByBeach.values()]
    },
    generatedAt: new Date().toISOString()
  }
}

function renderCampaignReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" })
    const chunks = []
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

    doc.fontSize(9).fillColor("#475569").text("REPÚBLICA PORTUGUESA", { align: "center" })
    doc.fontSize(11).fillColor("#0f172a").text(report.organizationName ?? "Entidade promotora", { align: "center" })
    if (report.organizationMunicipality) {
      doc.fontSize(9).fillColor("#64748b").text(`Município de ${report.organizationMunicipality}`, { align: "center" })
    }
    doc.moveDown(0.5)
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).strokeColor("#94a3b8").stroke()
    doc.moveDown()
    doc.fontSize(13).fillColor("#0f172a").text("RELATÓRIO DE CAMPANHA DE LIMPEZA DE PRAIAS", { align: "center" })
    doc.fontSize(11).text(report.title, { align: "center" })
    doc.fontSize(8).fillColor("#64748b").text(`Ref. ${report.referenceCode}`, { align: "center" })
    doc.moveDown()

    doc.fillColor("#0f172a").fontSize(10).text(`Estado: ${report.statusLabel}`)
    doc.text(`Período: ${report.startDate} — ${report.endDate}`)
    doc.text(`Distrito: ${report.district ?? "—"}`)
    doc.text(`Ponto de encontro: ${report.meetingLocation || "—"}`)
    doc.text(`Hora de encontro: ${report.meetingTime ?? "—"}`)
    doc.text(`Organizador responsável: ${report.organizerName ?? "—"}`)
    doc.moveDown()

    if (report.description) {
      doc.fontSize(11).text("Objectivo e informações")
      doc.fontSize(9).fillColor("#334155").text(report.description, { align: "justify" })
      doc.moveDown()
    }

    doc.fillColor("#0f172a").fontSize(11).text(`1. Praias abrangidas (${report.beaches.length})`)
    for (const beach of report.beaches) {
      doc.fontSize(9).text(`• ${beach.name} — ${beach.municipality ?? "—"} (${beach.district ?? "—"})`)
    }
    doc.moveDown()

    doc.fontSize(11).text("2. Participação voluntária")
    doc.fontSize(9).text(`Total inscrições: ${report.volunteers.total}`)
    doc.text(`Confirmadas: ${report.volunteers.confirmed} | Presentes: ${report.volunteers.present} | Taxa: ${report.volunteers.attendanceRate}%`)
    doc.text(`Pendentes: ${report.volunteers.pending} | Canceladas: ${report.volunteers.cancelled} | Ausentes: ${report.volunteers.absent}`)
    doc.moveDown()

    doc.fontSize(11).text("3. Resíduos recolhidos")
    doc.fontSize(9).text(`Unidades: ${report.waste.totalUnits}`)
    doc.text(`Peso real (kg): ${report.waste.totalActualWeightKg}`)
    doc.text(`Impacto estimado (kg): ${report.waste.totalImpactWeightKg}`)
    doc.moveDown(0.5)

    for (const row of report.waste.byType ?? []) {
      doc.fontSize(9).text(`• ${row.wasteType}: ${row.totalUnits} un., ${row.totalWeightKg} kg`)
    }
    doc.moveDown()

    for (const beach of report.waste.byBeach) {
      doc.fontSize(10).text(`Detalhe — ${beach.beachName}`)
      for (const c of beach.collections) {
        doc.fontSize(8).text(`  ${c.wasteName} (${c.wasteType ?? "—"}): ${c.unitQuantity} un., ${c.actualWeightKg} kg`)
      }
      doc.moveDown(0.5)
    }

    doc.fontSize(7).fillColor("#64748b").text(
      `Documento gerado em ${report.generatedAt} pela plataforma Mariva.`,
      { align: "right" }
    )
    doc.end()
  })
}

/**
 * Relatório JSON de campanha concluída.
 * Método: GET
 * Rota: /campaigns/:id/report
 */
export const getCampaignReport = async (req, res, next) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id, { attributes: ["id", "organizerId", "organizationId", "status"] })
    if (!campaign) {
      throw notFoundError("Campaign", req.params.id)
    }
    await assertCanManageCampaign(req.user.sub, campaign, req.organizationId)
    const data = await buildCampaignReportPayload(req.params.id, req.organizationId)
    res.json(
      withResourceLinks(`${CAMPAIGNS_BASE}/${req.params.id}/report`, data, {
        extraLinks: {
          pdf: { href: `${CAMPAIGNS_BASE}/${req.params.id}/report.pdf`, method: "GET" }
        }
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching campaign report")
  }
}

/**
 * Relatório PDF de campanha concluída.
 * Método: GET
 * Rota: /campaigns/:id/report.pdf
 */
export const getCampaignReportPdf = async (req, res, next) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id, { attributes: ["id", "organizerId", "organizationId", "status", "title"] })
    if (!campaign) {
      throw notFoundError("Campaign", req.params.id)
    }
    await assertCanManageCampaign(req.user.sub, campaign, req.organizationId)
    const report = await buildCampaignReportPayload(req.params.id, req.organizationId)
    const pdf = await renderCampaignReportPdf(report)
    const safeTitle = (campaign.title || "campanha").replace(/[^\w\-]+/g, "_").slice(0, 60)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-${safeTitle}.pdf"`)
    res.send(pdf)
  } catch (error) {
    passControllerError(error, next, "Error generating campaign report PDF")
  }
}

const PUBLIC_ACTIVE_STATUSES = [1, 2, 3]

function mapPublicCampaignBeach(beach) {
  return {
    id: beach.id,
    name: beach.name,
    municipality: beach.beachLocation?.municipality ?? null,
    latitude: beach.latitude != null ? Number(beach.latitude) : null,
    longitude: beach.longitude != null ? Number(beach.longitude) : null
  }
}

/**
 * Listar campanhas activas para descoberta pública (sem autenticação).
 * Método: GET
 * Rota: /campaigns/public/active
 */
export const getPublicActiveCampaigns = async (req, res, next) => {
  try {
    const rows = await Campaign.findAll({
      where: {
        deletedAt: null,
        status: { [Op.in]: PUBLIC_ACTIVE_STATUSES }
      },
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "municipality"]
        },
        {
          model: Beach,
          as: "beaches",
          through: { attributes: [] },
          attributes: ["id", "name", "latitude", "longitude"],
          required: false,
          include: [
            {
              model: BeachLocation,
              as: "beachLocation",
              attributes: ["municipality"]
            }
          ]
        }
      ],
      order: [["startDate", "ASC"]]
    })

    const data = rows.map((c) => ({
      id: c.id,
      title: c.title,
      statusKey: editStatusKeyFromDbStatus(c.status),
      startDate: toIsoDateString(c.startDate),
      endDate: toIsoDateString(c.endDate),
      organizationName: c.organization?.name ?? null,
      organizationMunicipality: c.organization?.municipality ?? null,
      beaches: (c.beaches ?? []).map(mapPublicCampaignBeach)
    }))

    res.json({ data })
  } catch (error) {
    passControllerError(error, next, "Error fetching public campaigns")
  }
}
