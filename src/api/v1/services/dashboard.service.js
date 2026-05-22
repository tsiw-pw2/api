import { Op, QueryTypes } from "sequelize"
import { sequelize } from "../../../config/sequelize.js"
import {
  Beach,
  Campaign,
  CampaignBeach,
  Registration,
  Waste,
  WasteCollection
} from "../../../models/index.js"

function formatPtLongDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d)
}

const NEXT_CAMPAIGN_STATUS_WHERE = {
  deletedAt: null,
  status: { [Op.in]: [1, 2, 3] }
}

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

export async function buildDashboardOverview() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  const todayStr = `${y}-${m}-${day}`

  const [
    campaignCount,
    beachCount,
    completedCampaigns,
    weightSumRaw,
    unitsSumRaw,
    collectionsForTop,
    nextCampaign
  ] = await Promise.all([
    Campaign.count({ where: { deletedAt: null } }),
    Beach.count({ where: { deletedAt: null } }),
    Campaign.count({ where: { deletedAt: null, status: 4 } }),
    WasteCollection.sum("actualWeightKg", { where: { deletedAt: null } }),
    WasteCollection.sum("unitQuantity", { where: { deletedAt: null } }),
    WasteCollection.findAll({
      where: { deletedAt: null },
      attributes: ["wasteId", "unitQuantity"],
      include: [{ model: Waste, as: "waste", attributes: ["name"], required: false }]
    }),
    findNextNearestCampaign(todayStr)
  ])

  const volunteerRows = await sequelize.query(
    "SELECT COUNT(DISTINCT utilizador_id) AS c FROM inscricao WHERE deleted_at IS NULL",
    { type: QueryTypes.SELECT }
  )
  const volunteerCount = Number(volunteerRows[0]?.c ?? 0)

  const weightKg =
    weightSumRaw != null && Number.isFinite(Number(weightSumRaw))
      ? Number(weightSumRaw)
      : 0
  const unitsTotal =
    unitsSumRaw != null && Number.isFinite(Number(unitsSumRaw))
      ? Number(unitsSumRaw)
      : 0

  const agg = new Map()
  for (const row of collectionsForTop) {
    const wid = row.wasteId
    const qty = Number(row.unitQuantity) || 0
    agg.set(wid, (agg.get(wid) ?? 0) + qty)
  }
  let topName = "—"
  let topQty = 0
  for (const row of collectionsForTop) {
    const total = agg.get(row.wasteId) ?? 0
    if (total > topQty) {
      topQty = total
      topName = row.waste?.name ?? "—"
    }
  }
  if (topQty === 0) {
    topName = "—"
  }

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
      volunteerCount
    },
    cleaningStatsRows: [
      { label: "Campanhas concluídas", value: String(completedCampaigns) },
      { label: "Kg recolhidos", value: String(Math.round(weightKg)) },
      { label: "Resíduos apanhados", value: String(Math.round(unitsTotal)) },
      { label: "Resíduo mais comum", value: topName }
    ],
    nextCampaignRows,
    nextCampaignId: nextCampaign?.id ?? null
  }
}
