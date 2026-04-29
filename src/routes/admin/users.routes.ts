import { Router } from "express"
import {
  bloquearUtilizadorAdmin,
  desbloquearUtilizadorAdmin,
  listarUtilizadoresAdmin,
  obterUtilizadorAdminPorId
} from "../../controllers/users.controller.js"
import { requerAdmin } from "../../middlewares/requerAdmin.js"
import { requerAutenticacao } from "../../middlewares/requerAutenticacao.js"

export const rotasAdminUtilizadores = Router()

rotasAdminUtilizadores.use(requerAutenticacao, requerAdmin)
rotasAdminUtilizadores.get("/admin/users", listarUtilizadoresAdmin)
rotasAdminUtilizadores.get("/admin/users/:id", obterUtilizadorAdminPorId)
rotasAdminUtilizadores.patch("/admin/users/:id/block", bloquearUtilizadorAdmin)
rotasAdminUtilizadores.patch("/admin/users/:id/unblock", desbloquearUtilizadorAdmin)
