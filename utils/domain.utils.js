import { Op } from "sequelize"
import { Campaign, Registration, User } from "../models/db.config.js"
import { isOrgAdminFor } from "./organization.utils.js"
import { createError, isUuidParam, notFoundError, validationError } from "./error.utils.js"

// --- Distritos: códigos estáveis na API vs. rótulos guardados em localizacao_praia ---

// Usar códigos estáveis na API; os nomes correspondem ao texto guardado em BeachLocation
export const DISTRICT_CODE_TO_LABEL = {
  viana_do_castelo: "Viana do Castelo",
  braga: "Braga",
  porto: "Porto",
  vila_real: "Vila Real",
  braganca: "Bragança",
  aveiro: "Aveiro",
  viseu: "Viseu",
  guarda: "Guarda",
  coimbra: "Coimbra",
  castelo_branco: "Castelo Branco",
  leiria: "Leiria",
  santarem: "Santarém",
  lisboa: "Lisboa",
  portalegre: "Portalegre",
  setubal: "Setúbal",
  evora: "Évora",
  beja: "Beja",
  faro: "Faro"
}

// Devolve o nome do distrito a partir do código estável.
export function districtLabelFromCode(code) {
  return DISTRICT_CODE_TO_LABEL[code] ?? null
}

// Devolve o código do distrito a partir do nome (comparação case-insensitive).
export function districtCodeFromLabel(label) {
  const t = label.trim().toLowerCase()
  for (const [code, lbl] of Object.entries(DISTRICT_CODE_TO_LABEL)) {
    if (lbl.toLowerCase() === t) return code
  }
  return null
}

// Verificar se o código de distrito existe no mapa de distritos.
export function isValidDistrictCode(code) {
  return DISTRICT_CODE_TO_LABEL[code] !== undefined
}

// --- Filtros de listagem: análise da consulta e construção de cláusulas WHERE ---

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_SEARCH_LENGTH = 100

// Mapear estados UI da campanha para valores tinyint da BD.
const STATUS_UI_TO_DB = {
  planeada: 0,
  aberta_inscricoes: 1,
  encerrada_inscricoes: 2,
  em_progresso: 3,
  concluida: 4,
  cancelada: 5
}

const ALLOWED_SCOPES = new Set(["all", "mine", "organizing", "participating"])
const ALLOWED_WASTE_UNITS = new Set(["peso", "unit"])

// Escapa caracteres especiais de padrões SQL LIKE (% e _).
export function escapeLikePattern(raw) {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

// Valida e devolve parâmetro de data ISO (AAAA-MM-DD) ou null.
function parseIsoDateParam(raw) {
  if (raw == null || raw === "") return null
  if (typeof raw !== "string" || !ISO_DATE.test(raw.trim())) {
    throw validationError(["Invalid request"])
  }
  return raw.trim()
}

// Converte lista de estados UI da campanha em valores numéricos da BD.
function parseStatusList(raw) {
  if (raw == null || raw === "") return null
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",").map((part) => part.trim()).filter(Boolean)
      : []
  if (items.length === 0) return null
  const statusDbList = []
  for (const item of items) {
    if (typeof item !== "string" || !(item in STATUS_UI_TO_DB)) {
      throw validationError(["Invalid request"])
    }
    const db = STATUS_UI_TO_DB[item]
    if (!statusDbList.includes(db)) {
      statusDbList.push(db)
    }
  }
  return statusDbList.length > 0 ? statusDbList : null
}

