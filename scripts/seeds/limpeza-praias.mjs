import "dotenv/config"
import { randomUUID } from "crypto"
import { validateEnv } from "../../src/config/env.js"
import { districtCodeFromLabel } from "../../src/utils/districts.js"
import { hashPassword } from "../../src/api/v1/services/auth.service.js"
import {
  sequelize,
  User,
  BeachLocation,
  Beach,
  WasteType,
  Waste,
  Campaign,
  CampaignBeach,
  Registration,
  Comment,
  WasteCollection
} from "../../src/models/index.js"

const TABLES_TRUNCATE_ORDER = [
  "refresh_token",
  "recolha_residuo",
  "comentario",
  "inscricao",
  "campanha_praia",
  "campanha",
  "praia",
  "residuo",
  "tipo_residuo",
  "localizacao_praia",
  "utilizador"
]

const LOCATIONS = [
  { district: "Braga", municipality: "Esposende", parish: "Esposende", nutsCode: "11103" },
  { district: "Braga", municipality: "Viana do Castelo", parish: "Darque", nutsCode: "11101" },
  { district: "Porto", municipality: "Matosinhos", parish: "Leça da Palmeira", nutsCode: "11207" },
  { district: "Porto", municipality: "Vila do Conde", parish: "Vila do Conde", nutsCode: "13109" },
  { district: "Lisboa", municipality: "Cascais", parish: "Cascais", nutsCode: "11105" },
  { district: "Lisboa", municipality: "Oeiras", parish: "Oeiras", nutsCode: "11106" },
  { district: "Faro", municipality: "Lagos", parish: "Lagos", nutsCode: "15051" },
  { district: "Faro", municipality: "Tavira", parish: "Tavira", nutsCode: "15052" },
  { district: "Bragança", municipality: "Mirandela", parish: "Mirandela", nutsCode: "04102" },
  { district: "Braga", municipality: "Barcelos", parish: "Esposende", nutsCode: "11102" }
]

const BEACH_SPECS = [
  { name: "Praia de Ofir", lat: 41.533, lng: -8.783, locIndex: 0 },
  { name: "Praia da Ramalha", lat: 41.551, lng: -8.792, locIndex: 0 },
  { name: "Praia de Belinho", lat: 41.538, lng: -8.775, locIndex: 0 },
  { name: "Praia do Cabedelo", lat: 41.684, lng: -8.829, locIndex: 1 },
  { name: "Praia de Afife", lat: 41.779, lng: -8.779, locIndex: 1 },
  { name: "Praia de Matosinhos", lat: 41.182, lng: -8.698, locIndex: 2 },
  { name: "Praia do Homem do Leme", lat: 41.15, lng: -8.677, locIndex: 2 },
  { name: "Praia da Azurara", lat: 41.337, lng: -8.744, locIndex: 3 },
  { name: "Praia da Baía", lat: 41.356, lng: -8.759, locIndex: 3 },
  { name: "Praia do Tamariz", lat: 38.705, lng: -9.398, locIndex: 4 },
  { name: "Praia da Poça", lat: 38.709, lng: -9.385, locIndex: 4 },
  { name: "Praia de Carcavelos", lat: 38.682, lng: -9.337, locIndex: 5 },
  { name: "Praia da Falésia", lat: 37.091, lng: -8.174, locIndex: 6 },
  { name: "Meia Praia", lat: 37.115, lng: -8.671, locIndex: 6 },
  { name: "Praia do Barril", lat: 37.208, lng: -7.796, locIndex: 7 },
  { name: "Praia da Terra Estreita", lat: 37.126, lng: -7.643, locIndex: 7 },
  { name: "Praia Fluvial do Tua", lat: 41.487, lng: -7.181, locIndex: 8 },
  { name: "Praia de Esposende Norte", lat: 41.544, lng: -8.801, locIndex: 9 },
  { name: "Praia da Apúlia", lat: 41.5227, lng: -8.7701, locIndex: 0 },
  { name: "Praia de Fão (Bonança)", lat: 41.5134, lng: -8.7739, locIndex: 0 },
  { name: "Praia de Cepães", lat: 41.5456, lng: -8.7867, locIndex: 0 },
  { name: "Praia de Suave Mar", lat: 41.5481, lng: -8.7941, locIndex: 0 },
  { name: "Praia de Rio de Moinhos", lat: 41.5392, lng: -8.7712, locIndex: 0 }
]

