import {
  forwardControllerError,
  missingFieldsValidationError,
  validationError,
  isUuidParam,
  collectMissingStringFields,
  mapSequelizeError,
  conflictError,
  notFoundError
} from "../utils/error.utils.js"
import {
  WASTE_CATEGORIES_BASE,
  listResponse,
  withResourceLinks,
  parsePaginationQuery
} from "../utils/hateoas.utils.js"
import { Waste, WasteType } from "../models/db.config.js"

const DUPLICATE_CATEGORY_NAME_PT = "Já existe uma categoria com este nome."
const CATEGORY_IN_USE_PT =
  "Não é possível eliminar: existem resíduos associados a esta categoria."

function toWasteCategoryListItem(row) {
  return {
    id: row.id,
    name: row.name
  }
}

const MAX_CATEGORY_NAME_LENGTH = 255

function parseCategoryNameBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  if (!name || name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw validationError({ name: ["Invalid category name"] })
  }
  return { name }
}

function mapCategorySequelizeError(error) {
  return mapSequelizeError(error, {
    onUnique: () => conflictError({ category: DUPLICATE_CATEGORY_NAME_PT }),
    onForeignKey: () => conflictError({ category: CATEGORY_IN_USE_PT })
  })
}

async function listWasteCategories(pagination) {
  const { offset, limit, page, pageSize } = pagination
  const total = await WasteType.count()
  const rows = await WasteType.findAll({
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
    limit,
    offset
  })
  return {
    items: rows.map((row) => toWasteCategoryListItem(row)),
    total,
    page,
    pageSize
  }
}

async function fetchWasteCategoryById(id) {
  const row = await WasteType.findByPk(id, { attributes: ["id", "name"] })
  if (!row) {
    throw notFoundError("waste category", id)
  }
  return toWasteCategoryListItem(row)
}

async function createWasteCategoryRecord(body) {
  const { name } = parseCategoryNameBody(body ?? {})
  const existing = await WasteType.findOne({
    where: { name },
    paranoid: true,
    attributes: ["id"]
  })
  if (existing) {
    throw conflictError({ category: DUPLICATE_CATEGORY_NAME_PT })
  }
  const now = new Date()
  const row = await WasteType.create({
    name,
    createdAt: now,
    updatedAt: now
  })
  return toWasteCategoryListItem(row)
}

async function updateWasteCategoryRecord(id, body) {
  const { name } = parseCategoryNameBody(body ?? {})
  const row = await WasteType.findByPk(id, { attributes: ["id", "name"] })
  if (!row) {
    throw notFoundError("waste category", id)
  }
  if (name !== row.name) {
    const taken = await WasteType.findOne({
      where: { name },
      paranoid: true,
      attributes: ["id"]
    })
    if (taken && taken.id !== row.id) {
      throw conflictError({ category: DUPLICATE_CATEGORY_NAME_PT })
    }
  }
  row.name = name
  row.updatedAt = new Date()
  await row.save()
  return toWasteCategoryListItem(row)
}

async function deleteWasteCategoryById(id) {
  const row = await WasteType.findByPk(id, { attributes: ["id"] })
  if (!row) {
    throw notFoundError("waste category", id)
  }
  const inUse = await Waste.count({ where: { wasteTypeId: id } })
  if (inUse > 0) {
    throw conflictError({ category: CATEGORY_IN_USE_PT })
  }
  await row.destroy()
}

export const getAllWasteCategories = async (req, res, next) => {
  try {
    const data = await listWasteCategories(parsePaginationQuery(req.query ?? {}))
    res.json(
      listResponse(WASTE_CATEGORIES_BASE, data.items, {
        page: data.page,
        pageSize: data.pageSize,
        total: data.total
      })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching waste categories", mapCategorySequelizeError)
  }
}

export const getWasteCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste category id"] }))
    }
    const resource = await fetchWasteCategoryById(id)
    res.json(
      withResourceLinks(WASTE_CATEGORIES_BASE, resource, { collection: "allWasteCategories" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error fetching waste category", mapCategorySequelizeError)
  }
}

export const createWasteCategory = async (req, res, next) => {
  try {
    const resource = await createWasteCategoryRecord(req.body ?? {})
    const response = withResourceLinks(WASTE_CATEGORIES_BASE, resource, {
      collection: "allWasteCategories"
    })
    res.status(201).location(`${WASTE_CATEGORIES_BASE}/${resource.id}`).json(response)
  } catch (error) {
    forwardControllerError(error, next, "Error creating waste category", mapCategorySequelizeError)
  }
}

export const updateWasteCategory = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste category id"] }))
    }
    const missing = collectMissingStringFields(req.body ?? {}, { name: "Name" })
    if (missing.length > 0) {
      return next(missingFieldsValidationError(missing))
    }
    const resource = await updateWasteCategoryRecord(id, req.body ?? {})
    res.json(
      withResourceLinks(WASTE_CATEGORIES_BASE, resource, { collection: "allWasteCategories" })
    )
  } catch (error) {
    forwardControllerError(error, next, "Error updating waste category", mapCategorySequelizeError)
  }
}

export const deleteWasteCategory = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste category id"] }))
    }
    await deleteWasteCategoryById(id)
    res.status(204).send()
  } catch (error) {
    forwardControllerError(error, next, "Error deleting waste category", mapCategorySequelizeError)
  }
}
