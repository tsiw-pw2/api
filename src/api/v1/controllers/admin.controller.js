const { asyncHandler } = require("../../../utils/async-handler")
const schemas = require("../validators/schemas")
const { dashboard, listUsers, getUserAdmin, blockUser, unblockUser} = require("../services/admin.service")
const { createLocation, createBeach, patchAdminBeach } = require("../services/beach.service")
const { patchAdminComment } = require("../services/comentario.service")

const getDashboard = asyncHandler(async (req, res) => {
    const q = schemas.parse(schemas.adminDashboardQuery, req.query)
    const data = await dashboard(q)
    res.json(data)
})

const getAdminUsers = asyncHandler(async (req, res) => {
    const q = schemas.parse(schemas.adminUsersQuery, req.query)
    const data = await listUsers(q)
    res.json(data)
})

const getAdminUser = asyncHandler(async (req, res) => {
    const data = await getUserAdmin(req.params.id)
    res.json(data)
})

const patchBlockUser = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.blockUser, req.body)
    const data = await blockUser(req.params.id, req.user.id, body.blocked_reason)
    res.json(data)
})

const patchUnblockUser = asyncHandler(async (req, res) => {
    const data = await unblockUser(req.params.id)
    res.json(data)
})

const postAdminLocation = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.postLocation, req.body)
    const data = await createLocation(body)
    res.status(201).json(data)
})

const postAdminBeach = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.postAdminBeach, req.body)
    const data = await createBeach(req.user.id, body)
    res.status(201).json(data)
})

const patchAdminBeachById = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.patchAdminBeach, req.body)
    const data = await patchAdminBeach(req.params.id, body)
    res.json(data)
})

const patchAdminCommentById = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.patchAdminComment, req.body)
    const data = await patchAdminComment(req.params.id, body.is_visible)
    res.json(data)
})

module.exports = {
    getDashboard,
    getAdminUsers,
    getAdminUser,
    patchBlockUser,
    patchUnblockUser,
    postAdminLocation,
    postAdminBeach,
    patchAdminBeachById,
    patchAdminCommentById,
}
