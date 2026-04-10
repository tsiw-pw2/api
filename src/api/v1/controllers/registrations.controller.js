const { asyncHandler } = require("../../../utils/async-handler")
const schemas = require("../validators/schemas")
const { patchInscricao } = require("../services/inscricao.service")

const patchRegistration = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.patchRegistration, req.body)
    const data = await patchInscricao(req.params.id, req.user, body)
    res.json(data)
})

module.exports = { patchRegistration }
