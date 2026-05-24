const TABLES_TRUNCATE = [
  "recolha_residuo",
  "comentario",
  "inscricao",
  "campanha_praia",
  "campanha",
  "praia",
  "localizacao_praia",
  "residuo",
  "tipo_residuo",
  "refresh_token",
  "utilizador",
]

export async function clearDatabase(sequelize) {
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0")
  for (const table of TABLES_TRUNCATE) {
    await sequelize.query(`TRUNCATE TABLE \`${table}\``)
  }
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 1")
}
