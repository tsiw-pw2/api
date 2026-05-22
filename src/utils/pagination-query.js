const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

/**
 * @param {import("express").Request["query"]} query
 * @returns {{ page: number, pageSize: number, offset: number, limit: number }}
 */
export function parsePaginationQuery(query) {
  const pageRaw = query?.page
  const pageSizeRaw = query?.pageSize
  let page = typeof pageRaw === "string" ? Number(pageRaw) : Number.NaN
  let pageSize = typeof pageSizeRaw === "string" ? Number(pageSizeRaw) : Number.NaN
  if (!Number.isFinite(page) || page < 1) page = 1
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset, limit: pageSize }
}
