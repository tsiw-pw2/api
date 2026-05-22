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

const DISTRICT_LABEL = "Braga"

const VOLUNTEER_COUNT = 110
const REGISTERED_VOLUNTEERS = 102
const COMMENT_COUNT = 320
const BEACH_SPECS = [
  { name: "Praia de Ofir", lat: 41.533, lng: -8.783, locIndex: 0 },
  { name: "Praia da Ramalha", lat: 41.551, lng: -8.792, locIndex: 0 },
  { name: "Praia de Apúlia (norte)", lat: 41.5227, lng: -8.7701, locIndex: 1 },
  { name: "Praia de Fão (Bonança)", lat: 41.5134, lng: -8.7739, locIndex: 1 },
  { name: "Praia de Belinho", lat: 41.538, lng: -8.775, locIndex: 0 },
  { name: "Praia de Rio de Moinhos", lat: 41.5392, lng: -8.7712, locIndex: 0 }
]

const LOCATIONS = [
  { district: DISTRICT_LABEL, municipality: "Esposende", parish: "Esposende", nutsCode: "11103" },
  { district: DISTRICT_LABEL, municipality: "Esposende", parish: "Apúlia", nutsCode: "11103" }
]

const WASTE_TYPE_NAMES = ["Plástico", "Vidro", "Papel e cartão", "Metal", "Madeira", "Resíduos mistos"]

const WASTE_COUNT = 28

const COMMENT_TEMPLATES = [
  "Sacos entregues no ponto B — contagem manual: {n} unidades visíveis na superfície.",
  "Pedido: reforço de pinças médias na faixa da duna norte (trecho {n}).",
  "Confirmo presença para o turno da manhã. Trago extensão e garrafão de água.",
  "Zona {n}: muito cordel fino entre a maré alta e a vegetação.",
  "Equipa {n} reporta caixote cheio; precisamos de etiquetas adicionais.",
  "Microplásticos acumulados na linha de espuma — vale a pena peneirar fino.",
  "Obrigado à equipa logística pela organização dos kits.",
  "Sugestão: próxima ação com horário escalonado para reduzir congestionamento no parque.",
  "Encontrámos um pneu pequeno semi enterrado — sinalizado com fita no GPS partilhado.",
  "Voluntário {n}: lembrete para calçado fechado na zona rochosa.",
  "Fotos antes/depois enviadas para o álbum partilhado (pasta dia {n}).",
  "Há contentor amarelo cheio junto ao aparcamento — avisar câmara.",
  "Vento forte na tarde; equipa sul reduziu tempo em exposição, tudo bem.",
  "Contagem de bitos de pesca na transecta {n} acima do esperado.",
  "Última passagem: areal limpo à vista, obrigado a todos."
]

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

function districtCode() {
  const code = districtCodeFromLabel(DISTRICT_LABEL)
  if (!code) throw new Error(`Seed dense: distrito "${DISTRICT_LABEL}" sem código`)
  return code
}

function volunteerName(i) {
  const first = [
    "João",
    "Maria",
    "Pedro",
    "Ana",
    "Miguel",
    "Inês",
    "Ricardo",
    "Sofia",
    "Tiago",
    "Beatriz",
    "Gonçalo",
    "Carla",
    "André",
    "Patrícia",
    "Duarte",
    "Helena",
    "Francisco",
    "Rita",
    "Bruno",
    "Luísa"
  ]
  const last = [
    "Silva",
    "Santos",
    "Ferreira",
    "Oliveira",
    "Costa",
    "Rodrigues",
    "Martins",
    "Jesus",
    "Almeida",
    "Ribeiro",
    "Carvalho",
    "Pinto",
    "Correia",
    "Nunes",
    "Teixeira",
    "Monteiro",
    "Araújo",
    "Lopes",
    "Matos",
    "Vieira"
  ]
  return `${first[i % first.length]} ${last[(i * 7) % last.length]} ${String(i + 1).padStart(3, "0")}`
}

function campaignDescription() {
  const parts = [
    "Grande ação de limpeza costeira concentrada num único dia, com vários postos de triagem e registo digital de sacos.",
    "Objetivo: maximizar dados de qualidade (peso, unidades, localização) para relatório municipal e comunicação pública.",
    "Regras: equipamento obrigatório (luvas, calçado fechado), menores acompanhados, e separação rigorosa dos fluxos.",
    "Pontos de encontro por praia com coordenador local; comunicação por canal PMR446 acordado na brief inicial.",
    "Este seed gera centenas de linhas de teste (inscrições, comentários, recolhas) sobre esta campanha única."
  ]
  return parts.join("\n\n")
}

