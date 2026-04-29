import { Router } from "express";
import { autenticar, renovarToken, terminarSessao } from "../controllers/auth.controller.js";
export const rotasAuth = Router();
rotasAuth.post("/auth/login", autenticar);
rotasAuth.post("/auth/refresh", renovarToken);
rotasAuth.post("/auth/logout", terminarSessao);
