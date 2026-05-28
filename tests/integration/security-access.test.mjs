import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import request from "supertest"
import { app } from "../../app.js"
import { initDatabase } from "../../models/db.config.js"

const DEMO_PASSWORD = "Demo2026!"
const VOLUNTEER_EMAIL = "vol01.silva@email.pt"
const ORGANIZER_EMAIL = "organizador1@demo.local"

async function login(email) {
  const res = await request(app)
    .post("/sessions")
    .send({ email, password: DEMO_PASSWORD })
    .set("Accept", "application/json")
  assert.equal(res.status, 200, `login failed for ${email}: ${res.status}`)
  assert.ok(typeof res.body.token === "string" && res.body.token.length > 0)
  return res.body.token
}

async function firstCampaignId(token) {
  const res = await request(app)
    .get("/campaigns?page=1&pageSize=1")
    .set("Authorization", `Bearer ${token}`)
    .set("Accept", "application/json")
  assert.equal(res.status, 200)
  const id = res.body?.data?.[0]?.id
  assert.ok(typeof id === "string")
  return id
}

describe("security access", { skip: process.env.SKIP_INTEGRATION === "1" }, () => {
  before(async () => {
    await initDatabase()
  })

  after(() => {})

  it("rejects access token without tokenVersion claim", async () => {
    const jwt = await import("jsonwebtoken")
    const secret = process.env.JWT_SECRET
    assert.ok(secret && secret.length >= 32)
    const legacy = jwt.default.sign(
      { sub: "00000000-0000-0000-0000-000000000001", role: "volunteer" },
      secret,
      { algorithm: "HS256", expiresIn: "15m" }
    )
    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${legacy}`)
    assert.equal(res.status, 401)
  })

  it("volunteer cannot create beaches", async () => {
    const token = await login(VOLUNTEER_EMAIL)
    const res = await request(app)
      .post("/beaches")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Praia teste integração",
        municipality: "Esposende",
        district: "braga",
        latitude: "41.48",
        longitude: "-8.77"
      })
    assert.equal(res.status, 403)
  })

  it("outsider volunteer cannot list waste collections of a campaign", async () => {
    const organizerToken = await login(ORGANIZER_EMAIL)
    const volunteerToken = await login(VOLUNTEER_EMAIL)
    const campaignId = await firstCampaignId(organizerToken)
    const res = await request(app)
      .get(`/campaigns/${campaignId}/waste-collections`)
      .set("Authorization", `Bearer ${volunteerToken}`)
    assert.equal(res.status, 403)
  })

  it("cancelled campaign maps to distinct detail status phase", async () => {
    const token = await login(ORGANIZER_EMAIL)
    const listRes = await request(app)
      .get("/campaigns?status=cancelada&page=1&pageSize=1")
      .set("Authorization", `Bearer ${token}`)
    const campaignId = listRes.body?.data?.[0]?.id
    if (!campaignId) return
    const detailRes = await request(app)
      .get(`/campaigns/${campaignId}`)
      .set("Authorization", `Bearer ${token}`)
    assert.equal(detailRes.status, 200)
    assert.equal(detailRes.body.status, 3)
    assert.equal(detailRes.body.editStatus, "cancelada")
  })
})
