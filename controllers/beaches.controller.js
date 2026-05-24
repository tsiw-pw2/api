import {
  forwardControllerError,
  conflictError,
  mapSequelizeError,
  missingFieldsValidationError,
  validationError,
  isUuidParam,
  collectMissingStringFields
} from "../utils/error.utils.js"
import {
  BEACHES_BASE,
  listResponse,
  withResourceLinks,
  parsePaginationQuery,
  districtLabelFromCode,
  districtCodeFromLabel
} from "../utils/hateoas.utils.js"
import { Beach, BeachLocation, User } from "../models/db.config.js"

function toBeachListItem(row) {
  const districtLabel = row.beachLocation?.district ?? ""
  const code = districtCodeFromLabel(districtLabel) ?? ""
  return {
    id: row.id,
    name: row.name,
    municipality: row.beachLocation?.municipality ?? "",
    district: code,
    latitude: row.latitude != null ? String(row.latitude) : "",
    longitude: row.longitude != null ? String(row.longitude) : ""
  }
}

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

async function assertCanModifyBeach(beach, userId) {
  if (beach.createdByUserId === userId) return
  const user = await User.findByPk(userId, { attributes: ["isAdmin"] })
  if (!user?.isAdmin) {
    throw createError(403, "Forbidden")
  }
}

async function listBeaches(pagination) {
  const { offset, limit, page, pageSize } = pagination
  const total = await Beach.count()
  const rows = await Beach.findAll({
    include: [BEACH_LOCATION_INCLUDE],
    order: [["name", "ASC"]],
    limit,
    offset
  })
  return {
    items: rows.map((b) => toBeachListItem(b)),
    page,
    pageSize,
    total
  }
}

async function fetchBeachRecord(id) {
  if (!isUuidParam(id)) {
    throw validationError({ id: ["Invalid beach id"] })
  }
  const full = await Beach.findByPk(id, { include: [BEACH_LOCATION_INCLUDE] })
  if (!full) {
    throw notFoundError("beach", id)
  }
  return toBeachListItem(full)
}

async function createBeachForUser(userId, body) {
  const { name, municipality, districtLabel, latitude, longitude } = parseBeachUpsertBody(body)
  const now = new Date()
  const [location] = await BeachLocation.findOrCreate({
    where: { district: districtLabel, municipality, parish: municipality },
    defaults: { nutsCode: "PT999", createdAt: now, updatedAt: now }
  })
  const beach = await Beach.create({
    beachLocationId: location.id,
    createdByUserId: userId,
    name,
    latitude,
    longitude,
    description: null,
    createdAt: now,
    updatedAt: now
  })
  const full = await Beach.findByPk(beach.id, { include: [BEACH_LOCATION_INCLUDE] })
  if (!full) {
    throw notFoundError("beach", beach.id)
  }
  return toBeachListItem(full)
}

async function updateBeachForUser(userId, id, body) {
  if (!isUuidParam(id)) {
    throw validationError({ id: ["Invalid beach id"] })
  }
  const beach = await Beach.findByPk(id, { include: [BEACH_LOCATION_INCLUDE] })
  if (!beach) {
    throw notFoundError("beach", id)
  }
  await assertCanModifyBeach(beach, userId)
  const { name, municipality, districtLabel, latitude, longitude } = parseBeachUpsertBody(body)
  const now = new Date()
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
    throw notFoundError("beach", beach.id)
  }
  return toBeachListItem(full)
}

async function deleteBeachForUser(userId, id) {
  if (!isUuidParam(id)) {
    throw validationError({ id: ["Invalid beach id"] })
  }
  const beach = await Beach.findByPk(id)
  if (!beach) {
    throw notFoundError("beach", id)
  }
  await assertCanModifyBeach(beach, userId)
  await beach.destroy()
}

export const getAllBeaches = async (req, res, next) => {
  try {
    const data = await listBeaches(parsePaginationQuery(req.query ?? {}))
    res.json(
      listResponse(BEACHES_BASE, data.items, {
        page: data.page,
        pageSize: data.pageSize,
        total: data.total
      })
    )
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
    const resource = await fetchBeachRecord(id)
    res.json(withResourceLinks(BEACHES_BASE, resource, { collection: "allBeaches" }))
  } catch (error) {
    forwardControllerError(error, next, "Error fetching beach", mapBeachSequelizeError)
  }
}

export const createBeach = async (req, res, next) => {
  try {
    const resource = await createBeachForUser(req.user.sub, req.body ?? {})
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
    const resource = await updateBeachForUser(req.user.sub, id, req.body ?? {})
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
    await deleteBeachForUser(req.user.sub, id)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting beach", mapBeachSequelizeError)
  }
}
