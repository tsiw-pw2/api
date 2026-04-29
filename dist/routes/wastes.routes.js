import { Router } from "express";
import { atualizarResiduo, criarResiduo, listarResiduos } from "../controllers/wastes.controller.js";
export const rotasResiduos = Router();
rotasResiduos.get("/wastes", listarResiduos);
rotasResiduos.post("/wastes", criarResiduo);
rotasResiduos.patch("/wastes/:id", atualizarResiduo);