// Analisa filtros de listagem de campanhas a partir da cadeia de consulta.
export function parseCampaignListFilters(query) {
  const filters = {
    scope: "all",
    statusDbList: null,
    districtCode: null,
    fromDate: null,
    toDate: null,
    searchQuery: null
  }

  const scopeRaw = query?.scope
  if (scopeRaw != null && scopeRaw !== "") {
    if (typeof scopeRaw !== "string" || !ALLOWED_SCOPES.has(scopeRaw)) {
      throw validationError(["Invalid request"])
    }
    filters.scope = scopeRaw
  }

  filters.statusDbList = parseStatusList(query?.status)

  const districtRaw = query?.district
  if (districtRaw != null && districtRaw !== "") {
    if (typeof districtRaw !== "string" || !isValidDistrictCode(districtRaw)) {
      throw validationError(["Invalid request"])
    }
    filters.districtCode = districtRaw
  }

  filters.fromDate = parseIsoDateParam(query?.from)
  filters.toDate = parseIsoDateParam(query?.to)

  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    throw validationError(["Invalid request"])
  }

  const qRaw = query?.q
  if (qRaw != null && qRaw !== "") {
    if (typeof qRaw !== "string") {
      throw validationError(["Invalid request"])
    }
    const q = qRaw.trim()
    if (q.length > MAX_SEARCH_LENGTH) {
      throw validationError(["Invalid request"])
    }
    if (q.length > 0) {
      filters.searchQuery = q
    }
  }

  return filters
}

// Constrói cláusula WHERE Sequelize para listagem de campanhas com âmbito do utilizador.
export async function buildCampaignListWhere(filters, userId, orgContext = null) {
  const where = { deletedAt: null }

  const organizationId =
    typeof orgContext?.organizationId === "string" ? orgContext.organizationId : null
  const role = orgContext?.role ?? null
  if (organizationId && role === "organizer") {
    where.organizationId = organizationId
  }

  if (filters.statusDbList != null) {
    where.status = { [Op.in]: filters.statusDbList }
  }

  if (filters.districtCode != null) {
    where.districtCode = filters.districtCode
  }

  if (filters.fromDate || filters.toDate) {
    where.startDate = {}
    if (filters.fromDate) where.startDate[Op.gte] = filters.fromDate
    if (filters.toDate) where.startDate[Op.lte] = filters.toDate
  }

  if (filters.searchQuery) {
    where.title = { [Op.like]: `%${escapeLikePattern(filters.searchQuery)}%` }
  }

  if (filters.scope === "all" || !userId) {
    return where
  }

  if (filters.scope === "organizing") {
    where.organizerId = userId
    return where
  }

  // âmbito «participating»: resolver IDs via inscrições activas (estado 0 ou 1).
  if (filters.scope === "participating") {
    const rows = await Registration.findAll({
      where: { userId, status: { [Op.in]: [0, 1] }, deletedAt: null },
      attributes: ["campaignId"],
      raw: true
    })
    const ids = [...new Set(rows.map((r) => r.campaignId))]
    // UUID impossível quando não há inscrições, para devolver lista vazia sem erro SQL.
    where.id = ids.length > 0 ? { [Op.in]: ids } : { [Op.in]: ["00000000-0000-0000-0000-000000000000"] }
    return where
  }

  // âmbito «mine»: campanhas organizadas pelo utilizador ou em que participa.
  const participatingRows = await Registration.findAll({
    where: { userId, status: { [Op.in]: [0, 1] }, deletedAt: null },
    attributes: ["campaignId"],
    raw: true
  })
  const participatingIds = new Set(participatingRows.map((r) => r.campaignId))

  where[Op.or] = [
    { organizerId: userId },
    ...(participatingIds.size > 0 ? [{ id: { [Op.in]: [...participatingIds] } }] : [])
  ]

  if (participatingIds.size === 0) {
    where[Op.or] = [{ organizerId: userId }]
  }

  return where
}

// Normalizar alias "kg" da query para "peso" (unidade interna da BD).
function parseWasteUnitList(raw) {
  if (raw == null || raw === "") return null
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",").map((part) => part.trim()).filter(Boolean)
      : []
  if (items.length === 0) return null
  const units = []
  for (const item of items) {
    const normalized = item === "kg" ? "peso" : item
    if (typeof normalized !== "string" || !ALLOWED_WASTE_UNITS.has(normalized)) {
      throw validationError(["Invalid request"])
    }
    if (!units.includes(normalized)) {
      units.push(normalized)
    }
  }
  return units.length > 0 ? units : null
}

