import { Op } from "sequelize"
import { Beach, BeachLocation, User } from "../models/db.config.js"
import { conflictError, createError, passControllerError, missingFieldsValidationError, notFoundError, validationError, mapSequelizeError, collectMissingStringFields, isUuidParam } from "../utils/error.utils.js"
import { buildBeachListWhere, districtCodeFromLabel, districtLabelFromCode, escapeLikePattern, parseBeachListFilters } from "../utils/domain.utils.js"
import { BEACHES_BASE, listResponse, parsePaginationQuery, withResourceLinks } from "../utils/response.utils.js"
import { beachCollectionCreateAllowed, beachItemActions, loadActorContext } from "../utils/hypermedia.permissions.js"
import { loadOrganizationById } from "../utils/organization.utils.js"

// Limites alinhados com colunas da BD e contrato REST (textos de erro da API em inglês).
const DUPLICATE_BEACH_NAME_PT = "Já existe uma praia com este nome."
const MAX_BEACH_NAME_LENGTH = 255
const MAX_MUNICIPALITY_LENGTH = 128
const LATITUDE_MIN = -90
const LATITUDE_MAX = 90
const LONGITUDE_MIN = -180
const LONGITUDE_MAX = 180

// Incluir localização na consulta: distrito e concelho estão em localizacao_praia, não na tabela praia.
const BEACH_LOCATION_INCLUDE = {
  model: BeachLocation,
  as: "beachLocation",
  attributes: ["district", "municipality"]
}

// Aceitar número ou string e validar o intervalo geográfico.
// Devolver { value } ou { error: fieldKey } para reunir vários erros num único 400.
function parseCoordinate(raw, fieldKey, min, max) {
  let value
  if (typeof raw === "number" && Number.isFinite(raw)) {
    value = raw
  } else if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return { error: fieldKey }
    value = Number(trimmed)
    if (!Number.isFinite(value)) return { error: fieldKey }
  } else {
    return { error: fieldKey }
  }
  if (value < min || value > max) return { error: fieldKey }
  return { value }
}

// Validar e normalizar o corpo de criação ou actualização de praia (POST e PATCH exigem corpo completo).
function parseBeachUpsertBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const municipality = typeof raw.municipality === "string" ? raw.municipality.trim() : ""
  const districtCode = typeof raw.district === "string" ? raw.district.trim() : ""

  const latitudeResult = parseCoordinate(raw.latitude, "latitude", LATITUDE_MIN, LATITUDE_MAX)
  const longitudeResult = parseCoordinate(raw.longitude, "longitude", LONGITUDE_MIN, LONGITUDE_MAX)

  // Reunir erros por campo num único validationError (arrays por convenção PW II / Sequelize).
  if (!name || !municipality || !districtCode || latitudeResult.error || longitudeResult.error) {
    const fieldErrors = {}
    if (!name) fieldErrors.name = ["Name is required"]
    if (!municipality) fieldErrors.municipality = ["Municipality is required"]
    if (!districtCode) fieldErrors.district = ["District is required"]
    if (latitudeResult.error) fieldErrors.latitude = ["Invalid latitude"]
    if (longitudeResult.error) fieldErrors.longitude = ["Invalid longitude"]
    throw validationError(fieldErrors)
  }

  if (name.length > MAX_BEACH_NAME_LENGTH || municipality.length > MAX_MUNICIPALITY_LENGTH) {
    throw validationError({ name: ["Name or municipality too long"] })
  }

  // A API recebe código estável (ex.: "aveiro"); validar contra mapa antes de gravar o nome em localizacao_praia.
  const districtLabel = districtLabelFromCode(districtCode)
  if (!districtLabel) {
    throw validationError({ district: ["Invalid district"] })
  }

  return {
    name,
    municipality,
    districtCode,
    districtLabel,
    latitude: latitudeResult.value,
    longitude: longitudeResult.value
  }
}

// Mapear registo Sequelize (praia + localização) para o formato JSON da API.
function toListItem(row) {
  // A BD guarda o nome do distrito; a resposta REST expõe o código estável (inverso de parseBeachUpsertBody).
  const districtLabel = row.beachLocation?.district ?? ""
  const code = districtCodeFromLabel(districtLabel) ?? ""
  return {
    id: row.id,
    name: row.name,
    municipality: row.beachLocation?.municipality ?? "",
    district: code,
    // Contrato REST: coordenadas como texto, não decimal bruto da BD.
    latitude: row.latitude != null ? String(row.latitude) : "",
    longitude: row.longitude != null ? String(row.longitude) : "",
    createdByUserId: row.createdByUserId ?? null
  }
}

function normalizeMunicipalityName(value) {
  return String(value ?? "").trim().toLocaleLowerCase("pt-PT")
}

