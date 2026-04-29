import { Router } from "express";
import { apagarComentario } from "../controllers/comments.controller.js";
export const rotasComentarios = Router();
rotasComentarios.delete("/comments/:id", apagarComentario);
