import { Waste, WasteType } from "../models/db.config.js"
import {
  conflictError,
  createError,
  passControllerError,
  missingFieldsValidationError,
  notFoundError,
  validationError,
  mapSequelizeError,
  collectMissingStringFields,
  isUuidParam
} from "../utils/error.utils.js"
import { buildWasteListWhere, parseWasteListFilters } from "../utils/domain.utils.js"
import {
  WASTE_ITEMS_BASE,
  listResponse,
  parsePaginationQuery,
  withResourceLinks
} from "../utils/response.utils.js"
import {
  loadActorContext,
  wasteItemActions,
  wasteItemCollectionCreateAllowed
} from "../utils/hypermedia.permissions.js"

const DUPLICATE_WASTE_NAME_PT = "Já existe um resíduo com este nome."
const MAX_WASTE_NAME_LENGTH = 255
const ALLOWED_UNITS = new Set(["peso", "unit"])
const MAX_AVERAGE_WEIGHT_GRAMS = 1_000_000

function normalizeWasteUnit(unit) {
  if (unit === "kg") return "peso"
  return unit
}

function parseAverageWeightGrams(raw) {
  if (raw.averageWeightGrams === undefined) {
    return undefined
  }
  if (raw.averageWeightGrams === null || raw.averageWeightGrams === "") {
    return null
  }
  const n = Number(raw.averageWeightGrams)
  if (!Number.isFinite(n) || n < 1 || n > MAX_AVERAGE_WEIGHT_GRAMS) {
    throw validationError(["Invalid request"])
  }
  return Math.round(n)
}

const WASTE_LIST_ATTRIBUTES = [
  "id",
  "wasteTypeId",
  "name",
  "unit",
  "averageWeightGrams",
  "createdAt",
  "updatedAt",
  "deletedAt"
]

const WASTE_TYPE_LIST_INCLUDE = {
  model: WasteType,
  as: "wasteType",
  attributes: ["id", "name"]
}

const WASTE_TYPE_NAME_ONLY_INCLUDE = {
  model: WasteType,
  as: "wasteType",
  attributes: ["id", "name"]
}

function assertStringField(value) {
  if (value === undefined) {
    return undefined
  }
  if (value === null || typeof value !== "string") {
    throw validationError(["Invalid request"])
  }
  return value.trim()
}

async function resolveCategoryId(categoryId) {
  if (!isUuidParam(categoryId)) {
    throw validationError({ categoryId: ["Invalid category id"] })
  }
  const row = await WasteType.findByPk(categoryId, { attributes: ["id", "name"] })
  if (!row) {
    throw validationError({ categoryId: ["Invalid category id"] })
  }
  return row
}

function parseWasteCreateBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const categoryId = typeof raw.categoryId === "string" ? raw.categoryId.trim() : ""
  const unit = typeof raw.unit === "string" ? raw.unit.trim() : ""

  if (!name || !categoryId || !unit) {
    throw validationError(["Invalid request"])
  }

  if (name.length > MAX_WASTE_NAME_LENGTH) {
    throw validationError(["Invalid request"])
  }

  const normalizedUnit = normalizeWasteUnit(unit)
  if (!ALLOWED_UNITS.has(normalizedUnit)) {
    throw validationError(["Invalid request"])
  }

  const parsed = parseAverageWeightGrams(raw)
  const averageWeightGrams = parsed === undefined ? null : parsed

  return { name, categoryId, unit: normalizedUnit, averageWeightGrams }
}

// No PATCH valido só os campos presentes no corpo
function parseWasteUpdateBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const patch = {}

  if (Object.prototype.hasOwnProperty.call(raw, "name")) {
    const name = assertStringField(raw.name)
    if (!name || name.length > MAX_WASTE_NAME_LENGTH) {
      throw validationError(["Invalid request"])
    }
    patch.name = name
  }

  if (Object.prototype.hasOwnProperty.call(raw, "unit")) {
    const unit = assertStringField(raw.unit)
    const normalizedUnit = unit ? normalizeWasteUnit(unit) : ""
    if (!normalizedUnit || !ALLOWED_UNITS.has(normalizedUnit)) {
      throw validationError(["Invalid request"])
    }
    patch.unit = normalizedUnit
  }

  if (Object.prototype.hasOwnProperty.call(raw, "averageWeightGrams")) {
    const grams = parseAverageWeightGrams(raw)
    if (grams !== undefined) {
      patch.averageWeightGrams = grams
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "categoryId")) {
    const categoryId = assertStringField(raw.categoryId)
    if (!categoryId) {
      throw validationError(["Invalid request"])
    }
    patch.categoryId = categoryId
  }

  return patch
}

