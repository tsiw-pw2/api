import { Campaign, CampaignBeach } from "../../models/db.config.js"
import { addDays } from "./dates.mjs"
import { campaignBeachId, IDS } from "./ids.mjs"

export async function seedCampaigns() {
  const now = new Date()
  const in14 = addDays(now, 14)
  const in21 = addDays(now, 21)
  const in18 = addDays(now, 18)
  const in35 = addDays(now, 35)
  const minus30 = addDays(now, -30)
  const minus25 = addDays(now, -25)
  const minus3 = addDays(now, -3)
  const plus3 = addDays(now, 3)

  await Campaign.bulkCreate([
    {
      id: IDS.campaigns.planned,
      title: "Limpeza de Outono  -  Matosinhos",
      description:
        "Acção de limpeza da orla da Praia de Matosinhos e do passeio marítimo. Inscrições abrem duas semanas antes da data.",
      meetingLocation: "Parque de estacionamento do Mercado de Matosinhos",
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
      title: "Limpeza de Verão  -  Espinho",
      description:
        "Acção de limpeza da Praia de Espinho. Inscrições abertas até três dias antes da data. Material fornecido pela Câmara.",
      meetingLocation: "Entrada principal da Praia de Espinho",
      meetingTime: "08:30:00",
      startDate: in14,
      endDate: in14,
      status: 1,
      organizerId: IDS.users.organizer2,
      districtCode: "aveiro",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.closed,
      title: "Limpeza Costeira  -  Matosinhos",
      description:
        "Inscrições encerradas. Equipa confirmada para o próximo fim de semana na Praia de Matosinhos.",
      meetingLocation: "Passeio Marítimo de Matosinhos",
      meetingTime: "09:00:00",
      startDate: in18,
      endDate: in18,
      status: 2,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.inProgress,
      title: "Limpeza da Foz do Ave  -  Em curso",
      description:
        "Recolha de resíduos na faixa entre a Praia da Azurara e a Praia da Codicheira. Acção a decorrer neste fim de semana.",
      meetingLocation: "Miradouro da Praia da Azurara",
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
      title: "Limpeza de Primavera  -  Vila do Conde",
      description:
        "Campanha concluída entre Azurara, Codicheira e Cabedelo. Resultados disponíveis no painel municipal.",
      meetingLocation: "Centro de interpretação da costa, Vila do Conde",
      meetingTime: "09:30:00",
      startDate: minus30,
      endDate: minus25,
      status: 4,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.cancelled,
      title: "Limpeza do Douro  -  Cancelada",
      description: "Acção cancelada por condições meteorológicas adversas. Nova data a anunciar.",
      meetingLocation: "Parque da Afurada, Vila Nova de Gaia",
      meetingTime: "08:00:00",
      startDate: in35,
      endDate: in35,
      status: 5,
      organizerId: IDS.users.organizer,
      districtCode: "porto",
      createdAt: now,
      updatedAt: now
    },
    {
      id: IDS.campaigns.empty,
      title: "Campanha de demonstração  -  Sem dados",
      description: "Campanha com praia associada; separadores de voluntários e recolhas vazios.",
      meetingLocation: "A definir no dia",
      meetingTime: "09:00:00",
      startDate: in21,
      endDate: in21,
      status: 0,
      organizerId: IDS.users.organizer2,
      districtCode: "aveiro",
      createdAt: now,
      updatedAt: now
    }
  ])

  await CampaignBeach.bulkCreate([
    { id: campaignBeachId(1), campaignId: IDS.campaigns.open, beachId: IDS.beaches.praiaEspinho, createdAt: now },
    { id: campaignBeachId(2), campaignId: IDS.campaigns.closed, beachId: IDS.beaches.praiaMatosinhos, createdAt: now },
    { id: campaignBeachId(3), campaignId: IDS.campaigns.inProgress, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: campaignBeachId(4), campaignId: IDS.campaigns.inProgress, beachId: IDS.beaches.praiaCodicheira, createdAt: now },
    { id: campaignBeachId(5), campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaAzurara, createdAt: now },
    { id: campaignBeachId(6), campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaCodicheira, createdAt: now },
    { id: campaignBeachId(7), campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaCabedelo, createdAt: now },
    { id: campaignBeachId(8), campaignId: IDS.campaigns.completed, beachId: IDS.beaches.praiaApulia, createdAt: now },
    { id: campaignBeachId(9), campaignId: IDS.campaigns.cancelled, beachId: IDS.beaches.praiaCodicheira, createdAt: now },
    { id: campaignBeachId(10), campaignId: IDS.campaigns.empty, beachId: IDS.beaches.praiaEspinho, createdAt: now }
  ])
}
