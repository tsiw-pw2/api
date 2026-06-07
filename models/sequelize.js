// Instância Sequelize isolada: os modelos importam só daqui para evitar dependência circular com db.config.js.
import { Sequelize } from "sequelize"

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    dialect: process.env.DB_DIALECT ?? "mysql",
    logging: process.env.DB_LOG_SQL === "1" ? (sql) => console.log(sql) : false
  }
)
