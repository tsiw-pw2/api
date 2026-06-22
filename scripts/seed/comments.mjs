import { Comment } from "../../models/db.config.js"
import { addDaysAsDate } from "./dates.mjs"
import { commentId, IDS } from "./ids.mjs"
import { COMPLETED_CAMPAIGN_COMMENTS } from "./pitch-data.mjs"
import { volunteerUserIdByNumber } from "./users.mjs"

const USER_KEY_MAP = {
  admin: IDS.users.admin,
  volunteer1: IDS.users.volunteer1,
  volunteer3: IDS.users.volunteer3,
  volunteer4: IDS.users.volunteer4,
  volunteer5: IDS.users.volunteer5,
  volunteer6: () => volunteerUserIdByNumber(6),
  volunteer7: () => volunteerUserIdByNumber(7),
  volunteer8: () => volunteerUserIdByNumber(8),
  volunteer9: () => volunteerUserIdByNumber(9),
  volunteer10: () => volunteerUserIdByNumber(10)
}

function resolveUserId(key) {
  const entry = USER_KEY_MAP[key]
  return typeof entry === "function" ? entry() : entry
}

export async function seedComments() {
  const baseDate = addDaysAsDate(new Date(), -26)

  const rows = COMPLETED_CAMPAIGN_COMMENTS.map((item, index) => {
    const createdAt = addDaysAsDate(baseDate, index)
    return {
      id: commentId(index + 1),
      campaignId: IDS.campaigns.completed,
      userId: resolveUserId(item.userKey),
      body: item.body,
      isVisible: item.isVisible,
      createdAt,
      updatedAt: createdAt
    }
  })

  await Comment.bulkCreate(rows)
}
