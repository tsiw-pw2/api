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

const LOCATIONS = [
  { district: DISTRICT_LABEL, municipality: "Esposende", parish: "Esposende", nutsCode: "11103" },
  { district: DISTRICT_LABEL, municipality: "Esposende", parish: "Apúlia", nutsCode: "11103" }
]

const BEACH_SPECS = [
  { name: "Praia de Ofir", lat: 41.533, lng: -8.783, locIndex: 0 },
  { name: "Praia da Ramalha", lat: 41.551, lng: -8.792, locIndex: 0 },
  { name: "Praia de Apúlia (norte)", lat: 41.5227, lng: -8.7701, locIndex: 1 },
  { name: "Praia de Fão (Bonança)", lat: 41.5134, lng: -8.7739, locIndex: 1 }
]

const LONG_DESCRIPTION = [
  "Objetivo: reduzir microplásticos na linha de costa e sensibilizar famílias.",
  "Material: sacos reutilizáveis, pinças com rosca e baldes numerados por equipa.",
  "Logística: duas saídas (manhã e tarde), ponto de água potável e tenda de primeiros socorros.",
  "Dados: registo fotográfico antes/depois na mesma transecta, com GPS do telemóvel.",
  "Acessibilidade: percurso plano nas primeiras 400 m; parte sul com escadas — voluntários escolhem o segmento.",
  "Meteorologia: em vento forte (>40 km/h) adia-se só a componente na duna; praia mantém-se se segurança ok.",
  "Resíduos-alvo: isopor fragmentado, cordas de nylon, tampas e bitos de pesca.",
  "Privacidade: não publicar rostos de menores sem autorização escrita dos encarregados de educação.",
  "Reforço: trazer chapéu, protetor solar mineral e garrafa de aço — evitar plástico descartável.",
  "Fecho: entrega de sacos numerados, pesagem opcional e decontaminação das pinças no contentor certo."
]
  .join(" ")
  .repeat(4)
  .slice(0, 6200)

const PARAGRAPH_COMMENT = `Bom dia a todos,

Confirmo que fico com o kit 3 (pinças médias). Levo também extensões elétricas para carregar telemétrica simples.

Cumprimentos,
Inês`

const HIDDEN_COMMENT =
  "[moderation] Conteúdo reportado por duplicar link externo suspeito — mantido oculto até revisão manual."

const WASTE_TYPES = ["Plástico", "Vidro", "Papel e cartão", "Outros"]

const WASTE_ITEMS = [
  { typeIdx: 0, name: "Garrafa PET (vários tamanhos)", grams: 22, unit: "unit" },
  { typeIdx: 0, name: "Pelotas / nurdles", grams: 1, unit: "unit" },
  { typeIdx: 1, name: "Cacos de vidro mistos", grams: 40, unit: "unit" },
  { typeIdx: 2, name: "Caixa de cartão encerado", grams: 90, unit: "unit" },
  { typeIdx: 3, name: "Isopor fragmentado", grams: 12, unit: "unit" },
  { typeIdx: 0, name: "Plástico triturado (balde)", grams: null, unit: "kg" }
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
  if (!code) throw new Error(`Seed edge: distrito "${DISTRICT_LABEL}" sem código`)
  return code
}

