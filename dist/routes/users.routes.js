import { Router } from "express";
import { atualizarPerfil, criarUtilizador, obterPerfil } from "../controllers/users.controller.js";
export const rotasUtilizadores = Router();
rotasUtilizadores.post("/users", criarUtilizador);
rotasUtilizadores.get("/users/me", obterPerfil);
rotasUtilizadores.patch("/users/me", atualizarPerfil);
