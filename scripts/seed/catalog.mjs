import { Beach, BeachLocation, Waste, WasteType } from "../../models/db.config.js"
import { IDS } from "./ids.mjs"

export async function seedCatalog() {
  const now = new Date()

  await BeachLocation.bulkCreate([
    {
      id: IDS.beachLocations.espinho,
      district: "Aveiro",
      municipality: "Espinho",
      parish: "Espinho",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beachLocations.vilaConde,
      district: "Porto",
      municipality: "Vila do Conde",
      parish: "Azurara",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beachLocations.matosinhos,
      district: "Porto",
      municipality: "Matosinhos",
      parish: "Matosinhos e Leça da Palmeira",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beachLocations.povoaVarzim,
      district: "Porto",
      municipality: "Póvoa de Varzim",
      parish: "Aguçadoura",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beachLocations.esposende,
      district: "Braga",
      municipality: "Esposende",
      parish: "Apúlia",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    }
  ])

  await Beach.bulkCreate([
    {
      id: IDS.beaches.praiaEspinho,
      beachLocationId: IDS.beachLocations.espinho,
      createdByUserId: IDS.users.organizer2,
      name: "Praia de Espinho",
      latitude: 41.015838,
      longitude: -8.645921,
      description: "Praia urbana entre o casino e o cais de pesca. Afluência elevada no verão.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaAzurara,
      beachLocationId: IDS.beachLocations.vilaConde,
      createdByUserId: IDS.users.admin,
      name: "Praia da Azurara",
      latitude: 41.33815,
      longitude: -8.743408,
      description: "Faixa arenosa junto à foz do rio Ave, entre dunas e pinhal.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaCodicheira,
      beachLocationId: IDS.beachLocations.povoaVarzim,
      createdByUserId: IDS.users.organizer,
      name: "Praia da Codicheira",
      latitude: 41.436019,
      longitude: -8.782684,
      description: "Praia entre Aguçadoura e Barranha, com areal amplo e ondas moderadas.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaMatosinhos,
      beachLocationId: IDS.beachLocations.matosinhos,
      createdByUserId: IDS.users.organizer,
      name: "Praia de Matosinhos",
      latitude: 41.176078,
      longitude: -8.693575,
      description: "Praia urbana junto ao porto de Leixões e ao mercado de peixe.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaApulia,
      beachLocationId: IDS.beachLocations.esposende,
      createdByUserId: IDS.users.admin,
      name: "Praia de Apúlia",
      latitude: 41.48248,
      longitude: -8.77777,
      description: "Extensa praia de areia fina, conhecida pelas estruturas de salga e pelo vento.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaCabedelo,
      beachLocationId: IDS.beachLocations.vilaConde,
      createdByUserId: IDS.users.organizer,
      name: "Praia do Cabedelo",
      latitude: 41.3123,
      longitude: -8.74002,
      description: "Praia costeira entre dunas e pinhal, no litoral norte de Vila do Conde.",
      createdAt: now,
      updatedAt: now
    }
  ])

  await WasteType.bulkCreate([
    { id: IDS.wasteTypes.plastic, name: "Plástico", createdAt: now, updatedAt: now },
    { id: IDS.wasteTypes.glass, name: "Vidro", createdAt: now, updatedAt: now },
    { id: IDS.wasteTypes.metal, name: "Metal", createdAt: now, updatedAt: now }
  ])

  await Waste.bulkCreate([
    {
      id: IDS.wastes.bottlePet,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Garrafa PET",
      unit: "unit",
      averageWeightGrams: 25,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.capPlastic,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Tampa de plástico",
      unit: "unit",
      averageWeightGrams: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.glassBottle,
      wasteTypeId: IDS.wasteTypes.glass,
      name: "Garrafa de vidro",
      unit: "unit",
      averageWeightGrams: 350,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.canAluminium,
      wasteTypeId: IDS.wasteTypes.metal,
      name: "Lata de alumínio",
      unit: "unit",
      averageWeightGrams: 15,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.fishingNet,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Rede de pesca (fragmento)",
      unit: "peso",
      averageWeightGrams: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.lighter,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Isqueiro",
      unit: "unit",
      averageWeightGrams: 12,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.flexiblePackaging,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Embalagem flexível",
      unit: "unit",
      averageWeightGrams: 8,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.microplastic,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Microplásticos",
      unit: "unit",
      averageWeightGrams: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wastes.rope,
      wasteTypeId: IDS.wasteTypes.plastic,
      name: "Cordel / cabo",
      unit: "peso",
      averageWeightGrams: null,
      createdAt: now,
      updatedAt: now
    }
  ])
}