export async function runQualityEdgeDemoSeed() {
  validateEnv()
  await sequelize.authenticate()
  await truncateTables()

  const plainPassword =
    typeof process.env.SEED_USER_PASSWORD === "string" &&
    process.env.SEED_USER_PASSWORD.trim().length > 0
      ? process.env.SEED_USER_PASSWORD.trim()
      : "EdgeDemo2026!"

  const passwordHash = await hashPassword(plainPassword)
  const now = new Date()
  const dc = districtCode()

  const id = {
    admin: randomUUID(),
    orgMariana: randomUUID(),
    orgTiago: randomUUID(),
    volInes: randomUUID(),
    volRicardo: randomUUID(),
    volHelena: randomUUID(),
    volDuarte: randomUUID(),
    volSofia: randomUUID(),
    volMiguel: randomUUID(),
    volBeatriz: randomUUID(),
    volGoncalo: randomUUID(),
    volCarla: randomUUID(),
    volAndre: randomUUID(),
    volPatricia: randomUUID(),
    blocked: randomUUID()
  }

  const userRows = [
    {
      id: id.admin,
      name: "Mariana Costa (admin)",
      email: "admin@edge.demo.local",
      passwordHash,
      isAdmin: true,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351910000001",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.orgMariana,
      name: "Mariana Azevedo",
      email: "mariana.azevedo@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: true,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351910000011",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.orgTiago,
      name: "Tiago Ferreira",
      email: "tiago.ferreira@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: true,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351910000022",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volInes,
      name: "Inês Rodrigues",
      email: "ines.rodrigues@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100001",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volRicardo,
      name: "Ricardo Peixoto",
      email: "ricardo.peixoto@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100002",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volHelena,
      name: "Helena Matos",
      email: "helena.matos@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volDuarte,
      name: "Duarte Pimentel",
      email: "duarte.pimentel@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100004",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volSofia,
      name: "Sofia Carvalho",
      email: "sofia.carvalho@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100005",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volMiguel,
      name: "Miguel Ângelo Lopes",
      email: "miguel.lopes@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100006",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volBeatriz,
      name: "Beatriz Nogueira",
      email: "beatriz.nogueira@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100007",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volGoncalo,
      name: "Gonçalo Martins",
      email: "goncalo.martins@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100008",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volCarla,
      name: "Carla Sequeira",
      email: "carla.sequeira@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100009",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volAndre,
      name: "André Vieira",
      email: "andre.vieira@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100010",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.volPatricia,
      name: "Patrícia Lemos",
      email: "patricia.lemos@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      tokenVersion: 0,
      phone: "+351920100011",
      createdAt: now,
      updatedAt: now
    },
    {
      id: id.blocked,
      name: "Conta Bloqueada (demo)",
      email: "bloqueado@edge.demo.local",
      passwordHash,
      isAdmin: false,
      isOrganizer: false,
      tokenVersion: 0,
      phone: "+351920199999",
      isBlocked: true,
      blockedReason: "Conta suspensa após revisão de segurança (dados de demonstração).",
      blockedAt: now,
      createdAt: now,
      updatedAt: now
    }
  ]

  await User.bulkCreate(userRows, {
    fields: [
      "id",
      "name",
      "email",
      "passwordHash",
      "isAdmin",
      "isOrganizer",
      "tokenVersion",
      "phone",
      "isBlocked",
      "blockedReason",
      "blockedAt",
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
    createdByUserId: idx % 2 === 0 ? id.orgMariana : id.orgTiago,
    name: spec.name,
    latitude: spec.lat,
    longitude: spec.lng,
    description:
      idx === 0
        ? "Praia atlântica com zona de estacionamento e acesso para pessoas com mobilidade reduzida na marginal norte."
        : idx === 3
          ? null
          : "Integrada no inventário costeiro de resíduos marinhos (demonstração).",
    createdAt: now,
    updatedAt: now
  }))
  await Beach.bulkCreate(beachRows)
  const beachIds = beachRows.map((r) => r.id)

  const wasteTypeRows = WASTE_TYPES.map((name) => ({
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
    unit: w.unit,
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
  const wasteIds = wasteRows.map((r) => r.id)

  const campDraft = randomUUID()
  const campScheduled = randomUUID()
  const campOngoing = randomUUID()
  const campCompleted = randomUUID()
  const campNoTime = randomUUID()

  const campaignRows = [
    {
      id: campDraft,
      title: "Rascunho — inventário Ofir (sem descrição)",
      description: null,
      meetingLocation: "A definir com a câmara municipal — zona norte do aparcamento",
      meetingTime: "09:15:00",
      startDate: "2027-04-10",
      endDate: "2027-04-10",
      status: 0,
      districtCode: dc,
      organizerId: id.orgMariana,
      createdAt: now,
      updatedAt: now
    },
    {
      id: campScheduled,
      title: "Ação «Mar limpo» Ramalha — inscrições abertas",
      description:
        "Voluntários recebem kit no encontro. Crianças apenas acompanhadas. Limite de 35 participantes ativos no areal.",
      meetingLocation: "Entrada principal da praia da Ramalha (lado sul, junto ao posto médico sazonal)",
      meetingTime: "08:45:00",
      startDate: "2026-07-12",
      endDate: "2026-07-12",
      status: 1,
      districtCode: dc,
      organizerId: id.orgMariana,
      createdAt: now,
      updatedAt: now
    },
    {
      id: campOngoing,
      title: "Mutirão multi-praia — Ofir, Ramalha e Apúlia",
      description: LONG_DESCRIPTION,
      meetingLocation: "Rotunda de Ofir — parque relvado entre o rio e o oceano",
      meetingTime: "09:00:00",
      startDate: "2026-06-20",
      endDate: "2026-06-21",
      status: 3,
      districtCode: dc,
      organizerId: id.orgTiago,
      createdAt: now,
      updatedAt: now
    },
    {
      id: campCompleted,
      title: "Fecho de temporada — Fão (concluída)",
      description: "Campanha concluída com relatório interno. Dados aqui servem apenas para histórico de UI.",
      meetingLocation: "Bonança — largo junto à capela",
      meetingTime: "10:00:00",
      startDate: "2026-05-03",
      endDate: "2026-05-03",
      status: 4,
      districtCode: dc,
      organizerId: id.orgTiago,
      createdAt: now,
      updatedAt: now
    },
    {
      id: campNoTime,
      title: "Teste UI — hora de encontro ausente",
      description: "Campo hora a null na base de dados; local ainda obrigatório.",
      meetingLocation: "Praia de Apúlia — zona do saveiro (coordenadas no pin do mapa da organização)",
      meetingTime: null,
      startDate: "2026-08-02",
      endDate: "2026-08-02",
      status: 1,
      districtCode: dc,
      organizerId: id.orgMariana,
      createdAt: now,
      updatedAt: now
    }
  ]
  await Campaign.bulkCreate(campaignRows)

  const links = [
    { campaignId: campDraft, beachIdx: 0 },
    { campaignId: campDraft, beachIdx: 1 },
    { campaignId: campScheduled, beachIdx: 1 },
    { campaignId: campOngoing, beachIdx: 0 },
    { campaignId: campOngoing, beachIdx: 1 },
    { campaignId: campOngoing, beachIdx: 2 },
    { campaignId: campCompleted, beachIdx: 3 },
    { campaignId: campNoTime, beachIdx: 2 }
  ].map((x) => ({
    id: randomUUID(),
    campaignId: x.campaignId,
    beachId: beachIds[x.beachIdx],
    createdAt: now
  }))
  await CampaignBeach.bulkCreate(links)

  const registrationRows = [
    {
      id: randomUUID(),
      campaignId: campDraft,
      userId: id.volInes,
      role: 0,
      status: 0,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campDraft,
      userId: id.volDuarte,
      role: 0,
      status: 0,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campDraft,
      userId: id.volSofia,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.volInes,
      role: 0,
      status: 1,
      attendance: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.volRicardo,
      role: 0,
      status: 2,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.volMiguel,
      role: 0,
      status: 1,
      attendance: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.orgTiago,
      role: 1,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      userId: id.volBeatriz,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      userId: id.volGoncalo,
      role: 0,
      status: 1,
      attendance: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      userId: id.volCarla,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      userId: id.volHelena,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campCompleted,
      userId: id.volAndre,
      role: 0,
      status: 1,
      attendance: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campNoTime,
      userId: id.volPatricia,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.blocked,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    }
  ]
  await Registration.bulkCreate(registrationRows)

  const commentRows = [
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.orgMariana,
      body: "Lista de verificação: sacos azuis (reciclável), sacos pretos (resto), pinças com cabo longo para vidro.",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.volInes,
      body: PARAGRAPH_COMMENT,
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.volMiguel,
      body: "Ok.",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campScheduled,
      userId: id.volDuarte,
      body: HIDDEN_COMMENT,
      isVisible: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      userId: id.orgTiago,
      body: "Equipa 2 fica com a faixa entre as coordenadas 41.540 / -8.780 e o poste vermelho. Qualquer dúvida, sinalizem no rádio comercial canal 8 (PMR446).",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      userId: id.volBeatriz,
      body: "Encontrámos muito cordel de pesca fino enterrado na transição areia/duna — convém calçado fechado.",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      userId: id.volGoncalo,
      body: "Comentário de teste com repetição para stress de layout e listas: " + "palavra ".repeat(180).trim(),
      isVisible: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campCompleted,
      userId: id.volAndre,
      body: "Obrigado — pesagens fechadas às 16h10, último saco etiquetado n.º 27.",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campNoTime,
      userId: id.volPatricia,
      body: "Confirmo que o encontro será à hora combinada por mensagem — aqui o campo hora está vazio de propósito.",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    }
  ]
  await Comment.bulkCreate(commentRows)

  const collectionRows = [
    {
      id: randomUUID(),
      campaignId: campOngoing,
      beachId: beachIds[0],
      wasteId: wasteIds[0],
      recordedByUserId: id.orgTiago,
      unitQuantity: 240,
      actualWeightKg: 5.125,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      beachId: beachIds[1],
      wasteId: wasteIds[1],
      recordedByUserId: id.volBeatriz,
      unitQuantity: 1,
      actualWeightKg: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campOngoing,
      beachId: beachIds[2],
      wasteId: wasteIds[5],
      recordedByUserId: id.volGoncalo,
      unitQuantity: 3,
      actualWeightKg: 2.4,
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      campaignId: campCompleted,
      beachId: beachIds[3],
      wasteId: wasteIds[2],
      recordedByUserId: id.orgTiago,
      unitQuantity: 18,
      actualWeightKg: null,
      createdAt: now,
      updatedAt: now
    }
  ]
  await WasteCollection.bulkCreate(collectionRows)

  console.log("")
  console.log("Seed quality_edge_demo concluído.")
  console.log(
    `Resumo: ${userRows.length} utilizadores, ${beachRows.length} praias, ${campaignRows.length} campanhas, ` +
      `${registrationRows.length} inscrições, ${commentRows.length} comentários (${commentRows.filter((c) => !c.isVisible).length} ocultos), ` +
      `${collectionRows.length} recolhas.`
  )
  console.log("")
  console.log("Contas (palavra-passe: SEED_USER_PASSWORD no .env ou EdgeDemo2026!):")
  console.log("  admin@edge.demo.local — administrador")
  console.log("  mariana.azevedo@edge.demo.local — organizadora")
  console.log("  tiago.ferreira@edge.demo.local — organizador")
  console.log("  ines.rodrigues@edge.demo.local — voluntária (várias inscrições)")
  console.log("  ricardo.peixoto@edge.demo.local — inscrição cancelada na Ramalha (não comenta)")
  console.log("  helena.matos@edge.demo.local — telefone null na base de dados")
  console.log("  bloqueado@edge.demo.local — conta bloqueada (também inscrito numa campanha)")
  console.log("")
  console.log("Casos-limite cobertos: descrição null, texto longo, hora null, rascunho, estados de inscrição,")
  console.log("presença sim/não/null, coorganizador (função 1), comentários multilinha, comentários ocultos,")
  console.log("recolha com peso null, quantidade elevada, utilizador bloqueado.")
  console.log("")
  console.log("Opcional: SEED_SKIP_TRUNCATE=1 para inserir sem TRUNCATE (pode falhar por duplicados).")
  console.log("")

  await sequelize.close()
}