// Organização só regista praias no concelho e distrito associados ao contexto activo.
async function assertBeachUpsertAllowedForOrganization(organizationId, municipality, districtLabel) {
  if (!organizationId) return

  const org = await loadOrganizationById(organizationId)
  if (!org?.municipality) {
    throw createError(403, "Forbidden")
  }

  if (normalizeMunicipalityName(municipality) !== normalizeMunicipalityName(org.municipality)) {
    throw validationError({ municipality: ["Municipality not allowed for organization"] })
  }

  const existingLocation = await BeachLocation.findOne({
    where: { municipality: org.municipality },
    attributes: ["district"]
  })
  if (existingLocation?.district && existingLocation.district !== districtLabel) {
    throw validationError({ district: ["District not allowed for organization"] })
  }
}

async function loadBeachWithLocation(beachOrId) {
  if (beachOrId?.beachLocation) {
    return beachOrId
  }
  const id = typeof beachOrId === "string" ? beachOrId : beachOrId?.id
  return Beach.findByPk(id, { include: [BEACH_LOCATION_INCLUDE] })
}

// Só alterar ou eliminar praias do concelho da organização activa (catálogo partilhado na leitura).
async function assertBeachBelongsToOrganization(beachOrId, organizationId) {
  if (!organizationId) return

  const org = await loadOrganizationById(organizationId)
  if (!org?.municipality) {
    throw createError(403, "Forbidden")
  }

  const beach = await loadBeachWithLocation(beachOrId)
  if (!beach) {
    throw notFoundError("beach", typeof beachOrId === "string" ? beachOrId : beachOrId?.id)
  }

  const beachMunicipality = beach.beachLocation?.municipality
  if (
    normalizeMunicipalityName(beachMunicipality) !== normalizeMunicipalityName(org.municipality)
  ) {
    throw notFoundError("beach", beach.id)
  }

  return beach
}

// Verificar na BD se o utilizador é staff municipal (defesa em profundidade; a rota já usa requireOrgStaff).
async function assertCanModifyBeach(_beach, userId) {
  const user = await User.findByPk(userId, {
    attributes: ["isOrganizer", "isRoot", "isBlocked", "deletedAt"]
  })
  if (!user || user.deletedAt || user.isBlocked || user.isRoot || !user.isOrganizer) {
    throw createError(403, "Forbidden")
  }
}

// Mapear erros Sequelize de praia (nome único, chave estrangeira em campanhas).
function mapBeachSequelizeError(error) {
  return mapSequelizeError(error, {
    onUnique: () => conflictError({ beach: DUPLICATE_BEACH_NAME_PT }),
    onForeignKey: () =>
      conflictError({ beach: "Cannot delete beach while it is referenced" })
  })
}

/**
 * Listar praias do catálogo.
 * Método: GET
 * Rota: /beaches
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Paginação e filtro q por nome ou município.
 * - Resposta expõe distrito como código estável; BD guarda nome em localizacao_praia.
 *
 * Notas técnicas:
 * - Eliminação lógica em praia; ligação create para admin/organizador.
 */
