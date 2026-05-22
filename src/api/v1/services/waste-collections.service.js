import {
  Beach,
  Campaign,
  CampaignBeach,
  Registration,
  User,
  Waste,
  WasteCollection
} from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"
import { isUuidParam } from "../../../utils/uuid-param.js"

const MAX_UNIT_QUANTITY = 100_000_000
const MAX_WEIGHT_KG = 1_000_000

async function assertCanInteractWithCampaignCollections(actorId, campaignId) {
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw ApiError.notFound()
  }

  if (campaign.organizerId === actorId) {
    return campaign
  }

  const user = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return campaign
  }

  const reg = await Registration.findOne({
    where: { campaignId, userId: actorId, status: 1 }
  })

  if (reg) {
    return campaign
  }

  throw ApiError.forbidden()
}

async function assertCanModifyCollection(actorId, collection) {
  const campaign = await Campaign.findByPk(collection.campaignId)
  if (!campaign) {
    throw ApiError.notFound()
  }

  if (campaign.organizerId === actorId) {
    return
  }

  const user = await User.findByPk(actorId, { attributes: ["isAdmin"] })
  if (user?.isAdmin) {
    return
  }

  if (collection.recordedByUserId === actorId) {
    return
  }

  const reg = await Registration.findOne({
    where: { campaignId: collection.campaignId, userId: actorId, status: 1 }
  })

  if (reg) {
    return
  }

  throw ApiError.forbidden()
}

export function mapCollectionRow(w) {
  return {
    id: w.id,
    unitQuantity: w.unitQuantity,
    actualWeightKg: w.actualWeightKg != null ? String(w.actualWeightKg) : null,
    createdAt: w.createdAt.toISOString(),
    beach: w.beach ? { id: w.beach.id, name: w.beach.name } : null,
    waste: w.waste ? { id: w.waste.id, name: w.waste.name } : null,
    recordedBy: w.recordedBy ? { id: w.recordedBy.id, name: w.recordedBy.name } : null
  }
}

const WASTE_COLLECTION_LIST_INCLUDE = [
  { model: Beach, as: "beach", attributes: ["id", "name"] },
  { model: Waste, as: "waste", attributes: ["id", "name"] },
  { model: User, as: "recordedBy", attributes: ["id", "name"] }
]

export async function listWasteCollectionsForCampaign(campaignId, pagination, beachId) {
  if (!isUuidParam(campaignId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw ApiError.notFound()
  }

  const { offset, limit, page, pageSize } = pagination
  const where = { campaignId, deletedAt: null }

  if (beachId != null && beachId !== "") {
    if (!isUuidParam(beachId)) {
      throw ApiError.badRequest("Invalid request")
    }
    const linked = await CampaignBeach.findOne({
      where: { campaignId, beachId }
    })
    if (!linked) {
      throw ApiError.badRequest("Invalid request")
    }
    where.beachId = beachId
  }

  const total = await WasteCollection.count({ where })
  const rows = await WasteCollection.findAll({
    where,
    include: WASTE_COLLECTION_LIST_INCLUDE,
    order: [["createdAt", "DESC"]],
    limit,
    offset
  })

  return {
    items: rows.map((w) => mapCollectionRow(w)),
    total,
    page,
    pageSize
  }
}

async function loadCollectionMapped(id) {
  const w = await WasteCollection.findByPk(id, {
    include: [
      { model: Beach, as: "beach", attributes: ["id", "name"] },
      { model: Waste, as: "waste", attributes: ["id", "name"] },
      { model: User, as: "recordedBy", attributes: ["id", "name"] }
    ]
  })

  if (!w) {
    throw ApiError.notFound()
  }

  return mapCollectionRow(w)
}

export async function createWasteCollection(campaignId, actorId, body) {
  if (!isUuidParam(campaignId)) {
    throw ApiError.badRequest("Invalid id")
  }

  await assertCanInteractWithCampaignCollections(actorId, campaignId)

  const beachId = body.beachId
  const wasteId = body.wasteId
  const unitQuantity = Number(body.unitQuantity)

  if (
    !beachId ||
    !wasteId ||
    !Number.isFinite(unitQuantity) ||
    unitQuantity < 1 ||
    unitQuantity > MAX_UNIT_QUANTITY
  ) {
    throw ApiError.badRequest("Invalid request")
  }

  if (!isUuidParam(beachId) || !isUuidParam(wasteId)) {
    throw ApiError.badRequest("Invalid request")
  }

  const link = await CampaignBeach.findOne({
    where: { campaignId, beachId }
  })

  if (!link) {
    throw ApiError.badRequest("Invalid request")
  }

  const waste = await Waste.findByPk(wasteId)
  if (!waste) {
    throw ApiError.badRequest("Invalid request")
  }

  const beach = await Beach.findByPk(beachId)
  if (!beach) {
    throw ApiError.badRequest("Invalid request")
  }

  const existing = await WasteCollection.findOne({
    where: { campaignId, beachId, wasteId }
  })

  const weight =
    body.actualWeightKg !== undefined && body.actualWeightKg !== null
      ? Number(body.actualWeightKg)
      : null

  if (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT_KG)) {
    throw ApiError.badRequest("Invalid request")
  }

  if (existing) {
    const nextQty = existing.unitQuantity + unitQuantity
    if (nextQty > MAX_UNIT_QUANTITY) {
      throw ApiError.badRequest("Invalid request")
    }
    existing.unitQuantity = nextQty
    if (weight != null && Number.isFinite(weight)) {
      const prev =
        existing.actualWeightKg != null ? Number(existing.actualWeightKg) : 0
      const nextW = prev + weight
      if (nextW > MAX_WEIGHT_KG) {
        throw ApiError.badRequest("Invalid request")
      }
      existing.actualWeightKg = nextW
    }
    await existing.save()
    return loadCollectionMapped(existing.id)
  }

  const now = new Date()
  const row = await WasteCollection.create({
    campaignId,
    beachId,
    wasteId,
    recordedByUserId: actorId,
    unitQuantity,
    actualWeightKg:
      weight != null && Number.isFinite(weight) && weight <= MAX_WEIGHT_KG ? weight : null,
    createdAt: now,
    updatedAt: now
  })

  return loadCollectionMapped(row.id)
}

export async function updateWasteCollection(collectionId, actorId, body) {
  if (!isUuidParam(collectionId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const collection = await WasteCollection.findByPk(collectionId)
  if (!collection) {
    throw ApiError.notFound()
  }

  await assertCanModifyCollection(actorId, collection)

  if (body.unitQuantity !== undefined) {
    const n = Number(body.unitQuantity)
    if (!Number.isFinite(n) || n < 1 || n > MAX_UNIT_QUANTITY) {
      throw ApiError.badRequest("Invalid request")
    }
    collection.unitQuantity = n
  }

  if (body.actualWeightKg !== undefined) {
    if (body.actualWeightKg === null) {
      collection.actualWeightKg = null
    } else {
      const n = Number(body.actualWeightKg)
      if (!Number.isFinite(n) || n < 0 || n > MAX_WEIGHT_KG) {
        throw ApiError.badRequest("Invalid request")
      }
      collection.actualWeightKg = n
    }
  }

  await collection.save()
  return loadCollectionMapped(collection.id)
}

export async function deleteWasteCollection(collectionId, actorId) {
  if (!isUuidParam(collectionId)) {
    throw ApiError.badRequest("Invalid id")
  }

  const collection = await WasteCollection.findByPk(collectionId)
  if (!collection) {
    throw ApiError.notFound()
  }

  await assertCanModifyCollection(actorId, collection)
  await collection.destroy()
}
