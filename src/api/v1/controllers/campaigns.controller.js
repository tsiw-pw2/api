const { asyncHandler } = require("../../../utils/async-handler")
const schemas = require("../validators/schemas")
const {
    listPublicCampaigns,
    getCampaignById,
    createCampaign,
    patchCampaign,
    syncCampaignBeaches,
    softDeleteCampaign,
    loadCampaignRow,
} = require("../services/campaign.service")
const { createInscricao, listInscricoesByCampaign } = require("../services/inscricao.service")
const { listComments, createComment } = require("../services/comentario.service")
const { upsertRecolha, listRecolhasByCampaign, softDeleteRecolha } = require("../services/recolha.service")
const { getPool } = require("../../../config/db")
const { ApiError } = require("../../../utils/api-error")

const getCampaigns = asyncHandler(async (req, res) => {
    const q = schemas.parse(schemas.campaignsQuery, req.query)
    const out = await listPublicCampaigns(q)
    res.json(out)
})

const getCampaign = asyncHandler(async (req, res) => {
    const data = await getCampaignById(req.params.id, { includeBeaches: true })
    res.json(data)
})

const postCampaign = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.createCampaign, req.body)
    const created = await createCampaign(req.user.id, body)
    res.status(201).json(created)
})

const patchCampaignById = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.patchCampaign, req.body)
    const data = await patchCampaign(req.params.id, req.user, body)
    res.json(data)
})

const deleteCampaignById = asyncHandler(async (req, res) => {
    await softDeleteCampaign(req.params.id, req.user)
    res.status(204).end()
})

const putCampaignBeaches = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.putCampaignBeaches, req.body)
    const data = await syncCampaignBeaches(req.params.id, req.user, body.beach_ids)
    res.json(data)
})

const putRecolha = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.upsertRecolha, req.body)
    const data = await upsertRecolha(req.params.id, req.params.praiaId, req.user, body)
    res.json(data)
})

const listRegistrations = asyncHandler(async (req, res) => {
    const data = await listInscricoesByCampaign(req.params.id, req.user)
    res.json({ data })
})

const listRecolhas = asyncHandler(async (req, res) => {
    const data = await listRecolhasByCampaign(req.params.id, req.user)
    res.json({ data })
})

const postRegistration = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.postRegistration, req.body || {})
    if (body.funcao === 1) {
        const campanha = await loadCampaignRow(getPool(), req.params.id)
        if (
            !campanha ||
            (!req.user.isAdmin && campanha.organizador_id !== req.user.id)
        ) {
            throw ApiError.forbidden(
                "Apenas o organizador da campanha ou um administrador pode definir função de organizador.",
                "FORBIDDEN",
            )
        }
    }
    const data = await createInscricao(req.params.id, req.user, body)
    res.status(201).json(data)
})

const getCampaignComments = asyncHandler(async (req, res) => {
    const q = schemas.parse(schemas.paginationOnly, req.query)
    const data = await listComments(req.params.id, q)
    res.json(data)
})

const postCampaignComment = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.postComment, req.body)
    const data = await createComment(req.params.id, req.user.id, body.comentario)
    res.status(201).json(data)
})

const deleteRecolhaById = asyncHandler(async (req, res) => {
    await softDeleteRecolha(req.params.id, req.user)
    res.status(204).end()
})

module.exports = {
    getCampaigns,
    getCampaign,
    postCampaign,
    patchCampaignById,
    deleteCampaignById,
    putCampaignBeaches,
    putRecolha,
    listRegistrations,
    listRecolhas,
    postRegistration,
    getCampaignComments,
    postCampaignComment,
    deleteRecolhaById,
}
