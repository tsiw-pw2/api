const { asyncHandler } = require("../../../utils/async-handler")
const { login, refresh, logout } = require("../services/auth.service")
const schemas = require("../validators/schemas")
const { COOKIE_NAME, refreshCookieOptions } = require("../../../utils/refresh-cookie")
const { ApiError } = require("../../../utils/api-error")

const postLogin = asyncHandler(async (req, res) => {
    const body = schemas.parse(schemas.login, req.body)
    const { accessToken, refreshRaw, expiresIn } = await login(body)
    res.cookie(COOKIE_NAME, refreshRaw, refreshCookieOptions())
    res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
    })
})

const postRefresh = asyncHandler(async (req, res) => {
    const raw = req.cookies?.[COOKIE_NAME]
    if (!raw) {
        throw ApiError.unauthorized("INVALID_REFRESH_TOKEN")
    }
    const { accessToken, refreshRaw, expiresIn } = await refresh({ rawToken: raw })
    res.cookie(COOKIE_NAME, refreshRaw, refreshCookieOptions())
    res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
    })
})

const postLogout = asyncHandler(async (req, res) => {
    const raw = req.cookies?.[COOKIE_NAME] ?? null
    await logout({ rawToken: raw })
    res.clearCookie(COOKIE_NAME, {
        path: "/api/v1/auth",
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
    })
    res.status(204).end()
})

module.exports = { postLogin, postRefresh, postLogout }
