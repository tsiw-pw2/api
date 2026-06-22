import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"
import { resetSeedUser } from "../helpers/reset-seed-user.mjs"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const ADMIN_EMAIL = "admin@demo.pt"
const VOLUNTEER1_EMAIL = "voluntario1@demo.pt"

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

    const stale = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`)
    assert.equal(stale.status, 401)

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

  it("promover papel invalida token antigo até novo login", async () => {
    const adminToken = await login(ADMIN_EMAIL)
    const volunteerToken = await login(VOLUNTEER1_EMAIL)

    const before = await request(app)
      .get("/waste-items")
      .set("Authorization", `Bearer ${volunteerToken}`)
    assert.equal(before.status, 200)
    assert.equal(before.body.links?.create, undefined)

    const patch = await request(app)
      .patch(`/users/${IDS.users.volunteer1}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "organizer" })
    assert.equal(patch.status, 200)

    const stale = await request(app)
      .get("/waste-items")
      .set("Authorization", `Bearer ${volunteerToken}`)
    assert.equal(stale.status, 401)

    const freshToken = await login(VOLUNTEER1_EMAIL)
    const after = await request(app)
      .get("/waste-items")
      .set("Authorization", `Bearer ${freshToken}`)
    assert.equal(after.status, 200)
    assert.equal(after.body.links?.create?.method, "POST")

    await request(app)
      .patch(`/users/${IDS.users.volunteer1}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "volunteer" })
      .expect(200)
  })
})
