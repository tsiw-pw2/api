import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const ORGANIZER_EMAIL = "ambiente@viladoconde.pt"
const VOLUNTEER_EMAIL = "joao.ferreira@email.pt"

async function login(email, organizationId = null) {
  const body = { email, password: DEMO_PASSWORD }
  if (organizationId) body.organizationId = organizationId
  const res = await request(app).post("/sessions").send(body)
  assert.equal(res.status, 201)
  return res.body.token
}

describe("GET /dashboards/overview", () => {
  it("staff municipal obtém painel com métricas (200)", async () => {
    const token = await login(ORGANIZER_EMAIL, IDS.organizations.vilaConde)

    const res = await request(app)
      .get("/dashboards/overview")
      .set("Authorization", `Bearer ${token}`)
      .set("x-org-id", IDS.organizations.vilaConde)

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
