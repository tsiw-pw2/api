import { API_ROOT, hateoasLink } from "../utils/hateoas.utils.js"

const JSON_MEDIA = "application/json"

// Monta o corpo JSON de erro REST com ligação HATEOAS para a raiz da API.
function errorJson(status, description, errors) {
  return {
    description,
    error_description: description,
    ...(errors ? { errors } : {}),
    _links: { api: hateoasLink(API_ROOT, "GET", "api") }
  }
}

// Exige negociação JSON (Accept e Content-Type) em pedidos REST, excepto OPTIONS e multipart.
export function requireJsonRestNegotiation(req, res, next) {
  if (req.method === "OPTIONS") {
    next()
    return
  }

  const accept = req.headers.accept ?? ""
  if (accept && !accept.includes("*/*") && !accept.includes(JSON_MEDIA)) {
    res.status(406).json(
      errorJson(406, "Not Acceptable", { accept: [`${JSON_MEDIA} required`] })
    )
    return
  }

  if (["POST", "PATCH"].includes(req.method)) {
    const contentType = req.headers["content-type"] ?? ""
    if (!contentType.includes("multipart/form-data") && !contentType.includes(JSON_MEDIA)) {
      res.status(415).json(
        errorJson(415, "Unsupported Media Type", {
          "content-type": [`${JSON_MEDIA} required`]
        })
      )
      return
    }
  }

  next()
}
