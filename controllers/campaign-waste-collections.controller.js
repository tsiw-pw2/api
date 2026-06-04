import { Op } from "sequelize"
import { Beach, Campaign, CampaignBeach, Registration, User, Waste, WasteCollection } from "../models/db.config.js"
import { createError, passControllerError, notFoundError, validationError, isUuidParam } from "../utils/error.utils.js"
import { assertCanAccessCampaignWasteData, collectionEstimatedWeightKg } from "../utils/domain.utils.js"
import {
  CAMPAIGNS_BASE,
  paginatedList,
  parsePaginationQuery,
  withResourceLinks
} from "../utils/response.utils.js"
import {
  loadActorContext,
  wasteCollectionCollectionCreateAllowed,
  wasteCollectionItemActions
} from "../utils/hypermedia.permissions.js"

// Confirma que a recolha de resíduos pertence à campanha indicada no URL.
async function assertCollectionInCampaign(campaignId, collectionId) {
  if (!isUuidParam(campaignId) || !isUuidParam(collectionId)) {
    throw validationError(["Invalid id"])
  }
  const row = await WasteCollection.findByPk(collectionId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Waste collection")
  }
}

const MAX_UNIT_QUANTITY = 100_000_000
const MAX_WEIGHT_KG = 1_000_000

// Permito registar recolhas ao organizador, admin ou inscrito activo (status 1)
async function assertCanInteractWithCampaignCollections(actorId, campaignId) {
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
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

  throw createError(403, "Forbidden")
}

// Verifica permissão para alterar ou eliminar um registo de recolha.
async function assertCanModifyCollection(actorId, collection) {
  const campaign = await Campaign.findByPk(collection.campaignId)
  if (!campaign) {
    throw notFoundError("Campaign")
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
    where: { campaignId: collection.campaignId, userId: actorId, status: { [Op.in]: [0, 1] } }
  })

  if (reg) {
    return
  }

  throw createError(403, "Forbidden")
}

// Mapeia um registo de recolha de resíduos para o DTO da API.
function mapCollectionRow(w) {
  const estimated =
    w.actualWeightKg == null && w.waste
      ? collectionEstimatedWeightKg(w, w.waste)
      : 0
  const estimatedWeightKg =
    estimated > 0 ? String(Math.round(estimated * 1000) / 1000) : null

  return {
    id: w.id,
    unitQuantity: w.unitQuantity,
    actualWeightKg: w.actualWeightKg != null ? String(w.actualWeightKg) : null,
    estimatedWeightKg,
    createdAt: w.createdAt.toISOString(),
    beach: w.beach ? { id: w.beach.id, name: w.beach.name } : null,
    waste: w.waste ? { id: w.waste.id, name: w.waste.name } : null,
    recordedBy: w.recordedBy ? { id: w.recordedBy.id, name: w.recordedBy.name } : null
  }
}

const WASTE_COLLECTION_LIST_INCLUDE = [
  { model: Beach, as: "beach", attributes: ["id", "name"] },
  { model: Waste, as: "waste", attributes: ["id", "name", "averageWeightGrams"] },
  { model: User, as: "recordedBy", attributes: ["id", "name"] }
]

