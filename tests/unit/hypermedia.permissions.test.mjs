import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  campaignItemActions,
  commentItemActions,
  beachItemActions,
  wasteItemActions,
  adminUserItemActions,
  registrationItemActions,
  viewerRegistrationActions,
  REGISTRATION_ENROLL_BLOCK_REASONS,
  registrationEnrollBlockMessage,
  registrationEnrollForbiddenError
} from "../../utils/hypermedia.permissions.js"

const admin = { actorId: "a1", role: "admin", isAdmin: true, isOrganizer: false }
const organizer = { actorId: "o1", role: "organizer", isAdmin: false, isOrganizer: true }
const volunteer = { actorId: "v1", role: "volunteer", isAdmin: false, isOrganizer: false }

describe("hypermedia.permissions", () => {
  it("campaignItemActions: org da campanha pode update/delete", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const actions = campaignItemActions(organizer, campaign)
    assert.equal(actions.self, true)
    assert.equal(actions.update, true)
    assert.equal(actions.delete, true)
  })

  it("campaignItemActions: voluntário não pode update/delete", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const actions = campaignItemActions(volunteer, campaign)
    assert.equal(actions.self, true)
    assert.equal(actions.update, undefined)
    assert.equal(actions.delete, undefined)
  })

  it("commentItemActions: voluntário autor só delete, não update", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const comment = { id: "cm1", userId: "v1" }
    const actions = commentItemActions(volunteer, comment, campaign)
    assert.equal(actions.update, undefined)
    assert.equal(actions.delete, true)
  })

  it("commentItemActions: org pode update e delete", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const comment = { id: "cm1", userId: "v1" }
    const actions = commentItemActions(organizer, comment, campaign)
    assert.equal(actions.update, true)
    assert.equal(actions.delete, true)
  })

  it("beachItemActions: organizador pode update/delete em qualquer praia", () => {
    const beach = { id: "b1", createdByUserId: "other" }
    const actions = beachItemActions(organizer, beach)
    assert.equal(actions.update, true)
    assert.equal(actions.delete, true)
  })

  it("beachItemActions: voluntário não pode update/delete", () => {
    const beach = { id: "b1", createdByUserId: "v1" }
    const actions = beachItemActions(volunteer, beach)
    assert.equal(actions.update, undefined)
    assert.equal(actions.delete, undefined)
  })

  it("wasteItemActions: voluntário só self", () => {
    const actions = wasteItemActions(volunteer)
    assert.equal(actions.self, true)
    assert.equal(actions.update, undefined)
  })

  it("registrationItemActions: inscrito pode cancelar (update), sem delete", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const reg = { id: "r1", userId: "v1", status: 1 }
    const actions = registrationItemActions(volunteer, reg, campaign)
    assert.equal(actions.update, true)
    assert.equal(actions.delete, undefined)
  })

  it("registrationItemActions: organizador da campanha gere inscrições de terceiros (sem delete)", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const reg = { id: "r1", userId: "v1", status: 1 }
    const actions = registrationItemActions(organizer, reg, campaign)
    assert.equal(actions.update, true)
    assert.equal(actions.delete, undefined)
  })

  it("adminUserItemActions inclui update", () => {
    const actions = adminUserItemActions()
    assert.equal(actions.update, true)
  })

  it("viewerRegistrationActions usa userId real da inscrição (não força actorId)", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const registration = { id: "r1", userId: "v1", status: 1 }
    const actions = viewerRegistrationActions(volunteer, registration, campaign)
    assert.equal(actions.update, true)
    assert.equal(actions.delete, undefined)

    const otherUserReg = { id: "r2", userId: "other", status: 1 }
    const denied = viewerRegistrationActions(volunteer, otherUserReg, campaign)
    assert.equal(denied.update, undefined)
    assert.equal(denied.delete, undefined)
  })

  it("registrationEnrollForbiddenError devolve 403 com mensagem e código estável", () => {
    const err = registrationEnrollForbiddenError(
      REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED
    )
    assert.equal(err.status, 403)
    assert.equal(
      err.message,
      registrationEnrollBlockMessage(REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED)
    )
    assert.deepEqual(err.errors.code, [REGISTRATION_ENROLL_BLOCK_REASONS.ALREADY_ENROLLED])
  })
})
