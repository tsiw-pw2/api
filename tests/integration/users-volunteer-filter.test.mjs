import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"

const ORG_ADMIN_EMAIL = "ambiente@viladoconde.pt"
const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"

describe("GET /organizations/:id/members (admin da org)", () => {
  it("devolve 200 com equipa da organização", async () => {
    const login = await request(app)
      .post("/sessions")
      .send({
        email: ORG_ADMIN_EMAIL,
        password: DEMO_PASSWORD,
        organizationId: IDS.organizations.vilaConde
      })
    assert.equal(login.status, 201)
    const token = login.body.token
    assert.ok(token)

    const res = await request(app)
      .get(`/organizations/${IDS.organizations.vilaConde}/members`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-org-id", IDS.organizations.vilaConde)

    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.items))
    assert.ok(res.body.items.length >= 1)
    assert.ok(res.body.links?.self)
  })

  it("voluntário não acede a membros (403)", async () => {
    const login = await request(app)
      .post("/sessions")
      .send({ email: "maria.silva@email.pt", password: DEMO_PASSWORD })
    assert.equal(login.status, 201)

    const res = await request(app)
      .get(`/organizations/${IDS.organizations.vilaConde}/members`)
      .set("Authorization", `Bearer ${login.body.token}`)

    assert.equal(res.status, 403)
  })
})
