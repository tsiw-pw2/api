import { Router } from "express"
import { atualizarVisibilidadeDoComentarioAdmin } from "../../controllers/comments.controller.js"
import { requerAdmin } from "../../middlewares/requerAdmin.js"
import { requerAutenticacao } from "../../middlewares/requerAutenticacao.js"

export const rotasAdminComentarios = Router()

rotasAdminComentarios.use(requerAutenticacao, requerAdmin)
rotasAdminComentarios.patch("/admin/comments/:id", atualizarVisibilidadeDoComentarioAdmin)
