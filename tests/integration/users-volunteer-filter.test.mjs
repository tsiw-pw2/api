import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"

const ADMIN_EMAIL = "admin@demo.pt"
const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"

describe("GET /users?role=volunteer (admin)", () => {
  it("devolve 200 com listagem paginada", async () => {
    const login = await request(app)
      .post("/sessions")
      .send({ email: ADMIN_EMAIL, password: DEMO_PASSWORD })
    assert.equal(login.status, 201)
    const token = login.body.token
    assert.ok(token)

    const res = await request(app)
      .get("/users")
      .query({ page: 1, pageSize: 10, role: "volunteer" })
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
    assert.equal(res.body.page, 1)
    assert.equal(res.body.pageSize, 10)
    assert.equal(typeof res.body.total, "number")
    assert.ok(res.body.links?.self)
  })

  it("rejeita role desconhecido com 400 (sem 401)", async () => {
    const login = await request(app)
      .post("/sessions")
      .send({ email: ADMIN_EMAIL, password: DEMO_PASSWORD })
    assert.equal(login.status, 201)
    const token = login.body.token

    const res = await request(app)
      .get("/users")
      .query({ page: 1, pageSize: 10, role: "volunteersss" })
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 400)
    assert.equal(res.body.success, false)
    assert.ok(res.body.errors?.role)
  })
})
