import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"
import { resetSeedUser } from "../helpers/reset-seed-user.mjs"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const VOLUNTEER1_EMAIL = "maria.silva@email.pt"

async function login(email) {
  const res = await request(app)
    .post("/sessions")
    .send({ email, password: DEMO_PASSWORD })
  assert.equal(res.status, 201)
  return res.body.token
}

describe("segurança de utilizador", () => {
  before(async () => {
    await resetSeedUser(IDS.users.volunteer1)
  })

  after(async () => {
    await resetSeedUser(IDS.users.volunteer1)
  })

  it("PATCH /users/me/password com palavra-passe correcta devolve novo token (200)", async () => {
    const token = await login(VOLUNTEER1_EMAIL)

    const res = await request(app)
      .patch("/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: DEMO_PASSWORD, newPassword: "NewPass2026!" })

    assert.equal(res.status, 200)
    assert.equal(typeof res.body.token, "string")
    assert.ok(res.body.token.length > 0)

    const me = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${res.body.token}`)
    assert.equal(me.status, 200)

    await request(app)
      .patch("/users/me/password")
      .set("Authorization", `Bearer ${res.body.token}`)
      .send({ currentPassword: "NewPass2026!", newPassword: DEMO_PASSWORD })
      .expect(200)
  })

  it("PATCH /users/me/password rejeita palavra-passe actual errada com 400", async () => {
    const token = await login(VOLUNTEER1_EMAIL)

    const res = await request(app)
      .patch("/users/me/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrong-password", newPassword: "NewPass2026!" })

    assert.equal(res.status, 400)
    assert.match(res.body.message, /palavra-passe actual/i)
    assert.ok(res.body.errors?.currentPassword)
  })

  it("gestão global de utilizadores por PATCH /users/:id já não existe", async () => {
    const token = await login(VOLUNTEER1_EMAIL)

    const res = await request(app)
      .patch(`/users/${IDS.users.volunteer1}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "organizer" })

    assert.equal(res.status, 404)
  })
})