const BEACH_COUNT = BEACH_SPECS.length

const WASTE_TYPE_NAMES = [
  "Plástico",
  "Vidro",
  "Papel / cartão",
  "Metal",
  "Madeira",
  "Outros"
]

const WASTE_ITEMS = [
  { typeIdx: 0, name: "Garrafa PET", grams: 25, unit: "unit" },
  { typeIdx: 0, name: "Embalagem filme plástico", grams: 8, unit: "unit" },
  { typeIdx: 0, name: "Tampa plástica", grams: 3, unit: "unit" },
  { typeIdx: 0, name: "Plástico triturado (sacos)", grams: null, unit: "kg" },
  { typeIdx: 1, name: "Frasco de vidro", grams: 120, unit: "unit" },
  { typeIdx: 1, name: "Cacos de vidro mistos", grams: 45, unit: "unit" },
  { typeIdx: 1, name: "Vidro recolhido (balde)", grams: null, unit: "kg" },
  { typeIdx: 2, name: "Caixa de cartão", grams: 80, unit: "unit" },
  { typeIdx: 2, name: "Copos de papel", grams: 12, unit: "unit" },
  { typeIdx: 3, name: "Lata de alumínio", grams: 14, unit: "unit" },
  { typeIdx: 3, name: "Clip metálico / arame", grams: 5, unit: "unit" },
  { typeIdx: 3, name: "Metal ferroso (kg)", grams: null, unit: "kg" },
  { typeIdx: 4, name: "Sarilhos / madeira flutuante", grams: 200, unit: "unit" },
  { typeIdx: 4, name: "Palitos / cotonetes", grams: 2, unit: "unit" },
  { typeIdx: 5, name: "Isopor fragmentado", grams: 15, unit: "unit" },
  { typeIdx: 5, name: "Mecha ou corda nylon", grams: 40, unit: "unit" }
]

