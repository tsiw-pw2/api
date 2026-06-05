import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { initDatabase } from "../../models/db.config.js"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const ADMIN_EMAIL = "admin@demo.pt"
const VOLUNTEER_EMAIL = "voluntario2@demo.pt"

let dbReady = false

try {
  await initDatabase()
  dbReady = true
} catch {
  console.warn("dashboard-overview: MySQL indisponível — testes ignorados")
}

async function login(email) {
  const res = await request(app)
    .post("/sessions")
    .send({ email, password: DEMO_PASSWORD })
  assert.equal(res.status, 201)
  return res.body.token
}

describe("GET /dashboards/overview", { skip: !dbReady }, () => {
  it("admin obtém painel com métricas (200)", async () => {
    const token = await login(ADMIN_EMAIL)

    const res = await request(app)
      .get("/dashboards/overview")
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 200)
    assert.ok(res.body.metrics)
    assert.equal(typeof res.body.metrics.campaignCount, "number")
    assert.ok(Array.isArray(res.body.nextCampaignRows))
    assert.ok(res.body.nextCampaignRows.some((row) => row.label === "Data" && row.value !== "—"))
  })

  it("voluntário não acede ao painel (403)", async () => {
    const token = await login(VOLUNTEER_EMAIL)

    const res = await request(app)
      .get("/dashboards/overview")
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 403)
  })
})
