import { passControllerError, missingFieldsValidationError, validationError, isUuidParam, collectMissingStringFields, mapSequelizeError, conflictError, notFoundError } from "../utils/error.utils.js"
import { WASTE_CATEGORIES_BASE, listResponse, parsePaginationQuery, withResourceLinks } from "../utils/response.utils.js"
import { loadActorContext, wasteCategoryActions, wasteCategoryCollectionCreateAllowed } from "../utils/hypermedia.permissions.js"
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

async function findWasteCategoryInOrganization(id, organizationId) {
  const row = await WasteType.findOne({
    where: { id, organizationId },
    attributes: ["id", "name"]
  })
  if (!row) {
    throw notFoundError("waste category", id)
  }
  return row
}

async function listWasteCategories(pagination, organizationId) {
  const { offset, limit, page, pageSize } = pagination
  const where = { organizationId }
  const total = await WasteType.count({ where })
  const rows = await WasteType.findAll({
    where,
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

async function fetchWasteCategoryById(id, organizationId) {
  const row = await findWasteCategoryInOrganization(id, organizationId)
  return toWasteCategoryListItem(row)
}

async function createWasteCategoryRecord(body, organizationId) {
  const { name } = parseCategoryNameBody(body ?? {})
  const existing = await WasteType.findOne({
    where: { name, organizationId },
    paranoid: true,
    attributes: ["id"]
  })
  if (existing) {
    throw conflictError({ category: DUPLICATE_CATEGORY_NAME_PT })
  }
  const now = new Date()
  const row = await WasteType.create({
    organizationId,
    name,
    createdAt: now,
    updatedAt: now
  })
  return toWasteCategoryListItem(row)
}

async function updateWasteCategoryRecord(id, body, organizationId) {
  const { name } = parseCategoryNameBody(body ?? {})
  const row = await findWasteCategoryInOrganization(id, organizationId)
  if (name !== row.name) {
    const taken = await WasteType.findOne({
      where: { name, organizationId },
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

async function deleteWasteCategoryById(id, organizationId) {
  const row = await findWasteCategoryInOrganization(id, organizationId)
  const inUse = await Waste.count({ where: { wasteTypeId: id, organizationId } })
  if (inUse > 0) {
    throw conflictError({ category: CATEGORY_IN_USE_PT })
  }
  await row.destroy()
}

export const getAllWasteCategories = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const data = await listWasteCategories(parsePaginationQuery(req.query ?? {}), req.organizationId)
    res.json(
      listResponse(
        WASTE_CATEGORIES_BASE,
        data.items,
        {
          page: data.page,
          pageSize: data.pageSize,
          total: data.total
        },
        {
          query: req.query,
          includeCreate: wasteCategoryCollectionCreateAllowed(actor),
          mapItem: (item) =>
            withResourceLinks(WASTE_CATEGORIES_BASE, item, {
              actions: wasteCategoryActions(actor),
              collection: "allWasteCategories"
            })
        }
      )
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching waste categories", mapCategorySequelizeError)
  }
}

export const getWasteCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste category id"] }))
    }
    const actor = await loadActorContext(req.user.sub)
    const resource = await fetchWasteCategoryById(id, req.organizationId)
    res.json(
      withResourceLinks(WASTE_CATEGORIES_BASE, resource, {
        actions: wasteCategoryActions(actor),
        collection: "allWasteCategories"
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching waste category", mapCategorySequelizeError)
  }
}

export const createWasteCategory = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const resource = await createWasteCategoryRecord(req.body ?? {}, req.organizationId)
    const response = withResourceLinks(WASTE_CATEGORIES_BASE, resource, {
      actions: wasteCategoryActions(actor),
      collection: "allWasteCategories"
    })
    res.status(201).location(`${WASTE_CATEGORIES_BASE}/${resource.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating waste category", mapCategorySequelizeError)
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
    const actor = await loadActorContext(req.user.sub)
    const resource = await updateWasteCategoryRecord(id, req.body ?? {}, req.organizationId)
    res.json(
      withResourceLinks(WASTE_CATEGORIES_BASE, resource, {
        actions: wasteCategoryActions(actor),
        collection: "allWasteCategories"
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error updating waste category", mapCategorySequelizeError)
  }
}

export const deleteWasteCategory = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste category id"] }))
    }
    await deleteWasteCategoryById(id, req.organizationId)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting waste category", mapCategorySequelizeError)
  }
}
