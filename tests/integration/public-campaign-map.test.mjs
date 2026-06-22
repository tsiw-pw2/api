import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"

describe("GET /campaigns/public-map", () => {
  it("devolve pinos sem autenticação (200)", async () => {
    const res = await request(app).get("/campaigns/public-map")
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.items))
    assert.ok(res.body.items.length >= 1)

    const first = res.body.items[0]
    assert.ok(first.beachId)
    assert.ok(first.campaignId)
    assert.ok(first.latitude)
    assert.ok(first.longitude)
    assert.ok(first.status)
    assert.equal(first.organizer, undefined)
    assert.equal(first.email, undefined)
  })
})