// Lista recolhas de resíduos de uma campanha (com filtro opcional por praia).
export async function listWasteCollectionsForCampaign(
  campaignId,
  actorUserId,
  pagination,
  beachId
) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
  }

  await assertCanAccessCampaignWasteData(actorUserId, campaignId)

  const { offset, limit, page, pageSize } = pagination
  const where = { campaignId, deletedAt: null }

  if (beachId != null && beachId !== "") {
    if (!isUuidParam(beachId)) {
      throw validationError(["Invalid request"])
    }
    const linked = await CampaignBeach.findOne({
      where: { campaignId, beachId }
    })
    if (!linked) {
      throw validationError(["Invalid request"])
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

// Carrega uma recolha da BD e devolve-a como DTO mapeado.
async function loadCollectionMapped(id) {
  const w = await WasteCollection.findByPk(id, {
    include: [
      { model: Beach, as: "beach", attributes: ["id", "name"] },
      { model: Waste, as: "waste", attributes: ["id", "name"] },
      { model: User, as: "recordedBy", attributes: ["id", "name"] }
    ]
  })

  if (!w) {
    throw notFoundError("Waste collection")
  }

  return mapCollectionRow(w)
}

// Regista ou actualiza quantidades de resíduos recolhidos numa praia da campanha.
export async function createWasteCollectionForCampaign(campaignId, actorId, body) {
  if (!isUuidParam(campaignId)) {
    throw validationError(["Invalid id"])
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
    throw validationError(["Invalid request"])
  }

  if (!isUuidParam(beachId) || !isUuidParam(wasteId)) {
    throw validationError(["Invalid request"])
  }

  const link = await CampaignBeach.findOne({
    where: { campaignId, beachId }
  })

  if (!link) {
    throw validationError(["Invalid request"])
  }

  const waste = await Waste.findByPk(wasteId)
  if (!waste) {
    throw validationError(["Invalid request"])
  }

  const beach = await Beach.findByPk(beachId)
  if (!beach) {
    throw validationError(["Invalid request"])
  }

  const existing = await WasteCollection.findOne({
    where: { campaignId, beachId, wasteId },
    paranoid: false
  })

  const weight =
    body.actualWeightKg !== undefined && body.actualWeightKg !== null
      ? Number(body.actualWeightKg)
      : null

  if (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT_KG)) {
    throw validationError(["Invalid request"])
  }

  if (existing) {
    if (existing.deletedAt) {
      existing.deletedAt = null
      existing.unitQuantity = unitQuantity
      existing.actualWeightKg =
        weight != null && Number.isFinite(weight) && weight <= MAX_WEIGHT_KG ? weight : null
      existing.recordedByUserId = actorId
      await existing.save()
      return loadCollectionMapped(existing.id)
    }
    const nextQty = existing.unitQuantity + unitQuantity
    if (nextQty > MAX_UNIT_QUANTITY) {
      throw validationError(["Invalid request"])
    }
    existing.unitQuantity = nextQty
    if (weight != null && Number.isFinite(weight)) {
      const prev =
        existing.actualWeightKg != null ? Number(existing.actualWeightKg) : 0
      const nextW = prev + weight
      if (nextW > MAX_WEIGHT_KG) {
        throw validationError(["Invalid request"])
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

// Actualiza unidades ou peso efectivo de um registo de recolha existente.
export async function updateWasteCollectionRecord(collectionId, actorId, body) {
  if (!isUuidParam(collectionId)) {
    throw validationError(["Invalid id"])
  }

  const collection = await WasteCollection.findByPk(collectionId)
  if (!collection) {
    throw notFoundError("Waste collection")
  }

  await assertCanModifyCollection(actorId, collection)

  if (body.unitQuantity !== undefined) {
    const n = Number(body.unitQuantity)
    if (!Number.isFinite(n) || n < 1 || n > MAX_UNIT_QUANTITY) {
      throw validationError(["Invalid request"])
    }
    collection.unitQuantity = n
  }

  if (body.actualWeightKg !== undefined) {
    if (body.actualWeightKg === null) {
      collection.actualWeightKg = null
    } else {
      const n = Number(body.actualWeightKg)
      if (!Number.isFinite(n) || n < 0 || n > MAX_WEIGHT_KG) {
        throw validationError(["Invalid request"])
      }
      collection.actualWeightKg = n
    }
  }

  await collection.save()
  return loadCollectionMapped(collection.id)
}

// Remove (soft delete) um registo de recolha de resíduos.
export async function deleteWasteCollectionRecord(collectionId, actorId) {
  if (!isUuidParam(collectionId)) {
    throw validationError(["Invalid id"])
  }

  const collection = await WasteCollection.findByPk(collectionId)
  if (!collection) {
    throw notFoundError("Waste collection")
  }

  await assertCanModifyCollection(actorId, collection)
  await collection.destroy()
}

// Handler HTTP GET para listar recolhas de resíduos de uma campanha.
export const getAllWasteCollections = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    const base = `${CAMPAIGNS_BASE}/${campaignId}/waste-collections`
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign"))
    }
    const beachId = typeof req.query?.beachId === "string" ? req.query.beachId : undefined
    const data = await listWasteCollectionsForCampaign(
      campaignId,
      req.user.sub,
      parsePaginationQuery(req.query ?? {}),
      beachId
    )
    const includeCreate = await wasteCollectionCollectionCreateAllowed(actor, campaignId)
    res.json(
      paginatedList(base, data, {
        query: req.query,
        includeCreate,
        mapItem: (item) =>
          withResourceLinks(base, item, {
            actions: wasteCollectionItemActions(
              actor,
              { ...item, recordedByUserId: item.recordedBy?.id },
              campaign
            )
          })
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error fetching waste collections")
  }
}

// Handler HTTP POST para registar uma recolha de resíduos.
export const createWasteCollectionHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    const base = `${CAMPAIGNS_BASE}/${campaignId}/waste-collections`
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign"))
    }
    const data = await createWasteCollectionForCampaign(
      campaignId,
      req.user.sub,
      req.body ?? {}
    )
    const response = withResourceLinks(base, data, {
      actions: wasteCollectionItemActions(
        actor,
        { id: data.id, recordedByUserId: req.user.sub },
        campaign
      )
    })
    res.status(201).location(`${base}/${data.id}`).json(response)
  } catch (error) {
    passControllerError(error, next, "Error creating waste collection")
  }
}

// Handler HTTP PATCH para actualizar uma recolha de resíduos.
export const updateWasteCollectionHandler = async (req, res, next) => {
  try {
    const actor = await loadActorContext(req.user.sub)
    const campaignId = req.params.id
    await assertCollectionInCampaign(campaignId, req.params.collectionId)
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ["id", "organizerId"]
    })
    if (!campaign) {
      return next(notFoundError("Campaign"))
    }
    const collection = await WasteCollection.findByPk(req.params.collectionId, {
      attributes: ["id", "recordedByUserId"]
    })
    const base = `${CAMPAIGNS_BASE}/${campaignId}/waste-collections`
    const data = await updateWasteCollectionRecord(
      req.params.collectionId,
      req.user.sub,
      req.body ?? {}
    )
    res.json(
      withResourceLinks(base, data, {
        actions: wasteCollectionItemActions(actor, collection, campaign)
      })
    )
  } catch (error) {
    passControllerError(error, next, "Error updating waste collection")
  }
}

// Handler HTTP DELETE para eliminar uma recolha de resíduos.
export const deleteWasteCollectionHandler = async (req, res, next) => {
  try {
    await assertCollectionInCampaign(req.params.id, req.params.collectionId)
    await deleteWasteCollectionRecord(req.params.collectionId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting waste collection")
  }
}
