export function toIsoDateOnly(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function addDays(from, days) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + days)
  return toIsoDateOnly(d)
}

export function addDaysAsDate(from, days) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonthsAsDate(from, months) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0)
  d.setMonth(d.getMonth() + months)
  return d
}

export function todayIso() {
  return toIsoDateOnly(new Date())
}
