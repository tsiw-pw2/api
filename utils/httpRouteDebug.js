const ROUTE_DEBUG_SEPARATOR = "-----"

export function isHttpRouteDebugEnabled() {
  if (process.env.DEBUG_HTTP_ROUTES === "0") return false
  if (process.env.DEBUG_HTTP_ROUTES === "1") return true
  return process.env.NODE_ENV !== "production"
}

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

  res.on("finish", () => {
    const ms = Date.now() - startedAt
    console.log(`[http] <-- ${method} ${path} ${res.statusCode} ${ms}ms`)
  })

  next()
}
