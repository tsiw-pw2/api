import { runSeed } from "./seed/index.mjs"

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
