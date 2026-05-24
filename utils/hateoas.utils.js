// Incluo links HATEOAS nas respostas JSON; paths relativos à raiz da API
const BEACHES_BASE = "/beaches"
const WASTE_ITEMS_BASE = "/waste-items"
const CAMPAIGNS_BASE = "/campaigns"
const USERS_BASE = "/users"
const SESSIONS_BASE = "/sessions"
const WASTE_CATEGORIES_BASE = "/waste-categories"
const DASHBOARD_BASE = "/dashboard"

export function resourceLinks(basePath, id, options = {}) {
  const path = id != null ? `${basePath}/${id}` : basePath
  const links = {
    self: { href: path, method: "GET" },
    update: { href: path, method: options.updateMethod ?? "PUT" },
    delete: { href: path, method: "DELETE" }
  }
  if (options.collection) {
    links[options.collection] = { href: basePath, method: "GET" }
  }
  return links
}

export function withResourceLinks(basePath, resource, options = {}) {
  const id = resource?.id
  return {
    ...resource,
    links: resourceLinks(basePath, id, options)
  }
}

export function listResponse(basePath, items, pagination, options = {}) {
  const updateMethod = options.updateMethod ?? "PUT"
  const data = items.map((item) =>
    withResourceLinks(basePath, item, { updateMethod })
  )
  return listEnvelope(data, pagination, options, basePath)
}

export function listResponseWithItemBase(items, resolveBase, pagination, options = {}) {
  const updateMethod = options.updateMethod ?? "PUT"
  const data = items.map((item) =>
    withResourceLinks(resolveBase(item), item, { updateMethod })
  )
  const collectionBase = options.collectionBase
  return listEnvelope(data, pagination, options, collectionBase)
}

function listEnvelope(data, pagination, options, collectionBase) {
  const body = { data }
  if (collectionBase) {
    body.links = {
      create: { href: collectionBase, method: "POST" }
    }
  } else if (options.links) {
    body.links = options.links
  }
  if (pagination) {
    body.page = pagination.page
    body.pageSize = pagination.pageSize
    body.total = pagination.total
  }
  return body
}

export { BEACHES_BASE, WASTE_ITEMS_BASE, CAMPAIGNS_BASE, USERS_BASE, SESSIONS_BASE, WASTE_CATEGORIES_BASE, DASHBOARD_BASE }

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100 // imponho tecto server-side para evitar listagens abusivas

export function parsePaginationQuery(query) {
  const pageRaw = query?.page
  const pageSizeRaw = query?.pageSize
  let page = typeof pageRaw === "string" ? Number(pageRaw) : Number.NaN
  let pageSize = typeof pageSizeRaw === "string" ? Number(pageSizeRaw) : Number.NaN
  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset, limit: pageSize }
}

// Uso códigos estáveis na API; os labels correspondem ao texto guardado em BeachLocation
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

export function districtLabelFromCode(code) {
  return DISTRICT_CODE_TO_LABEL[code] ?? null
}

export function districtCodeFromLabel(label) {
  const t = label.trim().toLowerCase()
  for (const [code, lbl] of Object.entries(DISTRICT_CODE_TO_LABEL)) {
    if (lbl.toLowerCase() === t) return code
  }
  return null
}

export function isValidDistrictCode(code) {
  return DISTRICT_CODE_TO_LABEL[code] !== undefined
}

import { Op } from "sequelize"
import { Registration } from "../models/db.config.js"
import { validationError } from "./error.utils.js"
import { isUuidParam } from "./error.utils.js"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_SEARCH_LENGTH = 100

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

function escapeLikePattern(raw) {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

function parseIsoDateParam(raw) {
  if (raw == null || raw === "") return null
  if (typeof raw !== "string" || !ISO_DATE.test(raw.trim())) {
    throw validationError(["Invalid request"])
  }
  return raw.trim()
}

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

export async function buildCampaignListWhere(filters, userId) {
  const where = { deletedAt: null }

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

  if (filters.scope === "participating") {
    const rows = await Registration.findAll({
      where: { userId, status: { [Op.in]: [0, 1] }, deletedAt: null },
      attributes: ["campaignId"],
      raw: true
    })
    const ids = [...new Set(rows.map((r) => r.campaignId))]
    where.id = ids.length > 0 ? { [Op.in]: ids } : { [Op.in]: ["00000000-0000-0000-0000-000000000000"] }
    return where
  }

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

export function parseWasteListFilters(query) {
  const filters = {
    searchQuery: null,
    categoryId: null,
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

  const categoryRaw = query?.category
  if (categoryRaw != null && categoryRaw !== "") {
    if (typeof categoryRaw !== "string" || !isUuidParam(categoryRaw.trim())) {
      throw validationError(["Invalid request"])
    }
    filters.categoryId = categoryRaw.trim()
  }

  filters.unitList = parseWasteUnitList(query?.unit)

  return filters
}

export function buildWasteListWhere(filters) {
  const where = { deletedAt: null }

  if (filters.searchQuery) {
    where.name = { [Op.like]: `%${escapeLikePattern(filters.searchQuery)}%` }
  }

  if (filters.categoryId) {
    where.wasteTypeId = filters.categoryId
  }

  if (filters.unitList != null) {
    where.unit = { [Op.in]: filters.unitList }
  }

  return where
}

export const MIN_CAMPAIGN_PARTICIPANT_AGE = 16

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

export function userMeetsMinimumAge(
  birthDateIso,
  minAge = MIN_CAMPAIGN_PARTICIPANT_AGE,
  referenceDate = new Date(),
) {
  const age = ageInFullYears(birthDateIso, referenceDate)
  return age != null && age >= minAge
}

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

export function assertEligibleForCampaignEnrollment(birthDate) {
  const iso = toIsoDateOnly(birthDate)
  if (!iso || !userMeetsMinimumAge(iso)) {
    throw validationError(["Invalid request"])
  }
}
