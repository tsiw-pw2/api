import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"

const ADMIN_EMAIL = "admin@demo.pt"
const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"

describe("GET /beaches?q= (admin)", () => {
  it("devolve 200 com listagem filtrada por nome ou município", async () => {
    const login = await request(app)
      .post("/sessions")
      .send({ email: ADMIN_EMAIL, password: DEMO_PASSWORD })
    assert.equal(login.status, 201)
    const token = login.body.token
    assert.ok(token)

    const all = await request(app)
      .get("/beaches")
      .query({ page: 1, pageSize: 100 })
      .set("Authorization", `Bearer ${token}`)
    assert.equal(all.status, 200)
    assert.ok(Array.isArray(all.body.data))
    assert.ok(all.body.data.length > 0, "seed deve ter praias")

    const sample = all.body.data[0]
    const needle = String(sample.name).slice(0, 4).toLowerCase()
    assert.ok(needle.length >= 2)

    const filtered = await request(app)
      .get("/beaches")
      .query({ page: 1, pageSize: 100, q: needle })
      .set("Authorization", `Bearer ${token}`)

    assert.equal(filtered.status, 200)
    assert.ok(Array.isArray(filtered.body.data))
    assert.ok(filtered.body.data.length > 0)
    assert.ok(
      filtered.body.data.every(
        (row) =>
          String(row.name).toLowerCase().includes(needle) ||
          String(row.municipality ?? "").toLowerCase().includes(needle)
      )
    )
    assert.ok(filtered.body.links?.self)
    assert.ok(String(filtered.body.links.self.href).includes("q="))
  })

  it("rejeita q demasiado longo com 400", async () => {
    const login = await request(app)
      .post("/sessions")
      .send({ email: ADMIN_EMAIL, password: DEMO_PASSWORD })
    assert.equal(login.status, 201)
    const token = login.body.token

    const res = await request(app)
      .get("/beaches")
      .query({ q: "x".repeat(101) })
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 400)
    assert.equal(res.body.success, false)
  })
})
