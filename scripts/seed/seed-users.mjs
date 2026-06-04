import bcrypt from "bcryptjs"
import { User } from "../../models/db.config.js"
import { IDS } from "./ids.mjs"

const BCRYPT_ROUNDS = 10

export async function seedUsers(passwordHash) {
  const now = new Date()
  const rows = [
    {
      id: IDS.users.admin,
      name: "Ana Administradora",
      email: "admin@demo.pt",
      passwordHash,
      birthDate: "1988-03-12",
      phone: "912000001",
      isAdmin: true,
      isOrganizer: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.organizer,
      name: "Bruno Organizador",
      email: "organizador@demo.pt",
      passwordHash,
      birthDate: "1992-07-20",
      phone: "912000002",
      isAdmin: false,
      isOrganizer: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.volunteer1,
      name: "Carla Voluntária",
      email: "voluntario1@demo.pt",
      passwordHash,
      birthDate: "2000-01-15",
      phone: "912000003",
      isAdmin: false,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.volunteer2,
      name: "Diogo Voluntário",
      email: "voluntario2@demo.pt",
      passwordHash,
      birthDate: "1998-11-03",
      phone: "912000004",
      isAdmin: false,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.blocked,
      name: "Eva Bloqueada",
      email: "bloqueado@demo.pt",
      passwordHash,
      birthDate: "1995-05-05",
      phone: "912000005",
      isAdmin: false,
      isOrganizer: false,
      isBlocked: true,
      blockedReason: "Conta de demonstração bloqueada",
      blockedAt: now,
      createdAt: now,
      updatedAt: now
    }
  ]

  await User.bulkCreate(rows)
  return rows
}

export async function hashSeedPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}
