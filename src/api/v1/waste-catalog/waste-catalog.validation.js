import { ApiError } from "../../../utils/api-error.js"

export const ALLOWED_CATEGORIES = new Set([
  "plastic",
  "glass",
  "metal",
  "paper",
  "organic",
  "other"
])

export const ALLOWED_UNITS = new Set(["kg", "unit"])

export const MAX_WASTE_NAME_LENGTH = 255

function assertStringField(value) {
  if (value === undefined) {
    return undefined
  }
  if (value === null || typeof value !== "string") {
    throw ApiError.badRequest("Invalid request")
  }
  return value.trim()
}

export function parseWasteCreateBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const category = typeof raw.category === "string" ? raw.category.trim() : ""
  const unit = typeof raw.unit === "string" ? raw.unit.trim() : ""

  if (!name || !category || !unit) {
    throw ApiError.badRequest("Invalid request")
  }

  if (name.length > MAX_WASTE_NAME_LENGTH) {
    throw ApiError.badRequest("Invalid request")
  }

  if (!ALLOWED_CATEGORIES.has(category)) {
    throw ApiError.badRequest("Invalid request")
  }

  if (!ALLOWED_UNITS.has(unit)) {
    throw ApiError.badRequest("Invalid request")
  }

  return { name, category, unit }
}

export function parseWasteUpdateBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const patch = {}

  if (Object.prototype.hasOwnProperty.call(raw, "name")) {
    const name = assertStringField(raw.name)
    if (!name || name.length > MAX_WASTE_NAME_LENGTH) {
      throw ApiError.badRequest("Invalid request")
    }
    patch.name = name
  }

  if (Object.prototype.hasOwnProperty.call(raw, "unit")) {
    const unit = assertStringField(raw.unit)
    if (!unit || !ALLOWED_UNITS.has(unit)) {
      throw ApiError.badRequest("Invalid request")
    }
    patch.unit = unit
  }

  if (Object.prototype.hasOwnProperty.call(raw, "category")) {
    const category = assertStringField(raw.category)
    if (!category || !ALLOWED_CATEGORIES.has(category)) {
      throw ApiError.badRequest("Invalid request")
    }
    patch.category = category
  }

  return patch
}