function toListItem(w) {
  const unit = normalizeWasteUnit(w.unit ?? "unit")
  const grams = w.averageWeightGrams
  return {
    id: w.id,
    name: w.name,
    categoryId: w.wasteTypeId,
    categoryName: w.wasteType?.name ?? "",
    unit,
    averageWeightGrams:
      grams != null && Number.isFinite(Number(grams)) ? Number(grams) : null
  }
}

async function findWasteForList(id) {
  return Waste.findByPk(id, {
    attributes: WASTE_LIST_ATTRIBUTES,
    include: [WASTE_TYPE_NAME_ONLY_INCLUDE]
  })
}

export async function listWasteItems(pagination, filters = parseWasteListFilters({})) {
  const { offset, limit, page, pageSize } = pagination
  const where = buildWasteListWhere(filters)
  const total = await Waste.count({ where })
  const rows = await Waste.findAll({
    where,
    attributes: WASTE_LIST_ATTRIBUTES,
    include: [WASTE_TYPE_LIST_INCLUDE],
    order: [["name", "ASC"]],
    limit,
    offset
  })
  return {
    items: rows.map((w) => toListItem(w)),
    total,
    page,
    pageSize
  }
}

export async function getWasteItemById(id) {
  const full = await findWasteForList(id)
  if (!full) {
    throw notFoundError("WasteItem", id)
  }
  return toListItem(full)
}

export async function createWasteItem(body) {
  const { name, categoryId, unit, averageWeightGrams } = parseWasteCreateBody(body ?? {})
  await resolveCategoryId(categoryId)

    // Verifico duplicados antes do INSERT; o unique na BD é a segunda linha de defesa
    const existing = await Waste.findOne({
    where: { name },
    paranoid: true,
    attributes: ["id"]
  })
  if (existing) {
    throw createError(409, DUPLICATE_WASTE_NAME_PT)
  }

  const now = new Date()
  try {
    const row = await Waste.create({
      wasteTypeId: categoryId,
      name,
      unit,
      averageWeightGrams: averageWeightGrams ?? null,
      createdAt: now,
      updatedAt: now
    })
    const full = await findWasteForList(row.id)
    if (!full) {
      throw notFoundError("WasteItem", row.id)
    }
    return toListItem(full)
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      throw createError(409, DUPLICATE_WASTE_NAME_PT)
    }
    throw e
  }
}

export async function updateWasteItem(id, body) {
  const row = await Waste.findByPk(id, {
    attributes: WASTE_LIST_ATTRIBUTES,
    include: [
      {
        model: WasteType,
        as: "wasteType",
        attributes: ["id", "name"]
      }
    ]
  })

  if (!row) {
    throw notFoundError("WasteItem", id)
  }

  const patch = parseWasteUpdateBody(body ?? {})

  if (patch.name !== undefined && patch.name !== row.name) {
    const taken = await Waste.findOne({
      where: { name: patch.name },
      paranoid: true,
      attributes: ["id"]
    })
    if (taken && taken.id !== row.id) {
      throw createError(409, DUPLICATE_WASTE_NAME_PT)
    }
    row.name = patch.name
  }

  if (patch.unit !== undefined) {
    row.unit = patch.unit
  }

  if (patch.averageWeightGrams !== undefined) {
    row.averageWeightGrams = patch.averageWeightGrams
  }

  if (patch.categoryId !== undefined) {
    // Confirmar que a categoria existe antes de alterar a FK.
    await resolveCategoryId(patch.categoryId)
    row.wasteTypeId = patch.categoryId
  }

  try {
    await row.save()
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      throw createError(409, DUPLICATE_WASTE_NAME_PT)
    }
    throw e
  }

  const full = await findWasteForList(row.id)

  if (!full) {
    throw notFoundError("WasteItem", id)
  }

  return toListItem(full)
}

async function deleteWasteItemById(id) {
  // Soft delete; RESTRICT em recolha_residuo impede eliminação se houver histórico.
  const removed = await Waste.destroy({ where: { id } })
  if (removed === 0) {
    throw notFoundError("WasteItem", id)
  }
}

function mapWasteSequelizeError(error) {
  return mapSequelizeError(error, {
    onUnique: () => conflictError({ waste: DUPLICATE_WASTE_NAME_PT })
  })
}

/**
 * Listar itens de resíduo do catálogo.
 * Método: GET
 * Rota: /waste-items
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Filtros por categoria (categoryId) e unidade (unit | peso).
 * - Paginação standard com links hypermedia.
 *
 * Notas técnicas:
 * - residuo N:1 tipo_residuo; peso_medio_gramas para estimativa de recolhas.
 */