// Converte lista de IDs de categorias de resíduo da query em UUIDs válidos.
function parseWasteCategoryList(raw) {
  if (raw == null || raw === "") return null
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",").map((part) => part.trim()).filter(Boolean)
      : []
  if (items.length === 0) return null
  const categoryIds = []
  for (const item of items) {
    if (typeof item !== "string" || !isUuidParam(item.trim())) {
      throw validationError(["Invalid request"])
    }
    const id = item.trim()
    if (!categoryIds.includes(id)) {
      categoryIds.push(id)
    }
  }
  return categoryIds.length > 0 ? categoryIds : null
}

// Analisa filtros de listagem de itens de resíduo a partir da cadeia de consulta.
export function parseWasteListFilters(query) {
  const filters = {
    searchQuery: null,
    categoryIds: null,
    unitList: null
  }

  const qRaw = query?.q
  if (qRaw != null && qRaw !== "") {
    if (typeof qRaw !== "string") {
      throw validationError(["Invalid request"])
    }
    const q = qRaw.trim()
    if (q.length > MAX_SEARCH_LENGTH) {
      throw validationError(["Invalid request"])
    }
    if (q.length > 0) {
      filters.searchQuery = q
    }
  }

  filters.categoryIds = parseWasteCategoryList(query?.category)

  filters.unitList = parseWasteUnitList(query?.unit)

  return filters
}

// Constrói cláusula WHERE Sequelize para listagem de resíduos com os filtros dados.
export function buildWasteListWhere(filters, organizationId = null) {
  const where = { deletedAt: null }

  if (organizationId) {
    where.organizationId = organizationId
  }

  if (filters.searchQuery) {
    where.name = { [Op.like]: `%${escapeLikePattern(filters.searchQuery)}%` }
  }

  if (filters.categoryIds != null) {
    where.wasteTypeId = filters.categoryIds.length === 1
      ? filters.categoryIds[0]
      : { [Op.in]: filters.categoryIds }
  }

  if (filters.unitList != null) {
    where.unit = { [Op.in]: filters.unitList }
  }

  return where
}

// Analisa filtros de listagem de praias a partir da cadeia de consulta.
export function parseBeachListFilters(query) {
  const filters = {
    searchQuery: null
  }

  const qRaw = query?.q
  if (qRaw != null && qRaw !== "") {
    if (typeof qRaw !== "string") {
      throw validationError(["Invalid request"])
    }
    const q = qRaw.trim()
    if (q.length > MAX_SEARCH_LENGTH) {
      throw validationError(["Invalid request"])
    }
    if (q.length > 0) {
      filters.searchQuery = q
    }
  }

  return filters
}

// Pesquisa por nome da praia ou por IDs de localização cujo concelho corresponde ao termo.
export function buildBeachListWhere(filters, municipalityLocationIds = []) {
  const where = {}

  if (filters.searchQuery) {
    const pattern = `%${escapeLikePattern(filters.searchQuery)}%`
    const or = [{ name: { [Op.like]: pattern } }]
    if (municipalityLocationIds.length > 0) {
      or.push({ beachLocationId: { [Op.in]: municipalityLocationIds } })
    }
    where[Op.or] = or
  }

  return where
}

// --- Regras de campanha: idade, perfil, datas e telefone ---

export const MIN_CAMPAIGN_PARTICIPANT_AGE = 16

// Calcular idade em anos completos entre uma data de nascimento ISO e a data de referência.
export function ageInFullYears(birthDateIso, referenceDate = new Date()) {
  if (typeof birthDateIso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateIso)) {
    return null
  }
  const y = Number(birthDateIso.slice(0, 4))
  const m = Number(birthDateIso.slice(5, 7))
  const d = Number(birthDateIso.slice(8, 10))
  const refY = referenceDate.getFullYear()
  const refM = referenceDate.getMonth() + 1
  const refD = referenceDate.getDate()
  let age = refY - y
  if (refM < m || (refM === m && refD < d)) {
    age -= 1
  }
  return age
}