export const getAllBeaches = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const filters = parseBeachListFilters(req.query ?? {})
    let municipalityLocationIds = []
    // Pesquisa q: nome na praia OU município em localizacao_praia (duas fontes reunidas em buildBeachListWhere).
    if (filters.searchQuery) {
      const pattern = `%${escapeLikePattern(filters.searchQuery)}%`
      const rows = await BeachLocation.findAll({
        where: { municipality: { [Op.like]: pattern } },
        attributes: ["id"],
        raw: true
      })
      municipalityLocationIds = rows.map((row) => row.id).filter(Boolean)
    }
    const where = buildBeachListWhere(filters, municipalityLocationIds)
    const { offset, limit, page, pageSize } = parsePaginationQuery(req.query ?? {})
    const include = [BEACH_LOCATION_INCLUDE]
    const total = await Beach.count({ where })
    const rows = await Beach.findAll({
      where,
      include,
      order: [["name", "ASC"]],
      limit,
      offset
    })
    const items = rows.map((b) => toListItem(b))
    res.json(
      listResponse(BEACHES_BASE, items, { page, pageSize, total }, {
        query: req.query,
        // Hipermedia: ligação create só se o utilizador autenticado for admin ou organizador.
        includeCreate: beachCollectionCreateAllowed(actor),
        mapItem: (item) =>
          withResourceLinks(BEACHES_BASE, item, {
            actions: beachItemActions(actor, item),
            collection: "allBeaches"
          })
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching beaches", mapBeachSequelizeError)
  }
}

/**
 * Detalhe de uma praia.
 * Método: GET
 * Rota: /beaches/:id
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Devolver coordenadas, município e código de distrito.
 *
 * Notas técnicas:
 * - Incluir criado_por_utilizador_id; ligações update/delete condicionais.
 */
export const getBeachById = async (req, res, next) => {
  const { id } = req.params
  try {
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid beach id"] }))
    }
    const full = await Beach.findByPk(id, { include: [BEACH_LOCATION_INCLUDE] })
    if (!full) return next(notFoundError("beach", id))
    const actor = await loadActorContext(req.user.sub)
    const resource = toListItem(full)
    res.json(
      withResourceLinks(BEACHES_BASE, resource, {
        actions: beachItemActions(actor, resource),
        collection: "allBeaches"
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching beach", mapBeachSequelizeError)
  }
}

/**
 * Criar praia no catálogo.
 * Método: POST
 * Rota: /beaches
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Validar distrito (código), município e coordenadas.
 * - Reutilizar ou criar localizacao_praia (nome do distrito + concelho).
 *
 * Notas técnicas:
 * - Autorização na rota (requireAnyRole); criado_por_utilizador_id = utilizador autenticado.
 */
export const createBeach = async (req, res, next) => {
  try {
    const { name, municipality, districtLabel, latitude, longitude } = parseBeachUpsertBody(req.body ?? {})
    await assertBeachUpsertAllowedForOrganization(req.organizationId, municipality, districtLabel)
    const now = new Date()
    // Reutilizar localização existente (nome do distrito + concelho) ou criar nova; freguesia = concelho por simplificação do domínio.
    const [location] = await BeachLocation.findOrCreate({
      where: { district: districtLabel, municipality, parish: municipality },
      defaults: { nutsCode: "PT999", createdAt: now, updatedAt: now }
    })
    const beach = await Beach.create({
      beachLocationId: location.id,
      createdByUserId: req.user.sub,
      name,
      latitude,
      longitude,
      description: null,
      createdAt: now,
      updatedAt: now
    })
    // Releitura com associação incluída para toListItem e hipermedia coerentes com GET.
    const full = await Beach.findByPk(beach.id, { include: [BEACH_LOCATION_INCLUDE] })
    if (!full) {
      return next(notFoundError("beach", beach.id))
    }
    const actor = await loadActorContext(req.user.sub)
    const resource = toListItem(full)
    const response = withResourceLinks(BEACHES_BASE, resource, {
      actions: beachItemActions(actor, resource),
      collection: "allBeaches"
    })
    res.status(201).location(`${BEACHES_BASE}/${resource.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating beach", mapBeachSequelizeError)
  }
}

/**
 * Actualizar praia existente.
 * Método: PATCH
 * Rota: /beaches/:id
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Admin e organizador podem editar qualquer praia do catálogo.
 * - Corpo completo obrigatório (não é PATCH parcial campo a campo).
 *
 * Notas técnicas:
 * - Alterar localização se distrito/município mudarem (findOrCreate em localizacao_praia).
 */
export const updateBeach = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid beach id"] }))
    }
    // Verificar presença de strings antes de parseBeachUpsertBody (mensagens «X is required»).
    const missing = collectMissingStringFields(req.body ?? {}, {
      name: "Name",
      municipality: "Municipality",
      district: "District"
    })
    if (missing.length > 0) {
      return next(missingFieldsValidationError(missing))
    }
    const beach = await assertBeachBelongsToOrganization(id, req.organizationId)
    await assertCanModifyBeach(beach, req.user.sub)
    const { name, municipality, districtLabel, latitude, longitude } = parseBeachUpsertBody(req.body ?? {})
    await assertBeachUpsertAllowedForOrganization(req.organizationId, municipality, districtLabel)
    const now = new Date()
    // Reutilizar localização existente (nome do distrito + concelho) ou criar nova.
    const [location] = await BeachLocation.findOrCreate({
      where: { district: districtLabel, municipality, parish: municipality },
      defaults: { nutsCode: "PT999", createdAt: now, updatedAt: now }
    })
    beach.name = name
    beach.beachLocationId = location.id
    beach.latitude = latitude
    beach.longitude = longitude
    await beach.save()
    const full = await Beach.findByPk(beach.id, { include: [BEACH_LOCATION_INCLUDE] })
    if (!full) {
      return next(notFoundError("beach", beach.id))
    }
    const actor = await loadActorContext(req.user.sub)
    const resource = toListItem(full)
    res.json(
      withResourceLinks(BEACHES_BASE, resource, {
        actions: beachItemActions(actor, resource),
        collection: "allBeaches"
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error updating beach", mapBeachSequelizeError)
  }
}

/**
 * Eliminar praia (eliminação lógica).
 * Método: DELETE
 * Rota: /beaches/:id
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Falhar se existirem campanhas ou dependências RESTRICT.
 *
 * Notas técnicas:
 * - Resposta 204; destroy() com eliminação lógica activo no modelo.
 */
export const deleteBeach = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid beach id"] }))
    }
    const beach = await assertBeachBelongsToOrganization(id, req.organizationId)
    await assertCanModifyBeach(beach, req.user.sub)
    // Eliminação lógica; devolver 409 se a praia estiver referenciada em campanhas (RESTRICT → mapBeachSequelizeError).
    await beach.destroy()
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting beach", mapBeachSequelizeError)
  }
}
