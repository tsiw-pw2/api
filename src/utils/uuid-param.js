const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {string | undefined} id
 */
export function isUuidParam(id) {
  return typeof id === "string" && UUID_RE.test(id)
}
