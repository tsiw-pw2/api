import { roleHasCapability } from "../middlewares/auth.middlewares.js"
import { campaignItemActions, campaignSubresourceActions, registrationCollectionCreateAllowed } from "./hypermedia.permissions.js"

// Caminhos canónicos dos recursos REST (substantivos no plural).
export const BEACHES_BASE = "/beaches"
export const WASTE_ITEMS_BASE = "/waste-items"
export const CAMPAIGNS_BASE = "/campaigns"
export const USERS_BASE = "/users"
export const USERS_ME_PATH = `${USERS_BASE}/me`
export const SESSIONS_BASE = "/sessions"
export const SESSION_CURRENT_PATH = `${SESSIONS_BASE}/current`
export const WASTE_CATEGORIES_BASE = "/waste-categories"
export const DASHBOARD_BASE = "/dashboards"
export const DASHBOARD_OVERVIEW_PATH = `${DASHBOARD_BASE}/overview`
export const ORGANIZATIONS_BASE = "/organizations"

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100
const DEFAULT_UPDATE_METHOD = "PATCH"

// Converter string de query num inteiro não negativo
function parsePositiveInt(raw) {
  const n = typeof raw === "string" ? Number(raw) : Number.NaN
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN
}

// Interpretar limit/offset ou page/pageSize da query
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

// Índice hipermedia da API (GET /) — filtrado pelo utilizador autenticado quando autenticado
export function apiRootResource(actor) {
  const links = {
    self: { href: "/", method: "GET" },
    sessions: { href: SESSIONS_BASE, method: "POST" },
    users: { href: USERS_BASE, method: "POST" }
  }

  if (!actor?.sub) {
    return { id: "api", name: "Mariva API", version: "1.0", links }
  }

  const role = actor.role
  links.sessionCurrent = { href: SESSION_CURRENT_PATH, method: "GET" }
  links.userMe = { href: USERS_ME_PATH, method: "GET" }
  links.campaigns = { href: CAMPAIGNS_BASE, method: "GET" }

  if (!actor?.isRoot) {
    links.beaches = { href: BEACHES_BASE, method: "GET" }
    links.wasteItems = { href: WASTE_ITEMS_BASE, method: "GET" }
    links.wasteCategories = { href: WASTE_CATEGORIES_BASE, method: "GET" }
  }

  if (actor?.isRoot) {
    links.organizations = { href: "/organizations", method: "GET" }
  }
  if (roleHasCapability(role, "dashboard")) {
    links.dashboards = { href: DASHBOARD_OVERVIEW_PATH, method: "GET" }
  }

  return { id: "api", name: "Mariva API", version: "1.0", links }
}

// Construir cadeia de consulta de paginação preservando filtros da listagem
function buildPageHref(basePath, page, pageSize, query = {}) {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("pageSize", String(pageSize))
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === "page" || key === "pageSize" || key === "limit" || key === "offset") continue
    if (value == null || value === "") continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

// Ligações de navegação para listagens paginadas
export function buildListPaginationLinks(basePath, pagination, query = {}) {
  if (!pagination) return {}
  const { page, pageSize, total } = pagination
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const links = {
    self: { href: buildPageHref(basePath, page, pageSize, query), method: "GET" }
  }
  if (page > 1) {
    links.prev = { href: buildPageHref(basePath, page - 1, pageSize, query), method: "GET" }
    links.first = { href: buildPageHref(basePath, 1, pageSize, query), method: "GET" }
  }
  if (page < totalPages) {
    links.next = { href: buildPageHref(basePath, page + 1, pageSize, query), method: "GET" }
    links.last = { href: buildPageHref(basePath, totalPages, pageSize, query), method: "GET" }
  }
  return links
}

// Construir ligações simples para um recurso (estilo exemplo products)
export function resourceLinks(basePath, id, options = {}) {
  const path = id != null ? `${basePath}/${id}` : basePath
  const updateMethod = options.updateMethod ?? DEFAULT_UPDATE_METHOD
  const links = {
    self: { href: path, method: "GET" },
    update: { href: path, method: updateMethod },
    delete: { href: path, method: "DELETE" }
  }
  if (options.collection) {
    links[options.collection] = { href: basePath, method: "GET" }
  }
  return links
}

// Construir ligações filtradas por acções permitidas
export function buildResourceLinks(basePath, id, actions = {}, options = {}) {
  const path = id != null ? `${basePath}/${id}` : basePath
  const updateMethod = options.updateMethod ?? DEFAULT_UPDATE_METHOD
  const links = {}
  if (actions.self !== false) {
    links.self = { href: path, method: "GET" }
  }
  if (actions.update) {
    links.update = { href: path, method: updateMethod }
  }
  if (actions.delete) {
    links.delete = { href: path, method: "DELETE" }
  }
  if (options.collection) {
    links[options.collection] = { href: basePath, method: "GET" }
  }
  return links
}

// Anexar ligações a um recurso: usar buildResourceLinks quando options.actions filtra acções permitidas.
export function withResourceLinks(basePath, resource, options = {}) {
  const extraLinks = options.extraLinks ?? {}
  const baseLinks =
    options.actions != null
      ? buildResourceLinks(basePath, resource?.id, options.actions, options)
      : resourceLinks(basePath, resource?.id, options)
  return {
    ...resource,
    links: {
      ...baseLinks,
      ...extraLinks
    }
  }
}

