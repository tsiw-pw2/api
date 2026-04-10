function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
    const rawLimit = Number.parseInt(query.limit, 10) || defaultLimit
    const limit = Math.min(maxLimit, Math.max(1, rawLimit))
    const offset = (page - 1) * limit
    return { page, limit, offset }
}

module.exports = { parsePagination }
