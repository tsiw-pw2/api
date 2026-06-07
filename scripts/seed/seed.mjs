import bcrypt from "bcryptjs"
import { Beach, BeachLocation, Campaign, CampaignBeach, Comment, Registration, User, Waste, WasteType } from "../../models/db.config.js"
import { addDays } from "./dates.mjs"
import { IDS } from "./ids.mjs"

const BCRYPT_ROUNDS = 10

const CORE_ACCOUNTS = [
  { email: "admin@demo.pt", role: "Administrador" },
  { email: "organizador@demo.pt", role: "Organizador" },
  { email: "voluntario1@demo.pt", role: "Voluntário" },
  { email: "voluntario2@demo.pt", role: "Voluntário" },
  { email: "bloqueado@demo.pt", role: "Bloqueado (login falha)" }
]

const EXTRA_ACCOUNTS = [
  { email: "organizador2@demo.pt", role: "Organizador" },
  { email: "voluntario3@demo.pt", role: "Voluntário" },
  { email: "voluntario4@demo.pt", role: "Voluntário" },
  { email: "voluntario5@demo.pt", role: "Voluntário" },
  ...Array.from({ length: 10 }, (_, i) => ({
    email: `voluntario${i + 6}@demo.pt`,
    role: "Voluntário"
  }))
]

const EXTRA_VOLUNTEER_PROFILES = [
  { name: "Filipa Nunes", birthDate: "1996-03-08" },
  { name: "Gonçalo Ribeiro", birthDate: "1997-11-21" },
  { name: "Helena Castro", birthDate: "1998-05-14" },
  { name: "Laura Duarte", birthDate: "1999-09-02" },
  { name: "Mário Henriques", birthDate: "2000-12-30" },
  { name: "Natália Freitas", birthDate: "2001-04-17" },
  { name: "Paula Gomes", birthDate: "1996-07-25" },
  { name: "Ricardo Lopes", birthDate: "1998-01-09" },
  { name: "Teresa Machado", birthDate: "1999-10-11" },
  { name: "Ulisses Costa", birthDate: "2002-02-28" }
]

function extraVolunteerId(seq) {
  return `10000000-0000-4000-8000-${String(seq).padStart(12, "0")}`
}

