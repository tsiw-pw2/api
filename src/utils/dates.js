/**
 * @param {string} raw
 * @returns {string | null} YYYY-MM-DD or null
 */
export function parseFlexibleDate(raw) {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s
  }
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(s)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return null
  }
  const mmStr = String(mm).padStart(2, "0")
  const ddStr = String(dd).padStart(2, "0")
  return `${yyyy}-${mmStr}-${ddStr}`
}

/**
 * @param {Date | string} value
 * @returns {string} DD/MM/YYYY
 */
export function formatDatePt(value) {
  const d = typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value
  if (Number.isNaN(d.getTime())) return ""
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * ISO date string for CampaignDetails (frontend Date parser)
 * @param {Date | string} value
 */
export function toIsoDateString(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
