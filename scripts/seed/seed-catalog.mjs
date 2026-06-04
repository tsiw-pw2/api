import {
  Beach,
  BeachLocation,
  Waste,
  WasteType
} from "../../models/db.config.js"
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
      id: IDS.beachLocations.vilaCha,
      district: "Porto",
      municipality: "Vila do Conde",
      parish: "Vila do Conde",
      nutsCode: "PT11A",
      createdAt: now,
      updatedAt: now
    }
  ])

  await Beach.bulkCreate([
    {
      id: IDS.beaches.praiaEspinho,
      beachLocationId: IDS.beachLocations.espinho,
      createdByUserId: IDS.users.organizer,
      name: "Praia de Espinho",
      latitude: 41.0052,
      longitude: -8.6419,
      description: "Praia urbana com grande afluência no verão.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaVilaCha,
      beachLocationId: IDS.beachLocations.vilaCha,
      createdByUserId: IDS.users.admin,
      name: "Praia da Azurara",
      latitude: 41.3501,
      longitude: -8.7462,
      description: "Zona norte, ideal para campanhas de fim de semana.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.beaches.praiaAzurara,
      beachLocationId: IDS.beachLocations.vilaCha,
      createdByUserId: IDS.users.organizer,
      name: "Praia da Codicheira",
      latitude: 41.3628,
      longitude: -8.7521,
      description: "Praia mais calma, boa para famílias.",
      createdAt: now,
      updatedAt: now
    }
  ])

  await WasteType.bulkCreate([
    {
      id: IDS.wasteTypes.plastic,
      name: "Plástico",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wasteTypes.glass,
      name: "Vidro",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.wasteTypes.metal,
      name: "Metal",
      createdAt: now,
      updatedAt: now
    }
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
      unit: "kg",
      averageWeightGrams: null,
      createdAt: now,
      updatedAt: now
    }
  ])
}