// Verificar se o utilizador tem idade mínima exigida para participar em campanhas.
export function userMeetsMinimumAge(
  birthDateIso,
  minAge = MIN_CAMPAIGN_PARTICIPANT_AGE,
  referenceDate = new Date(),
) {
  const age = ageInFullYears(birthDateIso, referenceDate)
  return age != null && age >= minAge
}

// Valida e normaliza o campo birthDate do perfil (formato ISO e idade mínima).
export function parseProfileBirthDateField(raw, { allowEmpty = false } = {}) {
  if (raw === null || raw === undefined || raw === "") {
    if (allowEmpty) return null
    throw validationError({ birthDate: ["Birth date is required"] })
  }
  if (typeof raw !== "string") {
    throw validationError({ birthDate: ["Invalid birth date"] })
  }
  const s = raw.trim()
  if (!s) {
    if (allowEmpty) return null
    throw validationError({ birthDate: ["Birth date is required"] })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw validationError({ birthDate: ["Invalid birth date"] })
  }
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw validationError({ birthDate: ["Invalid birth date"] })
  }
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  if (s > todayStr) {
    throw validationError({ birthDate: ["Invalid birth date"] })
  }
  if (!userMeetsMinimumAge(s)) {
    throw validationError({ birthDate: ["Minimum age not met"] })
  }
  return s
}

// Converte valor de data para string ISO AAAA-MM-DD ou null se inválido.
export function toIsoDateOnly(value) {
  if (value == null || value === "") return null
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Garantir que a data de fim da campanha não é anterior à data de início.
export function assertCampaignEndOnOrAfterStart(startDate, endDate) {
  const startIso = toIsoDateOnly(startDate)
  const endIso = toIsoDateOnly(endDate)
  if (!startIso || !endIso) {
    throw validationError({ endDate: ["Invalid campaign dates"] })
  }
  if (endIso < startIso) {
    throw validationError({ endDate: ["End date must be on or after start date"] })
  }
}

// Normalizar telefone para apenas dígitos (guardar como string numérica).
export function normalizePhoneDigits(raw) {
  if (raw == null || raw === "") return null
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw validationError({ phone: ["Invalid phone"] })
  }
  const digits = String(raw).replace(/\D/g, "")
  if (digits.length === 0) return null
  return digits
}

// Validar comprimento do telefone após normalização.
export function parsePhoneField(raw) {
  if (raw == null || raw === "") return null
  const hadNonEmptyInput =
    typeof raw === "string" ? raw.trim().length > 0 : true
  const digits = normalizePhoneDigits(raw)
  if (hadNonEmptyInput && !digits) {
    throw validationError({ phone: ["Phone must contain digits only"] })
  }
  if (digits && (digits.length < 9 || digits.length > 15)) {
    throw validationError({ phone: ["Invalid phone length"] })
  }
  return digits
}

// Indica se a campanha aceita auto-inscrição (só aberta a inscrições).
export function isCampaignOpenForSelfEnrollment(dbStatus) {
  return Number(dbStatus) === 1
}

// Campanha concluída (4) ou cancelada (5): sem alterações a inscrições ou recolhas.
export function isCampaignTerminalForOperations(dbStatus) {
  const status = Number(dbStatus)
  return status === 4 || status === 5
}

// Garante que a data de nascimento cumpre idade mínima para inscrição em campanha.
export function isEligibleForCampaignEnrollment(birthDate) {
  const iso = toIsoDateOnly(birthDate)
  // Idade mínima 16 anos (MIN_CAMPAIGN_PARTICIPANT_AGE) para auto-inscrição.
  return Boolean(iso && userMeetsMinimumAge(iso))
}

export function assertEligibleForCampaignEnrollment(birthDate) {
  if (!isEligibleForCampaignEnrollment(birthDate)) {
    throw validationError(["Invalid request"])
  }
}

// --- Métricas de impacto: peso real, estimado e agregação por tipo de resíduo ---

