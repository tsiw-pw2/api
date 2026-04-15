export type DbPoolConfig = {
  max: number
  min: number
  acquire: number
  idle: number
}

export type DbConfig = {
  host: string
  user: string
  password: string
  database: string
  dialect: "mysql"
  pool: DbPoolConfig
}

const config: DbConfig = {
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

export default config
