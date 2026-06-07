import { Op } from "sequelize"
import { Beach, BeachLocation, User } from "../models/db.config.js"
import { conflictError, createError, passControllerError, missingFieldsValidationError, notFoundError, validationError, mapSequelizeError, collectMissingStringFields, isUuidParam } from "../utils/error.utils.js"
import {
  buildBeachListWhere,
  districtCodeFromLabel,
  districtLabelFromCode,
  escapeLikePattern,
  parseBeachListFilters
} from "../utils/domain.utils.js"
import { BEACHES_BASE, listResponse, parsePaginationQuery, withResourceLinks } from "../utils/response.utils.js"
import {
  beachCollectionCreateAllowed,
  beachItemActions,
  loadActorContext
} from "../utils/hypermedia.permissions.js"

const DUPLICATE_BEACH_NAME_PT = "Já existe uma praia com este nome."
const MAX_BEACH_NAME_LENGTH = 255
const MAX_MUNICIPALITY_LENGTH = 128
const LATITUDE_MIN = -90
const LATITUDE_MAX = 90
const LONGITUDE_MIN = -180
const LONGITUDE_MAX = 180

const BEACH_LOCATION_INCLUDE = {
  model: BeachLocation,
  as: "beachLocation",
  attributes: ["district", "municipality"]
}

// Aceitar número ou string e validar o intervalo geográfico
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

// Validar e normalizar o corpo de criação ou actualização de praia
function parseBeachUpsertBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const municipality = typeof raw.municipality === "string" ? raw.municipality.trim() : ""
  const districtCode = typeof raw.district === "string" ? raw.district.trim() : ""

  const latitudeResult = parseCoordinate(raw.latitude, "latitude", LATITUDE_MIN, LATITUDE_MAX)
  const longitudeResult = parseCoordinate(raw.longitude, "longitude", LONGITUDE_MIN, LONGITUDE_MAX)

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

  // API recebe código estável; validar contra mapa antes de gravar nome em localizacao_praia.
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

// Mapear registo de praia para DTO da API
function toListItem(row) {
  const districtLabel = row.beachLocation?.district ?? ""
  const code = districtCodeFromLabel(districtLabel) ?? ""
  return {
    id: row.id,
    name: row.name,
    municipality: row.beachLocation?.municipality ?? "",
    district: code,
    latitude: row.latitude != null ? String(row.latitude) : "",
    longitude: row.longitude != null ? String(row.longitude) : "",
    createdByUserId: row.createdByUserId ?? null
  }
}

// Verificar se o utilizador pode alterar ou eliminar a praia
async function assertCanModifyBeach(_beach, userId) {
  const user = await User.findByPk(userId, { attributes: ["isAdmin", "isOrganizer"] })
  if (!user?.isAdmin && !user?.isOrganizer) {
    throw createError(403, "Forbidden")
  }
}

// Mapear erros Sequelize específicos de praia
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
 * - Resposta expõe district como código estável; BD guarda nome em localizacao_praia.
 *
 * Notas técnicas:
 * - Soft delete em praia; links.create para admin/organizador.
 */
export const getAllBeaches = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const filters = parseBeachListFilters(req.query ?? {})
    let municipalityLocationIds = []
    // Pesquisa q: nome na praia ou município em localizacao_praia (duas fontes unidas no where).
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
 * - Inclui criado_por_utilizador_id; links update/delete condicionais.
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
 * - Validar district (código), município e coordenadas.
 * - Reutilizar ou criar localizacao_praia (distrito nome + concelho).
 *
 * Notas técnicas:
 * - Transacção praia + localizacao_praia; actor como criado_por_utilizador_id.
 */
export const createBeach = async (req, res, next) => {
  try {
    const { name, municipality, districtLabel, latitude, longitude } = parseBeachUpsertBody(req.body ?? {})
    const now = new Date()
    // Reutilizar localização existente (distrito nome + concelho) ou criar nova.
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
 *
 * Notas técnicas:
 * - Pode alterar localização se distrito/município mudarem (findOrCreate localizacao_praia).
 */
export const updateBeach = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid beach id"] }))
    }
    const missing = collectMissingStringFields(req.body ?? {}, {
      name: "Name",
      municipality: "Municipality",
      district: "District"
    })
    if (missing.length > 0) {
      return next(missingFieldsValidationError(missing))
    }
    const beach = await Beach.findByPk(id, { include: [BEACH_LOCATION_INCLUDE] })
    if (!beach) {
      return next(notFoundError("beach", id))
    }
    await assertCanModifyBeach(beach, req.user.sub)
    const { name, municipality, districtLabel, latitude, longitude } = parseBeachUpsertBody(req.body ?? {})
    const now = new Date()
    // Reutilizar localização existente (distrito nome + concelho) ou criar nova.
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
 * Eliminar praia (soft delete).
 * Método: DELETE
 * Rota: /beaches/:id
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Falha se existirem campanhas ou dependências RESTRICT.
 *
 * Notas técnicas:
 * - Resposta 204; destroy() com paranoid.
 */
export const deleteBeach = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid beach id"] }))
    }
    const beach = await Beach.findByPk(id)
    if (!beach) {
      return next(notFoundError("beach", id))
    }
    await assertCanModifyBeach(beach, req.user.sub)
    // Soft delete; falha 409 se praia referenciada em campanhas (RESTRICT).
    await beach.destroy()
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting beach", mapBeachSequelizeError)
  }
}
