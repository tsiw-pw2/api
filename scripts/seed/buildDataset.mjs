import { buildIds } from "./ids.mjs"
import { buildSeedDates } from "./dates.mjs"

const VOLUNTEER_NAMES = [
  "Maria Silva", "João Costa", "Ana Ribeiro", "Pedro Santos", "Sofia Martins",
  "Miguel Ferreira", "Inês Oliveira", "Tiago Pereira", "Beatriz Rodrigues", "Rui Almeida",
  "Carla Sousa", "Hugo Carvalho", "Luísa Gomes", "Nuno Lopes", "Catarina Dias",
  "Bruno Monteiro", "Mariana Pinto", "Filipe Correia", "Rita Teixeira", "André Moreira",
  "Joana Nunes", "Paulo Machado", "Teresa Fonseca", "Daniel Araújo", "Helena Cardoso",
  "Vítor Barbosa", "Cláudia Rocha", "Gonçalo Mendes", "Patrícia Campos", "Ricardo Neves",
  "Sara Henriques", "Alexandre Coelho", "Marta Antunes", "Fábio Matos", "Diana Cruz",
  "Leonor Freitas", "Samuel Reis", "Alice Guimarães", "Tomás Borges", "Laura Faria",
]

const ORGANIZER_PROFILES = [
  { name: "Carlos Mendes", email: "organizador1@demo.local", phone: "+351 912 345 678" },
  { name: "Ana Ribeiro", email: "ana.ribeiro@email.pt", phone: "+351 913 456 789" },
  { name: "Pedro Porto", email: "pedro.porto@email.pt", phone: "+351 914 567 890" },
  { name: "Helena Costa", email: "helena.costa@email.pt", phone: "+351 915 678 901" },
  { name: "Miguel Aveiro", email: "miguel.aveiro@email.pt", phone: "+351 916 789 012" },
]

