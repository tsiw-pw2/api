import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  campaignItemActions,
  commentItemActions,
  beachItemActions,
  wasteItemActions,
  orgMemberItemActions,
  registrationItemActions,
  viewerRegistrationActions,
  REGISTRATION_ENROLL_BLOCK_REASONS,
  registrationEnrollBlockMessage,
  registrationEnrollForbiddenError
} from "../../utils/hypermedia.permissions.js"

const orgId = "15000000-0000-4000-8000-000000000001"
const orgAdmin = {
  actorId: "a1",
  role: "organizer",
  isOrganizer: true,
  orgAdminOrgIds: new Set([orgId])
}
const organizer = { actorId: "o1", role: "organizer", isOrganizer: true, orgAdminOrgIds: new Set() }
const volunteer = { actorId: "v1", role: "volunteer", isOrganizer: false, orgAdminOrgIds: new Set() }
const root = { actorId: "r1", role: "volunteer", isRoot: true, isOrganizer: false, orgAdminOrgIds: new Set() }

describe("hypermedia.permissions", () => {
  it("campaignItemActions: org da campanha pode update/delete", () => {
    const campaign = { id: "c1", organizerId: "o1" }
    const actions = campaignItemActions(organizer, campaign)
    assert.equal(actions.self, true)
    assert.equal(actions.update, true)
    assert.equal(actions.delete, true)
  })

  it("campaignItemActions: admin da org gere campanhas de outros organizadores", () => {
    const campaign = { id: "c1", organizerId: "o2", organizationId: orgId }
    const actions = campaignItemActions(orgAdmin, campaign)
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

  it("beachItemActions: organizador pode update/delete", () => {
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

  it("wasteItemActions: root só self", () => {
    const actions = wasteItemActions(root)
    assert.equal(actions.self, true)
    assert.equal(actions.update, undefined)
  })

  it("beachItemActions: root não pode update/delete", () => {
    const beach = { id: "b1" }
    const actions = beachItemActions(root, beach)
    assert.equal(actions.update, undefined)
    assert.equal(actions.delete, undefined)
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

  it("registrationItemActions: campanha concluída ou cancelada não permite update", () => {
    const reg = { id: "r1", userId: "v1", status: 1 }
    const completed = { id: "c1", organizerId: "o1", status: 4 }
    const cancelled = { id: "c2", organizerId: "o1", status: 5 }

    assert.equal(registrationItemActions(organizer, reg, completed).update, undefined)
    assert.equal(registrationItemActions(volunteer, reg, completed).update, undefined)
    assert.equal(registrationItemActions(organizer, reg, cancelled).update, undefined)
  })

  it("orgMemberItemActions inclui update", () => {
    const actions = orgMemberItemActions()
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