const CAMPAIGN_BLUEPRINTS = [
  {
    title: "Limpeza da Costa Norte — Ofir",
    meetingLoc: "Estacionamento junto à escola de surf",
    meetingTime: "09:30:00",
    startDate: "2026-05-10",
    endDate: "2026-05-10",
    status: 4,
    beachIndexes: [0, 1]
  },
  {
    title: "Voluntários pela Ramalha",
    meetingLoc: "Entrada principal da praia",
    meetingTime: "08:45:00",
    startDate: "2026-06-15",
    endDate: "2026-06-15",
    status: 1,
    beachIndexes: [1, 2]
  },
  {
    title: "Mar limpo em Esposende",
    meetingLoc: "Posto médico da praia",
    meetingTime: "10:00:00",
    startDate: "2026-07-08",
    endDate: "2026-07-09",
    status: 1,
    beachIndexes: [2, 17]
  },
  {
    title: "Matosinhos sem lixo marinho",
    meetingLoc: "Pérgola central",
    meetingTime: "09:00:00",
    startDate: "2026-05-22",
    endDate: "2026-05-22",
    status: 4,
    beachIndexes: [5, 6]
  },
  {
    title: "Rede Azurara — manhã",
    meetingLoc: "Café na marginal",
    meetingTime: "08:30:00",
    startDate: "2026-08-01",
    endDate: "2026-08-01",
    status: 1,
    beachIndexes: [7, 8]
  },
  {
    title: "Cascais — onda de voluntários",
    meetingLoc: "Quiosque informação",
    meetingTime: "09:15:00",
    startDate: "2026-09-12",
    endDate: "2026-09-13",
    status: 3,
    beachIndexes: [9, 10]
  },
  {
    title: "Carcavelos limpa",
    meetingLoc: "Saída da estação",
    meetingTime: "07:45:00",
    startDate: "2026-04-18",
    endDate: "2026-04-18",
    status: 4,
    beachIndexes: [11]
  },
  {
    title: "Algarve — Falésia em ação",
    meetingLoc: "Topo das escadas da falésia",
    meetingTime: "08:00:00",
    startDate: "2026-10-03",
    endDate: "2026-10-04",
    status: 1,
    beachIndexes: [12, 13]
  },
  {
    title: "Barril e dunas",
    meetingLoc: "Parque de estacionamento sul",
    meetingTime: "09:45:00",
    startDate: "2026-07-20",
    endDate: "2026-07-20",
    status: 4,
    beachIndexes: [14, 15]
  },
  {
    title: "Interior — margem do Tua",
    meetingLoc: "Centro de interpretação",
    meetingTime: "10:30:00",
    startDate: "2026-06-01",
    endDate: "2026-06-01",
    status: 1,
    beachIndexes: [16]
  },
  {
    title: "Planeado: grande mutirão regional",
    meetingLoc: "Local a definir",
    meetingTime: "09:00:00",
    startDate: "2027-03-01",
    endDate: "2027-03-02",
    status: 0,
    beachIndexes: [0, 3]
  },
  {
    title: "Corrente solidária Vila do Conde",
    meetingLoc: "Fortaleza — portão norte",
    meetingTime: "09:20:00",
    startDate: "2026-08-20",
    endDate: "2026-08-21",
    status: 1,
    beachIndexes: [8]
  },
  {
    title: "Praias norte — mutirão Esposende",
    meetingLoc: "Apeadeiro da Ramalha — estacionamento",
    meetingTime: "09:00:00",
    startDate: "2026-05-24",
    endDate: "2026-05-24",
    status: 1,
    beachIndexes: [18, 19, 20, 21, 22]
  }
]

const COMMENT_SNIPPETS = [
  "Contagem final foi positiva, menos sacos que no ano passado.",
  "Tragam luvas reutilizáveis na próxima.",
  "Água e chapéu obrigatórios — sol forte.",
  "Obrigado a todos os voluntários pela pontualidade.",
  "Detectámos mais plástico perto da zona das dunas.",
  "Inscrito e pronto para ajudar na recolha.",
  "Posso levar carrinho de transporte se precisarem.",
  "Há estacionamento gratuito ao fim-de-semana.",
  "Confirmo presença com mais dois familiares.",
  "Excelente organização na distribuição dos sacos."
]

function assertCampaignBeachIndexes() {
  for (let i = 0; i < CAMPAIGN_BLUEPRINTS.length; i++) {
    const bp = CAMPAIGN_BLUEPRINTS[i]
    for (const bi of bp.beachIndexes) {
      if (!Number.isInteger(bi) || bi < 0 || bi >= BEACH_COUNT) {
        throw new Error(
          `Seed: campanha índice ${i} "${bp.title}" referencia praia índice ${bi} inválido (0..${BEACH_COUNT - 1})`
        )
      }
    }
  }
}

function districtCodeSetForBeachIndexes(beachIndexes) {
  const codes = new Set()
  for (const bi of beachIndexes) {
    const loc = LOCATIONS[BEACH_SPECS[bi].locIndex]
    const code = districtCodeFromLabel(loc.district)
    if (!code) {
      throw new Error(
        `Seed: distrito da localização índice ${BEACH_SPECS[bi].locIndex} ("${loc.district}") não mapeia para código conhecido`
      )
    }
    codes.add(code)
  }
  return codes
}

