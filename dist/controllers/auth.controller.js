import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
export async function autenticar(_req, _res) {
    const body = (_req.body ?? {});
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
        _res.status(400).json({
            description: "Falha na validação do corpo.",
            errors: {
                ...(email ? {} : { email: ["O email é obrigatório."] }),
                ...(password ? {} : { password: ["A palavra-passe é obrigatória."] })
            }
        });
        return;
    }
    const utilizador = await User.findOne({ where: { email } });
    const credenciaisValidas = utilizador ? await bcrypt.compare(password, utilizador.passwordHash) : false;
    if (!utilizador || !credenciaisValidas) {
        _res.status(401).json({
            description: "Email ou palavra-passe incorretos.",
            code: "INVALID_CREDENTIALS"
        });
        return;
    }
    if (utilizador.isBlocked) {
        _res.status(403).json({
            description: "Conta bloqueada.",
            code: "ACCOUNT_BLOCKED",
            blocked_reason: utilizador.blockedReason ?? null
        });
        return;
    }
    const secret = process.env.JWT_SECRET ?? "dev-jwt-secret";
    const expiresInSeconds = Number(process.env.JWT_ACCESS_EXPIRES_IN ?? 3600);
    const payload = {
        sub: utilizador.id,
        email: utilizador.email,
        nome: utilizador.name,
        is_admin: utilizador.isAdmin,
        is_organizer: utilizador.isOrganizer
    };
    const access_token = jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
    const refresh_token = jwt.sign({ sub: utilizador.id }, secret, { expiresIn: "7d" });
    _res.json({
        access_token,
        refresh_token,
        token_type: "Bearer",
        expires_in: expiresInSeconds
    });
    return;
}
export async function renovarToken(_req, _res) {
    _res.status(501).json({ description: "Não implementado.", code: "NOT_IMPLEMENTED" });
    return;
}
export async function terminarSessao(_req, _res) {
    _res.status(204).end();
    return;
}
