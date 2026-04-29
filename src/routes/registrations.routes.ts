import { Router } from "express"
import { atualizarInscricao } from "../controllers/registrations.controller.js"

export const rotasInscricoes = Router()

rotasInscricoes.patch("/registrations/:id", atualizarInscricao)