function assertCampaignDistrictConsistency() {
  for (let i = 0; i < CAMPAIGN_BLUEPRINTS.length; i++) {
    const bp = CAMPAIGN_BLUEPRINTS[i]
    const codes = districtCodeSetForBeachIndexes(bp.beachIndexes)
    if (codes.size > 1) {
      throw new Error(
        `Seed: campanha índice ${i} "${bp.title}" mistura distritos (${[...codes].join(", ")}); ajusta praias ou blueprints.`
      )
    }
  }
}

function districtCodeForBlueprint(bp) {
  const codes = districtCodeSetForBeachIndexes(bp.beachIndexes)
  const [only] = codes
  return only ?? "braga"
}

function assertCampaignBlueprints() {
  assertCampaignBeachIndexes()
  assertCampaignDistrictConsistency()
}

async function truncateTables() {
  const skip =
    typeof process.env.SEED_SKIP_TRUNCATE === "string" &&
    ["1", "true", "yes"].includes(process.env.SEED_SKIP_TRUNCATE.trim().toLowerCase())
  if (skip) {
    console.warn("SEED_SKIP_TRUNCATE ativo: tabelas não foram truncadas.")
    return
  }
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0")
  for (const table of TABLES_TRUNCATE_ORDER) {
    try {
      await sequelize.query(`TRUNCATE TABLE \`${table}\``)
    } catch (e) {
      console.warn(`TRUNCATE ${table}: ${e.message}`)
    }
  }
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 1")
}

async function seedUsers(passwordHash, now) {
  const organizerRows = []
  for (let i = 1; i <= 6; i++) {
    organizerRows.push({
      id: randomUUID(),
      name: `Organizador ${i}`,
      email: `organizador${i}@demo.local`,
      passwordHash,
      isOrganizer: true,
      tokenVersion: 0,
      phone: `+351910${String(100100 + i).padStart(6, "0")}`,
      createdAt: now,
      updatedAt: now
    })
  }

  const volunteerRows = []
  for (let i = 1; i <= 24; i++) {
    volunteerRows.push({
      id: randomUUID(),
      name: `Voluntário ${String(i).padStart(2, "0")}`,
      email: `voluntario${String(i).padStart(2, "0")}@demo.local`,
      passwordHash,
      tokenVersion: 0,
      phone: `+351920${String(100000 + i).padStart(6, "0")}`,
      createdAt: now,
      updatedAt: now
    })
  }

  const adminRow = {
    id: randomUUID(),
    name: "Admin Demo",
    email: "admin@demo.local",
    passwordHash,
    isAdmin: true,
    tokenVersion: 0,
    phone: "+351910000003",
    createdAt: now,
    updatedAt: now
  }

  await User.bulkCreate([adminRow, ...organizerRows, ...volunteerRows])

  return {
    adminId: adminRow.id,
    organizerIds: organizerRows.map((r) => r.id),
    volunteerIds: volunteerRows.map((r) => r.id),
    organizerRows,
    volunteerRows
  }
}

async function seedBeachLocations(now) {
  const locationRows = LOCATIONS.map((loc) => ({
    id: randomUUID(),
    district: loc.district,
    municipality: loc.municipality,
    parish: loc.parish,
    nutsCode: loc.nutsCode,
    createdAt: now,
    updatedAt: now
  }))
  await BeachLocation.bulkCreate(locationRows)
  return locationRows.map((r) => r.id)
}

async function seedBeaches(locationIdByIndex, organizerIds, now) {
  const beachRows = BEACH_SPECS.map((spec, idx) => ({
    id: randomUUID(),
    beachLocationId: locationIdByIndex[spec.locIndex],
    createdByUserId: organizerIds[idx % organizerIds.length],
    name: spec.name,
    latitude: spec.lat,
    longitude: spec.lng,
    description:
      idx % 3 === 0 ? "Zona costeira incluída no programa de monitorização." : null,
    createdAt: now,
    updatedAt: now
  }))
  await Beach.bulkCreate(beachRows)
  return beachRows.map((r) => r.id)
}

