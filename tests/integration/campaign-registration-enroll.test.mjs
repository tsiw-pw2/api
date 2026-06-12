import { describe, it, before } from "node:test"
import assert from "node:assert/strict"
import request from "supertest"
import { app } from "../../app.js"
import { IDS } from "../../scripts/seed/ids.mjs"
import { resetSeedUser } from "../helpers/reset-seed-user.mjs"
import { clearActorContextCache, evaluateRegistrationCollectionCreate, loadActorContext, REGISTRATION_ENROLL_BLOCK_REASONS, registrationCollectionCreateAllowed, registrationEnrollBlockMessage } from "../../utils/hypermedia.permissions.js"

const DEMO_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Demo2026!"
const OPEN_CAMPAIGN_ID = IDS.campaigns.open
const CLOSED_CAMPAIGN_ID = IDS.campaigns.closed
const IN_PROGRESS_CAMPAIGN_ID = IDS.campaigns.inProgress
const VOLUNTEER1_REG_ID = "80000000-0000-4000-8000-000000000001"
const ORGANIZER_EMAIL = "ambiente@viladoconde.pt"
const VOLUNTEER1_EMAIL = "maria.silva@email.pt"
const VOLUNTEER2_EMAIL = "joao.ferreira@email.pt"

async function login(email, organizationId = null) {
  const body = { email, password: DEMO_PASSWORD }
  if (organizationId) body.organizationId = organizationId
  const res = await request(app).post("/sessions").send(body)
  assert.equal(res.status, 201)
  return res.body.token
}

