// Converte uma data para o formato AAAA-MM-DD (UTC).
function toDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

// Desloca uma data base um número de dias e devolve só a parte da data.
function shiftDays(base, days) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return toDateOnly(next)
}

// Desloca uma data base um número de meses e devolve só a parte da data.
function shiftMonths(base, months) {
  const next = new Date(base)
  next.setUTCMonth(next.getUTCMonth() + months)
  return toDateOnly(next)
}

// Constrói helpers de datas relativas à data base (hoje, dias/meses atrás ou à frente).
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
