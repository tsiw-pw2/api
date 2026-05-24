export function toDateOnly(d) {
  return d.toISOString().slice(0, 10)
}

export function addDays(base, days) {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function buildSeedDates() {
  const now = new Date()
  const today = toDateOnly(now)
  return {
    now,
    today,
    in7: toDateOnly(addDays(now, 7)),
    in14: toDateOnly(addDays(now, 14)),
    in30: toDateOnly(addDays(now, 30)),
    in45: toDateOnly(addDays(now, 45)),
    yesterday: toDateOnly(addDays(now, -1)),
    tomorrow: toDateOnly(addDays(now, 1)),
    daysAgo7: toDateOnly(addDays(now, -7)),
    daysAgo30: toDateOnly(addDays(now, -30)),
    daysAgo60: toDateOnly(addDays(now, -60)),
    daysAgo90: toDateOnly(addDays(now, -90)),
  }
}
