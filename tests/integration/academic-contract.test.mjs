import { describe, it } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import {
  assertCampaignEndOnOrAfterStart,
  isCampaignOpenForSelfEnrollment,
  isEligibleForCampaignEnrollment,
  parsePhoneField
} from "../../utils/domain.utils.js"
import {
  listResponse,
  withMeResourceLinks,
  withRegistrationResourceLinks,
  DASHBOARD_OVERVIEW_PATH
} from "../../utils/response.utils.js"

describe("contrato REST da API", () => {
  it("GET / sem token devolve índice público mínimo", async () => {
    const res = await request(app).get("/")
    assert.equal(res.status, 200)
    assert.ok(res.body.links)
    assert.equal(res.body.links.self.href, "/")
    assert.equal(res.body.links.sessions.method, "POST")
    assert.equal(res.body.links.users.method, "POST")
    assert.equal(res.body.links.campaigns, undefined)
    assert.equal(res.body.links.usersCollection, undefined)
    assert.equal(res.body.endpoints, undefined)
  })

  it("401 sem token inclui links.login", async () => {
    const res = await request(app).get("/users/me")
    assert.equal(res.status, 401)
    assert.equal(res.body.success, false)
    assert.equal(res.body.links.login.href, "/sessions")
    assert.equal(res.body.links.login.method, "POST")
  })

  it("404 inclui links.index", async () => {
    const res = await request(app).get("/recurso-inexistente-xyz")
    assert.equal(res.status, 404)
    assert.equal(res.body.links.index.href, "/")
  })

})

describe("helpers hypermedia", () => {
  it("withMeResourceLinks usa self canónico e atalho me", () => {
    const resource = withMeResourceLinks({ id: "u-1", name: "Test" })
    assert.equal(resource.links.self.href, "/users/u-1")
    assert.equal(resource.links.me.href, "/users/me")
    assert.equal(resource.links.update.href, "/users/me")
  })

  it("withRegistrationResourceLinks aponta para campanha/inscrição", () => {
    const resource = withRegistrationResourceLinks("camp-1", { id: "reg-1" })
    assert.equal(resource.links.self.href, "/campaigns/camp-1/registrations/reg-1")
    assert.equal(resource.links.update.method, "PATCH")
  })

  it("listResponse com omitCreate não inclui links.create", () => {
    const body = listResponse(
      "/users/u1/registrations",
      [{ id: "r1" }],
      { page: 1, pageSize: 10, total: 1 },
      { omitCreate: true }
    )
    assert.equal(body.links.create, undefined)
    assert.ok(body.links.self)
  })
})

describe("regras de domínio", () => {
  it("parsePhoneField guarda apenas dígitos", () => {
    assert.equal(parsePhoneField("912 345 678"), "912345678")
    assert.equal(parsePhoneField(null), null)
  })

  it("isCampaignOpenForSelfEnrollment exclui em andamento e concluída", () => {
    assert.equal(isCampaignOpenForSelfEnrollment(1), true)
    assert.equal(isCampaignOpenForSelfEnrollment(2), true)
    assert.equal(isCampaignOpenForSelfEnrollment(3), false)
    assert.equal(isCampaignOpenForSelfEnrollment(4), false)
  })

  it("isEligibleForCampaignEnrollment valida idade mínima", () => {
    assert.equal(isEligibleForCampaignEnrollment("2000-01-15"), true)
    assert.equal(isEligibleForCampaignEnrollment(null), false)
    assert.equal(isEligibleForCampaignEnrollment("2020-01-01"), false)
  })

  it("assertCampaignEndOnOrAfterStart rejeita fim anterior ao início", () => {
    assert.throws(
      () => assertCampaignEndOnOrAfterStart("2026-06-10", "2026-06-01"),
      (err) => err.status === 400
    )
    assert.doesNotThrow(() => assertCampaignEndOnOrAfterStart("2026-06-01", "2026-06-10"))
  })
})
