const { ApiError } = require("../utils/api-error")

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err)
    }
    if (err instanceof ApiError) {
        const body = {}
        if (err.description) body.description = err.description
        if (err.code) body.code = err.code
        if (err.errors) body.errors = err.errors
        if (err.blocked_reason) body.blocked_reason = err.blocked_reason
        return res.status(err.statusCode).json(body)
    }
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
        return res.status(401).json({ description: "Token em falta ou inválido.", code: "UNAUTHORIZED" })
    }
    console.error(err)
    return res.status(500).json({ description: "Erro interno.", code: "INTERNAL_ERROR" })
}

module.exports = { errorHandler }
