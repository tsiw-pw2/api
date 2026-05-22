import { User } from "../../../models/index.js"
import { ApiError } from "../../../utils/api-error.js"
import { districtCodeFromLabel } from "../../../utils/districts.js"
import * as beachesRepository from "./beaches.repository.js"
import { parseBeachUpsertBody } from "./beaches.validation.js"

const DUPLICATE_BEACH_NAME_PT = "Já existe uma praia com este nome."

/**
 * @param {import("sequelize").Model} row
 */
function toListItem(row) {
  const districtLabel = row.beachLocation?.district ?? ""
  const code = districtCodeFromLabel(districtLabel) ?? ""
  return {
    id: row.id,
    name: row.name,
    municipality: row.beachLocation?.municipality ?? "",
    district: code
  }
}

/**
 * @param {{ offset: number, limit: number, page: number, pageSize: number }} pagination
 */
export async function listBeaches(pagination) {
  const { offset, limit, page, pageSize } = pagination
  const total = await beachesRepository.countBeaches()
  const rows = await beachesRepository.findAllBeachesPaginated({ offset, limit })
  return {
    items: rows.map((b) => toListItem(b)),
    total,
    page,
    pageSize
  }
}

/**
 * @param {string} beachId
 */
export async function getBeachById(beachId) {
  const full = await beachesRepository.findBeachByIdWithLocation(beachId)
  if (!full) {
    throw ApiError.notFound()
  }
  return toListItem(full)
}

/**
 * @param {string} actorUserId
 * @param {unknown} body
 */
export async function createBeach(actorUserId, body) {
  const { name, municipality, districtLabel } = parseBeachUpsertBody(body ?? {})

  const [location] = await beachesRepository.findOrCreateBeachLocation({
    districtLabel,
    municipality
  })

  let beach
  try {
    beach = await beachesRepository.insertBeach({
      beachLocationId: location.id,
      createdByUserId: actorUserId,
      name
    })
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      throw ApiError.conflict(DUPLICATE_BEACH_NAME_PT)
    }
    throw e
  }

  const full = await beachesRepository.findBeachByIdWithLocation(beach.id)
  if (!full) {
    throw ApiError.notFound()
  }
  return toListItem(full)
}

/**
 * @param {string} actorUserId
 * @param {string} beachId
 * @param {unknown} body
 */
export async function updateBeach(actorUserId, beachId, body) {
  const beach = await beachesRepository.findBeachByIdWithLocation(beachId)

  if (!beach) {
    throw ApiError.notFound()
  }

  if (beach.createdByUserId !== actorUserId) {
    const user = await User.findByPk(actorUserId, { attributes: ["isAdmin"] })
    if (!user?.isAdmin) {
      throw ApiError.forbidden()
    }
  }

  const { name, municipality, districtLabel } = parseBeachUpsertBody(body ?? {})

  const [location] = await beachesRepository.findOrCreateBeachLocation({
    districtLabel,
    municipality
  })

  beach.name = name
  beach.beachLocationId = location.id
  try {
    await beachesRepository.saveBeachInstance(beach)
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      throw ApiError.conflict(DUPLICATE_BEACH_NAME_PT)
    }
    throw e
  }

  const full = await beachesRepository.findBeachByIdWithLocation(beach.id)
  if (!full) {
    throw ApiError.notFound()
  }
  return toListItem(full)
}

/**
 * @param {string} actorUserId
 * @param {string} beachId
 */
export async function deleteBeach(actorUserId, beachId) {
  const beach = await beachesRepository.findBeachByIdPlain(beachId)

  if (!beach) {
    throw ApiError.notFound()
  }

  if (beach.createdByUserId !== actorUserId) {
    const user = await User.findByPk(actorUserId, { attributes: ["isAdmin"] })
    if (!user?.isAdmin) {
      throw ApiError.forbidden()
    }
  }

  await beachesRepository.destroyBeachInstance(beach)
}
