import { Op } from "sequelize"
import { Beach, Campaign, CampaignBeach, Registration, Waste, WasteCollection, WasteType } from "../models/db.config.js"
import { roleFromUser, roleHasCapability } from "../middlewares/auth.middlewares.js"
import { User } from "../models/db.config.js"
import { createError, passControllerError } from "../utils/error.utils.js"
import { aggregateWasteByType, collectionImpactWeightKg, computeWasteImpactTotals, toIsoDateOnly } from "../utils/domain.utils.js"
import { BEACHES_BASE, CAMPAIGNS_BASE, DASHBOARD_BASE, DASHBOARD_OVERVIEW_PATH, USERS_ME_PATH, WASTE_ITEMS_BASE } from "../utils/response.utils.js"

// Formatar data ISO (AAAA-MM-DD) para texto longo em português de Portugal (painel operacional).
function formatPtLongDate(value) {
  const isoDate = toIsoDateOnly(value)
  if (!isoDate) return "—"
  const d = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d)
}

// Estados considerados «próxima campanha»: aberta_inscricoes, encerrada_inscricoes, em_progresso (1|2|3 na BD).
const NEXT_CAMPAIGN_STATUS_WHERE = {
  deletedAt: null,
  status: { [Op.in]: [1, 2, 3] }
}

// Encontrar a campanha mais próxima: primeiro futura por data_inicio; senão a que decorre hoje.
async function findNextNearestCampaign(todayStr) {
  const upcoming = await Campaign.findOne({
    where: {
      ...NEXT_CAMPAIGN_STATUS_WHERE,
      startDate: { [Op.gte]: todayStr }
    },
    order: [["startDate", "ASC"]]
  })
  if (upcoming) return upcoming

  return Campaign.findOne({
    where: {
      ...NEXT_CAMPAIGN_STATUS_WHERE,
      startDate: { [Op.lte]: todayStr },
      endDate: { [Op.gte]: todayStr }
    },
    order: [["endDate", "ASC"], ["startDate", "ASC"]]
  })
}

// Incluir praia, resíduo e tipo para agregar peso por categoria e estimativas no painel.
const DASHBOARD_WASTE_INCLUDE = [
  { model: Beach, as: "beach", attributes: ["id", "name"], required: false },
  {
    model: Waste,
    as: "waste",
    attributes: ["id", "name", "averageWeightGrams"],
    required: false,
    include: [
      { model: WasteType, as: "wasteType", attributes: ["id", "name"], required: false }
    ]
  }
]

