const BEACHES_BASE = "/beaches"
const WASTE_ITEMS_BASE = "/waste-items"
const CAMPAIGNS_BASE = "/campaigns"
const USERS_BASE = "/users"
const SESSIONS_BASE = "/sessions"
const WASTE_CATEGORIES_BASE = "/waste-categories"
const DASHBOARD_BASE = "/dashboard"
const API_ROOT = "/"

const DEFAULT_UPDATE_METHOD = "PATCH"

// Cria um objecto de ligação HATEOAS com href, método HTTP e rel.
export function hateoasLink(href, method, rel) {
  return { href, method, rel }
}

const PAGINATION_QUERY_KEYS = new Set(["page", "pageSize", "limit", "offset"])

// Constrói href de listagem com offset/limit preservando outros parâmetros de query.
function buildOffsetHref(basePath, query, offset, limit) {
  const params = new URLSearchParams()
  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      if (PAGINATION_QUERY_KEYS.has(key)) continue
      if (value == null || value === "") continue
      if (Array.isArray(value)) {
        for (const part of value) {
          if (part != null && String(part).length > 0) params.append(key, String(part))
        }
      } else {
        params.append(key, String(value))
      }
    }
  }
  params.set("limit", String(limit))
  params.set("offset", String(offset))
  const qs = params.toString()
  return qs.length > 0 ? `${basePath}?${qs}` : basePath
}

// Normaliza objecto de paginação para limit, offset e total.
function normalizePagination(pagination) {
  if (!pagination) return null
  if (Number.isFinite(pagination.limit) && Number.isFinite(pagination.offset)) {
    return pagination
  }
  const pageSize = pagination.pageSize ?? pagination.limit ?? DEFAULT_PAGE_SIZE
  const page = pagination.page ?? 1
  const offset = (Math.max(1, page) - 1) * pageSize
  return {
    limit: pageSize,
    offset,
    total: pagination.total
  }
}

// Gera ligações HATEOAS de paginação (self, first, prev, next, last).
export function paginationLinks(basePath, query, pagination) {
  const normalized = normalizePagination(pagination)
  if (!normalized) return {}
  const { offset, limit, total } = normalized
  const links = {
    self: hateoasLink(buildOffsetHref(basePath, query, offset, limit), "GET", "self")
  }
  if (offset > 0) {
    links.first = hateoasLink(buildOffsetHref(basePath, query, 0, limit), "GET", "first")
    const prevOffset = Math.max(0, offset - limit)
    links.prev = hateoasLink(buildOffsetHref(basePath, query, prevOffset, limit), "GET", "prev")
  }
  if (offset + limit < total) {
    links.next = hateoasLink(buildOffsetHref(basePath, query, offset + limit, limit), "GET", "next")
    const lastOffset = Math.max(0, Math.floor((total - 1) / limit) * limit)
    links.last = hateoasLink(buildOffsetHref(basePath, query, lastOffset, limit), "GET", "last")
  }
  return links
}

// Devolve ligações de descoberta dos principais endpoints da API.
export function apiDiscoveryLinks() {
  return {
    self: hateoasLink(API_ROOT, "GET", "self"),
    createSession: hateoasLink(SESSIONS_BASE, "POST", "create-session"),
    refreshSession: hateoasLink(`${SESSIONS_BASE}/current`, "PATCH", "refresh-session"),
    registerUser: hateoasLink(USERS_BASE, "POST", "register-user"),
    users: hateoasLink(USERS_BASE, "GET", "users"),
    currentUser: hateoasLink(`${USERS_BASE}/me`, "GET", "me"),
    updateCurrentUser: hateoasLink(`${USERS_BASE}/me`, "PATCH", "update-me"),
    changePassword: hateoasLink(`${USERS_BASE}/me/password`, "PATCH", "change-password"),
    campaigns: hateoasLink(CAMPAIGNS_BASE, "GET", "campaigns"),
    beaches: hateoasLink(BEACHES_BASE, "GET", "beaches"),
    wasteItems: hateoasLink(WASTE_ITEMS_BASE, "GET", "waste-items"),
    wasteCategories: hateoasLink(WASTE_CATEGORIES_BASE, "GET", "waste-categories"),
    dashboard: hateoasLink(DASHBOARD_BASE, "GET", "dashboard")
  }
}

// Monta o recurso raiz da API com metadados e ligações de descoberta.
export function buildApiRootResource() {
  return {
    id: "api",
    name: "Mariva API",
    version: "1.0",
    _links: apiDiscoveryLinks()
  }
}

