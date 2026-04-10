const { ApiError } = require("../utils/api-error")

function requireAdmin(req, res, next) {
    if (!req.user?.isAdmin) {
        return next(
            ApiError.forbidden("Acesso reservado a administradores.", "ADMIN_REQUIRED"),
        )
    }
    next()
}

module.exports = { requireAdmin }
