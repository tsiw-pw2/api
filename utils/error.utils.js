export function createError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

export function validationError(errors) {
  const err = createError(400, "Validation error")
  if (Array.isArray(errors)) {
    err.errors = errors
  } else if (errors && typeof errors === "object") {
    err.errors = errors
  }
  return err
}

export function notFoundError(resource, id) {
  const suffix = id != null && String(id).length > 0 ? ` (${id})` : ""
  return createError(404, `${resource} not found${suffix}`)
}

export function genericError(message) {
  return createError(500, message || "Internal server error")
}

export function sequelizeValidationError(sequelizeErrors) {
  const fieldErrors = {}
  for (const item of sequelizeErrors ?? []) {
    const key = item.path || item.validatorKey || "field"
    if (!fieldErrors[key]) {
      fieldErrors[key] = []
    }
    fieldErrors[key].push(item.message || "Invalid value")
  }
  return validationError(fieldErrors)
}

export function missingFieldsValidationError(fields) {
  const list = Array.isArray(fields) ? fields : [fields]
  const fieldErrors = {}
  for (const name of list) {
    const key = String(name).toLowerCase()
    fieldErrors[key] = [`${name} is required`]
  }
  return validationError(fieldErrors)
}

export function conflictError(errors) {
  const err = createError(409, "Conflict")
  if (errors && typeof errors === "object") {
    err.errors = errors
  }
  return err
}

export function mapSequelizeError(error, handlers = {}) {
  if (error?.name === "SequelizeValidationError") {
    return sequelizeValidationError(error.errors)
  }
  if (error?.name === "SequelizeUniqueConstraintError" && handlers.onUnique) {
    return handlers.onUnique(error)
  }
  if (error?.name === "SequelizeForeignKeyConstraintError" && handlers.onForeignKey) {
    return handlers.onForeignKey(error)
  }
  return null
}

export function forwardControllerError(error, next, fallbackMessage, mapDbError = mapSequelizeError) {
  if (error && typeof error.status === "number") {
    next(error)
    return
  }
  const mapped = mapDbError(error)
  if (mapped) {
    next(mapped)
    return
  }
  next(genericError(fallbackMessage))
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidParam(id) {
  return typeof id === "string" && UUID_RE.test(id)
}

export function collectMissingStringFields(body, fieldLabels) {
  const raw = body && typeof body === "object" ? body : {}
  const missing = []
  for (const [key, label] of Object.entries(fieldLabels)) {
    const value = raw[key]
    if (!value || typeof value !== "string" || !value.trim()) {
      missing.push(label)
    }
  }
  return missing
}
