const { ApiError } = require("../../../utils/api-error")

function requireOrganizerOrAdmin(req, res, next) {
    if (req.user?.isAdmin || req.user?.isOrganizer) {
        return next()
    }
    return next(
        ApiError.forbidden("Requer papel de organizador ou administrador.", "FORBIDDEN"),
    )
}

module.exports = { requireOrganizerOrAdmin }
