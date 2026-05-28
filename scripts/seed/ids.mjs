const NS = "a0000000-0000-4000-8000-"

function id(n) {
  return `${NS}${String(n).padStart(12, "0")}`
}

export function buildIds() {
  const users = {
    admin: id(1),
    blocked: id(2),
    org1: id(3),
    org2: id(4),
    org3: id(5),
    org4: id(6),
    org5: id(7),
  }

  const volunteers = Array.from({ length: 40 }, (_, index) => id(100 + index))

  const beachLocations = Array.from({ length: 28 }, (_, index) => id(200 + index))
  const beaches = Array.from({ length: 28 }, (_, index) => id(300 + index))

  const wasteTypes = Array.from({ length: 8 }, (_, index) => id(400 + index))
  const wastes = Array.from({ length: 42 }, (_, index) => id(500 + index))

  const campaigns = Array.from({ length: 28 }, (_, index) => id(600 + index))
  const campaignBeaches = Array.from({ length: 55 }, (_, index) => id(700 + index))
  const registrations = Array.from({ length: 220 }, (_, index) => id(800 + index))
  const comments = Array.from({ length: 35 }, (_, index) => id(900 + index))
  const wasteCollections = Array.from({ length: 280 }, (_, index) => id(1000 + index))

  return {
    users,
    volunteers,
    beachLocations,
    beaches,
    wasteTypes,
    wastes,
    campaigns,
    campaignBeaches,
    registrations,
    comments,
    wasteCollections,
  }
}
