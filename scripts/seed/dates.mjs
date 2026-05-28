function toDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

function shiftDays(base, days) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return toDateOnly(next)
}

function shiftMonths(base, months) {
  const next = new Date(base)
  next.setUTCMonth(next.getUTCMonth() + months)
  return toDateOnly(next)
}

export function buildSeedDates(baseDate = new Date()) {
  const today = toDateOnly(baseDate)

  return {
    today,
    daysAgo: (days) => shiftDays(baseDate, -days),
    daysAhead: (days) => shiftDays(baseDate, days),
    monthsAgo: (months) => shiftMonths(baseDate, -months),
    monthsAhead: (months) => shiftMonths(baseDate, months),
  }
}
