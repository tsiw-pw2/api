import { Beach, BeachLocation, User } from "../models/db.config.js"
import {
  conflictError,
  createError,
  forwardControllerError,
  missingFieldsValidationError,
  notFoundError,
  validationError,
  mapSequelizeError,
  collectMissingStringFields,
  isUuidParam
} from "../utils/error.utils.js"
import {
  BEACHES_BASE,
  districtCodeFromLabel,
  districtLabelFromCode,
  listResponse,
  parsePaginationQuery,
  withResourceLinks
} from "../utils/hateoas.utils.js"

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

// Aceito número ou string e valido o intervalo geográfico
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

// Exponho o distrito como código na API; na BD guardo o label em BeachLocation
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
  }
}

// Permito alterar/apagar ao criador da praia ou ao admin
async function assertCanModifyBeach(beach, userId) {
  if (beach.createdByUserId === userId) return
  const user = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (!user?.isAdmin) {
    throw createError(403, "Forbidden")
  }
}

function mapBeachSequelizeError(error) {
  return mapSequelizeError(error, {
    onUnique: () => conflictError({ beach: DUPLICATE_BEACH_NAME_PT }),
    onForeignKey: () =>
      conflictError({ beach: "Cannot delete beach while it is referenced" })
  })
}

export const getAllBeaches = async (req, res, next) => {
  try {
    const { offset, limit, page, pageSize } = parsePaginationQuery(req.query ?? {})
    const total = await Beach.count()
    const rows = await Beach.findAll({
      include: [BEACH_LOCATION_INCLUDE],
      order: [["name", "ASC"]],
      limit,
      offset
    })
    const items = rows.map((b) => toListItem(b))
    res.json(listResponse(BEACHES_BASE, items, { page, pageSize, total }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching beaches", mapBeachSequelizeError)
  }
}

export const getBeachById = async (req, res, next) => {
  const { id } = req.params
  try {
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid beach id"] }))
    }
    const full = await Beach.findByPk(id, { include: [BEACH_LOCATION_INCLUDE] })
    if (!full) return next(notFoundError("beach", id))
    const resource = toListItem(full)
    res.json(
      withResourceLinks(BEACHES_BASE, resource, { collection: "allBeaches" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching beach", mapBeachSequelizeError)
  }
}

export const createBeach = async (req, res, next) => {
  try {
    const { name, municipality, districtLabel, latitude, longitude } = parseBeachUpsertBody(req.body ?? {})
    const now = new Date()
    // Reutilizo localização por distrito+concelho; uso parish = municipality por simplificação
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
    const resource = toListItem(full)
    const response = withResourceLinks(BEACHES_BASE, resource, { collection: "allBeaches" })
    res.status(201).location(`${BEACHES_BASE}/${resource.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating beach", mapBeachSequelizeError)
  }
}

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
    // Reutilizo localização por distrito+concelho; uso parish = municipality por simplificação
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
    const resource = toListItem(full)
    res.json(withResourceLinks(BEACHES_BASE, resource, { collection: "allBeaches" }))
  } catch (error) {
    forwardControllerError(error, next, "Error updating beach", mapBeachSequelizeError)
  }
}

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
    await beach.destroy()
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting beach", mapBeachSequelizeError)
  }
}