// Gera ligações CRUD HATEOAS para um recurso individual ou colecção.
export function resourceLinks(basePath, id, options = {}) {
  const path = id != null ? `${basePath}/${id}` : basePath
  const updateMethod = options.updateMethod ?? DEFAULT_UPDATE_METHOD
  const links = {
    self: hateoasLink(path, "GET", "self"),
    update: hateoasLink(path, updateMethod, "update"),
    delete: hateoasLink(path, "DELETE", "delete")
  }
  if (options.collection) {
    links[options.collection] = hateoasLink(basePath, "GET", options.collection)
  }
  return links
}

// Anexa ligações HATEOAS a um recurso, com ligações extra opcionais.
export function withResourceLinks(basePath, resource, options = {}) {
  const id = resource?.id
  const extraLinks = options.extraLinks ?? {}
  return {
    ...resource,
    _links: {
      ...resourceLinks(basePath, id, options),
      ...extraLinks
    }
  }
}

// Devolve ligações HATEOAS para sub-recursos de uma campanha.
export function campaignSubResourceLinks(campaignId) {
  const base = `${CAMPAIGNS_BASE}/${campaignId}`
  return {
    registrations: hateoasLink(`${base}/registrations`, "GET", "registrations"),
    comments: hateoasLink(`${base}/comments`, "GET", "comments"),
    wasteCollections: hateoasLink(`${base}/waste-collections`, "GET", "waste-collections")
  }
}

// Anexa ligações de campanha incluindo sub-recursos e colecção.
export function withCampaignResourceLinks(resource, options = {}) {
  const id = resource?.id
  return withResourceLinks(CAMPAIGNS_BASE, resource, {
    collection: "allCampaigns",
    extraLinks: id != null ? campaignSubResourceLinks(id) : {},
    ...options
  })
}

// Devolve envelope de listagem com itens, ligações e metadados de paginação.
export function listResponse(basePath, items, pagination, options = {}) {
  const updateMethod = options.updateMethod ?? DEFAULT_UPDATE_METHOD
  const data = items.map((item) =>
    withResourceLinks(basePath, item, { updateMethod })
  )
  return listEnvelope(data, pagination, options, basePath)
}

// Listagem com base path por item e envelope HATEOAS partilhado.
export function listResponseWithItemBase(items, resolveBase, pagination, options = {}) {
  const updateMethod = options.updateMethod ?? DEFAULT_UPDATE_METHOD
  const data = items.map((item) =>
    withResourceLinks(resolveBase(item), item, { updateMethod })
  )
  const collectionBase = options.collectionBase
  return listEnvelope(data, pagination, options, collectionBase)
}

// Monta corpo { data, _links, limit, offset, total } para respostas de listagem.
function listEnvelope(data, pagination, options, collectionBase) {
  const body = { data }
  const _links = {}
  if (collectionBase) {
    _links.create = hateoasLink(collectionBase, "POST", "create")
  }
  if (options._links) {
    Object.assign(_links, options._links)
  }
  if (pagination && collectionBase) {
    Object.assign(_links, paginationLinks(collectionBase, options.query, pagination))
  }
  if (Object.keys(_links).length > 0) {
    body._links = _links
  }
  const normalized = normalizePagination(pagination)
  if (normalized) {
    body.limit = normalized.limit
    body.offset = normalized.offset
    body.total = normalized.total
  }
  return body
}

export {
  API_ROOT,
  BEACHES_BASE,
  WASTE_ITEMS_BASE,
  CAMPAIGNS_BASE,
  USERS_BASE,
  SESSIONS_BASE,
  WASTE_CATEGORIES_BASE,
  DASHBOARD_BASE
}

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100 // imponho tecto server-side para evitar listagens abusivas

// Converte string de query num inteiro não negativo ou NaN.
function parsePositiveInt(raw) {
  const n = typeof raw === "string" ? Number(raw) : Number.NaN
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN
}

// Interpreta limit/offset ou page/pageSize da query com valores por defeito e tecto.
export function parsePaginationQuery(query) {
  let limit = parsePositiveInt(query?.limit)
  let offset = parsePositiveInt(query?.offset)

  if (Number.isFinite(limit) && limit > 0) {
    if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE
    if (!Number.isFinite(offset) || offset < 0) offset = 0
  } else {
    const pageRaw = query?.page
    const pageSizeRaw = query?.pageSize ?? query?.limit
    let page = typeof pageRaw === "string" ? Number(pageRaw) : Number.NaN
    let pageSize = typeof pageSizeRaw === "string" ? Number(pageSizeRaw) : Number.NaN
    if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE
    if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE
    if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE
    limit = pageSize
    offset = (page - 1) * pageSize
  }

  const page = Math.floor(offset / limit) + 1
  return { limit, offset, page, pageSize: limit }
}
