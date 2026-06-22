import bcrypt from "bcryptjs"
import { User } from "../../models/db.config.js"

const BCRYPT_ROUNDS = 10
const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"

// Repor palavra-passe e flags de papel ao estado do seed.
export async function resetSeedUser(
  userId,
  { isAdmin = false, isOrganizer = false } = {}
) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS)
  await User.update(
    { passwordHash, isAdmin, isOrganizer },
    { where: { id: userId } }
  )
}