function buildExtraVolunteerRows(passwordHash, now) {
  return EXTRA_VOLUNTEER_PROFILES.map((profile, i) => {
    const n = i + 6
    return {
      id: extraVolunteerId(10 + i),
      name: profile.name,
      email: `voluntario${n}@demo.pt`,
      passwordHash,
      birthDate: profile.birthDate,
      phone: `912000${String(n + 4).padStart(3, "0")}`,
      isAdmin: false,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    }
  })
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

async function seedUsers(passwordHash) {
  const now = new Date()

  await User.bulkCreate([
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
    },
    {
      id: IDS.users.organizer2,
      name: "Mariana Sousa",
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

async function seedCatalog() {
  const now = new Date()

  await BeachLocation.bulkCreate([
    {
      id: IDS.beachLocations.espinho,
      district: "Aveiro",
      municipality: "Espinho",
      parish: "Espinho",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beachLocations.vilaCha,
      district: "Porto",
      municipality: "Vila do Conde",
      parish: "Vila do Conde",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    }
  ])

  await Beach.bulkCreate([
    {
      id: IDS.beaches.praiaEspinho,
      beachLocationId: IDS.beachLocations.espinho,
      createdByUserId: IDS.users.organizer,
      name: "Praia de Espinho",
      latitude: 41.0052,
      longitude: -8.6419,
      description: "Praia urbana com grande afluência no verão.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaVilaCha,
      beachLocationId: IDS.beachLocations.vilaCha,
      createdByUserId: IDS.users.admin,
      name: "Praia da Azurara",
      latitude: 41.3501,
      longitude: -8.7462,
      description: "Zona norte, ideal para campanhas de fim de semana.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaAzurara,
      beachLocationId: IDS.beachLocations.vilaCha,
      createdByUserId: IDS.users.organizer,
      name: "Praia da Codicheira",
      latitude: 41.3628,
      longitude: -8.7521,
      description: "Praia mais calma, boa para famílias.",
      createdAt: now,
      updatedAt: now
    }
  ])

  await WasteType.bulkCreate([
    { id: IDS.wasteTypes.plastic, name: "Plástico", createdAt: now, updatedAt: now },
    { id: IDS.wasteTypes.glass, name: "Vidro", createdAt: now, updatedAt: now },
    { id: IDS.wasteTypes.metal, name: "Metal", createdAt: now, updatedAt: now }
  ])

  await Waste.bulkCreate([
    {
      id: IDS.wastes.bottlePet,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Garrafa PET",
      unit: "unit",
      averageWeightGrams: 25,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.capPlastic,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Tampa de plástico",
      unit: "unit",
      averageWeightGrams: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.glassBottle,
      wasteTypeId: IDS.wasteTypes.glass,
      name: "Garrafa de vidro",
      unit: "unit",
      averageWeightGrams: 350,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.canAluminium,
      wasteTypeId: IDS.wasteTypes.metal,
      name: "Lata de alumínio",
      unit: "unit",
      averageWeightGrams: 15,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.fishingNet,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Rede de pesca (fragmento)",
      unit: "kg",
      averageWeightGrams: null,
      createdAt: now,
      updatedAt: now
    }
  ])
}

async function seedCampaigns() {
  const now = new Date()
  const in14 = addDays(new Date(), 14)
  const in21 = addDays(new Date(), 21)
  const in18 = addDays(new Date(), 18)
  const in35 = addDays(new Date(), 35)
  const minus30 = addDays(new Date(), -30)
  const minus25 = addDays(new Date(), -25)
  const minus3 = addDays(new Date(), -3)
  const plus3 = addDays(new Date(), 3)

  await Campaign.bulkCreate([
    {
      id: IDS.campaigns.planned,
      title: "Limpeza Outono - Planeada",
      description: "Campanha ainda sem inscrições abertas.",
      meetingLocation: "Parque de estacionamento principal",
      meetingTime: "09:00:00",
      startDate: in21,
      endDate: in21,
      status: 0,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.open,
      title: "Limpeza Espinho - Inscrições abertas",
      description: "Junta-te como voluntário. Vagas limitadas.",
      meetingLocation: "Entrada principal da praia",
      meetingTime: "08:30:00",
      startDate: in14,
      endDate: in14,
      status: 1,
      organizerId: IDS.users.organizer,
      districtCode: "aveiro",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.closed,
      title: "Limpeza Matosinhos - Inscrições encerradas",
      description: "Vagas esgotadas; inscrições pendentes em revisão.",
      meetingLocation: "Passeio Marítimo de Matosinhos",
      meetingTime: "09:00:00",
      startDate: in18,
      endDate: in18,
      status: 2,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.inProgress,
      title: "Limpeza Norte - Em progresso",
      description: "Campanha activa neste fim de semana.",
      meetingLocation: "Miradouro da praia",
      meetingTime: "10:00:00",
      startDate: minus3,
      endDate: plus3,
      status: 3,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.completed,
      title: "Limpeza Primavera - Concluída",
      description: "Campanha concluída com dados para o dashboard.",
      meetingLocation: "Centro interpretativo",
      meetingTime: "09:30:00",
      startDate: minus30,
      endDate: minus25,
      status: 4,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.cancelled,
      title: "Limpeza Douro - Cancelada",
      description: "Cancelada por condições meteorológicas adversas.",
      meetingLocation: "Parque da Afurada",
      meetingTime: "08:00:00",
      startDate: in35,
      endDate: in35,
      status: 5,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.empty,
      title: "Campanha Vazia - Sem dados",
      description: "Só campanha e uma praia — tabs de voluntários, recolhas e comentários vazias.",
      meetingLocation: "A definir no dia",
      meetingTime: "09:00:00",
      startDate: in21,
      endDate: in21,
      status: 0,
      organizerId: IDS.users.organizer,
      districtCode: "aveiro",
      createdAt: now,
      updatedAt: now
    }
  ])

  await CampaignBeach.bulkCreate([
    { id: "70000000-0000-4000-8000-000000000001", campaignId: IDS.campaigns.open, beachId: IDS.beaches.praiaEspinho, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000002", campaignId: IDS.campaigns.closed, beachId: IDS.beaches.praiaVilaCha, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000003", campaignId: IDS.campaigns.inProgress, beachId: IDS.beaches.praiaVilaCha, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000004", campaignId: IDS.campaigns.inProgress, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000005", campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaVilaCha, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000006", campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000007", campaignId: IDS.campaigns.cancelled, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000008", campaignId: IDS.campaigns.empty, beachId: IDS.beaches.praiaEspinho, createdAt: now }
  ])

  await Registration.bulkCreate([
    { id: "80000000-0000-4000-8000-000000000001", campaignId: IDS.campaigns.open, userId: IDS.users.volunteer1, role: 0, status: 1, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000002", campaignId: IDS.campaigns.closed, userId: IDS.users.volunteer2, role: 0, status: 0, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000003", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer1, role: 0, status: 1, attendance: true, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000004", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer2, role: 0, status: 1, attendance: null, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000005", campaignId: IDS.campaigns.open, userId: IDS.users.admin, role: 0, status: 2, createdAt: now, updatedAt: now }
  ])

  await Comment.bulkCreate([
    { id: "90000000-0000-4000-8000-000000000001", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer1, body: "Já estou no local, equipa pronta!", isVisible: true, createdAt: now, updatedAt: now },
    { id: "90000000-0000-4000-8000-000000000002", campaignId: IDS.campaigns.inProgress, userId: IDS.users.admin, body: "Bom trabalho a todos. Mantenham os sacos separados.", isVisible: true, createdAt: now, updatedAt: now },
    { id: "90000000-0000-4000-8000-000000000003", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer2, body: "Comentário oculto — aguarda moderação.", isVisible: false, createdAt: now, updatedAt: now }
  ])
}

// Inserir utilizadores, catálogo e campanhas de demonstração.
export async function runSeed(password) {
  const passwordHash = await hashPassword(password)
  await seedUsers(passwordHash)
  await seedCatalog()
  await seedCampaigns()
  return { password, accounts: [...CORE_ACCOUNTS, ...EXTRA_ACCOUNTS] }
}
