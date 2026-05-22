import { Waste, WasteType } from "../../../models/index.js"

export const LIST_ATTRIBUTES = [
  "id",
  "wasteTypeId",
  "name",
  "unit",
  "averageWeightGrams",
  "createdAt",
  "updatedAt",
  "deletedAt"
]

const WASTE_TYPE_LIST_INCLUDE = {
  model: WasteType,
  as: "wasteType",
  attributes: ["id", "name"]
}

const WASTE_TYPE_NAME_ONLY_INCLUDE = {
  model: WasteType,
  as: "wasteType",
  attributes: ["name"]
}

export async function countWasteRows() {
  return Waste.count()
}

export async function findAllWastePaginated({ offset, limit }) {
  return Waste.findAll({
    attributes: LIST_ATTRIBUTES,
    include: [WASTE_TYPE_LIST_INCLUDE],
    order: [["name", "ASC"]],
    limit,
    offset
  })
}

export async function findWasteByIdForList(id) {
  return Waste.findByPk(id, {
    attributes: LIST_ATTRIBUTES,
    include: [WASTE_TYPE_NAME_ONLY_INCLUDE]
  })
}

export async function findWasteByIdForUpdate(id) {
  return Waste.findByPk(id, {
    attributes: LIST_ATTRIBUTES,
    include: [
      {
        model: WasteType,
        as: "wasteType",
        attributes: ["id", "name"]
      }
    ]
  })
}

export async function findWasteByName(name) {
  return Waste.findOne({
    where: { name },
    paranoid: true,
    attributes: ["id"]
  })
}

export async function findOrCreateWasteTypeByCategoryName(category) {
  const now = new Date()
  return WasteType.findOrCreate({
    where: { name: category },
    defaults: { name: category, createdAt: now, updatedAt: now }
  })
}

export async function insertWasteRow({ wasteTypeId, name, unit }) {
  const now = new Date()
  return Waste.create({
    wasteTypeId,
    name,
    unit,
    averageWeightGrams: null,
    createdAt: now,
    updatedAt: now
  })
}

export async function saveWasteRow(row) {
  return row.save()
}

export async function destroyWasteById(id) {
  return Waste.destroy({ where: { id } })
}
