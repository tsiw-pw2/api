import { Beach, BeachLocation } from "../../../models/index.js"

const BEACH_LOCATION_INCLUDE = {
  model: BeachLocation,
  as: "beachLocation",
  attributes: ["district", "municipality"]
}

export async function countBeaches() {
  return Beach.count()
}

export async function findAllBeachesPaginated({ offset, limit }) {
  return Beach.findAll({
    include: [BEACH_LOCATION_INCLUDE],
    order: [["name", "ASC"]],
    limit,
    offset
  })
}

export async function findBeachByIdWithLocation(id) {
  return Beach.findByPk(id, {
    include: [BEACH_LOCATION_INCLUDE]
  })
}

export async function findBeachByIdPlain(id) {
  return Beach.findByPk(id)
}

export async function findOrCreateBeachLocation({ districtLabel, municipality }) {
  const now = new Date()
  return BeachLocation.findOrCreate({
    where: {
      district: districtLabel,
      municipality,
      parish: municipality
    },
    defaults: {
      nutsCode: "PT999",
      createdAt: now,
      updatedAt: now
    }
  })
}

export async function insertBeach(row) {
  const now = new Date()
  return Beach.create({
    beachLocationId: row.beachLocationId,
    createdByUserId: row.createdByUserId,
    name: row.name,
    latitude: 0,
    longitude: 0,
    description: null,
    createdAt: now,
    updatedAt: now
  })
}

export async function saveBeachInstance(beachInstance) {
  return beachInstance.save()
}

export async function destroyBeachInstance(beachInstance) {
  return beachInstance.destroy()
}
