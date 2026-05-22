import { ApiError } from "../../../utils/api-error.js"
import { DISTRICT_CODE_TO_LABEL } from "../../../utils/districts.js"

export const MAX_BEACH_NAME_LENGTH = 255
export const MAX_MUNICIPALITY_LENGTH = 128

export function parseBeachUpsertBody(body) {
  const raw = body && typeof body === "object" ? body : {}
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const municipality = typeof raw.municipality === "string" ? raw.municipality.trim() : ""
  const districtCode = typeof raw.district === "string" ? raw.district.trim() : ""

  if (!name || !municipality || !districtCode) {
    throw ApiError.badRequest("Invalid request")
  }

  if (name.length > MAX_BEACH_NAME_LENGTH || municipality.length > MAX_MUNICIPALITY_LENGTH) {
    throw ApiError.badRequest("Invalid request")
  }

  const districtLabel = DISTRICT_CODE_TO_LABEL[districtCode]
  if (!districtLabel) {
    throw ApiError.badRequest("Invalid request")
  }

  return { name, municipality, districtCode, districtLabel }
}
