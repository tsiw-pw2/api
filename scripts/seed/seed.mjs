import { CORE_ACCOUNTS, EXTRA_ACCOUNTS } from "./pitch-data.mjs"
import { seedCatalog } from "./catalog.mjs"
import { seedCampaigns } from "./campaigns.mjs"
import { seedComments } from "./comments.mjs"
import { seedWasteCollections } from "./collections.mjs"
import { seedRegistrations } from "./registrations.mjs"
import { hashPassword, seedUsers } from "./users.mjs"

export async function runSeed(password) {
  const passwordHash = await hashPassword(password)
  await seedUsers(passwordHash)
  await seedCatalog()
  await seedCampaigns()
  await seedRegistrations()
  await seedComments()
  await seedWasteCollections()
  return { password, accounts: [...CORE_ACCOUNTS, ...EXTRA_ACCOUNTS] }
}
