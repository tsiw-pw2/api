import { Sequelize } from "sequelize";
import dbConfig from "./db.config.js";
const logging = process.env.DB_LOG_SQL === "1" ? (sql) => console.log(sql) : false;
export const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool,
    logging
});
export { Sequelize };
const db = {
    sequelize,
    Sequelize
};
export default db;
