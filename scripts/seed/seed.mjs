import bcrypt from "bcryptjs"
import { Beach, BeachLocation, Campaign, CampaignBeach, Comment, Organization, Registration, User, UserOrganization, Waste, WasteCollection, WasteType } from "../../models/db.config.js"
import { addDays } from "./dates.mjs"
import { IDS } from "./ids.mjs"

const BCRYPT_ROUNDS = 10

const CORE_ACCOUNTS = [
  { email: "gestao@mariva.pt", role: "Root (plataforma Mariva)" },
  { email: "ambiente@viladoconde.pt", role: "Admin org CM Vila do Conde" },
  { email: "maria.silva@email.pt", role: "Voluntário" },
  { email: "joao.ferreira@email.pt", role: "Voluntário" },
  { email: "bloqueado@mariva.pt", role: "Bloqueado (login falha)" }
]

const EXTRA_ACCOUNTS = [
  { email: "operacoes@viladoconde.pt", role: "Organizador CM Vila do Conde (sem admin org)" },
  { email: "ambiente@povoa.varzim.pt", role: "Admin org CM Póvoa de Varzim" },
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

async function seedOrganizations() {
  const now = new Date()

  await Organization.bulkCreate([
    {
      id: IDS.organizations.vilaConde,
      name: "Câmara Municipal de Vila do Conde",
      contactEmail: "ambiente@viladoconde.pt",
      municipality: "Vila do Conde",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.organizations.povoaVarzim,
      name: "Câmara Municipal da Póvoa de Varzim",
      contactEmail: "ambiente@povoa.varzim.pt",
      municipality: "Póvoa de Varzim",
      createdAt: now,
      updatedAt: now
    }
  ])
}

async function seedUserOrganizations() {
  const now = new Date()

  await UserOrganization.bulkCreate([
    {
      id: "16000000-0000-4000-8000-000000000001",
      userId: IDS.users.organizer,
      organizationId: IDS.organizations.vilaConde,
      isOrgAdmin: true,
      createdAt: now
    },
    {
      id: "16000000-0000-4000-8000-000000000002",
      userId: IDS.users.organizer2,
      organizationId: IDS.organizations.povoaVarzim,
      isOrgAdmin: true,
      createdAt: now
    },
    {
      id: "16000000-0000-4000-8000-000000000003",
      userId: IDS.users.organizerStaff,
      organizationId: IDS.organizations.vilaConde,
      isOrgAdmin: false,
      createdAt: now
    }
  ])
}

async function seedUsers(passwordHash) {
  const now = new Date()

  await User.bulkCreate([
    {
      id: IDS.users.admin,
      name: "Ana Administradora",
      email: "gestao@mariva.pt",
      passwordHash,
      birthDate: "1988-03-12",
      phone: "912000001",
      isAdmin: false,
      isRoot: true,
      isOrganizer: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.users.organizer,
      name: "Bruno Costa",
      email: "ambiente@viladoconde.pt",
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
      name: "Maria Silva",
      email: "maria.silva@email.pt",
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
      name: "João Ferreira",
      email: "joao.ferreira@email.pt",
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
      email: "bloqueado@mariva.pt",
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
      email: "ambiente@povoa.varzim.pt",
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
    {
      id: IDS.users.organizerStaff,
      name: "Carlos Organizador",
      email: "operacoes@viladoconde.pt",
      passwordHash,
      birthDate: "1990-09-05",
      phone: "912000010",
      isAdmin: false,
      isOrganizer: true,
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
      id: IDS.beachLocations.vilaConde,
      district: "Porto",
      municipality: "Vila do Conde",
      parish: "Azurara",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beachLocations.povoaVarzim,
      district: "Porto",
      municipality: "Póvoa de Varzim",
      parish: "Póvoa de Varzim",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    }
  ])

  await Beach.bulkCreate([
    {
      id: IDS.beaches.praiaAzurara,
      beachLocationId: IDS.beachLocations.vilaConde,
      createdByUserId: IDS.users.organizer,
      name: "Praia da Azurara",
      latitude: 41.3501,
      longitude: -8.7462,
      description: "Praia extensa junto à foz do rio Ave, muito frequentada no verão.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaCodicheira,
      beachLocationId: IDS.beachLocations.vilaConde,
      createdByUserId: IDS.users.organizer,
      name: "Praia da Codicheira",
      latitude: 41.3628,
      longitude: -8.7521,
      description: "Zona mais calma, ideal para famílias e campanhas de fim de semana.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaSalgueiros,
      beachLocationId: IDS.beachLocations.povoaVarzim,
      createdByUserId: IDS.users.organizer2,
      name: "Praia dos Salgueiros",
      latitude: 41.3824,
      longitude: -8.7689,
      description: "Praia urbana da Póvoa de Varzim, acesso fácil pelo passeio marítimo.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaCaboFurado,
      beachLocationId: IDS.beachLocations.povoaVarzim,
      createdByUserId: IDS.users.organizer2,
      name: "Praia do Cabo Furado",
      latitude: 41.3956,
      longitude: -8.7791,
      description: "Praia natural no extremo norte do concelho.",
      createdAt: now,
      updatedAt: now
    }
  ])

  const orgVila = IDS.organizations.vilaConde
  const orgPovoa = IDS.organizations.povoaVarzim

  await WasteType.bulkCreate([
    { id: IDS.wasteTypes.plastic, organizationId: orgVila, name: "Plástico", createdAt: now, updatedAt: now },
    { id: IDS.wasteTypes.glass, organizationId: orgVila, name: "Vidro", createdAt: now, updatedAt: now },
    { id: IDS.wasteTypes.metal, organizationId: orgVila, name: "Metal", createdAt: now, updatedAt: now },
    { id: IDS.povoaWasteTypes.plastic, organizationId: orgPovoa, name: "Plástico", createdAt: now, updatedAt: now },
    { id: IDS.povoaWasteTypes.glass, organizationId: orgPovoa, name: "Vidro", createdAt: now, updatedAt: now },
    { id: IDS.povoaWasteTypes.metal, organizationId: orgPovoa, name: "Metal", createdAt: now, updatedAt: now }
  ])

  await Waste.bulkCreate([
    {
      id: IDS.wastes.bottlePet,
      organizationId: orgVila,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Garrafa PET",
      unit: "unit",
      averageWeightGrams: 25,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.capPlastic,
      organizationId: orgVila,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Tampa de plástico",
      unit: "unit",
      averageWeightGrams: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.glassBottle,
      organizationId: orgVila,
      wasteTypeId: IDS.wasteTypes.glass,
      name: "Garrafa de vidro",
      unit: "unit",
      averageWeightGrams: 350,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.canAluminium,
      organizationId: orgVila,
      wasteTypeId: IDS.wasteTypes.metal,
      name: "Lata de alumínio",
      unit: "unit",
      averageWeightGrams: 15,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.fishingNet,
      organizationId: orgVila,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Rede de pesca (fragmento)",
      unit: "kg",
      averageWeightGrams: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.povoaWastes.bottlePet,
      organizationId: orgPovoa,
      wasteTypeId: IDS.povoaWasteTypes.plastic,
      name: "Garrafa PET",
      unit: "unit",
      averageWeightGrams: 25,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.povoaWastes.capPlastic,
      organizationId: orgPovoa,
      wasteTypeId: IDS.povoaWasteTypes.plastic,
      name: "Tampa de plástico",
      unit: "unit",
      averageWeightGrams: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.povoaWastes.glassBottle,
      organizationId: orgPovoa,
      wasteTypeId: IDS.povoaWasteTypes.glass,
      name: "Garrafa de vidro",
      unit: "unit",
      averageWeightGrams: 350,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.povoaWastes.canAluminium,
      organizationId: orgPovoa,
      wasteTypeId: IDS.povoaWasteTypes.metal,
      name: "Lata de alumínio",
      unit: "unit",
      averageWeightGrams: 15,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.povoaWastes.fishingNet,
      organizationId: orgPovoa,
      wasteTypeId: IDS.povoaWasteTypes.plastic,
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

  const orgVila = IDS.organizations.vilaConde
  const orgPovoa = IDS.organizations.povoaVarzim

  await Campaign.bulkCreate([
    {
      id: IDS.campaigns.planned,
      title: "Limpeza Outono — Azurara",
      description: "Campanha municipal ainda sem inscrições abertas.",
      meetingLocation: "Parque de estacionamento da Praia da Azurara",
      meetingTime: "09:00:00",
      startDate: in21,
      endDate: in21,
      status: 0,
      organizerId: IDS.users.organizer,
      organizationId: orgVila,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.open,
      title: "Limpeza Azurara — Inscrições abertas",
      description: "Junta-te como voluntário. Vagas limitadas.",
      meetingLocation: "Entrada principal da Praia da Azurara",
      meetingTime: "08:30:00",
      startDate: in14,
      endDate: in14,
      status: 1,
      organizerId: IDS.users.organizer,
      organizationId: orgVila,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.closed,
      title: "Limpeza Codicheira — Inscrições encerradas",
      description: "Vagas esgotadas; inscrições pendentes em revisão.",
      meetingLocation: "Acesso à Praia da Codicheira",
      meetingTime: "09:00:00",
      startDate: in18,
      endDate: in18,
      status: 2,
      organizerId: IDS.users.organizer,
      organizationId: orgVila,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.inProgress,
      title: "Limpeza Costeira Vila do Conde — Em progresso",
      description: "Campanha activa neste fim de semana.",
      meetingLocation: "Miradouro da Praia da Azurara",
      meetingTime: "10:00:00",
      startDate: minus3,
      endDate: plus3,
      status: 3,
      organizerId: IDS.users.organizer,
      organizationId: orgVila,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.completed,
      title: "Limpeza Primavera — Concluída",
      description: "Campanha concluída com dados para o dashboard.",
      meetingLocation: "Centro de visitantes de Azurara",
      meetingTime: "09:30:00",
      startDate: minus30,
      endDate: minus25,
      status: 4,
      organizerId: IDS.users.organizer,
      organizationId: orgVila,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.cancelled,
      title: "Limpeza Codicheira — Cancelada",
      description: "Cancelada por condições meteorológicas adversas.",
      meetingLocation: "Parque da Codicheira",
      meetingTime: "08:00:00",
      startDate: in35,
      endDate: in35,
      status: 5,
      organizerId: IDS.users.organizer,
      organizationId: orgVila,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.empty,
      title: "Campanha Vazia — Sem dados",
      description: "Só campanha e uma praia — tabs de voluntários, recolhas e comentários vazias.",
      meetingLocation: "A definir no dia",
      meetingTime: "09:00:00",
      startDate: in21,
      endDate: in21,
      status: 0,
      organizerId: IDS.users.organizer,
      organizationId: orgVila,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.povoaOpen,
      title: "Limpeza Salgueiros — Inscrições abertas",
      description: "Campanha da Câmara Municipal da Póvoa de Varzim. Inscrições abertas.",
      meetingLocation: "Passeio Marítimo dos Salgueiros",
      meetingTime: "09:00:00",
      startDate: in14,
      endDate: in14,
      status: 1,
      organizerId: IDS.users.organizer2,
      organizationId: orgPovoa,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    }
  ])

  await CampaignBeach.bulkCreate([
    { id: "70000000-0000-4000-8000-000000000001", campaignId: IDS.campaigns.open, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000002", campaignId: IDS.campaigns.closed, beachId: IDS.beaches.praiaCodicheira, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000003", campaignId: IDS.campaigns.inProgress, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000004", campaignId: IDS.campaigns.inProgress, beachId: IDS.beaches.praiaCodicheira, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000005", campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000006", campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaCodicheira, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000007", campaignId: IDS.campaigns.cancelled, beachId: IDS.beaches.praiaCodicheira, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000008", campaignId: IDS.campaigns.empty, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: "70000000-0000-4000-8000-000000000009", campaignId: IDS.campaigns.povoaOpen, beachId: IDS.beaches.praiaSalgueiros, createdAt: now }
  ])

  await Registration.bulkCreate([
    { id: "80000000-0000-4000-8000-000000000001", campaignId: IDS.campaigns.open, userId: IDS.users.volunteer1, role: 0, status: 1, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000002", campaignId: IDS.campaigns.closed, userId: IDS.users.volunteer2, role: 0, status: 0, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000003", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer1, role: 0, status: 1, attendance: true, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000004", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer2, role: 0, status: 1, attendance: null, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000005", campaignId: IDS.campaigns.open, userId: IDS.users.volunteer3, role: 0, status: 2, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000006", campaignId: IDS.campaigns.completed, userId: IDS.users.volunteer1, role: 0, status: 1, attendance: true, createdAt: now, updatedAt: now },
    { id: "80000000-0000-4000-8000-000000000007", campaignId: IDS.campaigns.completed, userId: IDS.users.volunteer2, role: 0, status: 1, attendance: true, createdAt: now, updatedAt: now }
  ])

  await Comment.bulkCreate([
    { id: "90000000-0000-4000-8000-000000000001", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer1, body: "Já estou no local, equipa pronta!", isVisible: true, createdAt: now, updatedAt: now },
    { id: "90000000-0000-4000-8000-000000000002", campaignId: IDS.campaigns.inProgress, userId: IDS.users.organizer, body: "Bom trabalho a todos. Mantenham os sacos separados.", isVisible: true, createdAt: now, updatedAt: now },
    { id: "90000000-0000-4000-8000-000000000003", campaignId: IDS.campaigns.inProgress, userId: IDS.users.volunteer2, body: "Comentário oculto — aguarda moderação.", isVisible: false, createdAt: now, updatedAt: now }
  ])

  await WasteCollection.bulkCreate([
    {
      id: "a0000000-0000-4000-8000-000000000001",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaAzurara,
      wasteId: IDS.wastes.bottlePet,
      recordedByUserId: IDS.users.organizer,
      unitQuantity: 120,
      actualWeightKg: 3.2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "a0000000-0000-4000-8000-000000000002",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaAzurara,
      wasteId: IDS.wastes.glassBottle,
      recordedByUserId: IDS.users.organizer,
      unitQuantity: 45,
      actualWeightKg: 18.5,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "a0000000-0000-4000-8000-000000000003",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaCodicheira,
      wasteId: IDS.wastes.canAluminium,
      recordedByUserId: IDS.users.organizer,
      unitQuantity: 80,
      actualWeightKg: 1.2,
      createdAt: now,
      updatedAt: now
    }
  ])
}

// Inserir utilizadores, catálogo e campanhas de demonstração.
export async function runSeed(password) {
  const passwordHash = await hashPassword(password)
  await seedOrganizations()
  await seedUsers(passwordHash)
  await seedUserOrganizations()
  await seedCatalog()
  await seedCampaigns()
  return { password, accounts: [...CORE_ACCOUNTS, ...EXTRA_ACCOUNTS] }
}
