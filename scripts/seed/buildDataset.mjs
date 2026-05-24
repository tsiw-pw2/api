import { id } from "./ids.mjs"

function userRow(ids, seq, fields) {
  return {
    id: id.user(seq),
    tokenVersion: 0,
    isBlocked: false,
    isAdmin: false,
    isOrganizer: false,
    ...fields,
  }
}

export function buildDataset(ids, dates, passwordHash) {
  const ts = dates.now

  const users = [
    userRow(ids, 1, {
      id: ids.admin,
      name: "Inês Marques",
      email: "admin@demo.local",
      passwordHash,
      phone: "+351912000001",
      birthDate: "1988-03-12",
      isAdmin: true,
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 2, {
      id: ids.org1,
      name: "Ricardo Almeida",
      email: "organizador1@demo.local",
      passwordHash,
      phone: "+351912000002",
      birthDate: "1990-07-21",
      isOrganizer: true,
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 3, {
      id: ids.org2,
      name: "Ana Ribeiro",
      email: "ana.ribeiro@email.pt",
      passwordHash,
      phone: "+351923456789",
      birthDate: "1992-11-05",
      isOrganizer: true,
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 4, {
      id: ids.org3,
      name: "Pedro Matos",
      email: "pedro.porto@demo.local",
      passwordHash,
      phone: "+351912000004",
      birthDate: "1985-04-18",
      isOrganizer: true,
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 5, {
      id: ids.vol1,
      name: "Maria Costa",
      email: "maria.costa@email.pt",
      passwordHash,
      phone: "+351934567890",
      birthDate: "1998-01-18",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 6, {
      id: ids.vol2,
      name: "João Silva",
      email: "joao.silva@email.pt",
      passwordHash,
      phone: "+351945678901",
      birthDate: "2000-09-30",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 7, {
      id: ids.vol3,
      name: "Sofia Mendes",
      email: "sofia.mendes@email.pt",
      passwordHash,
      phone: "+351936111222",
      birthDate: "1996-06-14",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 8, {
      id: ids.vol4,
      name: "Tiago Ferreira",
      email: "tiago.ferreira@email.pt",
      passwordHash,
      phone: "+351937222333",
      birthDate: "1999-12-02",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 9, {
      id: ids.vol5,
      name: "Beatriz Lopes",
      email: "beatriz.lopes@email.pt",
      passwordHash,
      phone: "+351938333444",
      birthDate: "2001-03-22",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 10, {
      id: ids.vol6,
      name: "Miguel Santos",
      email: "miguel.santos@email.pt",
      passwordHash,
      phone: "+351939444555",
      birthDate: "1997-08-09",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 11, {
      id: ids.vol7,
      name: "Carla Pinto",
      email: "carla.pinto@email.pt",
      passwordHash,
      phone: "+351930555666",
      birthDate: "1994-10-31",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 12, {
      id: ids.vol8,
      name: "André Nunes",
      email: "andre.nunes@email.pt",
      passwordHash,
      phone: "+351931666777",
      birthDate: "2002-01-15",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 14, {
      id: id.user(14),
      name: "Rita Oliveira",
      email: "rita.oliveira@email.pt",
      passwordHash,
      phone: "+351932777888",
      birthDate: "1995-05-20",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 15, {
      id: id.user(15),
      name: "Hugo Carvalho",
      email: "hugo.carvalho@email.pt",
      passwordHash,
      phone: "+351933888999",
      birthDate: "1993-07-11",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 16, {
      id: id.user(16),
      name: "Diana Sousa",
      email: "diana.sousa@email.pt",
      passwordHash,
      phone: "+351934999000",
      birthDate: "2000-11-28",
      createdAt: ts,
      updatedAt: ts,
    }),
    userRow(ids, 13, {
      id: ids.blocked,
      name: "Conta Bloqueada",
      email: "bloqueado@demo.local",
      passwordHash,
      phone: "+351900000099",
      birthDate: "1990-01-01",
      isBlocked: true,
      createdAt: ts,
      updatedAt: ts,
    }),
  ]

  const beachLocations = [
    { id: ids.locApulia, district: "Braga", municipality: "Esposende", parish: "Apúlia", nutsCode: "PT11", createdAt: ts, updatedAt: ts },
    { id: ids.locEsposende, district: "Braga", municipality: "Esposende", parish: "Esposende", nutsCode: "PT11", createdAt: ts, updatedAt: ts },
    { id: ids.locCabedelo, district: "Viana do Castelo", municipality: "Viana do Castelo", parish: "Cabedelo", nutsCode: "PT11", createdAt: ts, updatedAt: ts },
    { id: ids.locMatosinhos, district: "Porto", municipality: "Matosinhos", parish: "Matosinhos", nutsCode: "PT11", createdAt: ts, updatedAt: ts },
    { id: ids.locEspinho, district: "Aveiro", municipality: "Espinho", parish: "Espinho", nutsCode: "PT11", createdAt: ts, updatedAt: ts },
    { id: ids.locCostaCaparica, district: "Setúbal", municipality: "Almada", parish: "Costa da Caparica", nutsCode: "PT17", createdAt: ts, updatedAt: ts },
    { id: ids.locNazaré, district: "Leiria", municipality: "Nazaré", parish: "Nazaré", nutsCode: "PT16", createdAt: ts, updatedAt: ts },
    { id: ids.locAveiroBarra, district: "Aveiro", municipality: "Ílhavo", parish: "Barra", nutsCode: "PT11", createdAt: ts, updatedAt: ts },
  ]

  const beaches = [
    { id: ids.beachApulia, beachLocationId: ids.locApulia, createdByUserId: ids.org1, name: "Praia da Apúlia", latitude: 41.48012, longitude: -8.78945, description: "Faixa arenosa junto à arriba fóssil; ações regulares de limpeza.", createdAt: ts, updatedAt: ts },
    { id: ids.beachEsposende, beachLocationId: ids.locEsposende, createdByUserId: ids.org1, name: "Praia de Esposende", latitude: 41.53321, longitude: -8.78234, description: "Praia urbana com acesso fácil para voluntários.", createdAt: ts, updatedAt: ts },
    { id: ids.beachCabedelo, beachLocationId: ids.locCabedelo, createdByUserId: ids.org2, name: "Praia do Cabedelo", latitude: 41.6789, longitude: -8.8123, description: "Zona estuarina sensível; foco em plásticos.", createdAt: ts, updatedAt: ts },
    { id: ids.beachMatosinhos, beachLocationId: ids.locMatosinhos, createdByUserId: ids.org3, name: "Praia de Matosinhos", latitude: 41.1821, longitude: -8.6892, description: "Praia urbana junto ao porto de Leixões.", createdAt: ts, updatedAt: ts },
    { id: ids.beachEspinho, beachLocationId: ids.locEspinho, createdByUserId: ids.org2, name: "Praia de Espinho", latitude: 41.0098, longitude: -8.6401, description: "Costa atlântica com correntes fortes; microplásticos frequentes.", createdAt: ts, updatedAt: ts },
    { id: ids.beachCostaCaparica, beachLocationId: ids.locCostaCaparica, createdByUserId: ids.org1, name: "Costa da Caparica", latitude: 38.6445, longitude: -9.2356, description: "Extensa costa para campanhas de grande dimensão.", createdAt: ts, updatedAt: ts },
    { id: ids.beachNazaré, beachLocationId: ids.locNazaré, createdByUserId: ids.org2, name: "Praia da Nazaré", latitude: 39.6012, longitude: -9.0701, description: "Praia icónica; parcerias com escolas locais.", createdAt: ts, updatedAt: ts },
    { id: ids.beachAveiroBarra, beachLocationId: ids.locAveiroBarra, createdByUserId: ids.org3, name: "Praia da Barra", latitude: 40.6428, longitude: -8.7453, description: "Junção do rio e mar; atenção a redes e cordas.", createdAt: ts, updatedAt: ts },
  ]

  const wasteTypes = [
    { id: ids.typePlastic, name: "Plásticos", createdAt: ts, updatedAt: ts },
    { id: ids.typeGlass, name: "Vidro", createdAt: ts, updatedAt: ts },
    { id: ids.typePaper, name: "Papel e cartão", createdAt: ts, updatedAt: ts },
    { id: ids.typeMetal, name: "Metais", createdAt: ts, updatedAt: ts },
    { id: ids.typeOther, name: "Outros", createdAt: ts, updatedAt: ts },
  ]

  const wastes = [
    { id: ids.wasteBottles, wasteTypeId: ids.typePlastic, name: "Garrafas PET", unit: "unit", averageWeightGrams: 25, createdAt: ts, updatedAt: ts },
    { id: ids.wasteBags, wasteTypeId: ids.typePlastic, name: "Sacos e filmes plásticos", unit: "unit", averageWeightGrams: 15, createdAt: ts, updatedAt: ts },
    { id: ids.wasteCans, wasteTypeId: ids.typeMetal, name: "Latas de bebidas", unit: "unit", averageWeightGrams: 35, createdAt: ts, updatedAt: ts },
    { id: ids.wasteGlass, wasteTypeId: ids.typeGlass, name: "Cacos e frascos de vidro", unit: "unit", averageWeightGrams: 120, createdAt: ts, updatedAt: ts },
    { id: ids.wasteCaps, wasteTypeId: ids.typePlastic, name: "Tampinhas plásticas", unit: "unit", averageWeightGrams: 2, createdAt: ts, updatedAt: ts },
    { id: ids.wasteNet, wasteTypeId: ids.typeOther, name: "Redes e cordas de pesca", unit: "peso", averageWeightGrams: null, createdAt: ts, updatedAt: ts },
    { id: ids.wasteTyre, wasteTypeId: ids.typeOther, name: "Fragmentos de borracha", unit: "peso", averageWeightGrams: null, createdAt: ts, updatedAt: ts },
    { id: ids.wasteCigarettes, wasteTypeId: ids.typeOther, name: "Beatas e filtros", unit: "unit", averageWeightGrams: 1, createdAt: ts, updatedAt: ts },
    { id: ids.wasteRope, wasteTypeId: ids.typePlastic, name: "Cordéis e fibras sintéticas", unit: "peso", averageWeightGrams: null, createdAt: ts, updatedAt: ts },
    { id: ids.wasteMicro, wasteTypeId: ids.typePlastic, name: "Microplásticos (amostra)", unit: "peso", averageWeightGrams: null, createdAt: ts, updatedAt: ts },
  ]

  const campaigns = [
    {
      id: ids.campOpen,
      title: "Limpeza da Apúlia e Esposende",
      description: "Ação conjunta com a Câmara de Esposende. Reunião no parque da Apúlia; luvas e sacos no local.",
      meetingLocation: "Parque de estacionamento da Praia da Apúlia",
      meetingTime: "09:30:00",
      startDate: dates.in14,
      endDate: dates.in14,
      status: 1,
      organizerId: ids.org1,
      districtCode: "braga",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ids.campProgress,
      title: "Maré viva — Esposende em curso",
      description: "Campanha a decorrer hoje; registo de recolhas em tempo real nas praias associadas.",
      meetingLocation: "Entrada principal da Praia de Esposende",
      meetingTime: "08:00:00",
      startDate: dates.yesterday,
      endDate: dates.tomorrow,
      status: 3,
      organizerId: ids.org1,
      districtCode: "braga",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ids.campDone,
      title: "Esposende sem plástico — relatório 2026",
      description: "Campanha concluída com recolhas, presenças e comentários para testar relatórios e dashboard.",
      meetingLocation: "Praia de Esposende",
      meetingTime: "10:00:00",
      startDate: dates.daysAgo30,
      endDate: dates.daysAgo30,
      status: 4,
      organizerId: ids.org1,
      districtCode: "braga",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ids.campPlanned,
      title: "Preparação verão — Cabedelo",
      description: "Planeamento de inscrições para o verão; parceria com associação local.",
      meetingLocation: "Centro de interpretação do Cabedelo",
      meetingTime: "08:45:00",
      startDate: dates.in45,
      endDate: dates.in45,
      status: 0,
      organizerId: ids.org2,
      districtCode: "viana_do_castelo",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ids.campClosed,
      title: "Nazaré — inscrições encerradas",
      description: "Equipa fechada; aguarda dia da ação.",
      meetingLocation: "Praia da Nazaré",
      meetingTime: "09:00:00",
      startDate: dates.in7,
      endDate: dates.in7,
      status: 2,
      organizerId: ids.org2,
      districtCode: "leiria",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ids.campCancelled,
      title: "Caparica — cancelada por condições marítimas",
      description: "Cancelada por aviso laranja; dados mantidos para histórico.",
      meetingLocation: "Costa da Caparica",
      meetingTime: "07:30:00",
      startDate: dates.in30,
      endDate: dates.in30,
      status: 5,
      organizerId: ids.org1,
      districtCode: "setubal",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ids.campPortoDone,
      title: "Matosinhos — primavera limpa",
      description: "Campanha no distrito do Porto com recolhas registadas na praia urbana.",
      meetingLocation: "Avenida da Praia de Matosinhos",
      meetingTime: "10:30:00",
      startDate: dates.daysAgo60,
      endDate: dates.daysAgo60,
      status: 4,
      organizerId: ids.org3,
      districtCode: "porto",
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  let cbSeq = 0
  const campaignBeaches = [
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campOpen, beachId: ids.beachApulia, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campOpen, beachId: ids.beachEsposende, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campProgress, beachId: ids.beachEsposende, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campProgress, beachId: ids.beachApulia, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campDone, beachId: ids.beachEsposende, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campDone, beachId: ids.beachApulia, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campPlanned, beachId: ids.beachCabedelo, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campClosed, beachId: ids.beachNazaré, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campCancelled, beachId: ids.beachCostaCaparica, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campPortoDone, beachId: ids.beachMatosinhos, createdAt: ts },
    { id: id.campaignBeach(++cbSeq), campaignId: ids.campPortoDone, beachId: ids.beachEspinho, createdAt: ts },
  ]

  let regSeq = 0
  const registration = (campaignId, userId, role, status, attendance = null) => ({
    id: id.registration(++regSeq),
    campaignId,
    userId,
    role,
    status,
    attendance,
    createdAt: ts,
    updatedAt: ts,
  })

  const vol9 = id.user(14)
  const vol10 = id.user(15)
  const vol11 = id.user(16)

  const registrations = [
    registration(ids.campOpen, ids.org1, 1, 1),
    registration(ids.campOpen, ids.vol1, 0, 1),
    registration(ids.campOpen, ids.vol2, 0, 1),
    registration(ids.campOpen, ids.vol3, 0, 1),
    registration(ids.campOpen, ids.vol4, 0, 1),
    registration(ids.campOpen, ids.vol5, 0, 1),
    registration(ids.campOpen, vol9, 0, 1),
    registration(ids.campOpen, vol10, 0, 1),
    registration(ids.campOpen, ids.vol6, 0, 0),
    registration(ids.campOpen, ids.vol7, 0, 0),
    registration(ids.campOpen, ids.vol8, 0, 0),
    registration(ids.campOpen, vol11, 0, 0),
    registration(ids.campProgress, ids.org1, 1, 1),
    registration(ids.campProgress, ids.vol1, 0, 1),
    registration(ids.campProgress, ids.vol2, 0, 1),
    registration(ids.campDone, ids.org1, 1, 1, true),
    registration(ids.campDone, ids.vol1, 0, 1, true),
    registration(ids.campDone, ids.vol2, 0, 1, true),
    registration(ids.campDone, ids.vol3, 0, 1, false),
    registration(ids.campDone, ids.vol4, 0, 1, true),
    registration(ids.campDone, ids.vol5, 0, 2),
    registration(ids.campClosed, ids.org2, 1, 1),
    registration(ids.campClosed, ids.vol6, 0, 1),
    registration(ids.campClosed, ids.vol7, 0, 0),
    registration(ids.campPortoDone, ids.org3, 1, 1, true),
    registration(ids.campPortoDone, ids.vol8, 0, 1, true),
  ]

  const seenRegistrationKeys = new Set()
  for (const r of registrations) {
    const key = `${r.campaignId}:${r.userId}`
    if (seenRegistrationKeys.has(key)) {
      throw new Error(`Seed: inscrição duplicada ${key}`)
    }
    seenRegistrationKeys.add(key)
  }

  const openConfirmedVols = [ids.vol1, ids.vol2, ids.vol3, ids.vol4, ids.vol5, vol9, vol10]

  let commentSeq = 0
  const commentBodies = [
    "Posso chegar um pouco depois das 9h30 — há estacionamento gratuito?",
    "Trago 2 pares de luvas extra para quem precisar.",
    "Há alguma restrição para menores acompanhados?",
    "Confirmado! Levo sacos reutilizáveis.",
    "A previsão de vento está forte — cancelam se piorar?",
    "O ponto de encontro tem WC?",
    "Posso ajudar no registo de recolhas no telemóvel.",
    "Vou com um grupo de 4 estudantes — registo todos?",
    "Há transporte a partir do centro de Esposende?",
    "Obrigada pela organização, equipa muito simpática na última ação.",
    "Alguém tem carrinha para levar sacos até ao contentor?",
    "Deixo aqui o contacto da associação parceira.",
    "Confirmada presença para a Apúlia.",
    "Prefiro ficar na praia de Esposende se for possível escolher.",
  ]

  const comments = commentBodies.map((body, index) => ({
    id: id.comment(++commentSeq),
    campaignId: ids.campOpen,
    userId: openConfirmedVols[index % openConfirmedVols.length],
    body,
    isVisible: index !== 9,
    createdAt: ts,
    updatedAt: ts,
  }))

  comments.push({
    id: id.comment(++commentSeq),
    campaignId: ids.campDone,
    userId: ids.vol1,
    body: "Bom trabalho em equipa — relatório enviado à câmara.",
    isVisible: true,
    createdAt: ts,
    updatedAt: ts,
  })

  const wasteIdsForCollections = [
    ids.wasteBottles,
    ids.wasteBags,
    ids.wasteCans,
    ids.wasteGlass,
    ids.wasteCaps,
    ids.wasteCigarettes,
    ids.wasteNet,
    ids.wasteRope,
  ]

  const recorders = [ids.org1, ids.vol1, ids.vol2, ids.vol3, ids.vol4]

  let collectSeq = 0
  const wasteCollections = []

  function addCollection(campaignId, beachId, wasteId, recordedByUserId, unitQuantity, actualWeightKg) {
    wasteCollections.push({
      id: id.collection(++collectSeq),
      campaignId,
      beachId,
      wasteId,
      recordedByUserId,
      unitQuantity,
      actualWeightKg,
      createdAt: ts,
      updatedAt: ts,
    })
  }

  for (const beachId of [ids.beachEsposende, ids.beachApulia]) {
    for (let w = 0; w < wasteIdsForCollections.length; w += 1) {
      const wasteId = wasteIdsForCollections[w]
      addCollection(
        ids.campDone,
        beachId,
        wasteId,
        recorders[w % recorders.length],
        30 + w * 7 + (beachId === ids.beachApulia ? 5 : 0),
        w % 4 === 0 ? null : Number((1.5 + w * 0.35).toFixed(2)),
      )
    }
  }

  for (let w = 0; w < 6; w += 1) {
    addCollection(
      ids.campProgress,
      w % 2 === 0 ? ids.beachEsposende : ids.beachApulia,
      wasteIdsForCollections[w],
      recorders[w % recorders.length],
      12 + w * 3,
      w % 2 === 0 ? Number((0.8 + w * 0.2).toFixed(2)) : null,
    )
  }

  addCollection(ids.campOpen, ids.beachApulia, ids.wasteBottles, ids.vol1, 18, null)
  addCollection(ids.campOpen, ids.beachEsposende, ids.wasteBags, ids.vol2, 24, 0.55)

  for (const wasteId of [ids.wasteBottles, ids.wasteCans, ids.wasteGlass, ids.wasteTyre]) {
    addCollection(
      ids.campPortoDone,
      ids.beachMatosinhos,
      wasteId,
      ids.org3,
      40 + wasteIdsForCollections.indexOf(wasteId) * 5,
      wasteId === ids.wasteTyre ? 6.2 : 2.4,
    )
  }

  return {
    users,
    beachLocations,
    beaches,
    wasteTypes,
    wastes,
    campaigns,
    campaignBeaches,
    registrations,
    comments,
    wasteCollections,
    accounts: [
      { email: "admin@demo.local", role: "Administrador" },
      { email: "organizador1@demo.local", role: "Organizador (Braga)" },
      { email: "ana.ribeiro@email.pt", role: "Organizadora" },
      { email: "pedro.porto@demo.local", role: "Organizador (Porto)" },
      { email: "maria.costa@email.pt", role: "Voluntária (inscrita em campanhas abertas)" },
      { email: "joao.silva@email.pt", role: "Voluntário" },
      { email: "miguel.santos@email.pt", role: "Voluntário (inscrição pendente)" },
      { email: "carla.pinto@email.pt", role: "Voluntária (inscrição pendente)" },
      { email: "bloqueado@demo.local", role: "Conta bloqueada (teste de acesso)" },
    ],
    stats: {
      users: users.length,
      beaches: beaches.length,
      campaigns: campaigns.length,
      registrations: registrations.length,
      comments: comments.length,
      wasteCollections: wasteCollections.length,
    },
  }
}
