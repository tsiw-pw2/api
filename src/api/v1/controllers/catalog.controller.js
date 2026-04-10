const { asyncHandler } = require("../../../utils/async-handler")
const schemas = require("../validators/schemas")
const {
    listTipos,
    listResiduos,
    createTipo,
    createResiduo,
    patchTipo,
    patchResiduo,
} = require("../services/residuo.service")

const getWasteTypes = asyncHandler(async (req, res) => {
    const q = schemas.parse(schemas.paginationOnly, req.query)
    const data = await listTipos(q)
    res.json(data)
})

const getWastes = asyncHandler(async (req, res) => {
    const q = schemas.parse(schemas.wastesQuery, req.query)
    const data = await listResiduos(q)
    res.json(data)
})

const postWasteType = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.postTipoResiduo, req.body)
    const data = await createTipo(body)
    res.status(201).json(data)
})

const postWaste = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.postResiduo, req.body)
    const data = await createResiduo(body)
    res.status(201).json(data)
})

const patchWasteType = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.patchTipoResiduo, req.body)
    const data = await patchTipo(req.params.id, body)
    res.json(data)
})

const patchWaste = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.patchResiduo, req.body)
    const data = await patchResiduo(req.params.id, body)
    res.json(data)
})

module.exports = {
    getWasteTypes,
    getWastes,
    postWasteType,
    postWaste,
    patchWasteType,
    patchWaste,
}
