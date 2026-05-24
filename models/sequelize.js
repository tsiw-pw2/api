import "dotenv/config"
import { Sequelize } from "sequelize"
import { env } from "../env.js"

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: env.db.dialect,
  logging: env.db.logSql ? (sql) => console.log(sql) : false
})
