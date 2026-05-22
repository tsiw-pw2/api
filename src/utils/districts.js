export const DISTRICT_CODE_TO_LABEL = {
  viana_do_castelo: "Viana do Castelo",
  braga: "Braga",
  porto: "Porto",
  vila_real: "Vila Real",
  braganca: "Bragança",
  aveiro: "Aveiro",
  viseu: "Viseu",
  guarda: "Guarda",
  coimbra: "Coimbra",
  castelo_branco: "Castelo Branco",
  leiria: "Leiria",
  santarem: "Santarém",
  lisboa: "Lisboa",
  portalegre: "Portalegre",
  setubal: "Setúbal",
  evora: "Évora",
  beja: "Beja",
  faro: "Faro"
}

export function districtCodeFromLabel(label) {
  const t = label.trim().toLowerCase()
  for (const [code, lbl] of Object.entries(DISTRICT_CODE_TO_LABEL)) {
    if (lbl.toLowerCase() === t) return code
  }
  return null
}

export function districtLabelFromCode(code) {
  return DISTRICT_CODE_TO_LABEL[code] ?? null
}