const BEACH_DEFS = [
  { district: "Braga", municipality: "Esposende", parish: "Apúlia", code: "braga", name: "Praia de Apúlia", lat: 41.4862, lon: -8.7739 },
  { district: "Braga", municipality: "Esposende", parish: "Belinho", code: "braga", name: "Praia de Ofir", lat: 41.5124, lon: -8.7891 },
  { district: "Viana do Castelo", municipality: "Viana do Castelo", parish: "Darque", code: "viana_do_castelo", name: "Praia do Cabedelo", lat: 41.6893, lon: -8.8342 },
  { district: "Porto", municipality: "Matosinhos", parish: "Matosinhos", code: "porto", name: "Praia de Matosinhos", lat: 41.1821, lon: -8.6894 },
  { district: "Porto", municipality: "Matosinhos", parish: "Leça da Palmeira", code: "porto", name: "Praia de Leça da Palmeira", lat: 41.1912, lon: -8.7013 },
  { district: "Porto", municipality: "Vila do Conde", parish: "Azurara", code: "porto", name: "Praia da Azurara", lat: 41.3345, lon: -8.7421 },
  { district: "Porto", municipality: "Espinho", parish: "Espinho", code: "porto", name: "Praia de Espinho", lat: 41.0063, lon: -8.6432 },
  { district: "Aveiro", municipality: "Ílhavo", parish: "Gafanha da Nazaré", code: "aveiro", name: "Praia da Barra", lat: 40.6431, lon: -8.7456 },
  { district: "Aveiro", municipality: "Ílhavo", parish: "Gafanha da Encarnação", code: "aveiro", name: "Praia da Costa Nova", lat: 40.6124, lon: -8.7489 },
  { district: "Aveiro", municipality: "Mira", parish: "Mira", code: "aveiro", name: "Praia de Mira", lat: 40.4287, lon: -8.7391 },
  { district: "Leiria", municipality: "Nazaré", parish: "Nazaré", code: "leiria", name: "Praia da Nazaré", lat: 39.6012, lon: -9.0701 },
  { district: "Leiria", municipality: "Marinha Grande", parish: "São Pedro de Moel", code: "leiria", name: "Praia de São Pedro de Moel", lat: 39.7584, lon: -9.0312 },
  { district: "Leiria", municipality: "Peniche", parish: "Peniche", code: "leiria", name: "Praia de Supertubos", lat: 39.3456, lon: -9.3789 },
  { district: "Setúbal", municipality: "Almada", parish: "Costa da Caparica", code: "setubal", name: "Praia da Costa da Caparica", lat: 38.6441, lon: -9.2356 },
  { district: "Setúbal", municipality: "Sesimbra", parish: "Sesimbra", code: "setubal", name: "Praia do Meco", lat: 38.5123, lon: -9.1789 },
  { district: "Setúbal", municipality: "Grândola", parish: "Troia", code: "setubal", name: "Praia de Troia", lat: 38.4967, lon: -8.8945 },
  { district: "Lisboa", municipality: "Cascais", parish: "Carcavelos", code: "lisboa", name: "Praia de Carcavelos", lat: 38.6912, lon: -9.3387 },
  { district: "Lisboa", municipality: "Cascais", parish: "Cascais", code: "lisboa", name: "Praia do Guincho", lat: 38.7334, lon: -9.4734 },
  { district: "Lisboa", municipality: "Sintra", parish: "Colares", code: "lisboa", name: "Praia das Maçãs", lat: 38.8234, lon: -9.4678 },
  { district: "Faro", municipality: "Faro", parish: "Faro", code: "faro", name: "Praia da Ilha de Faro", lat: 36.9978, lon: -7.9367 },
  { district: "Faro", municipality: "Loulé", parish: "Quarteira", code: "faro", name: "Praia de Vilamoura", lat: 37.0789, lon: -8.1123 },
  { district: "Faro", municipality: "Albufeira", parish: "Albufeira", code: "faro", name: "Praia dos Pescadores", lat: 37.0891, lon: -8.2456 },
  { district: "Faro", municipality: "Lagoa", parish: "Carvoeiro", code: "faro", name: "Praia de Carvoeiro", lat: 37.1012, lon: -8.4678 },
  { district: "Coimbra", municipality: "Figueira da Foz", parish: "Buarcos", code: "coimbra", name: "Praia da Claridade", lat: 40.1456, lon: -8.8567 },
  { district: "Coimbra", municipality: "Mira", parish: "Mira", code: "coimbra", name: "Praia da Tocha", lat: 40.3567, lon: -8.8012 },
  { district: "Santarém", municipality: "Alcobaça", parish: "São Martinho do Porto", code: "santarem", name: "Praia de São Martinho do Porto", lat: 39.5123, lon: -9.1345 },
  { district: "Viseu", municipality: "Vagos", parish: "Vagueira", code: "viseu", name: "Praia da Vagueira", lat: 40.5567, lon: -8.6789 },
  { district: "Braga", municipality: "Vila Nova de Famalicão", parish: "Antas", code: "braga", name: "Praia Fluvial de Antas", lat: 41.4123, lon: -8.5234 },
]

const WASTE_TYPE_DEFS = [
  "Plásticos",
  "Vidro",
  "Metais",
  "Papel e cartão",
  "Madeira e troncos",
  "Têxteis e redes",
  "Microplásticos",
  "Outros",
]

