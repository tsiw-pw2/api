import { ApiError } from "../../../utils/api-error.js"
import * as wasteCatalogRepository from "./waste-catalog.repository.js"
import {
  ALLOWED_CATEGORIES,
  parseWasteCreateBody,
  parseWasteUpdateBody
} from "./waste-catalog.validation.js"

const DUPLICATE_WASTE_NAME_PT = "Já existe um resíduo com este nome."

const WASTE_TYPE_NAME_TO_CATEGORY_SLUG = {
  plastic: "plastic",
  glass: "glass",
  metal: "metal",
  paper: "paper",
  organic: "organic",
  other: "other",
  Plástico: "plastic",
  Vidro: "glass",
  Metal: "metal",
  "Papel / cartão": "paper",
  Madeira: "other",
  Outros: "other"
}

function wasteTypeNameToCategorySlug(raw) {
  if (raw == null || raw === "") return "other"
  const s = String(raw).trim()
  if (ALLOWED_CATEGORIES.has(s)) return s
  const mapped = WASTE_TYPE_NAME_TO_CATEGORY_SLUG[s]
  if (mapped) return mapped
  return "other"
}

function toListItem(w) {
  return {
    id: w.id,
    name: w.name,
    category: wasteTypeNameToCategorySlug(w.wasteType?.name),
    unit: w.unit ?? "unit"
  }
}

export async function listWasteItems(pagination) {
  const { offset, limit, page, pageSize } = pagination
  const total = await wasteCatalogRepository.countWasteRows()
  const rows = await wasteCatalogRepository.findAllWastePaginated({ offset, limit })
  return {
    items: rows.map((w) => toListItem(w)),
    total,
    page,
    pageSize
  }
}

export async function getWasteItemById(id) {
  const full = await wasteCatalogRepository.findWasteByIdForList(id)
  if (!full) {
    throw ApiError.notFound()
  }
  return toListItem(full)
}

export async function createWasteItem(body) {
  const { name, category, unit } = parseWasteCreateBody(body ?? {})

  const existing = await wasteCatalogRepository.findWasteByName(name)
  if (existing) {
    throw ApiError.conflict(DUPLICATE_WASTE_NAME_PT)
  }

  const [wasteType] = await wasteCatalogRepository.findOrCreateWasteTypeByCategoryName(category)

  try {
    const row = await wasteCatalogRepository.insertWasteRow({
      wasteTypeId: wasteType.id,
      name,
      unit
    })
    const full = await wasteCatalogRepository.findWasteByIdForList(row.id)
    if (!full) {
      throw ApiError.notFound()
    }
    return toListItem(full)
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      throw ApiError.conflict(DUPLICATE_WASTE_NAME_PT)
    }
    throw e
  }
}

export async function updateWasteItem(id, body) {
  const row = await wasteCatalogRepository.findWasteByIdForUpdate(id)

  if (!row) {
    throw ApiError.notFound()
  }

  const patch = parseWasteUpdateBody(body ?? {})

  if (patch.name !== undefined && patch.name !== row.name) {
    const taken = await wasteCatalogRepository.findWasteByName(patch.name)
    if (taken && taken.id !== row.id) {
      throw ApiError.conflict(DUPLICATE_WASTE_NAME_PT)
    }
    row.name = patch.name
  }

  if (patch.unit !== undefined) {
    row.unit = patch.unit
  }

  if (patch.category !== undefined) {
    const [wasteType] = await wasteCatalogRepository.findOrCreateWasteTypeByCategoryName(
      patch.category
    )
    row.wasteTypeId = wasteType.id
  }

  try {
    await wasteCatalogRepository.saveWasteRow(row)
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      throw ApiError.conflict(DUPLICATE_WASTE_NAME_PT)
    }
    throw e
  }

  const full = await wasteCatalogRepository.findWasteByIdForList(row.id)

  if (!full) {
    throw ApiError.notFound()
  }

  return toListItem(full)
}

export async function deleteWasteItem(id) {
  const removed = await wasteCatalogRepository.destroyWasteById(id)
  if (removed === 0) {
    throw ApiError.notFound()
  }
}
