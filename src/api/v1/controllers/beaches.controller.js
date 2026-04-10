const { asyncHandler } = require("../../../utils/async-handler")
const schemas = require("../validators/schemas")
const { listBeaches, getBeachById } = require("../services/beach.service")

const getBeaches = asyncHandler(async (req, res) => {
    const q = schemas.parse(schemas.beachesQuery, req.query)
    const data = await listBeaches(q)
    res.json(data)
})

const getBeach = asyncHandler(async (req, res) => {
    const data = await getBeachById(req.params.id)
    res.json(data)
})

module.exports = { getBeaches, getBeach }