export async function runDenseCampaignDemoSeed() {
  validateEnv()
  await sequelize.authenticate()
  await truncateTables()

  const plainPassword =
    typeof process.env.SEED_USER_PASSWORD === "string" &&
    process.env.SEED_USER_PASSWORD.trim().length > 0
      ? process.env.SEED_USER_PASSWORD.trim()
      : "DenseDemo2026!"

  const passwordHash = await hashPassword(plainPassword)
  const now = new Date()
  const dc = districtCode()

  const idAdmin = randomUUID()
  const idOrgA = randomUUID()
  const idOrgB = randomUUID()
  const idCampaign = randomUUID()
  const volunteerIds = Array.from({ length: VOLUNTEER_COUNT }, () => randomUUID())

  const userRows = [
    {
      id: idAdmin,
      name: "Administrador Dense",
      email: "admin@dense.demo.local",
      passwordHash,
      isAdmin: true,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351910900001",
      createdAt: now,
      updatedAt: now
    },
    {
      id: idOrgA,
      name: "Mariana Azevedo (organizadora)",
      email: "mariana.dense@demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: true,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351910900010",
      createdAt: now,
      updatedAt: now
    },
    {
      id: idOrgB,
      name: "Tiago Ferreira (organizador)",
      email: "tiago.dense@demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: true,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351910900011",
      createdAt: now,
      updatedAt: now
    },
    ...volunteerIds.map((id, i) => ({
      id,
      name: volunteerName(i),
      email: `dense.vol.${String(i + 1).padStart(3, "0")}@demo.local`,
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: i % 11 === 0 ? null : `+351920${String(200000 + i).slice(-6)}`,
      createdAt: now,
      updatedAt: now
    }))
  ]

  await User.bulkCreate(userRows, {
    fields: [
      "id",
      "name",
      "email",
      "passwordHash",
      "isAdmin",
      "isOrganizer",
      "isBlocked",
      "tokenVersion",
      "phone",
      "createdAt",
      "updatedAt"
    ]
  })

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
  const locationIds = locationRows.map((r) => r.id)

  const beachRows = BEACH_SPECS.map((spec, idx) => ({
    id: randomUUID(),
    beachLocationId: locationIds[spec.locIndex],
    createdByUserId: idx % 2 === 0 ? idOrgA : idOrgB,
    name: spec.name,
    latitude: spec.lat,
    longitude: spec.lng,
    description: idx === 2 ? null : "Praia costeira atlântica (dados de demonstração densa).",
    createdAt: now,
    updatedAt: now
  }))
  await Beach.bulkCreate(beachRows)
  const beachIds = beachRows.map((r) => r.id)

  const wasteTypeRows = WASTE_TYPE_NAMES.map((name) => ({
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now
  }))
  await WasteType.bulkCreate(wasteTypeRows)
  const wasteTypeIds = wasteTypeRows.map((r) => r.id)

  const wasteRows = []
  for (let w = 0; w < WASTE_COUNT; w++) {
    const typeIdx = w % wasteTypeIds.length
    const unit = w % 5 === 0 ? "kg" : "unit"
    wasteRows.push({
      id: randomUUID(),
      wasteTypeId: wasteTypeIds[typeIdx],
      name: `Amostra resíduo ${String(w + 1).padStart(2, "0")} — ${WASTE_TYPE_NAMES[typeIdx]}`,
      unit,
      averageWeightGrams: unit === "kg" ? null : 5 + (w % 180),
      createdAt: now,
      updatedAt: now
    })
  }
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
  const wasteIds = wasteRows.map((r) => r.id)

  await Campaign.create({
    id: idCampaign,
    title: "Mutirão denso — uma campanha com volume elevado de dados de teste",
    description: campaignDescription(),
    meetingLocation: "Rotunda de Ofir — relvado entre o rio Cávado e o oceano (lado nascente do parque)",
    meetingTime: "08:30:00",
    startDate: "2026-09-14",
    endDate: "2026-09-15",
    status: 3,
    districtCode: dc,
    organizerId: idOrgA,
    createdAt: now,
    updatedAt: now
  })

  const campaignBeachRows = beachIds.map((beachId) => ({
    id: randomUUID(),
    campaignId: idCampaign,
    beachId,
    createdAt: now
  }))
  await CampaignBeach.bulkCreate(campaignBeachRows)

  const registrationRows = []
  for (let i = 0; i < REGISTERED_VOLUNTEERS; i++) {
    const uid = volunteerIds[i]
    let status = 1
    if (i % 11 === 0) status = 0
    else if (i % 13 === 0) status = 2
    let attendance = null
    if (status === 1) {
      const m = i % 3
      attendance = m === 0 ? null : m === 1 ? true : false
    }
    registrationRows.push({
      id: randomUUID(),
      campaignId: idCampaign,
      userId: uid,
      role: 0,
      status,
      attendance,
      createdAt: now,
      updatedAt: now
    })
  }
  registrationRows.push({
    id: randomUUID(),
    campaignId: idCampaign,
    userId: idOrgB,
    role: 1,
    status: 1,
    attendance: null,
    createdAt: now,
    updatedAt: now
  })
  await Registration.bulkCreate(registrationRows)

  const commentAuthorPool = [idOrgA, idOrgB, ...volunteerIds]
  const commentRows = []
  for (let c = 0; c < COMMENT_COUNT; c++) {
    const tpl = COMMENT_TEMPLATES[c % COMMENT_TEMPLATES.length].replace(/\{n\}/g, String((c % 50) + 1))
    const extra = c % 17 === 0 ? `\n\nLinha extra ${c}: registo de ocorrência para teste de quebras de linha na UI.` : ""
    const body = `${tpl}${extra}`
    const userId = commentAuthorPool[c % commentAuthorPool.length]
    commentRows.push({
      id: randomUUID(),
      campaignId: idCampaign,
      userId,
      body,
      isVisible: c % 14 === 0 ? false : true,
      createdAt: now,
      updatedAt: now
    })
  }
  await Comment.bulkCreate(commentRows)

  const collectionRows = []
  let rowIdx = 0
  for (let b = 0; b < beachIds.length; b++) {
    for (let w = 0; w < wasteIds.length; w++) {
      const recorder =
        rowIdx % 5 === 0 ? idOrgA : volunteerIds[rowIdx % volunteerIds.length]
      const withWeight = rowIdx % 4 !== 0
      collectionRows.push({
        id: randomUUID(),
        campaignId: idCampaign,
        beachId: beachIds[b],
        wasteId: wasteIds[w],
        recordedByUserId: recorder,
        unitQuantity: 1 + (rowIdx % 220),
        actualWeightKg: withWeight ? Number((0.05 + (rowIdx % 180) * 0.01).toFixed(3)) : null,
        createdAt: now,
        updatedAt: now
      })
      rowIdx++
    }
  }
  await WasteCollection.bulkCreate(collectionRows)

  const regByStatus = { p: 0, c: 0, cancelled: 0 }
  for (const r of registrationRows) {
    if (r.status === 0) regByStatus.p++
    else if (r.status === 2) regByStatus.cancelled++
    else regByStatus.c++
  }
  const hiddenComments = commentRows.filter((x) => !x.isVisible).length

  console.log("")
  console.log("Seed dense_campaign_demo concluído.")
  console.log(
    `Uma campanha: ${beachIds.length} praias, ${wasteIds.length} tipos de resíduo distintos, ` +
      `${collectionRows.length} recolhas (grelha completa praia×resíduo, respeitando uk_recolha_unique).`
  )
  console.log(
    `Utilizadores: ${userRows.length} (admin + 2 organizadores + ${VOLUNTEER_COUNT} voluntários). ` +
      `Inscrições na campanha: ${registrationRows.length} (pendentes ${regByStatus.p}, canceladas ${regByStatus.cancelled}, confirmadas/outras ${regByStatus.c}).`
  )
  console.log(`Comentários: ${commentRows.length} (${hiddenComments} ocultos para testes de admin).`)
  console.log("")
  console.log("Contas (SEED_USER_PASSWORD ou DenseDemo2026!):")
  console.log("  admin@dense.demo.local")
  console.log("  mariana.dense@demo.local")
  console.log("  tiago.dense@demo.local")
  console.log(`  dense.vol.001@demo.local … dense.vol.${String(VOLUNTEER_COUNT).padStart(3, "0")}@demo.local`)
  console.log("")
  console.log("Opcional: SEED_SKIP_TRUNCATE=1 para inserir sem TRUNCATE (pode falhar por duplicados).")
  console.log("")

  await sequelize.close()
}
