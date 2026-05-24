import express from "express"
import { getAllBeaches, getBeachById, createBeach, updateBeach, deleteBeach } from "../controllers/beaches.controller.js"
import { verifyToken } from "../middlewares/auth.middleware.js"

const router = express.Router()

router.use(verifyToken)

// Permito registo a qualquer autenticado; valido edição/apagar no controller
router.get("/", getAllBeaches)
router.get("/:id", getBeachById)
router.post("/", createBeach)
router.put("/:id", updateBeach)
router.delete("/:id", deleteBeach)

export default router