// Construir tendência dos últimos 6 meses: unidades e peso (real ou estimado) por mês de criação da recolha.
function buildMonthlyTrend(collections) {
  const monthMap = new Map()
  const now = new Date()
  // Pré-preencher os 6 meses para devolver série contínua mesmo sem recolhas.
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthMap.set(key, { month: key, weightKg: 0, units: 0 })
  }
  for (const row of collections) {
    const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
    if (Number.isNaN(created.getTime())) continue
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`
    if (!monthMap.has(key)) continue
    const entry = monthMap.get(key)
    entry.units += Number(row.unitQuantity) || 0
    entry.weightKg += collectionImpactWeightKg(row, row.waste)
  }
  return [...monthMap.values()].map((entry) => ({
    month: entry.month,
    units: entry.units,
    weightKg: Math.round(entry.weightKg * 1000) / 1000
  }))
}

// Agregar top 5 praias por número de recolhas e peso total (impacto ambiental).
function buildTopBeaches(collections) {
  const byBeach = new Map()
  for (const row of collections) {
    const beachId = row.beachId
    const name = row.beach?.name ?? "—"
    const prev = byBeach.get(beachId) ?? {
      beachId,
      name,
      collectionsCount: 0,
      weightKg: 0
    }
    prev.collectionsCount += 1
    prev.weightKg += collectionImpactWeightKg(row, row.waste)
    byBeach.set(beachId, prev)
  }
  return [...byBeach.values()]
    .map((entry) => ({
      beachId: entry.beachId,
      name: entry.name,
      collectionsCount: entry.collectionsCount,
      weightKg: Math.round(entry.weightKg * 1000) / 1000
    }))
    .sort((a, b) => b.collectionsCount - a.collectionsCount || b.weightKg - a.weightKg)
    .slice(0, 5)
}

// Agregar métricas operacionais da plataforma (campanhas, recolhas, utilizadores, próxima campanha).
async function buildDashboardOverview() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  const todayStr = `${y}-${m}-${day}`

  // Agregar contagens e recolhas em paralelo para o painel operacional.
  const [
    campaignCount,
    beachCount,
    userCount,
    completedCampaigns,
    allCollections,
    nextCampaign
  ] = await Promise.all([
    Campaign.count({ where: { deletedAt: null } }),
    Beach.count({ where: { deletedAt: null } }),
    User.count(),
    Campaign.count({ where: { deletedAt: null, status: 4 } }),
    WasteCollection.findAll({
      where: { deletedAt: null },
      attributes: ["id", "beachId", "wasteId", "unitQuantity", "actualWeightKg", "createdAt"],
      include: DASHBOARD_WASTE_INCLUDE
    }),
    findNextNearestCampaign(todayStr)
  ])

  // Peso total: preferir peso_real_kg; estimar via peso_medio_gramas quando ausente.
  const wasteImpact = computeWasteImpactTotals(allCollections)
  const weightKg = wasteImpact.totalActualWeightKg
  const unitsTotal = allCollections.reduce(
    (sum, row) => sum + (Number(row.unitQuantity) || 0),
    0
  )

  const wasteByType = aggregateWasteByType(allCollections).slice(0, 5)
  const wasteByTypeRows = wasteByType.map((entry) => ({
    label: entry.typeName,
    value: `${Math.round(entry.weightKg)} kg · ${entry.units} un.`
  }))

  // Resíduo mais comum: maior soma de quantidade_unidades entre todos os registos.
  const agg = new Map()
  for (const row of allCollections) {
    const wid = row.wasteId
    const qty = Number(row.unitQuantity) || 0
    agg.set(wid, (agg.get(wid) ?? 0) + qty)
  }
  let topName = "—"
  let topQty = 0
  for (const row of allCollections) {
    const total = agg.get(row.wasteId) ?? 0
    if (total > topQty) {
      topQty = total
      topName = row.waste?.name ?? "—"
    }
  }
  if (topQty === 0) {
    topName = "—"
  }

  const monthlyTrend = buildMonthlyTrend(allCollections)
  const topBeaches = buildTopBeaches(allCollections)

  let nextCampaignRows = [
    { label: "Título", value: "—" },
    { label: "Data", value: "—" },
    { label: "Inscritos", value: "0" },
    { label: "Praias", value: "0" }
  ]

  if (nextCampaign) {
    const [inscCount, beachLinkCount] = await Promise.all([
      Registration.count({ where: { campaignId: nextCampaign.id } }),
      CampaignBeach.count({ where: { campaignId: nextCampaign.id } })
    ])
    nextCampaignRows = [
      { label: "Título", value: nextCampaign.title },
      { label: "Data", value: formatPtLongDate(nextCampaign.startDate) },
      { label: "Inscritos", value: String(inscCount) },
      { label: "Praias", value: String(beachLinkCount) }
    ]
  }

  return {
    metrics: {
      campaignCount,
      beachCount,
      userCount
    },
    cleaningStatsRows: [
      { label: "Campanhas concluídas", value: String(completedCampaigns) },
      { label: "Kg pesados", value: String(Math.round(weightKg)) },
      { label: "Resíduos apanhados", value: String(Math.round(unitsTotal)) },
      { label: "Resíduo mais comum", value: topName }
    ],
    wasteByTypeRows,
    monthlyTrend,
    topBeaches,
    nextCampaignRows,
    nextCampaignId: nextCampaign?.id ?? null
  }
}

// Montar recurso recurso único do painel com ligações hipermedia de navegação (id fixo «overview»).
function buildDashboardResource(overview) {
  const links = {
    self: { href: DASHBOARD_OVERVIEW_PATH, method: "GET" },
    collection: { href: DASHBOARD_BASE, method: "GET" },
    api: { href: "/", method: "GET" },
    userMe: { href: USERS_ME_PATH, method: "GET" },
    campaigns: { href: CAMPAIGNS_BASE, method: "GET" },
    beaches: { href: BEACHES_BASE, method: "GET" },
    wasteItems: { href: WASTE_ITEMS_BASE, method: "GET" }
  }
  // Link condicional para a próxima campanha quando existir candidata activa.
  if (overview.nextCampaignId) {
    links.nextCampaign = {
      href: `${CAMPAIGNS_BASE}/${overview.nextCampaignId}`,
      method: "GET"
    }
  }
  return {
    id: "overview",
    ...overview,
    links
  }
}

/**
 * Painel operacional com métricas agregadas.
 * Método: GET
 * Rota: /dashboards/overview (alternativa GET /dashboards)
 * Autenticação: sim (Bearer JWT, organizador ou admin)
 *
 * Regras de negócio:
 * - Voluntário sem capacidade de painel recebe 403.
 * - Métricas: campanhas, inscrições, recolhas, peso por tipo e tendências mensais.
 *
 * Notas técnicas:
 * - Agregações Sequelize sobre campanha, inscricao e recolha_residuo.
 * - Recurso recurso único com id overview e ligações hipermedia.
 */
export const getDashboard = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.sub, {
      attributes: ["isAdmin", "isOrganizer", "isBlocked"]
    })
    if (!user || user.isBlocked) {
      return next(createError(403, "Forbidden"))
    }
    const role = roleFromUser(user)
    // Voluntário não tem capacidade de painel; organizador e admin acedem.
    if (!roleHasCapability(role, "dashboard")) {
      return next(createError(403, "Forbidden"))
    }
    const overview = await buildDashboardOverview()
    res.json(buildDashboardResource(overview))
  } catch (error) {
    passControllerError(error, next, "Error fetching dashboard")
  }
}
