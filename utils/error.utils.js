// Alinhado com example/utils/error.utils.js (+ códigos REST no handler global)

// Converte erros de validação do Sequelize num erro HTTP 400 estruturado.
export const sequelizeValidationError = (errors) => {
  const err = new Error("Validation failed")
  err.status = 400
  err.errors = (errors ?? []).reduce((acc, item) => {
    const key = item.path || item.validatorKey || "field"
    if (!acc[key]) acc[key] = []
    acc[key].push(item.message || "Invalid value")
    return acc
  }, {})
  return err
}

// Cria erro 400 com lista de campos obrigatórios em falta.
export const missingFieldsValidationError = (missingFields) => {
  const err = new Error("Missing required fields")
  err.status = 400
  err.errors = {}
  for (const field of missingFields) {
    const key = String(field).toLowerCase()
    err.errors[key] = [`${field} is required`]
  }
  return err
}

// Cria erro 400 de validação a partir de array ou objeto de erros.
export const validationError = (errors) => {
  const err = new Error("Validation failed")
  err.status = 400
  if (Array.isArray(errors)) {
    err.errors = errors
  } else if (errors && typeof errors === "object") {
    err.errors = errors
  }
  return err
}

// Cria erro 404 quando o recurso com o ID indicado não existe.
export const notFoundError = (resource, id) => {
  const key = String(resource).toLowerCase()
  const err = new Error("Resource not found")
  err.status = 404
  err.errors = {
    [key]: `Resource ${key} with ID ${id} not found`
  }
  return err
}

// Cria erro 500 com mensagem personalizada ou genérica.
export const genericError = (message = "Internal Server Error") => {
  const err = new Error(message)
  err.status = 500
  return err
}

// Cria erro 409 de conflito com mensagem ou detalhes de erros.
export const conflictError = (messageOrErrors) => {
  const err = new Error(
    typeof messageOrErrors === "string" ? messageOrErrors : "Conflict"
  )
  err.status = 409
  if (messageOrErrors && typeof messageOrErrors === "object") {
    err.errors = messageOrErrors
  }
  return err
}

// Cria erro HTTP com código de estado e mensagem arbitrários.
export const createError = (status, message) => {
  const err = new Error(message)
  err.status = status
  return err
}

// Mapeia erros Sequelize para erros da API, com handlers opcionais.
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

// Encaminha erros do controlador para o middleware, mapeando erros da BD.
export function handleControllerError(error, next, fallbackMessage, mapDbError) {
  if (error && typeof error.status === "number") {
    next(error)
    return
  }
  if (typeof mapDbError === "function") {
    const mapped = mapDbError(error)
    if (mapped) {
      next(mapped)
      return
    }
  }
  if (error?.name === "SequelizeValidationError") {
    next(sequelizeValidationError(error.errors))
    return
  }
  next(genericError(fallbackMessage))
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Verifica se o parâmetro é um UUID v4 válido.
export function isUuidParam(id) {
  return typeof id === "string" && UUID_RE.test(id)
}

// Recolhe etiquetas de campos de texto obrigatórios em falta no corpo do pedido.
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