// Sub-recursos do perfil autenticado (/users/me/password e /users/me/avatar).
export function meSubResourceLinks() {
  return {
    password: { href: `${USERS_ME_PATH}/password`, method: "PATCH" },
    avatar: { href: `${USERS_ME_PATH}/avatar`, method: "PATCH" }
  }
}

// Perfil autenticado: self canónico em /users/{id}, me em /users/me, sub-recursos password e avatar.
export function withMeResourceLinks(resource, options = {}) {
  const extraLinks = options.extraLinks ?? {}
  const userId = resource?.id
  const canonicalSelf =
    userId != null ? { href: `${USERS_BASE}/${userId}`, method: "GET" } : { href: USERS_ME_PATH, method: "GET" }
  return {
    ...resource,
    links: {
      self: canonicalSelf,
      me: { href: USERS_ME_PATH, method: "GET" },
      update: { href: USERS_ME_PATH, method: "PATCH" },
      ...meSubResourceLinks(),
      ...extraLinks
    }
  }
}

// Ligações de sub-recursos de campanha (filtradas)
export function campaignSubResourceLinks(campaignId, allowed = {}) {
  const base = `${CAMPAIGNS_BASE}/${campaignId}`
  const links = {}
  if (allowed.registrations) {
    links.registrations = { href: `${base}/registrations`, method: "GET" }
  }
  if (allowed.comments) {
    links.comments = { href: `${base}/comments`, method: "GET" }
  }
  if (allowed.wasteCollections) {
    links.wasteCollections = { href: `${base}/waste-collections`, method: "GET" }
  }
  if (allowed.selfRegistration) {
    links.selfRegistration = { href: `${base}/registrations`, method: "POST" }
  }
  return links
}

// Anexar ligações de campanha com sub-recursos (legado — todas as relações GET)
export function withCampaignResourceLinks(resource, options = {}) {
  const id = resource?.id
  const extra =
    id != null
      ? campaignSubResourceLinks(id, {
          registrations: true,
          comments: true,
          wasteCollections: true
        })
      : {}
  return withResourceLinks(CAMPAIGNS_BASE, resource, {
    collection: "allCampaigns",
    extraLinks: extra,
    ...options
  })
}

// Campanha com ligações condicionais: acções no item + sub-recursos avaliados por papel e inscrição.
export async function withCampaignResourceLinksForActor(resource, actor, options = {}) {
  const id = resource?.id
  const campaignRow =
    options.campaign ??
    (id != null ? { id, organizerId: resource.organizerId ?? options.organizerId } : null)
  const itemActions = campaignItemActions(actor, campaignRow)
  const subAllowed = id != null ? await campaignSubresourceActions(actor, id) : {}
  const selfRegistration =
    id != null && actor ? await registrationCollectionCreateAllowed(actor, id) : false
  const extra =
    id != null
      ? campaignSubResourceLinks(id, { ...subAllowed, selfRegistration })
      : {}
  return withResourceLinks(CAMPAIGNS_BASE, resource, {
    collection: "allCampaigns",
    actions: itemActions,
    extraLinks: extra,
    ...options
  })
}

// Construir path de sub-coleção de utilizador (vista admin, ex.: /users/{id}/registrations).
export function userSubResourcePath(userId, segment) {
  return `${USERS_BASE}/${userId}/${segment}`
}

// Path da coleção de inscrições aninhada em campanha (/campaigns/{id}/registrations).
export function registrationCollectionPath(campaignId) {
  return `${CAMPAIGNS_BASE}/${campaignId}/registrations`
}

// Anexar links a uma inscrição individual sob a campanha indicada.
export function withRegistrationResourceLinks(
  campaignId,
  resource,
  actions = { self: true, update: true, delete: true },
  extraLinks = {}
) {
  const base = registrationCollectionPath(campaignId)
  return withResourceLinks(base, resource, {
    updateMethod: "PATCH",
    actions,
    extraLinks
  })
}

// Campanha embutida com ligação self
export function withEmbeddedCampaignLinks(campaign) {
  if (!campaign?.id) return campaign
  const path = `${CAMPAIGNS_BASE}/${campaign.id}`
  return {
    ...campaign,
    links: {
      self: { href: path, method: "GET" }
    }
  }
}

// Envelope de listagem REST { data, page, pageSize, total, links }
export function listResponse(basePath, items, pagination, options = {}) {
  const updateMethod = options.updateMethod ?? DEFAULT_UPDATE_METHOD
  const query = options.query ?? {}
  const mapItem =
    options.mapItem ??
    ((item) => withResourceLinks(basePath, item, { updateMethod }))
  const data = items.map(mapItem)
  const body = { data }
  if (pagination) {
    body.page = pagination.page
    body.pageSize = pagination.pageSize
    body.total = pagination.total
  }
  const collectionLinks = {
    ...buildListPaginationLinks(basePath, pagination, query),
    ...(options.collectionLinks ?? {}),
    ...(options.links ?? {})
  }
  const includeCreate = options.includeCreate !== false && !options.omitCreate
  if (includeCreate) {
    collectionLinks.create = { href: basePath, method: "POST" }
  }
  body.links = collectionLinks
  return body
}

// Envelope paginado (equivalente a listResponse para listas já calculadas no controlador)
export function paginatedList(basePath, data, options = {}) {
  return listResponse(
    basePath,
    data.items,
    { page: data.page, pageSize: data.pageSize, total: data.total },
    options
  )
}
