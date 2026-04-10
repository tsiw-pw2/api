const { Sequelize } = require("sequelize")

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",
    logging: process.env.DB_LOG_SQL === "1" ? console.log : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    define: {
        freezeTableName: true,
        charset: "utf8mb4",
        collate: "utf8mb4_unicode_ci",
    },
})

module.exports = { sequelize }
