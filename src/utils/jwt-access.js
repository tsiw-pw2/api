const jwt = require("jsonwebtoken")

const ACCESS_TTL_SEC = 15 * 60

function signAccessToken(payload) {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error("JWT_SECRET is not set")
    return jwt.sign(
        {
            userId: payload.userId,
            tokenVersion: payload.tokenVersion,
            isAdmin: payload.isAdmin ? 1 : 0,
            isOrganizer: payload.isOrganizer ? 1 : 0,
        },
        secret,
        { algorithm: "HS256", expiresIn: ACCESS_TTL_SEC },
    )
}

function verifyAccessToken(token) {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error("JWT_SECRET is not set")
    return jwt.verify(token, secret, { algorithms: ["HS256"] })
}

module.exports = { signAccessToken, verifyAccessToken, ACCESS_TTL_SEC }