const WASTE_DEFS = [
  { name: "Garrafas PET", type: 0, unit: "unit", grams: 28 },
  { name: "Tampas de plástico", type: 0, unit: "unit", grams: 4 },
  { name: "Canudos de plástico", type: 0, unit: "unit", grams: 2 },
  { name: "Sacos plásticos", type: 0, unit: "peso", grams: 450 },
  { name: "Embalagens flexíveis", type: 0, unit: "peso", grams: 320 },
  { name: "Garrafas de vidro", type: 1, unit: "unit", grams: 320 },
  { name: "Cacos de vidro", type: 1, unit: "peso", grams: 850 },
  { name: "Latas de alumínio", type: 2, unit: "unit", grams: 15 },
  { name: "Latas de aço", type: 2, unit: "unit", grams: 45 },
  { name: "Arame e ferrugem", type: 2, unit: "peso", grams: 1200 },
  { name: "Cartão ondulado", type: 3, unit: "peso", grams: 180 },
  { name: "Papel molhado", type: 3, unit: "peso", grams: 220 },
  { name: "Paletes de madeira", type: 4, unit: "peso", grams: 8500 },
  { name: "Troncos e madeira flutuante", type: 4, unit: "peso", grams: 15000 },
  { name: "Redes de pesca", type: 5, unit: "peso", grams: 2400 },
  { name: "Cordame e sisal", type: 5, unit: "peso", grams: 900 },
  { name: "Roupa e tecidos", type: 5, unit: "peso", grams: 650 },
  { name: "Microplásticos na areia", type: 6, unit: "peso", grams: 350 },
  { name: "Pellets industriais", type: 6, unit: "peso", grams: 280 },
  { name: "Isqueiros descartáveis", type: 7, unit: "unit", grams: 12 },
  { name: "Embalagens compostas", type: 7, unit: "unit", grams: 35 },
  { name: "Restos de obras", type: 7, unit: "peso", grams: 4200 },
  { name: "Copos de plástico", type: 0, unit: "unit", grams: 8 },
  { name: "Frascos de detergente", type: 0, unit: "unit", grams: 95 },
  { name: "Garrafas de água", type: 0, unit: "unit", grams: 22 },
  { name: "Embalagens de iogurte", type: 0, unit: "unit", grams: 6 },
  { name: "Anéis de latas", type: 2, unit: "unit", grams: 3 },
  { name: "Pneus pequenos", type: 7, unit: "peso", grams: 6500 },
  { name: "Bóias de poliestireno", type: 0, unit: "unit", grams: 180 },
  { name: "Cintas de embalagem", type: 0, unit: "peso", grams: 540 },
  { name: "Garrafas de cerveja", type: 1, unit: "unit", grams: 280 },
  { name: "Frascos de medicamentos", type: 1, unit: "unit", grams: 45 },
  { name: "Latas de conservas", type: 2, unit: "unit", grams: 55 },
  { name: "Papel de alumínio", type: 2, unit: "peso", grams: 120 },
  { name: "Jornais e revistas", type: 3, unit: "peso", grams: 90 },
  { name: "Caixas de pizza", type: 3, unit: "unit", grams: 85 },
  { name: "Espreguiçadeiras partidas", type: 4, unit: "peso", grams: 3200 },
  { name: "Aparelhos de pesca abandonados", type: 5, unit: "peso", grams: 1800 },
  { name: "Seda de pesca", type: 5, unit: "peso", grams: 45 },
  { name: "Restos de fósforos", type: 7, unit: "unit", grams: 1 },
  { name: "Embalagens de snacks", type: 0, unit: "unit", grams: 5 },
  { name: "Detritos mistos", type: 7, unit: "peso", grams: 750 },
]

const COMMENT_SAMPLES = [
  "Confirmo presença. Levo luvas e sacos reutilizáveis.",
  "Há estacionamento perto do ponto de encontro?",
  "Posso levar mais dois voluntários da minha associação?",
  "Qual é a hora prevista para o regresso?",
  "Já participei numa ação semelhante na Costa Nova — excelente organização.",
  "Recomendo calçado fechado; há muitos detritos metálicos na zona rochosa.",
  "Vou trazer uma balança portátil para pesarmos alguns sacos.",
  "O grupo escolar de Esposende confirma 12 participantes.",
  "Choveu ontem — a areia pode estar mais pesada do que o habitual.",
  "Alguém sabe se haverá apoio da câmara municipal no local?",
  "Trago rede para recolher microplásticos na maré baixa.",
  "Podemos dividir equipas por zona da praia?",
  "Tenho transporte para 4 pessoas desde Braga.",
  "Excelente iniciativa — o litoral precisa disto.",
  "Há WC e pontos de água no percurso?",
  "Vou partilhar o evento nas redes da nossa ONG.",
  "Confirmado. Chego 15 minutos antes para ajudar no briefing.",
  "Na última campanha recolhemos sobretudo plásticos perto dos acessos.",
  "Alguém tem contacto do responsável local da APA?",
  "Levo coletes refletores para o grupo.",
]

