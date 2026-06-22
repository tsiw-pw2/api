import { Beach, Campaign, CampaignBeach, User, Waste, WasteCollection } from "../models/db.config.js"
import { createError, passControllerError, notFoundError, validationError, isUuidParam } from "../utils/error.utils.js"
import { assertCanAccessCampaignWasteData, collectionEstimatedWeightKg } from "../utils/domain.utils.js"
import { CAMPAIGNS_BASE, paginatedList, parsePaginationQuery, withResourceLinks } from "../utils/response.utils.js"
import { loadActorContext, wasteCollectionCollectionCreateAllowed, wasteCollectionItemActions } from "../utils/hypermedia.permissions.js"

// Confirmar que a recolha pertence à campanha indicada no URL (sub-recurso aninhado).
async function assertCollectionInCampaign(campaignId, collectionId) {
  if (!isUuidParam(campaignId) || !isUuidParam(collectionId)) {
    throw validationError(["Invalid id"])
  }
  const row = await WasteCollection.findByPk(collectionId, { attributes: ["campaignId"] })
  if (!row || row.campaignId !== campaignId) {
    throw notFoundError("Waste collection")
  }
}

// Limites de validação alinhados com colunas quantidade_unidades e peso_real_kg em recolha_residuo.
const MAX_UNIT_QUANTITY = 100_000_000
const MAX_WEIGHT_KG = 1_000_000

// Permitir registar recolhas apenas ao organizador da campanha ou administrador (POST).
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

  throw createError(403, "Forbidden")
}

// Verificar permissão para alterar ou eliminar um registo de recolha (PATCH/DELETE).
// Ordem: organizador → admin → autor do registo → inscrito pendente/confirmado.
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

  throw createError(403, "Forbidden")
}

// Mapear registo Sequelize (recolha_residuo + praia + resíduo + autor) para o formato JSON da API.
function mapCollectionRow(w) {
  // Peso estimado só quando não há peso_real_kg (usa peso_medio_gramas do catálogo residuo).
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

// Incluir praia, resíduo (com peso médio para estimativa) e utilizador que registou a recolha.
const WASTE_COLLECTION_LIST_INCLUDE = [
  { model: Beach, as: "beach", attributes: ["id", "name"] },
  { model: Waste, as: "waste", attributes: ["id", "name", "averageWeightGrams"] },
  { model: User, as: "recordedBy", attributes: ["id", "name"] }
]

// Listar recolhas de resíduos de uma campanha (com filtro opcional por praia via campanha_praia).
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

  // Filtro beachId: validar que a praia pertence à campanha antes de filtrar recolha_residuo.
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

// Carregar uma recolha da BD e devolver como formato da API mapeado (releitura após create/update).
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

// Registar ou actualizar quantidades de resíduos recolhidos numa praia da campanha (inserir ou actualizar por campanha+praia+resíduo).
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

  // A praia tem de estar associada à campanha via campanha_praia.
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

  // Incluir registos eliminados logicamente para permitir reactivar registo apagado (único por campanha_id + praia_id + residuo_id).
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
      // Reactivar registo eliminado logicamente com novas quantidades.
      existing.deletedAt = null
      existing.unitQuantity = unitQuantity
      existing.actualWeightKg =
        weight != null && Number.isFinite(weight) && weight <= MAX_WEIGHT_KG ? weight : null
      existing.recordedByUserId = actorId
      await existing.save()
      return loadCollectionMapped(existing.id)
    }
    // Inserir ou actualizar: somar unidades ao registo existente (campanha + praia + resíduo únicos).
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

// Actualizar unidades ou peso efectivo de um registo de recolha existente (PATCH parcial).
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

// Remover (eliminação lógica) um registo de recolha de resíduos.
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

/**
 * Listar recolhas de resíduos de uma campanha.
 * Método: GET
 * Rota: /campaigns/:id/waste-collections
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Inscrito confirmado, organizador ou admin acede aos dados.
 * - Filtro opcional beachId na query.
 *
 * Notas técnicas:
 * - recolha_residuo liga campanha, praia e resíduo; peso estimado ou peso_real_kg.
 */
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
    // Hipermedia: ligação create só para quem pode registar recolhas na campanha.
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

/**
 * Registar recolha de resíduos numa praia da campanha.
 * Método: POST
 * Rota: /campaigns/:id/waste-collections
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Praia deve pertencer à campanha (campanha_praia); resíduo do catálogo.
 * - Organizador ou admin; inserir ou actualizar por (campanha, praia, resíduo) único.
 *
 * Notas técnicas:
 * - quantidade_unidades obrigatória; actualWeightKg opcional.
 */
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

/**
 * Actualizar quantidades ou peso de uma recolha.
 * Método: PATCH
 * Rota: /campaigns/:id/waste-collections/:collectionId
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Organizador, admin, autor do registo ou inscrito confirmado podem alterar.
 *
 * Notas técnicas:
 * - PATCH parcial em unitQuantity e actualWeightKg.
 */
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

/**
 * Eliminar registo de recolha (eliminação lógica).
 * Método: DELETE
 * Rota: /campaigns/:id/waste-collections/:collectionId
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Mesmas permissões de modificação que PATCH.
 *
 * Notas técnicas:
 * - Resposta 204; destroy() com eliminação lógica em recolha_residuo.
 */
export const deleteWasteCollectionHandler = async (req, res, next) => {
  try {
    await assertCollectionInCampaign(req.params.id, req.params.collectionId)
    await deleteWasteCollectionRecord(req.params.collectionId, req.user.sub)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting waste collection")
  }
}
