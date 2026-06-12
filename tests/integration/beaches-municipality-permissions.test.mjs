import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const VILA_ORG = IDS.organizations.vilaConde
const POVOA_ORG = IDS.organizations.povoaVarzim
const POVOA_BEACH_ID = IDS.beaches.praiaSalgueiros

async function login(email, organizationId) {
  const res = await request(app)
    .post("/sessions")
    .send({ email, password: DEMO_PASSWORD, organizationId })
  assert.equal(res.status, 201)
  return res.body.token
}

describe("permissões de praias por concelho da org", () => {
  it("organizador de Vila do Conde não elimina praia da Póvoa (404)", async () => {
    const token = await login("ambiente@viladoconde.pt", VILA_ORG)

    const res = await request(app)
      .delete(`/beaches/${POVOA_BEACH_ID}`)
      .set({
        Authorization: `Bearer ${token}`,
        "x-org-id": VILA_ORG
      })

    assert.equal(res.status, 404)
  })

  it("admin da Póvoa não altera praia de Vila do Conde (404)", async () => {
    const token = await login("ambiente@povoa.varzim.pt", POVOA_ORG)

    const res = await request(app)
      .patch(`/beaches/${IDS.beaches.praiaAzurara}`)
      .set({
        Authorization: `Bearer ${token}`,
        "x-org-id": POVOA_ORG
      })
      .send({
        name: "Praia da Azurara",
        municipality: "Póvoa de Varzim",
        district: "Porto",
        latitude: "41.3501",
        longitude: "-8.7462"
      })

    assert.equal(res.status, 404)
  })
})
