import {
  Campaign,
  CampaignBeach,
  Comment,
  Registration,
  WasteCollection
} from "../../models/db.config.js"
import { addDays } from "./dates.mjs"
import { IDS } from "./ids.mjs"

export async function seedCampaigns() {
  const now = new Date()
  const in14 = addDays(new Date(), 14)
  const in21 = addDays(new Date(), 21)
  const minus30 = addDays(new Date(), -30)
  const minus25 = addDays(new Date(), -25)
  const minus3 = addDays(new Date(), -3)
  const plus3 = addDays(new Date(), 3)

  await Campaign.bulkCreate([
    {
      id: IDS.campaigns.planned,
      title: "Limpeza Outono — Planeada",
      description: "Campanha ainda sem inscrições abertas.",
      meetingLocation: "Parque de estacionamento principal",
      meetingTime: "09:00:00",
      startDate: in21,
      endDate: in21,
      status: 0,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.open,
      title: "Limpeza Espinho — Inscrições abertas",
      description: "Junta-te como voluntário. Vagas limitadas.",
      meetingLocation: "Entrada principal da praia",
      meetingTime: "08:30:00",
      startDate: in14,
      endDate: in14,
      status: 1,
      organizerId: IDS.users.organizer,
      districtCode: "aveiro",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.inProgress,
      title: "Limpeza Norte — Em progresso",
      description: "Campanha activa neste fim de semana.",
      meetingLocation: "Miradouro da praia",
      meetingTime: "10:00:00",
      startDate: minus3,
      endDate: plus3,
      status: 3,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.completed,
      title: "Limpeza Primavera — Concluída",
      description: "Campanha terminada com relatório de recolhas.",
      meetingLocation: "Centro interpretativo",
      meetingTime: "09:30:00",
      startDate: minus30,
      endDate: minus25,
      status: 4,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    }
  ])

  await CampaignBeach.bulkCreate([
    {
      id: "70000000-0000-4000-8000-000000000001",
      campaignId: IDS.campaigns.open,
      beachId: IDS.beaches.praiaEspinho,
      createdAt: now
    },
    {
      id: "70000000-0000-4000-8000-000000000002",
      campaignId: IDS.campaigns.inProgress,
      beachId: IDS.beaches.praiaVilaCha,
      createdAt: now
    },
    {
      id: "70000000-0000-4000-8000-000000000003",
      campaignId: IDS.campaigns.inProgress,
      beachId: IDS.beaches.praiaAzurara,
      createdAt: now
    },
    {
      id: "70000000-0000-4000-8000-000000000004",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaVilaCha,
      createdAt: now
    },
    {
      id: "70000000-0000-4000-8000-000000000005",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaAzurara,
      createdAt: now
    }
  ])

  await Registration.bulkCreate([
    {
      id: "80000000-0000-4000-8000-000000000001",
      campaignId: IDS.campaigns.open,
      userId: IDS.users.volunteer1,
      role: 0,
      status: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "80000000-0000-4000-8000-000000000003",
      campaignId: IDS.campaigns.inProgress,
      userId: IDS.users.volunteer1,
      role: 0,
      status: 1,
      attendance: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "80000000-0000-4000-8000-000000000004",
      campaignId: IDS.campaigns.inProgress,
      userId: IDS.users.volunteer2,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "80000000-0000-4000-8000-000000000005",
      campaignId: IDS.campaigns.completed,
      userId: IDS.users.volunteer1,
      role: 0,
      status: 1,
      attendance: true,
      createdAt: now,
      updatedAt: now
    }
  ])

  await Comment.bulkCreate([
    {
      id: "90000000-0000-4000-8000-000000000001",
      campaignId: IDS.campaigns.inProgress,
      userId: IDS.users.volunteer1,
      body: "Já estou no local, equipa pronta!",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "90000000-0000-4000-8000-000000000002",
      campaignId: IDS.campaigns.inProgress,
      userId: IDS.users.admin,
      body: "Bom trabalho a todos. Mantenham os sacos separados.",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "90000000-0000-4000-8000-000000000003",
      campaignId: IDS.campaigns.completed,
      userId: IDS.users.organizer,
      body: "Obrigado a todos os voluntários — excelente participação.",
      isVisible: true,
      createdAt: now,
      updatedAt: now
    }
  ])

  const completedAt = new Date()
  completedAt.setDate(completedAt.getDate() - 20)

  await WasteCollection.bulkCreate([
    {
      id: "a0000000-0000-4000-8000-000000000001",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaVilaCha,
      wasteId: IDS.wastes.bottlePet,
      recordedByUserId: IDS.users.volunteer1,
      unitQuantity: 120,
      actualWeightKg: null,
      createdAt: completedAt,
      updatedAt: completedAt
    },
    {
      id: "a0000000-0000-4000-8000-000000000002",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaVilaCha,
      wasteId: IDS.wastes.glassBottle,
      recordedByUserId: IDS.users.organizer,
      unitQuantity: 45,
      actualWeightKg: null,
      createdAt: completedAt,
      updatedAt: completedAt
    },
    {
      id: "a0000000-0000-4000-8000-000000000003",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaAzurara,
      wasteId: IDS.wastes.canAluminium,
      recordedByUserId: IDS.users.volunteer1,
      unitQuantity: 80,
      actualWeightKg: null,
      createdAt: completedAt,
      updatedAt: completedAt
    },
    {
      id: "a0000000-0000-4000-8000-000000000004",
      campaignId: IDS.campaigns.completed,
      beachId: IDS.beaches.praiaAzurara,
      wasteId: IDS.wastes.fishingNet,
      recordedByUserId: IDS.users.organizer,
      unitQuantity: 1,
      actualWeightKg: 2.35,
      createdAt: completedAt,
      updatedAt: completedAt
    }
  ])
}
