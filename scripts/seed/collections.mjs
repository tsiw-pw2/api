import { WasteCollection } from "../../models/db.config.js"
import { addDaysAsDate, addMonthsAsDate } from "./dates.mjs"
import { IDS, wasteCollectionId } from "./ids.mjs"

function collection(id, campaignId, beachId, wasteId, unitQuantity, actualWeightKg, createdAt) {
  const ts = createdAt ?? new Date()
  return {
    id,
    campaignId,
    beachId,
    wasteId,
    recordedByUserId: IDS.users.organizer,
    unitQuantity,
    actualWeightKg,
    createdAt: ts,
    updatedAt: ts
  }
}

export async function seedWasteCollections() {
  const now = new Date()

  await WasteCollection.bulkCreate([
    // Campanha em curso  -  recolhas parciais (hoje)
    collection(
      IDS.wasteCollections.inProgressAzuraraPet,
      IDS.campaigns.inProgress,
      IDS.beaches.praiaAzurara,
      IDS.wastes.bottlePet,
      142,
      null,
      now
    ),
    collection(
      IDS.wasteCollections.inProgressAzuraraCap,
      IDS.campaigns.inProgress,
      IDS.beaches.praiaAzurara,
      IDS.wastes.capPlastic,
      385,
      null,
      now
    ),
    collection(
      IDS.wasteCollections.inProgressCodicheiraGlass,
      IDS.campaigns.inProgress,
      IDS.beaches.praiaCodicheira,
      IDS.wastes.glassBottle,
      22,
      7.8,
      now
    ),
    collection(
      wasteCollectionId(7),
      IDS.campaigns.inProgress,
      IDS.beaches.praiaAzurara,
      IDS.wastes.lighter,
      34,
      null,
      now
    ),
    collection(
      wasteCollectionId(8),
      IDS.campaigns.inProgress,
      IDS.beaches.praiaCodicheira,
      IDS.wastes.flexiblePackaging,
      156,
      null,
      now
    ),
    collection(
      wasteCollectionId(9),
      IDS.campaigns.inProgress,
      IDS.beaches.praiaCodicheira,
      IDS.wastes.canAluminium,
      48,
      null,
      now
    ),

    // Campanha concluída  -  recolhas históricas (tendência mensal no dashboard)
    collection(
      IDS.wasteCollections.completedAzuraraCan,
      IDS.campaigns.completed,
      IDS.beaches.praiaAzurara,
      IDS.wastes.canAluminium,
      92,
      null,
      addMonthsAsDate(now, -5)
    ),
    collection(
      IDS.wasteCollections.completedCodicheiraNet,
      IDS.campaigns.completed,
      IDS.beaches.praiaCodicheira,
      IDS.wastes.fishingNet,
      1,
      14.2,
      addMonthsAsDate(now, -4)
    ),
    collection(
      IDS.wasteCollections.completedCodicheiraPet,
      IDS.campaigns.completed,
      IDS.beaches.praiaCodicheira,
      IDS.wastes.bottlePet,
      248,
      null,
      addMonthsAsDate(now, -4)
    ),
    collection(
      wasteCollectionId(10),
      IDS.campaigns.completed,
      IDS.beaches.praiaAzurara,
      IDS.wastes.bottlePet,
      312,
      null,
      addMonthsAsDate(now, -3)
    ),
    collection(
      wasteCollectionId(11),
      IDS.campaigns.completed,
      IDS.beaches.praiaAzurara,
      IDS.wastes.capPlastic,
      420,
      null,
      addMonthsAsDate(now, -3)
    ),
    collection(
      wasteCollectionId(12),
      IDS.campaigns.completed,
      IDS.beaches.praiaCodicheira,
      IDS.wastes.glassBottle,
      38,
      13.4,
      addMonthsAsDate(now, -2)
    ),
    collection(
      wasteCollectionId(13),
      IDS.campaigns.completed,
      IDS.beaches.praiaCabedelo,
      IDS.wastes.fishingNet,
      1,
      9.6,
      addMonthsAsDate(now, -2)
    ),
    collection(
      wasteCollectionId(14),
      IDS.campaigns.completed,
      IDS.beaches.praiaCabedelo,
      IDS.wastes.rope,
      1,
      6.3,
      addMonthsAsDate(now, -1)
    ),
    collection(
      wasteCollectionId(15),
      IDS.campaigns.completed,
      IDS.beaches.praiaApulia,
      IDS.wastes.flexiblePackaging,
      187,
      null,
      addMonthsAsDate(now, -1)
    ),
    collection(
      wasteCollectionId(16),
      IDS.campaigns.completed,
      IDS.beaches.praiaApulia,
      IDS.wastes.microplastic,
      540,
      null,
      addMonthsAsDate(now, -1)
    ),
    collection(
      wasteCollectionId(17),
      IDS.campaigns.completed,
      IDS.beaches.praiaAzurara,
      IDS.wastes.lighter,
      56,
      null,
      addDaysAsDate(now, -28)
    ),
    collection(
      wasteCollectionId(18),
      IDS.campaigns.completed,
      IDS.beaches.praiaCodicheira,
      IDS.wastes.canAluminium,
      74,
      null,
      addDaysAsDate(now, -27)
    )
  ])
}
