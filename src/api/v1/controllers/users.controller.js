const { asyncHandler } = require("../../../utils/async-handler")
const { registerUser, getUserById, updateUserProfile } = require("../services/user.service")
const schemas = require("../validators/schemas")
const { fmtDateTime } = require("../services/campaign.service")

const postUsers = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.registerUser, req.body)
    const u = await registerUser({
        nome: body.nome,
        email: body.email,
        password: body.password,
        data_nascimento: body.data_nascimento,
        telefone: body.telefone,
    })
    res.status(201).json({
        id: u.id,
        nome: u.nome,
        email: u.email,
        links: { login: { href: "/api/v1/auth/login" } },
    })
})

const getMe = asyncHandler(async (req, res) => {
    const row = await getUserById(req.user.id)
    const data = {
        ...row,
        created_at: row.created_at ? fmtDateTime(row.created_at) : null,
        updated_at: row.updated_at ? fmtDateTime(row.updated_at) : null,
    }
    res.json(data)
})

const patchMe = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.patchMe, req.body)
    const row = await updateUserProfile(req.user.id, body)
    const data = {
        ...row,
        created_at: row.created_at ? fmtDateTime(row.created_at) : null,
        updated_at: row.updated_at ? fmtDateTime(row.updated_at) : null,
    }
    res.json(data)
})

module.exports = { postUsers, getMe, patchMe }
