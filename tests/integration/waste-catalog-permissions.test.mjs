import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { User } from "../../models/db.config.js"
import { IDS } from "../../scripts/seed/ids.mjs"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const ORGANIZER_EMAIL = "ambiente@viladoconde.pt"
const ROOT_EMAIL = "gestao@mariva.pt"
const VOLUNTEER2_EMAIL = "joao.ferreira@email.pt"
const WASTE_ID = IDS.wastes.bottlePet
const CATEGORY_ID = IDS.wasteTypes.plastic
const ORG_ID = IDS.organizations.vilaConde

async function login(email, organizationId = ORG_ID) {
  const body = { email, password: DEMO_PASSWORD }
  if (organizationId) body.organizationId = organizationId
  const res = await request(app).post("/sessions").send(body)
  assert.equal(res.status, 201)
  return res.body.token
}

function orgHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "x-org-id": ORG_ID
  }
}

const patchBody = {
  name: "Garrafa PET",
  categoryId: CATEGORY_ID,
  unit: "unit",
  averageWeightGrams: "25"
}

describe("permissões do catálogo de resíduos", () => {
  it("organizador pode actualizar item do catálogo (200)", async () => {
    const token = await login(ORGANIZER_EMAIL)

    const res = await request(app)
      .patch(`/waste-items/${WASTE_ID}`)
      .set(orgHeaders(token))
      .send(patchBody)

    assert.equal(res.status, 200)
    assert.equal(res.body.id, WASTE_ID)
    assert.ok(res.body.links?.update)
  })

  it("voluntário não pode actualizar item do catálogo (403)", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    const res = await request(app)
      .patch(`/waste-items/${WASTE_ID}`)
      .set(orgHeaders(token))
      .send(patchBody)

    assert.equal(res.status, 403)
    assert.equal(res.body.message, "Insufficient permissions")
  })

  it("organizador pode eliminar item sem referências (204)", async () => {
    const token = await login(ORGANIZER_EMAIL)
    const create = await request(app)
      .post("/waste-items")
      .set(orgHeaders(token))
      .send({
        name: `Item temporário ${Date.now()}`,
        categoryId: CATEGORY_ID,
        unit: "unit",
        averageWeightGrams: "1"
      })

    assert.equal(create.status, 201)
    const tempId = create.body.id

    const deleted = await request(app)
      .delete(`/waste-items/${tempId}`)
      .set(orgHeaders(token))

    assert.equal(deleted.status, 204)
  })

  it("admin de outra org não altera item da org activa (404)", async () => {
    const povoaToken = await login("ambiente@povoa.varzim.pt", IDS.organizations.povoaVarzim)

    const res = await request(app)
      .patch(`/waste-items/${WASTE_ID}`)
      .set({
        Authorization: `Bearer ${povoaToken}`,
        "x-org-id": IDS.organizations.povoaVarzim
      })
      .send(patchBody)

    assert.equal(res.status, 404)
  })

  it("root não acede ao catálogo de resíduos (403)", async () => {
    const token = await login(ROOT_EMAIL, null)

    const res = await request(app)
      .get("/waste-items")
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 403)
  })

  it("JWT com papel antigo usa flags da BD em requireAnyRole (200)", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    await User.update(
      { isOrganizer: true, isAdmin: false },
      { where: { id: IDS.users.volunteer2 } }
    )

    try {
      const res = await request(app)
        .patch(`/waste-items/${WASTE_ID}`)
        .set(orgHeaders(token))
        .send(patchBody)

      assert.equal(res.status, 200)
      assert.equal(res.body.id, WASTE_ID)
    } finally {
      await User.update(
        { isOrganizer: false, isAdmin: false },
        { where: { id: IDS.users.volunteer2 } }
      )
    }
  })
})
