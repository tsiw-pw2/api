class ApiError extends Error {
    constructor(statusCode, { description, code, errors, blocked_reason: blockedReason } = {}) {
        super(description || code || "Error")
        this.statusCode = statusCode
        this.description = description
        this.code = code
        this.errors = errors
        this.blocked_reason = blockedReason
    }

    static badRequest(description, errors) {
        return new ApiError(400, { description, code: "VALIDATION_ERROR", errors })
    }

    static unauthorized(code = "UNAUTHORIZED") {
        return new ApiError(401, { description: "Token em falta ou inválido.", code })
    }

    static forbidden(description, code = "FORBIDDEN") {
        return new ApiError(403, { description, code })
    }

    static notFound(description, code = "NOT_FOUND") {
        return new ApiError(404, { description, code })
    }

    static conflict(description, code) {
        return new ApiError(409, { description, code })
    }

    static unprocessableEntity(description, code) {
        return new ApiError(422, { description, code })
    }

    static fromZod(zodError) {
        const errors = {}
        for (const issue of zodError.issues) {
            const path = issue.path.join(".") || "_root"
            if (!errors[path]) errors[path] = []
            errors[path].push(issue.message)
        }
        return new ApiError(400, {
            description: "Falha na validação.",
            code: "VALIDATION_ERROR",
            errors,
        })
    }
}

module.exports = { ApiError }
