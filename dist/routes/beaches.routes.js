import { Router } from "express";
import { listarPraias, obterPraiaPorId } from "../controllers/beaches.controller.js";
export const rotasPraias = Router();
rotasPraias.get("/beaches", listarPraias);
rotasPraias.get("/beaches/:id", obterPraiaPorId);