export const getAllWasteItems = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const filters = parseWasteListFilters(req.query ?? {})
    const data = await listWasteItems(parsePaginationQuery(req.query ?? {}), filters)
    res.json(
      listResponse(
        WASTE_ITEMS_BASE,
        data.items,
        {
          page: data.page,
          pageSize: data.pageSize,
          total: data.total
        },
        {
          query: req.query,
          includeCreate: wasteItemCollectionCreateAllowed(actor),
          mapItem: (item) =>
            withResourceLinks(WASTE_ITEMS_BASE, item, {
              actions: wasteItemActions(actor),
              collection: "allWasteItems"
            })
        }
      )
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching waste items", mapWasteSequelizeError)
  }
}

/**
 * Detalhe de um item de resíduo.
 * Método: GET
 * Rota: /waste-items/:id
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Incluir categoria associada e unidade de medida.
 *
 * Notas técnicas:
 * - Soft delete; item eliminado devolve 404.
 */
export const getWasteItemByIdHandler = async (req, res, next) => {
  const { id } = req.params
  try {
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste item id"] }))
    }
    const actor = await loadActorContext(req.user.sub)
    const data = await getWasteItemById(id)
    res.json(
      withResourceLinks(WASTE_ITEMS_BASE, data, {
        actions: wasteItemActions(actor),
        collection: "allWasteItems"
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching waste item", mapWasteSequelizeError)
  }
}

/**
 * Criar item de resíduo.
 * Método: POST
 * Rota: /waste-items
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Nome único; categoryId deve existir; unidade unit ou peso.
 * - averageWeightGramas obrigatório quando unidade é peso.
 *
 * Notas técnicas:
 * - Resposta 201 com Location.
 */
export const createWasteItemHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const data = await createWasteItem(req.body ?? {})
    const response = withResourceLinks(WASTE_ITEMS_BASE, data, {
      actions: wasteItemActions(actor),
      collection: "allWasteItems"
    })
    res.status(201).location(`${WASTE_ITEMS_BASE}/${data.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating waste item", mapWasteSequelizeError)
  }
}

/**
 * Actualizar item de resíduo.
 * Método: PATCH
 * Rota: /waste-items/:id
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Validar unicidade do nome e coerência unidade/peso_medio_gramas.
 *
 * Notas técnicas:
 * - PATCH parcial; soft delete preserva histórico de recolhas.
 */
export const updateWasteItemHandler = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste item id"] }))
    }
    const missing = collectMissingStringFields(req.body ?? {}, {
      name: "Name",
      categoryId: "Category",
      unit: "Unit"
    })
    if (missing.length > 0) {
      return next(missingFieldsValidationError(missing))
    }
    const { name, categoryId, unit, averageWeightGrams } = parseWasteCreateBody(req.body ?? {})
    await resolveCategoryId(categoryId)
    const row = await Waste.findByPk(id, {
      attributes: WASTE_LIST_ATTRIBUTES,
      include: [{ model: WasteType, as: "wasteType", attributes: ["id", "name"] }]
    })
    if (!row) {
      return next(notFoundError("waste item", id))
    }
    // Verificar unicidade do nome entre itens activos.
    const taken = await Waste.findOne({ where: { name }, paranoid: true, attributes: ["id"] })
    if (taken && taken.id !== row.id) {
      return next(conflictError({ waste: DUPLICATE_WASTE_NAME_PT }))
    }
    row.name = name
    row.unit = unit
    row.wasteTypeId = categoryId
    row.averageWeightGrams = averageWeightGrams ?? null
    await row.save()
    const full = await findWasteForList(row.id)
    if (!full) {
      return next(notFoundError("waste item", id))
    }
    const actor = await loadActorContext(req.user.sub)
    const resource = toListItem(full)
    res.json(
      withResourceLinks(WASTE_ITEMS_BASE, resource, {
        actions: wasteItemActions(actor),
        collection: "allWasteItems"
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error updating waste item", mapWasteSequelizeError)
  }
}

/**
 * Eliminar item de resíduo (soft delete).
 * Método: DELETE
 * Rota: /waste-items/:id
 * Autenticação: sim (Bearer JWT, admin ou organizador)
 *
 * Regras de negócio:
 * - Impedir eliminação se existirem recolhas associadas (RESTRICT).
 *
 * Notas técnicas:
 * - Resposta 204.
 */
export const deleteWasteItemHandler = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste item id"] }))
    }
    await deleteWasteItemById(id)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting waste item", mapWasteSequelizeError)
  }
}