// Devolver o peso real registado numa recolha em kg, ou zero.
export function collectionActualWeightKg(row) {
  if (row?.actualWeightKg == null) return 0
  const n = Number(row.actualWeightKg)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Estima o peso em kg com base na quantidade de unidades e peso médio do resíduo.
export function collectionEstimatedWeightKg(row, waste) {
  const grams = waste?.averageWeightGrams
  if (grams == null) return 0
  const g = Number(grams)
  if (!Number.isFinite(g) || g <= 0) return 0
  const qty = Number(row?.unitQuantity) || 0
  if (qty <= 0) return 0
  return (qty * g) / 1000
}

// Preferir peso real (peso_real_kg); se ausente, estimar via quantidade × peso_medio_gramas.
export function collectionImpactWeightKg(row, waste) {
  const actual = collectionActualWeightKg(row)
  if (actual > 0) return actual
  return collectionEstimatedWeightKg(row, waste)
}

// Agrega recolhas por tipo de resíduo com unidades e peso total de impacto.
export function aggregateWasteByType(collections) {
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

  // Arredondar a 3 casas decimais para o dashboard e respostas REST.
  return [...byType.values()]
    .map((entry) => ({
      typeName: entry.typeName,
      units: entry.units,
      weightKg: Math.round(entry.weightKg * 1000) / 1000
    }))
    .sort((a, b) => b.weightKg - a.weightKg)
}

// Calcula totais de peso real, peso de impacto e agregação por tipo de resíduo.
export function computeWasteImpactTotals(collections) {
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

// --- Controlo de acesso a dados de campanha (participantes vs. recolhas) ---

// Carregar campanha para verificação de acesso (404 se não existir).
async function campaignForActorAccess(actorUserId, campaignId) {
  if (!isUuidParam(campaignId) || !isUuidParam(actorUserId)) {
    throw createError(403, "Forbidden")
  }
  const campaign = await Campaign.findByPk(campaignId, {
    attributes: ["id", "organizerId", "organizationId"]
  })
  if (!campaign) {
    throw notFoundError("Campaign", campaignId)
  }
  return campaign
}

// Verificar se o utilizador autenticado é organizador da campanha ou admin da org.
async function actorHasCampaignManagementPrivilege(actorUserId, campaign) {
  const user = await User.findByPk(actorUserId, { attributes: ["isRoot", "deletedAt", "isBlocked"] })
  if (!user || user.deletedAt || user.isBlocked || user.isRoot) {
    return false
  }
  if (campaign.organizerId === actorUserId) {
    return true
  }
  if (campaign.organizationId) {
    return isOrgAdminFor(actorUserId, campaign.organizationId)
  }
  return false
}

export async function actorCanManageCampaign(actorUserId, campaign) {
  return actorHasCampaignManagementPrivilege(actorUserId, campaign)
}

// Garantir acesso a participantes/comentários (organizador, admin ou inscrito pendente/confirmado).
export async function assertCanAccessCampaignParticipantData(actorUserId, campaignId) {
  const campaign = await campaignForActorAccess(actorUserId, campaignId)
  if (await actorHasCampaignManagementPrivilege(actorUserId, campaign)) {
    return campaign
  }
  // Inscrito pendente (0) ou confirmado (1) pode ver comentários e lista de participantes.
  const reg = await Registration.findOne({
    where: { campaignId, userId: actorUserId, status: { [Op.in]: [0, 1] } },
    attributes: ["id"]
  })
  if (reg) {
    return campaign
  }
  throw createError(403, "Forbidden")
}

// Garantir acesso a recolhas de resíduos (organizador, admin ou inscrito confirmado).
export async function assertCanAccessCampaignWasteData(actorUserId, campaignId) {
  const campaign = await campaignForActorAccess(actorUserId, campaignId)
  if (await actorHasCampaignManagementPrivilege(actorUserId, campaign)) {
    return campaign
  }
  // Recolhas exigem inscrição confirmada (estado 1), não apenas pendente.
  const reg = await Registration.findOne({
    where: { campaignId, userId: actorUserId, status: 1 },
    attributes: ["id"]
  })
  if (reg) {
    return campaign
  }
  throw createError(403, "Forbidden")
}
