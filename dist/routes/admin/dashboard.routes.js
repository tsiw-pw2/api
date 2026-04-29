import { Router } from "express";
import { obterDashboard } from "../../controllers/dashboard.controller.js";
import { requerAdmin } from "../../middlewares/requerAdmin.js";
import { requerAutenticacao } from "../../middlewares/requerAutenticacao.js";
export const rotasAdminDashboard = Router();
rotasAdminDashboard.use(requerAutenticacao, requerAdmin);
rotasAdminDashboard.get("/admin/dashboard", obterDashboard);
