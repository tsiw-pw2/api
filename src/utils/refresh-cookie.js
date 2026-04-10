const crypto = require("crypto")

const COOKIE_NAME = "refresh_token"
const REFRESH_DAYS = 7

function randomRefreshToken() {
    return crypto.randomBytes(48).toString("hex")
}

function hashRefreshToken(raw) {
    return crypto.createHash("sha256").update(raw).digest("hex")
}

function refreshCookieOptions() {
    const isProd = process.env.NODE_ENV === "production"
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: "strict",
        maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
        path: "/api/v1/auth",
    }
}

module.exports = {
    COOKIE_NAME,
    REFRESH_DAYS,
    randomRefreshToken,
    hashRefreshToken,
    refreshCookieOptions,
}
