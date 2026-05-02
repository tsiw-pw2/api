import { Sequelize } from "sequelize"

const dbConfig = {
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "root",
  database: process.env.DB_NAME ?? "my_db",
  dialect: "mysql",
  pool: {
    max: Number(process.env.DB_POOL_MAX ?? 3),
    min: Number(process.env.DB_POOL_MIN ?? 0),
    acquire: Number(process.env.DB_POOL_ACQUIRE ?? 30000),
    idle: Number(process.env.DB_POOL_IDLE ?? 10000)
  }
}

const logging =
  process.env.DB_LOG_SQL === "1" ? (sql) => console.log(sql) : false

export const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.user,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool,
    logging
  }
)

export { Sequelize }

const db = {
  sequelize,
  Sequelize
}

export default db
