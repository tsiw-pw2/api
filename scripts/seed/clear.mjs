const TABLES = [
  "refresh_token",
  "recolha_residuo",
  "comentario",
  "inscricao",
  "campanha_praia",
  "campanha",
  "residuo",
  "tipo_residuo",
  "praia",
  "localizacao_praia",
  "utilizador",
]

export async function clearDatabase(sequelize) {
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0")
  for (const table of TABLES) {
    await sequelize.query(`TRUNCATE TABLE \`${table}\``)
  }
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 1")
}