async function seedWasteCatalog(now) {
  const wasteTypeRows = WASTE_TYPE_NAMES.map((name) => ({
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now
  }))
  await WasteType.bulkCreate(wasteTypeRows)
  const wasteTypeIds = wasteTypeRows.map((r) => r.id)

  const wasteRows = WASTE_ITEMS.map((w) => ({
    id: randomUUID(),
    wasteTypeId: wasteTypeIds[w.typeIdx],
    name: w.name,
    unit: w.unit ?? "unit",
    averageWeightGrams: w.grams ?? null,
    createdAt: now,
    updatedAt: now
  }))
  await Waste.bulkCreate(wasteRows, {
    fields: [
      "id",
      "wasteTypeId",
      "name",
      "unit",
      "averageWeightGrams",
      "createdAt",
      "updatedAt"
    ]
  })
  return { wasteTypeRows, wasteRows, wasteIds: wasteRows.map((r) => r.id) }
}

async function seedCampaignsAndLinks(organizerIds, beachIdByIndex, now) {
  const campaignRows = CAMPAIGN_BLUEPRINTS.map((bp, idx) => {
    const districtCode = districtCodeForBlueprint(bp)
    return {
      id: randomUUID(),
      title: bp.title,
      description: `Campanha de seed ${idx + 1}: envolvimento local e recolha selectiva de resíduos.`,
      meetingLocation: bp.meetingLoc,
      meetingTime: bp.meetingTime,
      startDate: bp.startDate,
      endDate: bp.endDate,
      status: bp.status,
      districtCode,
      organizerId: organizerIds[idx % organizerIds.length],
      createdAt: now,
      updatedAt: now
    }
  })
  await Campaign.bulkCreate(campaignRows)

  const campaignLinks = []
  for (let c = 0; c < campaignRows.length; c++) {
    const bp = CAMPAIGN_BLUEPRINTS[c]
    for (const bi of bp.beachIndexes) {
      campaignLinks.push({
        id: randomUUID(),
        campaignId: campaignRows[c].id,
        beachId: beachIdByIndex[bi],
        createdAt: now
      })
    }
  }
  await CampaignBeach.bulkCreate(campaignLinks)
  return { campaignRows, campaignLinks }
}

async function seedRegistrations(campaignRows, volunteerIds, now) {
  const registrationRows = []
  const pairSeen = new Set()
  let regIdx = 0
  for (let v = 0; v < volunteerIds.length; v++) {
    const numCampaigns = 2 + (v % 4)
    for (let k = 0; k < numCampaigns; k++) {
      const campOffset = (v * 3 + k * 5) % campaignRows.length
      const campaignId = campaignRows[campOffset].id
      const key = `${campaignId}:${volunteerIds[v]}`
      if (pairSeen.has(key)) continue
      pairSeen.add(key)
      registrationRows.push({
        id: randomUUID(),
        campaignId,
        userId: volunteerIds[v],
        role: 0,
        status: regIdx % 5 === 0 ? 0 : 1,
        attendance: regIdx % 7 === 0 ? true : regIdx % 11 === 0 ? false : null,
        createdAt: now,
        updatedAt: now
      })
      regIdx++
    }
  }
  await Registration.bulkCreate(registrationRows)
  return registrationRows
}

async function seedComments(campaignRows, volunteerIds, now) {
  const commentRows = []
  for (let c = 0; c < campaignRows.length; c++) {
    const numComments = 2 + (c % 4)
    for (let j = 0; j < numComments; j++) {
      const authorId = volunteerIds[(c * 3 + j * 7) % volunteerIds.length]
      commentRows.push({
        id: randomUUID(),
        campaignId: campaignRows[c].id,
        userId: authorId,
        body: COMMENT_SNIPPETS[(c + j) % COMMENT_SNIPPETS.length],
        isVisible: j !== 2,
        createdAt: now,
        updatedAt: now
      })
    }
  }
  await Comment.bulkCreate(commentRows)
  return commentRows
}

