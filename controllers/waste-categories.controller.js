import { passControllerError, missingFieldsValidationError, validationError, isUuidParam, collectMissingStringFields, mapSequelizeError, conflictError, notFoundError } from "../utils/error.utils.js"
import { WASTE_CATEGORIES_BASE, listResponse, parsePaginationQuery, withResourceLinks } from "../utils/response.utils.js"
import { loadActorContext, wasteCategoryActions, wasteCategoryCollectionCreateAllowed } from "../utils/hypermedia.permissions.js"
import { Waste, WasteType } from "../models/db.config.js"

// Mensagens alinhadas com constraints da BD (textos de erro da API em inglês).
const DUPLICATE_CATEGORY_NAME_PT = "Já existe uma categoria com este nome."
const CATEGORY_IN_USE_PT =
  "Não é possível eliminar: existem resíduos associados a esta categoria."

// Mapear registo Sequelize (tipo_residuo) para o formato JSON da API.
function toWasteCategoryListItem(row) {
  return {
    id: row.id,
    name: row.name
  }
}

const MAX_CATEGORY_NAME_LENGTH = 255

// Validar o nome da categoria no corpo do pedido (POST e PATCH).
function parseCategoryNameBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  if (!name || name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw validationError({ name: ["Invalid category name"] })
  }
  return { name }
}

// Mapear erros Sequelize de categoria (nome único, chave estrangeira em residuo) para respostas HTTP.
function mapCategorySequelizeError(error) {
  return mapSequelizeError(error, {
    onUnique: () => conflictError({ category: DUPLICATE_CATEGORY_NAME_PT }),
    onForeignKey: () => conflictError({ category: CATEGORY_IN_USE_PT })
  })
}

// Listar categorias de resíduo com paginação (tabela tipo_residuo).
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

// Obter uma categoria pelo identificador; 404 se eliminada logicamente.
async function fetchWasteCategoryById(id) {
  const row = await WasteType.findByPk(id, { attributes: ["id", "name"] })
  if (!row) {
    throw notFoundError("waste category", id)
  }
  return toWasteCategoryListItem(row)
}

// Criar categoria de resíduo na base de dados; verificar nome único antes do INSERT.
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

// Actualizar nome da categoria existente; validar unicidade se o nome mudar.
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

// Eliminar categoria (eliminação lógica) se não tiver resíduos associados em residuo.
async function deleteWasteCategoryById(id) {
  const row = await WasteType.findByPk(id, { attributes: ["id"] })
  if (!row) {
    throw notFoundError("waste category", id)
  }
  // Bloquear eliminação se existirem itens de resíduo na categoria.
  const inUse = await Waste.count({ where: { wasteTypeId: id } })
  if (inUse > 0) {
    throw conflictError({ category: CATEGORY_IN_USE_PT })
  }
  await row.destroy()
}

/**
 * Listar categorias de resíduo.
 * Método: GET
 * Rota: /waste-categories
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Catálogo legível por todos os autenticados; ligações de criação (create) só para admin.
 *
 * Notas técnicas:
 * - tipo_residuo 1:N residuo; eliminação lógica em ambas as tabelas.
 */
export const getAllWasteCategories = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const data = await listWasteCategories(parsePaginationQuery(req.query ?? {}))
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
          // Hipermedia: ligação create só para admin.
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

/**
 * Detalhe de categoria de resíduo.
 * Método: GET
 * Rota: /waste-categories/:id
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Devolver nome da categoria (tipo_residuo).
 *
 * Notas técnicas:
 * - 404 se categoria eliminada logicamente.
 */
export const getWasteCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste category id"] }))
    }
    const actor = await loadActorContext(req.user.sub)
    const resource = await fetchWasteCategoryById(id)
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

/**
 * Criar categoria de resíduo.
 * Método: POST
 * Rota: /waste-categories
 * Autenticação: sim (Bearer JWT, papel admin)
 *
 * Regras de negócio:
 * - Nome obrigatório e único entre categorias activas.
 *
 * Notas técnicas:
 * - Resposta 201 com Location.
 */
export const createWasteCategory = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const resource = await createWasteCategoryRecord(req.body ?? {})
    const response = withResourceLinks(WASTE_CATEGORIES_BASE, resource, {
      actions: wasteCategoryActions(actor),
      collection: "allWasteCategories"
    })
    res.status(201).location(`${WASTE_CATEGORIES_BASE}/${resource.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating waste category", mapCategorySequelizeError)
  }
}

/**
 * Renomear categoria de resíduo.
 * Método: PATCH
 * Rota: /waste-categories/:id
 * Autenticação: sim (Bearer JWT, papel admin)
 *
 * Regras de negócio:
 * - Validar unicidade do novo nome.
 *
 * Notas técnicas:
 * - PATCH parcial (campo name).
 */
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
    const resource = await updateWasteCategoryRecord(id, req.body ?? {})
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

/**
 * Eliminar categoria de resíduo (eliminação lógica).
 * Método: DELETE
 * Rota: /waste-categories/:id
 * Autenticação: sim (Bearer JWT, papel admin)
 *
 * Regras de negócio:
 * - Recusar se existirem itens de resíduo na categoria.
 *
 * Notas técnicas:
 * - Resposta 204.
 */
export const deleteWasteCategory = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuidParam(id)) {
      return next(validationError({ id: ["Invalid waste category id"] }))
    }
    await deleteWasteCategoryById(id)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting waste category", mapCategorySequelizeError)
  }
}
