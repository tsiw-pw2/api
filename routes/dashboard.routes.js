import express from "express"
import { getDashboard } from "../controllers/dashboard.controller.js"
import { verifyToken } from "../middlewares/auth.middlewares.js"

const router = express.Router()

// Montagem: verifyToken em todas as rotas; capability dashboard validada no controlador.
// GET /overview (canónico) e GET / (alias) devolvem o mesmo recurso.

router.use(verifyToken)
router.get("/overview", getDashboard)
router.get("/", getDashboard)

export default router
