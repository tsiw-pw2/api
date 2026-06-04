// Utilitários de erro alinhados com os slides PW II

function createErrorFromOptions({ status, description, errors }) {
  const error = new Error(description)
  error.status = status
  if (errors !== undefined) {
    error.errors = errors
  }
  return error
}

// Criar erro HTTP (objecto dos slides ou assinatura legada status + mensagem)
export function createError(statusOrOptions, legacyMessage) {
  if (typeof statusOrOptions === "object" && statusOrOptions !== null) {
    return createErrorFromOptions(statusOrOptions)
  }
  const error = new Error(legacyMessage ?? "Error")
  error.status = statusOrOptions
  return error
}

// Converter erros de validação do Sequelize para formato 400
export function sequelizeValidationError(errors) {
  return validationError(
    (errors ?? []).reduce((acc, item) => {
      const key = item.path || item.validatorKey || "field"
      if (!acc[key]) acc[key] = []
      acc[key].push(item.message || "Invalid value")
      return acc
    }, {})
  )
}

// Campos obrigatórios em falta no corpo do pedido
export function missingFieldsValidationError(missingFields) {
  const err = new Error("Missing required fields")
  err.status = 400
  err.errors = {}
  for (const field of missingFields) {
    const key = String(field).toLowerCase()
    err.errors[key] = [`${field} is required`]
  }
  return err
}

// Validação genérica (400)
export function validationError(errors) {
  return createErrorFromOptions({
    status: 400,
    description: "Validation failed",
    errors: Array.isArray(errors) ? errors : errors
  })
}

// Recurso não encontrado (404)
export function notFoundError(resource, id) {
  const key = String(resource).toLowerCase()
  return createErrorFromOptions({
    status: 404,
    description: "Resource not found",
    errors: {
      [key]: [`${resource} with ID ${id} not found`]
    }
  })
}

// Erro interno (500)
export function genericError(message = "Internal Server Error") {
  return createErrorFromOptions({
    status: 500,
    description: message,
    errors: null
  })
}

// Conflito (409)
export function conflictError(messageOrErrors) {
  const description =
    typeof messageOrErrors === "string" ? messageOrErrors : "Conflict"
  const err = createErrorFromOptions({ status: 409, description })
  if (messageOrErrors && typeof messageOrErrors === "object") {
    err.errors = messageOrErrors
  }
  return err
}

// Mapear erros Sequelize para erros da API
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Verificar se o parâmetro é um UUID v4 válido
export function isUuidParam(id) {
  return typeof id === "string" && UUID_RE.test(id)
}

// Recolher etiquetas de campos de texto obrigatórios em falta
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

// Encaminhar erro do controlador para next (substitui handleControllerError)
export function passControllerError(error, next, fallbackMessage, mapDbError) {
  if (error && typeof error.status === "number") {
    return next(error)
  }
  if (typeof mapDbError === "function") {
    const mapped = mapDbError(error)
    if (mapped) {
      return next(mapped)
    }
  }
  if (error?.name === "SequelizeValidationError") {
    return next(sequelizeValidationError(error.errors))
  }
  return next(genericError(fallbackMessage))
}