// Calcula uma data de nascimento fictícia que corresponde à idade indicada.
function birthDateForAge(ageYears) {
  const year = new Date().getUTCFullYear() - ageYears
  return `${year}-06-15`
}

// Cria o objecto base de um utilizador de seed com valores por omissão.
function userBase(passwordHash, overrides) {
  return {
    passwordHash,
    isAdmin: false,
    isOrganizer: false,
    isBlocked: false,
    blockedReason: null,
    blockedAt: null,
    tokenVersion: 0,
    avatarUrl: null,
    ...overrides,
  }
}

// Monta o conjunto completo de entidades demo (utilizadores, campanhas, resíduos, etc.).
export function buildDataset({ passwordHash }) {
  const ids = buildIds()
  const dates = buildSeedDates()
  const now = new Date()

  const users = [
    userBase(passwordHash, {
      id: ids.users.admin,
      name: "Administrador Demo",
      email: "admin@demo.local",
      phone: "+351 910 000 001",
      birthDate: birthDateForAge(35),
      isAdmin: true,
    }),
    userBase(passwordHash, {
      id: ids.users.blocked,
      name: "Utilizador Bloqueado",
      email: "bloqueado@demo.local",
      phone: "+351 910 000 002",
      birthDate: birthDateForAge(28),
      isBlocked: true,
      blockedReason: "Comportamento inadequado em comentários públicos.",
      blockedAt: new Date(dates.daysAgo(12)),
    }),
    ...ORGANIZER_PROFILES.map((profile, index) => userBase(passwordHash, {
      id: [ids.users.org1, ids.users.org2, ids.users.org3, ids.users.org4, ids.users.org5][index],
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      birthDate: birthDateForAge(32 + index),
      isOrganizer: true,
    })),
    ...VOLUNTEER_NAMES.map((name, index) => userBase(passwordHash, {
      id: ids.volunteers[index],
      name,
      email: `vol${String(index + 1).padStart(2, "0")}.${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".")}@email.pt`,
      phone: `+351 9${String(20 + (index % 70)).padStart(2, "0")} ${String(100 + index).slice(-3)} ${String(200 + index).slice(-3)}`,
      birthDate: birthDateForAge(18 + (index % 25)),
    })),
  ]

  const beachLocations = BEACH_DEFS.map((def, index) => ({
    id: ids.beachLocations[index],
    district: def.district,
    municipality: def.municipality,
    parish: def.parish,
    nutsCode: "PTZZZ",
  }))

  const beaches = BEACH_DEFS.map((def, index) => ({
    id: ids.beaches[index],
    beachLocationId: ids.beachLocations[index],
    createdByUserId: ids.users.admin,
    name: def.name,
    latitude: def.lat,
    longitude: def.lon,
    description: `Praia costeira em ${def.municipality}, ${def.district}. Zona monitorizada para ações de limpeza.`,
  }))

  const wasteTypes = WASTE_TYPE_DEFS.map((name, index) => ({
    id: ids.wasteTypes[index],
    name,
  }))

  const wastes = WASTE_DEFS.map((def, index) => ({
    id: ids.wastes[index],
    wasteTypeId: ids.wasteTypes[def.type],
    name: def.name,
    unit: def.unit,
    averageWeightGrams: def.unit === "peso" ? def.grams : null,
  }))

  const campaignDefs = [
    { title: "Limpeza da Apúlia e Ofir", status: 1, district: "braga", org: ids.users.org1, start: dates.daysAhead(14), end: dates.daysAhead(14), beaches: [0, 1], meeting: "Parque de estacionamento da Apúlia" },
    { title: "Costa Nova — manhã de primavera", status: 1, district: "aveiro", org: ids.users.org2, start: dates.daysAhead(21), end: dates.daysAhead(21), beaches: [8], meeting: "Café da Costa Nova" },
    { title: "Matosinhos e Leça — maré baixa", status: 1, district: "porto", org: ids.users.org3, start: dates.daysAhead(7), end: dates.daysAhead(7), beaches: [3, 4], meeting: "Entrada da Avenida da Liberdade" },
    { title: "Nazaré — recolha pós temporal", status: 1, district: "leiria", org: ids.users.org4, start: dates.daysAhead(10), end: dates.daysAhead(11), beaches: [10], meeting: "Miradouro da Nazaré" },
    { title: "Caparica — grande ação de verão", status: 3, district: "setubal", org: ids.users.org1, start: dates.daysAgo(1), end: dates.daysAhead(2), beaches: [13, 14], meeting: "Rotunda da Fonte da Telha" },
    { title: "Ilha de Faro — limpeza em progresso", status: 3, district: "faro", org: ids.users.org5, start: dates.daysAgo(2), end: dates.daysAhead(1), beaches: [19], meeting: "Cais da Ilha de Faro" },
    { title: "Espinho — encerrada a inscrições", status: 2, district: "porto", org: ids.users.org2, start: dates.daysAhead(5), end: dates.daysAhead(5), beaches: [6], meeting: "Praça do Mar" },
    { title: "Troia — últimas vagas", status: 2, district: "setubal", org: ids.users.org3, start: dates.daysAhead(18), end: dates.daysAhead(19), beaches: [15], meeting: "Terminal de ferry de Setúbal" },
    { title: "Planeamento Carcavelos 2026", status: 0, district: "lisboa", org: ids.users.org4, start: dates.monthsAhead(2), end: dates.monthsAhead(2), beaches: [16], meeting: "A definir" },
    { title: "Guincho — ação outono", status: 0, district: "lisboa", org: ids.users.org5, start: dates.monthsAhead(3), end: dates.monthsAhead(3), beaches: [17], meeting: "Parque de estacionamento do Guincho" },
    { title: "Claridade — campanha adiada", status: 0, district: "coimbra", org: ids.users.org1, start: dates.monthsAhead(1), end: dates.monthsAhead(1), beaches: [23], meeting: "Fortaleza da Buarcos" },
    { title: "Apúlia — março (cancelada)", status: 5, district: "braga", org: ids.users.org1, start: dates.daysAgo(40), end: dates.daysAgo(40), beaches: [0], meeting: "Apúlia" },
    { title: "Vilamoura — condições meteorológicas", status: 5, district: "faro", org: ids.users.org5, start: dates.daysAgo(25), end: dates.daysAgo(24), beaches: [20], meeting: "Marina de Vilamoura" },
    { title: "Supertubos — adiada por mar agitado", status: 5, district: "leiria", org: ids.users.org4, start: dates.daysAgo(15), end: dates.daysAgo(15), beaches: [12], meeting: "Peniche" },
  ]

  const completedCampaignTemplates = [
    { title: "Apúlia — limpeza de inverno", district: "braga", beaches: [0, 1], org: ids.users.org1, monthsAgo: 5 },
    { title: "Cabedelo — ação comunitária", district: "viana_do_castelo", beaches: [2], org: ids.users.org2, monthsAgo: 5 },
    { title: "Barra — recolha pós-época balnear", district: "aveiro", beaches: [7, 8], org: ids.users.org2, monthsAgo: 4 },
    { title: "Mira — areal limpo", district: "aveiro", beaches: [9], org: ids.users.org3, monthsAgo: 4 },
    { title: "São Pedro de Moel — troncos e plásticos", district: "leiria", beaches: [11], org: ids.users.org4, monthsAgo: 4 },
    { title: "Costa da Caparica — mega ação", district: "setubal", beaches: [13], org: ids.users.org1, monthsAgo: 3 },
    { title: "Carcavelos — domingo solidário", district: "lisboa", beaches: [16], org: ids.users.org4, monthsAgo: 3 },
    { title: "Guincho — vento e resíduos", district: "lisboa", beaches: [17], org: ids.users.org5, monthsAgo: 3 },
    { title: "Ilha de Faro — Ria Formosa", district: "faro", beaches: [19], org: ids.users.org5, monthsAgo: 2 },
    { title: "Carvoeiro — baía limpa", district: "faro", beaches: [22], org: ids.users.org3, monthsAgo: 2 },
    { title: "Claridade — Figueira da Foz", district: "coimbra", beaches: [23], org: ids.users.org2, monthsAgo: 2 },
    { title: "São Martinho do Porto — baía", district: "santarem", beaches: [25], org: ids.users.org1, monthsAgo: 1 },
    { title: "Vagueira — campanha escolar", district: "viseu", beaches: [26], org: ids.users.org3, monthsAgo: 1 },
    { title: "Matosinhos — fecho de época", district: "porto", beaches: [3], org: ids.users.org3, monthsAgo: 1 },
  ]

  let campaignIndex = 0
  const campaigns = []
  const campaignBeachLinks = []
  let campaignBeachLinkIndex = 0

  function addCampaign(def) {
    const id = ids.campaigns[campaignIndex]
    campaigns.push({
      id,
      title: def.title,
      description: def.description ?? `Campanha de limpeza costeira em ${def.district.replace(/_/g, " ")}. Material de proteção recomendado; ponto de encontro indicado abaixo.`,
      meetingLocation: def.meeting,
      meetingTime: "09:30:00",
      startDate: def.start,
      endDate: def.end ?? def.start,
      status: def.status,
      organizerId: def.org,
      districtCode: def.district,
    })
    for (const beachIdx of def.beaches) {
      campaignBeachLinks.push({
        id: ids.campaignBeaches[campaignBeachLinkIndex++],
        campaignId: id,
        beachId: ids.beaches[beachIdx],
      })
    }
    campaignIndex += 1
    return id
  }

  for (const def of campaignDefs) {
    addCampaign(def)
  }

  for (const template of completedCampaignTemplates) {
    const start = dates.monthsAgo(template.monthsAgo)
    addCampaign({
      title: template.title,
      district: template.district,
      org: template.org,
      start,
      end: start,
      beaches: template.beaches,
      meeting: "Ponto de encontro principal",
      status: 4,
    })
  }

  const openCampaignId = campaigns[0].id

  const registrations = []
  let registrationIndex = 0
  const registeredPairs = new Set()

  function addRegistration(campaignId, userId, role, status, attendance = null) {
    if (registrationIndex >= ids.registrations.length) return
    const key = `${campaignId}:${userId}`
    if (registeredPairs.has(key)) return
    registeredPairs.add(key)
    registrations.push({
      id: ids.registrations[registrationIndex++],
      campaignId,
      userId,
      role,
      status,
      attendance,
    })
  }

  for (const campaign of campaigns) {
    addRegistration(campaign.id, campaign.organizerId, 1, 1, true)
    const poolSize = campaign.status === 1 ? 10 : campaign.status === 3 ? 6 : 4
    const volunteerPool = ids.volunteers.slice(0, poolSize)
    volunteerPool.forEach((volunteerId, idx) => {
      let status = 1
      if (campaign.status === 1 && idx % 4 === 0) status = 0
      if (campaign.status === 5 || (campaign.status === 2 && idx % 5 === 0)) status = 2
      let attendance = null
      if (campaign.status === 4) {
        attendance = idx % 7 === 0 ? false : idx % 11 === 0 ? null : true
      }
      addRegistration(campaign.id, volunteerId, 0, status, attendance)
    })
  }

  const comments = []
  let commentIndex = 0
  for (let i = 0; i < 22; i += 1) {
    comments.push({
      id: ids.comments[commentIndex++],
      campaignId: openCampaignId,
      userId: ids.volunteers[i % ids.volunteers.length],
      body: COMMENT_SAMPLES[i % COMMENT_SAMPLES.length],
      isVisible: i !== 7,
      createdAt: new Date(now.getTime() - (22 - i) * 3600 * 1000),
    })
  }
  for (const campaign of campaigns.filter((c) => c.status === 4).slice(0, 6)) {
    comments.push({
      id: ids.comments[commentIndex++],
      campaignId: campaign.id,
      userId: ids.volunteers[commentIndex % ids.volunteers.length],
      body: "Obrigado a todos — foi uma manhã produtiva na praia.",
      isVisible: true,
      createdAt: new Date(`${campaign.endDate}T16:00:00Z`),
    })
  }

  const wasteCollections = []
  let collectionIndex = 0
  const collectionKeys = new Set()

  function addCollection(campaignId, beachId, wasteId, userId, unitQuantity, actualWeightKg, createdAt) {
    if (collectionIndex >= ids.wasteCollections.length) return
    const key = `${campaignId}:${beachId}:${wasteId}`
    if (collectionKeys.has(key)) return
    collectionKeys.add(key)
    wasteCollections.push({
      id: ids.wasteCollections[collectionIndex++],
      campaignId,
      beachId,
      wasteId,
      recordedByUserId: userId,
      unitQuantity,
      actualWeightKg,
      createdAt,
    })
  }

  function populateCollectionsForCampaign(campaign, wasteCount, dayOffset) {
    const links = campaignBeachLinks.filter((link) => link.campaignId === campaign.id)
    for (const link of links) {
      for (let w = 0; w < wasteCount; w += 1) {
        if (collectionIndex >= ids.wasteCollections.length) return
        const waste = wastes[(collectionIndex + w) % wastes.length]
        const qty = 5 + ((collectionIndex + w) % 45)
        const estimatedKg = Number(((waste.averageWeightGrams ?? 120) * qty / 1000).toFixed(3))
        const createdAt = new Date(`${campaign.endDate ?? campaign.startDate}T10:00:00Z`)
        createdAt.setUTCDate(createdAt.getUTCDate() - dayOffset)
        createdAt.setUTCHours(10 + (w % 6))
        addCollection(
          campaign.id,
          link.beachId,
          waste.id,
          ids.volunteers[(collectionIndex + w) % ids.volunteers.length],
          qty,
          waste.unit === "peso" ? estimatedKg : (w % 3 === 0 ? estimatedKg : null),
          createdAt,
        )
      }
    }
  }

  for (const campaign of campaigns.filter((c) => c.status === 4)) {
    populateCollectionsForCampaign(campaign, 5, 0)
  }

  for (const campaign of campaigns.filter((c) => c.status === 3)) {
    populateCollectionsForCampaign(campaign, 3, 0)
  }

  return {
    users,
    beachLocations,
    beaches,
    wasteTypes,
    wastes,
    campaigns,
    campaignBeaches: campaignBeachLinks,
    registrations,
    comments,
    wasteCollections,
    meta: {
      defaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!",
      accounts: {
        admin: "admin@demo.local",
        organizer: "organizador1@demo.local",
        volunteer: users.find((u) => u.email.startsWith("vol01."))?.email,
        blocked: "bloqueado@demo.local",
      },
    },
  }
}
