import { sequelize } from "../../models/sequelize.js"

const TABLES = [
  "refresh_token",
  "recolha_residuo",
  "comentario",
  "inscricao",
  "campanha_praia",
  "campanha",
  "praia",
  "localizacao_praia",
  "residuo",
  "tipo_residuo",
  "utilizador"
]

/** Apaga todos os dados das tabelas da aplicação (mantém o esquema). */
export async function clearDatabase() {
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0")
  try {
    for (const table of TABLES) {
      await sequelize.query(`TRUNCATE TABLE \`${table}\``)
    }
  } finally {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1")
  }
}
