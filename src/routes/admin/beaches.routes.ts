import { Router } from "express"
import { atualizarPraiaAdmin, criarPraiaAdmin } from "../../controllers/beaches.controller.js"
import { requerAdmin } from "../../middlewares/requerAdmin.js"
import { requerAutenticacao } from "../../middlewares/requerAutenticacao.js"

export const rotasAdminPraias = Router()

rotasAdminPraias.use(requerAutenticacao, requerAdmin)
rotasAdminPraias.post("/admin/beaches", criarPraiaAdmin)
rotasAdminPraias.patch("/admin/beaches/:id", atualizarPraiaAdmin)
