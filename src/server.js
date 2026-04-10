require("dotenv").config()

const { sequelize } = require("./db/models")
const app = require("./app")

const PORT = process.env.PORT || 3000

sequelize
    .authenticate()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`)
        })
    })
    .catch((err) => {
        console.error("Database connection failed", err)
        process.exit(1)
    })
