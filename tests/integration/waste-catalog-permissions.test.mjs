import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { User } from "../../models/db.config.js"
import { IDS } from "../../scripts/seed/ids.mjs"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const ORGANIZER_EMAIL = "organizador@demo.pt"
const VOLUNTEER2_EMAIL = "voluntario2@demo.pt"
const WASTE_ID = IDS.wastes.bottlePet
const CATEGORY_ID = IDS.wasteTypes.plastic

async function login(email) {
  const res = await request(app)
    .post("/sessions")
    .send({ email, password: DEMO_PASSWORD })
  assert.equal(res.status, 201)
  return res.body.token
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
      .set("Authorization", `Bearer ${token}`)
      .send(patchBody)

    assert.equal(res.status, 200)
    assert.equal(res.body.id, WASTE_ID)
    assert.ok(res.body.links?.update)
  })

  it("voluntário não pode actualizar item do catálogo (403)", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    const res = await request(app)
      .patch(`/waste-items/${WASTE_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .send(patchBody)

    assert.equal(res.status, 403)
    assert.equal(res.body.message, "Insufficient permissions")
  })

  it("organizador pode eliminar item sem referências (204)", async () => {
    const token = await login(ORGANIZER_EMAIL)
    const create = await request(app)
      .post("/waste-items")
      .set("Authorization", `Bearer ${token}`)
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
      .set("Authorization", `Bearer ${token}`)

    assert.equal(deleted.status, 204)
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
        .set("Authorization", `Bearer ${token}`)
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
