import { Router } from "express";
import { criarLocalizacao } from "../../controllers/locations.controller.js";
import { requerAdmin } from "../../middlewares/requerAdmin.js";
import { requerAutenticacao } from "../../middlewares/requerAutenticacao.js";
export const rotasAdminLocalizacoes = Router();
rotasAdminLocalizacoes.use(requerAutenticacao, requerAdmin);
rotasAdminLocalizacoes.post("/admin/locations", criarLocalizacao);