describe("inscrição em campanha", () => {
  before(async () => {
    await resetSeedUser(IDS.users.volunteer1)
  })

  it("campanha com inscrições encerradas não permite auto-inscrição (403)", async () => {
    const token = await login(VOLUNTEER1_EMAIL)

    const detail = await request(app)
      .get(`/campaigns/${CLOSED_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(detail.status, 200)
    assert.equal(detail.body.viewerCanEnroll, false)
    assert.equal(detail.body.links.selfRegistration, undefined)

    clearActorContextCache()
    const actor = await loadActorContext(IDS.users.volunteer1)
    const check = await evaluateRegistrationCollectionCreate(actor, CLOSED_CAMPAIGN_ID)
    assert.equal(check.allowed, false)
    assert.equal(check.reason, REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_CLOSED)
    assert.equal(
      await registrationCollectionCreateAllowed(actor, CLOSED_CAMPAIGN_ID),
      false
    )

    const res = await request(app)
      .post(`/campaigns/${CLOSED_CAMPAIGN_ID}/registrations`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 403)
    assert.equal(res.body.success, false)
    assert.equal(
      res.body.message,
      registrationEnrollBlockMessage(REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_CLOSED)
    )
    assert.deepEqual(res.body.errors?.code, [REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_CLOSED])
  })

  it("voluntario2 inscreve na campanha aberta sem cancelar primeiro (201)", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    let detail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(detail.status, 200)

    const activeReg = detail.body.viewerRegistration
    if (!detail.body.viewerCanEnroll && activeReg && activeReg.status !== 2) {
      await request(app)
        .patch(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations/${activeReg.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: 2 })
        .expect(200)
      detail = await request(app)
        .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
        .set("Authorization", `Bearer ${token}`)
    }

    assert.equal(detail.body.viewerCanEnroll, true)
    if (detail.body.viewerRegistration) {
      assert.equal(detail.body.viewerRegistration.status, 2)
    }
    assert.equal(detail.body.links.selfRegistration?.method, "POST")

    const res = await request(app)
      .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 201)
    assert.ok(res.body.id)
    assert.equal(res.body.role, 0)
    assert.equal(res.body.status, 1)
  })

  it("qualquer cargo (ex.: organizador) pode inscrever-se numa campanha aberta (201)", async () => {
    const token = await login(ORGANIZER_EMAIL)

    let detail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(detail.status, 200)

    const activeReg = detail.body.viewerRegistration
    if (!detail.body.viewerCanEnroll && activeReg && activeReg.status !== 2) {
      await request(app)
        .patch(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations/${activeReg.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: 2 })
        .expect(200)
      detail = await request(app)
        .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
        .set("Authorization", `Bearer ${token}`)
    }

    assert.equal(detail.status, 200)
    assert.equal(detail.body.viewerCanEnroll, true)
    assert.equal(detail.body.links.selfRegistration?.method, "POST")

    const res = await request(app)
      .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 201)
    assert.ok(res.body.id)
  })

  it("campanha em progresso não permite inscrição (viewerCanEnroll false)", async () => {
    const token = await login(ORGANIZER_EMAIL)

    const detail = await request(app)
      .get(`/campaigns/${IN_PROGRESS_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(detail.status, 200)
    assert.equal(detail.body.viewerCanEnroll, false)
    assert.equal(detail.body.links.selfRegistration, undefined)

    clearActorContextCache()
    const actor = await loadActorContext(IDS.users.organizer)
    const check = await evaluateRegistrationCollectionCreate(actor, IN_PROGRESS_CAMPAIGN_ID)
    assert.equal(check.allowed, false)
    assert.equal(check.reason, REGISTRATION_ENROLL_BLOCK_REASONS.CAMPAIGN_CLOSED)
    assert.equal(
      await registrationCollectionCreateAllowed(actor, IN_PROGRESS_CAMPAIGN_ID),
      false
    )
  })

  it("voluntário com inscrição activa tem viewerCanEnroll false", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    const detail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(detail.status, 200)
    assert.equal(detail.body.viewerCanEnroll, false)
    assert.ok(detail.body.viewerRegistration)
    assert.notEqual(detail.body.viewerRegistration.status, 2)
  })

  it("utilizador já inscrito não pode voltar a inscrever-se (403 com motivo)", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    clearActorContextCache()
    const actor = await loadActorContext(IDS.users.volunteer2)
    const check = await evaluateRegistrationCollectionCreate(actor, OPEN_CAMPAIGN_ID)
    assert.equal(check.allowed, false)
    assert.equal(check.reason, REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED)

    const res = await request(app)
      .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 403)
    assert.equal(res.body.success, false)
    assert.equal(
      res.body.message,
      registrationEnrollBlockMessage(REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED)
    )
    assert.deepEqual(res.body.errors?.code, [REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED])
  })

  it("voluntario2 inscreve sem cancelar inscrição do voluntario1", async () => {
    const volunteer1Token = await login(VOLUNTEER1_EMAIL)

    let volunteer1Detail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${volunteer1Token}`)

    let volunteer1RegId = volunteer1Detail.body.viewerRegistration?.id

    if (volunteer1Detail.body.viewerCanEnroll === true) {
      const enroll = await request(app)
        .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
        .set("Authorization", `Bearer ${volunteer1Token}`)
      assert.equal(enroll.status, 201)
      volunteer1RegId = enroll.body.id
    } else if (volunteer1Detail.body.viewerRegistration?.status === 2) {
      const enroll = await request(app)
        .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
        .set("Authorization", `Bearer ${volunteer1Token}`)
      assert.equal(enroll.status, 201)
      volunteer1RegId = enroll.body.id
    } else {
      assert.equal(volunteer1Detail.body.viewerRegistration?.status, 1)
      volunteer1RegId = volunteer1Detail.body.viewerRegistration.id
    }

    const volToken = await login(VOLUNTEER2_EMAIL)

    let volDetail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${volToken}`)

    if (!volDetail.body.viewerCanEnroll && volDetail.body.viewerRegistration?.status !== 2) {
      await request(app)
        .patch(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations/${volDetail.body.viewerRegistration.id}`)
        .set("Authorization", `Bearer ${volToken}`)
        .send({ status: 2 })
        .expect(200)
      volDetail = await request(app)
        .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
        .set("Authorization", `Bearer ${volToken}`)
    }

    if (volDetail.body.viewerCanEnroll === true) {
      const volEnroll = await request(app)
        .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
        .set("Authorization", `Bearer ${volToken}`)
      assert.equal(volEnroll.status, 201)
    }

    volunteer1Detail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${volunteer1Token}`)

    assert.equal(volunteer1Detail.status, 200)
    assert.equal(volunteer1Detail.body.viewerRegistration?.id, volunteer1RegId)
    assert.equal(volunteer1Detail.body.viewerRegistration?.status, 1)
    assert.equal(volunteer1Detail.body.viewerRegistration?.userId, IDS.users.volunteer1)

    const orgToken = await login(ORGANIZER_EMAIL, IDS.organizations.vilaConde)
    const list = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
      .set("Authorization", `Bearer ${orgToken}`)
      .set("x-org-id", IDS.organizations.vilaConde)

    assert.equal(list.status, 200)
    const volunteer1Row = list.body.data.find((row) => row.user?.id === IDS.users.volunteer1)
    assert.ok(volunteer1Row)
    assert.equal(volunteer1Row.status, 1)
  })

  it("voluntario1 com inscrição activa no seed também recebe 403 ao repetir POST", async () => {
    const token = await login(VOLUNTEER1_EMAIL)

    let detail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(detail.status, 200)

    if (detail.body.viewerCanEnroll === true) {
      const enroll = await request(app)
        .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
        .set("Authorization", `Bearer ${token}`)
      assert.equal(enroll.status, 201)
      detail = await request(app)
        .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
        .set("Authorization", `Bearer ${token}`)
    }

    assert.equal(detail.body.viewerCanEnroll, false)
    assert.notEqual(detail.body.viewerRegistration?.status, 2)

    const res = await request(app)
      .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 403)
    assert.deepEqual(res.body.errors?.code, [REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED])
  })

  it("após cancelar inscrição, voluntário vê viewerCanEnroll e link selfRegistration", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    const before = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)
    const regId = before.body.viewerRegistration?.id
    assert.ok(regId)

    await request(app)
      .patch(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations/${regId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: 2 })
      .expect(200)

    const detail = await request(app)
      .get(`/campaigns/${OPEN_CAMPAIGN_ID}`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(detail.status, 200)
    assert.equal(detail.body.viewerCanEnroll, true)
    assert.equal(detail.body.links.selfRegistration?.method, "POST")
    assert.equal(detail.body.links.selfRegistration?.href, `/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)

    clearActorContextCache()
    const actor = await loadActorContext(IDS.users.volunteer2)
    assert.equal(await registrationCollectionCreateAllowed(actor, OPEN_CAMPAIGN_ID), true)
  })

  it("POST /registrations cria inscrição (201) após cancelamento prévio", async () => {
    const token = await login(VOLUNTEER2_EMAIL)

    const res = await request(app)
      .post(`/campaigns/${OPEN_CAMPAIGN_ID}/registrations`)
      .set("Authorization", `Bearer ${token}`)

    assert.equal(res.status, 201)
    assert.ok(res.body.id)
    assert.equal(res.body.role, 0)
    assert.equal(res.body.status, 1)
  })
})
