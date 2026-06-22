import { Registration } from "../../models/db.config.js"
import { IDS, registrationId } from "./ids.mjs"
import { volunteerUserIdByNumber } from "./users.mjs"

function reg(seq, campaignId, volunteerNum, status, extra = {}) {
  const now = new Date()
  return {
    id: registrationId(seq),
    campaignId,
    userId: volunteerUserIdByNumber(volunteerNum),
    role: 0,
    status,
    createdAt: now,
    updatedAt: now,
    ...extra
  }
}

export async function seedRegistrations() {
  const rows = [
    // Invariantes de teste (IDs fixos 1–5)
    {
      id: registrationId(1),
      campaignId: IDS.campaigns.open,
      userId: IDS.users.volunteer1,
      role: 0,
      status: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: registrationId(2),
      campaignId: IDS.campaigns.closed,
      userId: IDS.users.volunteer2,
      role: 0,
      status: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: registrationId(3),
      campaignId: IDS.campaigns.inProgress,
      userId: IDS.users.volunteer1,
      role: 0,
      status: 1,
      attendance: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: registrationId(4),
      campaignId: IDS.campaigns.inProgress,
      userId: IDS.users.volunteer2,
      role: 0,
      status: 1,
      attendance: null,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: registrationId(5),
      campaignId: IDS.campaigns.open,
      userId: IDS.users.admin,
      role: 0,
      status: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  let seq = 6

  // Espinho (aberta): 14 confirmadas  -  v1 já inscrita; v2 livre para demo
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    rows.push(reg(seq++, IDS.campaigns.open, n, 1))
  }

  // Matosinhos (encerrada): 10 confirmadas + 2 pendentes (v2 já pendente)
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    rows.push(reg(seq++, IDS.campaigns.closed, n, 1))
  }
  rows.push(reg(seq++, IDS.campaigns.closed, 13, 0))

  // Foz do Ave (em curso): 8 confirmadas  -  v1, v2 já inscritos
  for (const n of [3, 4, 5, 6, 7, 8]) {
    const attendance = n <= 5 ? true : n === 6 ? false : null
    rows.push(reg(seq++, IDS.campaigns.inProgress, n, 1, { attendance }))
  }

  // Primavera (concluída): 12 confirmadas com presença registada
  for (const n of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 14, 15]) {
    rows.push(reg(seq++, IDS.campaigns.completed, n, 1, { attendance: true }))
  }

  await Registration.bulkCreate(rows)
}
