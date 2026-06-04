const ROUTE_DEBUG_SEPARATOR = "-----"

// Indica se o registo de depuração de rotas HTTP está activo.
export function isHttpRouteDebugEnabled() {
  if (process.env.DEBUG_HTTP_ROUTES === "0") return false
  if (process.env.DEBUG_HTTP_ROUTES === "1") return true
  return process.env.NODE_ENV !== "production"
}

// Regista no terminal o início e fim de cada pedido HTTP quando a depuração está activa.
export function httpRouteDebugMiddleware(req, res, next) {
  if (!isHttpRouteDebugEnabled()) {
    next()
    return
  }

  const startedAt = Date.now()
  const method = req.method
  const path = req.originalUrl

  console.log(ROUTE_DEBUG_SEPARATOR)
  console.log(`[http] --> ${method} ${path}`)

  // Regista no terminal o código de estado e a duração quando a resposta termina.
  res.on("finish", () => {
    const ms = Date.now() - startedAt
    console.log(`[http] <-- ${method} ${path} ${res.statusCode} ${ms}ms`)
  })

  next()
}