async function seedWasteCollections(
  campaignRows,
  beachIdByIndex,
  wasteIds,
  organizerIds,
  volunteerIds,
  now
) {
  const collectionRows = []
  const collectionKey = new Set()
  let rowIdx = 0
  for (let c = 0; c < campaignRows.length; c++) {
    const bp = CAMPAIGN_BLUEPRINTS[c]
    const campaignId = campaignRows[c].id
    const recorder = organizerIds[c % organizerIds.length]
    let wOffset = c % wasteIds.length
    for (const bi of bp.beachIndexes) {
      const beachId = beachIdByIndex[bi]
      for (let t = 0; t < 3; t++) {
        const wasteId = wasteIds[(wOffset + t) % wasteIds.length]
        const ck = `${campaignId}:${beachId}:${wasteId}`
        if (collectionKey.has(ck)) continue
        collectionKey.add(ck)
        const withWeight = rowIdx % 3 !== 0
        collectionRows.push({
          id: randomUUID(),
          campaignId,
          beachId,
          wasteId,
          recordedByUserId:
            t === 0 ? recorder : volunteerIds[(c + bi + t) % volunteerIds.length],
          unitQuantity: 5 + ((c + bi + t) % 40),
          actualWeightKg: withWeight ? Number((0.12 + ((c + t) % 50) * 0.03).toFixed(3)) : null,
          createdAt: now,
          updatedAt: now
        })
        rowIdx++
      }
      wOffset += 2
    }
  }
  await WasteCollection.bulkCreate(collectionRows)
  return collectionRows
}

async function runSeedBody() {
  assertCampaignBlueprints()

  const plainPassword =
    typeof process.env.SEED_USER_PASSWORD === "string" &&
    process.env.SEED_USER_PASSWORD.trim().length > 0
      ? process.env.SEED_USER_PASSWORD.trim()
      : "SeedDemo2026!"

  const passwordHash = await hashPassword(plainPassword)
  const now = new Date()

  const { organizerIds, volunteerRows, organizerRows } = await seedUsers(passwordHash, now)
  const locationIdByIndex = await seedBeachLocations(now)
  const beachIdByIndex = await seedBeaches(locationIdByIndex, organizerIds, now)
  const { wasteTypeRows, wasteRows, wasteIds } = await seedWasteCatalog(now)
  const { campaignRows, campaignLinks } = await seedCampaignsAndLinks(
    organizerIds,
    beachIdByIndex,
    now
  )
  const registrationRows = await seedRegistrations(campaignRows, volunteerRows.map((r) => r.id), now)
  const commentRows = await seedComments(campaignRows, volunteerRows.map((r) => r.id), now)
  const collectionRows = await seedWasteCollections(
    campaignRows,
    beachIdByIndex,
    wasteIds,
    organizerIds,
    volunteerRows.map((r) => r.id),
    now
  )

  console.log(
    `Seed limpeza_praias: ${organizerRows.length} organizadores, ${volunteerRows.length} voluntários, ` +
      `${LOCATIONS.length} localizações, ${BEACH_SPECS.length} praias, ${wasteTypeRows.length} tipos de resíduo, ` +
      `${wasteRows.length} resíduos (${wasteRows.filter((w) => w.unit === "kg").length} em kg), ` +
      `${campaignRows.length} campanhas, ${campaignLinks.length} ligações campanha-praia, ` +
      `${registrationRows.length} inscrições, ${commentRows.length} comentários, ${collectionRows.length} recolhas.`
  )
  console.log(
    "Contas: organizador1@demo.local … organizador6@demo.local, voluntario01@demo.local …, admin@demo.local"
  )
  console.log("Palavra-passe: SEED_USER_PASSWORD no .env ou SeedDemo2026!")
  console.log("Opcional: SEED_SKIP_TRUNCATE=1 para inserir sem TRUNCATE (pode falhar por duplicados).")
}

export async function runLimpezaPraiasSeed() {
  validateEnv()
  await sequelize.authenticate()
  await truncateTables()
  await runSeedBody()
  await sequelize.close()
}
