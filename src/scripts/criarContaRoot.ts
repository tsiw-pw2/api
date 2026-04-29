import "dotenv/config"
import bcrypt from "bcryptjs"
import { sequelize, User } from "../models/index.js"

async function main() {
  const email = (process.env.ROOT_EMAIL ?? "").trim().toLowerCase()
  const password = process.env.ROOT_PASSWORD ?? ""
  const nome = process.env.ROOT_NAME ?? "Root"

  if (!email || !password) {
    console.error("Faltam variáveis de ambiente ROOT_EMAIL e/ou ROOT_PASSWORD.")
    process.exit(1)
  }

  await sequelize.authenticate()

  const passwordHash = await bcrypt.hash(password, 12)

  const [utilizador, foiCriado] = await User.findOrCreate({
    where: { email },
    defaults: {
      name: nome,
      email,
      passwordHash,
      isAdmin: true,
      isOrganizer: true,
      isBlocked: false,
      createdAt: new Date(),
      birthDate: null,
      phone: null,
      blockedReason: null,
      blockedAt: null
    }
  })

  if (!foiCriado) {
    await utilizador.update({
      name: nome,
      passwordHash,
      isAdmin: true,
      isOrganizer: true,
      isBlocked: false,
      blockedReason: null,
      blockedAt: null
    })
  }

  console.log(
    JSON.stringify(
      {
        id: utilizador.id,
        email: utilizador.email,
        nome: utilizador.name,
        is_admin: utilizador.isAdmin,
        is_organizer: utilizador.isOrganizer,
        criado: foiCriado
      },
      null,
      2
    )
  )

  await sequelize.close()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await sequelize.close()
  } catch {
    // ignore
  }
  process.exit(1)
})

