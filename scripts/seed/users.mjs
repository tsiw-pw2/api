import bcrypt from "bcryptjs"
import { User } from "../../models/db.config.js"
import { EXTRA_VOLUNTEER_PROFILES } from "./pitch-data.mjs"
import { extraVolunteerId, IDS } from "./ids.mjs"

const BCRYPT_ROUNDS = 10

function buildExtraVolunteerRows(passwordHash, now) {
  return EXTRA_VOLUNTEER_PROFILES.map((profile, i) => {
    const n = i + 6
    return {
      id: extraVolunteerId(10 + i),
      name: profile.name,
      email: `voluntario${n}@demo.pt`,
      passwordHash,
      birthDate: profile.birthDate,
      phone: profile.phone,
      isAdmin: false,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    }
  })
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function seedUsers(passwordHash) {
  const now = new Date()

  await User.bulkCreate([
    {
      id: IDS.users.admin,
      name: "Ana Ribeiro",
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
      name: "Divisão de Ambiente  -  Câmara Municipal de Matosinhos",
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
      name: "Carla Santos",
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
      name: "Diogo Pereira",
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
    },
    {
      id: IDS.users.organizer2,
      name: "Divisão de Ambiente  -  Câmara Municipal de Espinho",
      email: "organizador2@demo.pt",
      passwordHash,
      birthDate: "1985-04-18",
      phone: "912000006",
      isAdmin: false,
      isOrganizer: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.volunteer3,
      name: "Inês Costa",
      email: "voluntario3@demo.pt",
      passwordHash,
      birthDate: "1999-02-14",
      phone: "912000007",
      isAdmin: false,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.volunteer4,
      name: "João Silva",
      email: "voluntario4@demo.pt",
      passwordHash,
      birthDate: "1997-08-30",
      phone: "912000008",
      isAdmin: false,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.volunteer5,
      name: "Sofia Mendes",
      email: "voluntario5@demo.pt",
      passwordHash,
      birthDate: "2001-06-22",
      phone: "912000009",
      isAdmin: false,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    },
    ...buildExtraVolunteerRows(passwordHash, now)
  ])
}

export function allVolunteerUserIds() {
  const ids = [
    IDS.users.volunteer1,
    IDS.users.volunteer2,
    IDS.users.volunteer3,
    IDS.users.volunteer4,
    IDS.users.volunteer5
  ]
  for (let i = 0; i < EXTRA_VOLUNTEER_PROFILES.length; i++) {
    ids.push(extraVolunteerId(10 + i))
  }
  return ids
}

export function volunteerUserIdByNumber(n) {
  if (n <= 5) {
    return [
      null,
      IDS.users.volunteer1,
      IDS.users.volunteer2,
      IDS.users.volunteer3,
      IDS.users.volunteer4,
      IDS.users.volunteer5
    ][n]
  }
  return extraVolunteerId(10 + (n - 6))
}
