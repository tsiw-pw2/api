import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const IN_PROGRESS_CAMPAIGN_ID = IDS.campaigns.inProgress
const VOLUNTEER1_EMAIL = "voluntario1@demo.pt"
const ORGANIZER_EMAIL = "organizador@demo.pt"

async function login(email) {
  const res = await request(app)
    .post("/sessions")
    .send({ email, password: DEMO_PASSWORD })
  assert.equal(res.status, 201)
  return res.body.token
}

describe("permissões de recolhas de resíduos", () => {
  it("voluntário inscrito não pode registar recolha (403)", async () => {
    const token = await login(VOLUNTEER1_EMAIL)

    const detail = await request(app)
      .get(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)
    assert.equal(detail.status, 200)

    const beachId = detail.body.beaches?.[0]?.id
    assert.ok(beachId)

    const res = await request(app)
      .post(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}/waste-collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        beachId,
        wasteId: IDS.wastes.bottlePet,
        unitQuantity: 1
      })

    assert.equal(res.status, 403)
  })

  it("organizador pode registar recolha (201)", async () => {
    const token = await login(ORGANIZER_EMAIL)

    const detail = await request(app)
      .get(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)
    assert.equal(detail.status, 200)

    const beachId = detail.body.beaches?.[0]?.id
    assert.ok(beachId)

    const res = await request(app)
      .post(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}/waste-collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        beachId,
        wasteId: IDS.wastes.capPlastic,
        unitQuantity: 2
      })

    assert.equal(res.status, 201)
    assert.ok(res.body.id)
  })

  it("voluntário inscrito não pode alterar recolha do organizador (403)", async () => {
    const token = await login(VOLUNTEER1_EMAIL)
    const collectionId = IDS.wasteCollections.inProgressAzuraraPet

    const patch = await request(app)
      .patch(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}/waste-collections/${collectionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ unitQuantity: 999 })

    assert.equal(patch.status, 403)

    const del = await request(app)
      .delete(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}/waste-collections/${collectionId}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(del.status, 403)
  })

  it("organizador pode alterar recolha existente (200)", async () => {
    const token = await login(ORGANIZER_EMAIL)
    const collectionId = IDS.wasteCollections.inProgressAzuraraPet

    const patch = await request(app)
      .patch(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}/waste-collections/${collectionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ unitQuantity: 121 })

    assert.equal(patch.status, 200)
    assert.equal(patch.body.unitQuantity, 121)
  })
})
