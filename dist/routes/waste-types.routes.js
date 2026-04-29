import { Router } from "express";
import { atualizarTipoDeResiduo, criarTipoDeResiduo, listarTiposDeResiduo } from "../controllers/waste-types.controller.js";
export const rotasTiposDeResiduo = Router();
rotasTiposDeResiduo.get("/waste-types", listarTiposDeResiduo);
rotasTiposDeResiduo.post("/waste-types", criarTipoDeResiduo);
rotasTiposDeResiduo.patch("/waste-types/:id", atualizarTipoDeResiduo);
