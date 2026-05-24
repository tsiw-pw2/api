/**
 * Smoke test: rotas na raiz (/sessions, /users, /campaigns, …).
 *
 * Pré-requisitos: API a correr, MySQL (sequelize.sync), JWT_SECRET, contas de teste e SMOKE_PASSWORD.
 * Execução: pnpm run smoke:api
 *
 * Opcional: API_BASE_URL, SMOKE_ORG_EMAIL, SMOKE_VOL_EMAIL, SMOKE_ADMIN_EMAIL
 */
import "dotenv/config"
import { randomUUID } from "node:crypto"
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const API_BASE = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")
const PREFIX = API_BASE
const PASSWORD =
  typeof process.env.SMOKE_PASSWORD === "string" && process.env.SMOKE_PASSWORD.trim().length > 0
    ? process.env.SMOKE_PASSWORD.trim()
    : "Demo2026!"

const EMAIL_ORG = process.env.SMOKE_ORG_EMAIL?.trim() || "organizador1@demo.local"
const EMAIL_VOL = process.env.SMOKE_VOL_EMAIL?.trim() || "maria.costa@email.pt"
const EMAIL_ADMIN = process.env.SMOKE_ADMIN_EMAIL?.trim() || "admin@demo.local"

/** @type {{ org: string, vol: string, admin: string }} */
const access = { org: "", vol: "", admin: "" }

const results = []

async function http(method, path, opts = {}) {
  const { token, jsonBody, rawBody, headers: extraHeaders } = opts
  const headers = new Headers({ Accept: "application/json", ...(extraHeaders || {}) })
  if (token) headers.set("Authorization", `Bearer ${token}`)
  let body = undefined
  if (jsonBody !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(jsonBody)
  } else if (rawBody !== undefined) {
    body = rawBody
  }
  const res = await fetch(`${PREFIX}${path}`, { method, headers, body })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, headers: res.headers, json, text }
}

async function login(email, role) {
  const res = await http("POST", "/sessions", {
    jsonBody: { email, password: PASSWORD }
  })
  const token = res.json?.token
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`Sessão falhou para ${email} (${role}): HTTP ${res.status}`)
  }
  access[role] = token
  return res
}

function record(name, method, path, expectStatuses, status, ok) {
  results.push({ name, method, path, expect: [...expectStatuses].sort((a, b) => a - b), status, ok })
}

async function expect(name, method, path, expectStatuses, exec) {
  const { status } = await exec()
  const ok = expectStatuses.includes(status)
  record(name, method, path, expectStatuses, status, ok)
  return ok
}

function hateoasListItems(json) {
  if (!json || typeof json !== "object") return []
  if (Array.isArray(json.data)) return json.data
  if (Array.isArray(json.items)) return json.items
  return []
}

async function findCampaignForVolunteer(volToken) {
  const cl = await http("GET", "/campaigns?page=1&pageSize=50", { token: volToken })
  if (cl.status !== 200) return null
  for (const row of hateoasListItems(cl.json)) {
    const det = await http("GET", `/campaigns/${row.id}`, { token: volToken })
    if (det.status !== 200) continue
    if (det.json?.viewerCanPostComment === true) {
      return row.id
    }
  }
  return null
}

const SMOKE_CAMPAIGN_EDIT_STATUS_PRIORITY = [
  "em_progresso",
  "aberta_inscricoes",
  "concluida",
  "planeada",
  "encerrada_inscricoes"
]

async function findCampaignIdForOrganizer(orgToken, orgUserId) {
  const cl = await http("GET", "/campaigns?page=1&pageSize=50", { token: orgToken })
  if (cl.status !== 200) return null
  const items = hateoasListItems(cl.json)
  const candidates = []
  for (const row of items) {
    const det = await http("GET", `/campaigns/${row.id}`, { token: orgToken })
    if (det.status !== 200) continue
    if (det.json?.organizer?.id !== orgUserId) continue
    const beaches = det.json?.beaches ?? []
    if (beaches.length === 0) continue
    if (det.json?.editStatus === "cancelada") continue
    candidates.push({ id: row.id, editStatus: det.json?.editStatus ?? "" })
  }
  for (const status of SMOKE_CAMPAIGN_EDIT_STATUS_PRIORITY) {
    const match = candidates.find((c) => c.editStatus === status)
    if (match) return match.id
  }
  return candidates[0]?.id ?? items[0]?.id ?? null
}

async function main() {
  const invalidLogin = await http("POST", "/sessions", { jsonBody: {} })
  record("sessions corpo inválido", "POST", "/sessions", [400], invalidLogin.status, invalidLogin.status === 400)

  await login(EMAIL_ORG, "org")
  await login(EMAIL_VOL, "vol")
  await login(EMAIL_ADMIN, "admin")

  await expect("users/me sem token", "GET", "/users/me", [401], () => http("GET", "/users/me"))

  await expect("users/me com token org", "GET", "/users/me", [200], () =>
    http("GET", "/users/me", { token: access.org })
  )

  await expect("users/me PATCH vazio (org)", "PATCH", "/users/me", [200], () =>
    http("PATCH", "/users/me", { token: access.org, jsonBody: {} })
  )

  await expect("dashboard org", "GET", "/dashboard", [200], () =>
    http("GET", "/dashboard", { token: access.org })
  )

  const beachesList = await http("GET", "/beaches?page=1&pageSize=5", { token: access.org })
  record("beaches list", "GET", "/beaches?page=1&pageSize=5", [200], beachesList.status, beachesList.status === 200)

  const beachItems = hateoasListItems(beachesList.json)
  const beachesHasHateoasData =
    beachesList.status === 200 && Array.isArray(beachesList.json?.data) && beachesList.json?.links?.create
  record("beaches list HATEOAS", "GET", "/beaches?page=1&pageSize=5", [200], beachesList.status, beachesHasHateoasData)
  const beach0 = beachItems[0]
  const beachId = beach0?.id
  if (beachId) {
    const one = await http("GET", `/beaches/${beachId}`, { token: access.org })
    record("beaches getById", "GET", `/beaches/:id`, [200], one.status, one.status === 200)
  } else {
    record("beaches getById", "GET", `/beaches/:id`, [200], 0, false)
  }

  const sameDistrict = beachItems.filter((b) => b.district === "braga").map((b) => b.id)
  const beachIdsForCampaign =
    sameDistrict.length >= 1 ? sameDistrict.slice(0, Math.min(2, sameDistrict.length)) : beachItems.slice(0, 1).map((b) => b.id)
  const districtForNewCampaign =
    (beachIdsForCampaign.length > 0 && beachItems.find((b) => b.id === beachIdsForCampaign[0])?.district) || "braga"

  const smokeBeachName = `Smoke praia ${randomUUID().slice(0, 8)}`
  const createBeach = await http("POST", "/beaches", {
    token: access.org,
    jsonBody: {
      name: smokeBeachName,
      municipality: "Esposende",
      district: "braga",
      latitude: 41.5333,
      longitude: -8.7833
    }
  })
  record("beaches create", "POST", "/beaches", [201], createBeach.status, createBeach.status === 201)
  const newBeachId = createBeach.json?.id

  if (newBeachId) {
    const putBeach = await http("PUT", `/beaches/${newBeachId}`, {
      token: access.org,
      jsonBody: {
        name: smokeBeachName,
        municipality: "Esposende",
        district: "braga",
        latitude: 41.5333,
        longitude: -8.7833
      }
    })
    record("beaches put", "PUT", "/beaches/:id", [200], putBeach.status, putBeach.status === 200)

    const delBeach = await http("DELETE", `/beaches/${newBeachId}`, { token: access.org })
    record("beaches delete", "DELETE", "/beaches/:id", [204], delBeach.status, delBeach.status === 204)
  }

  const wasteCategories = await http("GET", "/waste-categories?page=1&pageSize=5", { token: access.org })
  const wasteCategoryId = hateoasListItems(wasteCategories.json)[0]?.id

  await expect("waste POST voluntário (403)", "POST", "/waste-items", [403], () =>
    http("POST", "/waste-items", {
      token: access.vol,
      jsonBody: {
        name: "x",
        categoryId: wasteCategoryId ?? "00000000-0000-4000-8000-000000000001",
        unit: "unit"
      }
    })
  )

  const wasteName = `Smoke residuo ${randomUUID().slice(0, 8)}`
  const createWaste = await http("POST", "/waste-items", {
    token: access.org,
    jsonBody: {
      name: wasteName,
      categoryId: wasteCategoryId,
      unit: "unit"
    }
  })
  record("waste create org", "POST", "/waste-items", [201], createWaste.status, createWaste.status === 201)
  const newWasteId = createWaste.json?.id

  if (newWasteId) {
    const putWaste = await http("PUT", `/waste-items/${newWasteId}`, {
      token: access.org,
      jsonBody: { name: `${wasteName} b`, categoryId: wasteCategoryId, unit: "peso" }
    })
    record("waste put", "PUT", "/waste-items/:id", [200], putWaste.status, putWaste.status === 200)

    const getWaste = await http("GET", `/waste-items/${newWasteId}`, { token: access.org })
    record("waste getById", "GET", "/waste-items/:id", [200], getWaste.status, getWaste.status === 200)

    const delWaste = await http("DELETE", `/waste-items/${newWasteId}`, { token: access.org })
    record("waste delete", "DELETE", "/waste-items/:id", [204], delWaste.status, delWaste.status === 204)
  }

  const wasteList = await http("GET", "/waste-items?page=1&pageSize=5", { token: access.org })
  record("waste list", "GET", "/waste-items", [200], wasteList.status, wasteList.status === 200)
  const wasteRow = hateoasListItems(wasteList.json)[0]
  const wasteIdForCollection = wasteRow?.id

  const campList = await http("GET", "/campaigns?page=1&pageSize=50", { token: access.org })
  record("campaigns list", "GET", "/campaigns", [200], campList.status, campList.status === 200)

  const orgMe = await http("GET", "/users/me", { token: access.org })
  const orgUserId = orgMe.json?.id
  const campaignId = await findCampaignIdForOrganizer(access.org, orgUserId)
  const volCampaignId = (await findCampaignForVolunteer(access.vol)) ?? campaignId

  if (campaignId) {
    const campDetail = await http("GET", `/campaigns/${campaignId}`, { token: access.org })
    record("campaigns getById", "GET", "/campaigns/:id", [200], campDetail.status, campDetail.status === 200)

    const d = campDetail.json
    const hasViewerRegistrationField =
      d != null && Object.prototype.hasOwnProperty.call(d, "viewerRegistration")
    record(
      "campaigns getById viewerRegistration field",
      "GET",
      "/campaigns/:id",
      [200],
      campDetail.status,
      campDetail.status === 200 && hasViewerRegistrationField
    )

    const beachForCollection = d?.beaches?.[0]?.id
    const regList = await http("GET", `/campaigns/${campaignId}/registrations`, { token: access.admin })
    record("campaigns registrations list (org)", "GET", "/campaigns/:id/registrations", [200], regList.status, regList.status === 200)
    const regListPayload = regList.json
    const regListArr = Array.isArray(regListPayload) ? regListPayload : hateoasListItems(regListPayload)

    const regPost = await http("POST", `/campaigns/${volCampaignId ?? campaignId}/registrations`, {
      token: access.vol
    })
    record(
      "campaigns registrations create (vol)",
      "POST",
      "/campaigns/:id/registrations",
      [201, 400],
      regPost.status,
      regPost.status === 201 || regPost.status === 400
    )

    const regListAfter = await http("GET", `/campaigns/${campaignId}/registrations`, { token: access.admin })
    const regListAfterPayload = regListAfter.json
    const regArrAfter = Array.isArray(regListAfterPayload)
      ? regListAfterPayload
      : hateoasListItems(regListAfterPayload)
    const volWho = await http("GET", "/users/me", { token: access.vol })
    const volUid = volWho.json?.id
    const regId = regArrAfter.find((r) => r.user?.id === volUid)?.id

    if (regId) {
      const regPatch = await http("PATCH", `/campaigns/${campaignId}/registrations/${regId}`, {
        token: access.org,
        jsonBody: { status: 1 }
      })
      record(
        "registrations patch (org)",
        "PATCH",
        "/campaigns/:id/registrations/:registrationId",
        [200],
        regPatch.status,
        regPatch.status === 200
      )
    }

    const badReg = await http(
      "PATCH",
      `/campaigns/${campaignId}/registrations/00000000-0000-4000-8000-000000000000`,
      {
        token: access.org,
        jsonBody: { status: 1 }
      }
    )
    record(
      "registrations patch id inválido",
      "PATCH",
      "/campaigns/:id/registrations/:registrationId",
      [400, 404],
      badReg.status,
      [400, 404].includes(badReg.status)
    )

    const badWc = await http(
      "PATCH",
      `/campaigns/${campaignId}/waste-collections/00000000-0000-4000-8000-000000000000`,
      {
        token: access.org,
        jsonBody: { unitQuantity: 1 }
      }
    )
    record(
      "waste-collections patch id inválido",
      "PATCH",
      "/campaigns/:id/waste-collections/:collectionId",
      [400, 404],
      badWc.status,
      [400, 404].includes(badWc.status)
    )

    if (beachForCollection && wasteIdForCollection) {
      const wc = await http("POST", `/campaigns/${campaignId}/waste-collections`, {
        token: access.org,
        jsonBody: { beachId: beachForCollection, wasteId: wasteIdForCollection, unitQuantity: 1 }
      })
      record(
        "campaigns waste-collections create",
        "POST",
        "/campaigns/:id/waste-collections",
        [201],
        wc.status,
        wc.status === 201
      )
      const wcId = wc.json?.id
      if (wcId) {
        const wcPatch = await http("PATCH", `/campaigns/${campaignId}/waste-collections/${wcId}`, {
          token: access.org,
          jsonBody: { unitQuantity: 2 }
        })
        record(
          "waste-collections patch",
          "PATCH",
          "/campaigns/:id/waste-collections/:collectionId",
          [200],
          wcPatch.status,
          wcPatch.status === 200
        )

        const wcDel = await http("DELETE", `/campaigns/${campaignId}/waste-collections/${wcId}`, {
          token: access.org
        })
        record(
          "waste-collections delete",
          "DELETE",
          "/campaigns/:id/waste-collections/:collectionId",
          [204],
          wcDel.status,
          wcDel.status === 204
        )
      }
    }

    const commentCampaignId = volCampaignId ?? campaignId
    const comPost = await http("POST", `/campaigns/${commentCampaignId}/comments`, {
      token: access.vol,
      jsonBody: { body: `Smoke comentário ${randomUUID().slice(0, 8)}` }
    })
    record(
      "campaigns comments create (vol)",
      "POST",
      "/campaigns/:id/comments",
      [201],
      comPost.status,
      comPost.status === 201
    )

    const detailAfterComment = await http("GET", `/campaigns/${commentCampaignId}`, { token: access.vol })
    const comments2 = detailAfterComment.json?.comments ?? []
    const myComment2 = comments2.find((c) => c.user?.id === volUid)
    const commentId2 = myComment2?.id ?? comments2[0]?.id

    if (commentId2) {
      const vis = await http("PATCH", `/campaigns/${campaignId}/comments/${commentId2}`, {
        token: access.org,
        jsonBody: { isVisible: false }
      })
      record(
        "comments patch visibility (org)",
        "PATCH",
        "/campaigns/:id/comments/:commentId",
        [200],
        vis.status,
        vis.status === 200
      )

      await http("PATCH", `/campaigns/${campaignId}/comments/${commentId2}`, {
        token: access.org,
        jsonBody: { isVisible: true }
      })
    }

    const delComBad = await http(
      "DELETE",
      `/campaigns/${campaignId}/comments/00000000-0000-4000-8000-000000000000`,
      { token: access.vol }
    )
    record(
      "comments delete id inválido",
      "DELETE",
      "/campaigns/:id/comments/:commentId",
      [400, 404],
      delComBad.status,
      [400, 404].includes(delComBad.status)
    )

    if (beachIdsForCampaign.length > 0) {
      const newCamp = await http("POST", "/campaigns", {
        token: access.org,
        jsonBody: {
          title: `Smoke camp ${randomUUID().slice(0, 8)}`,
          meetingTime: "09:00",
          startDate: "2026-06-15",
          endDate: "2026-06-15",
          status: "draft",
          information: "Smoke",
          district: districtForNewCampaign,
          beachIds: beachIdsForCampaign
        }
      })
      record("campaigns create", "POST", "/campaigns", [201], newCamp.status, newCamp.status === 201)
      const newCampId = newCamp.json?.id
      if (newCampId) {
        const detailNew = await http("GET", `/campaigns/${newCampId}`, { token: access.org })
        const dn = detailNew.json
        if (dn) {
          const mt = (dn.meetingTime ?? "09:00").toString().slice(0, 5)
          const putCamp = await http("PUT", `/campaigns/${newCampId}`, {
            token: access.org,
            jsonBody: {
              title: dn.title,
              meetingTime: mt,
              startDate: dn.startDate,
              endDate: dn.endDate,
              status: dn.editStatus ?? "draft",
              information: dn.description ?? "",
              district: dn.district ?? districtForNewCampaign
            }
          })
          record("campaigns put", "PUT", "/campaigns/:id", [200], putCamp.status, putCamp.status === 200)
        }

        const delCamp = await http("DELETE", `/campaigns/${newCampId}`, { token: access.org })
        record("campaigns delete", "DELETE", "/campaigns/:id", [204], delCamp.status, delCamp.status === 204)
      }
    }
  }

  const adminList = await http("GET", "/users?page=1&pageSize=5", { token: access.admin })
  record("admin users list", "GET", "/users", [200], adminList.status, adminList.status === 200)
  const adminUsers = hateoasListItems(adminList.json)
  const volUser = adminUsers.find((u) => u.email === EMAIL_VOL) ?? adminUsers[0]
  const volUserId = volUser?.id

  const invalidAdminUuid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

  const blockBad = await http("PATCH", `/users/${invalidAdminUuid}`, {
    token: access.admin,
    jsonBody: { isBlocked: true, blockedReason: "x" }
  })
  record("admin block id inválido", "PATCH", "/users/:id", [400, 404], blockBad.status, [400, 404].includes(blockBad.status))

  if (volUserId) {
    const blockNoReason = await http("PATCH", `/users/${volUserId}`, {
      token: access.admin,
      jsonBody: { isBlocked: true, blockedReason: 123 }
    })
    record("admin block reason inválido", "PATCH", "/users/:id", [400], blockNoReason.status, blockNoReason.status === 400)
  }

  const unbBad = await http("PATCH", `/users/${invalidAdminUuid}`, {
    token: access.admin,
    jsonBody: { isBlocked: false }
  })
  record("admin unblock id inválido", "PATCH", "/users/:id", [400, 404], unbBad.status, [400, 404].includes(unbBad.status))

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed

  const report = {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    passed,
    failed,
    total: results.length,
    results
  }

  const outDir = dirname(fileURLToPath(import.meta.url))
  const outPath = join(outDir, "..", "smoke-report.json")
  writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(`\nSmoke API: ${passed}/${results.length} OK (falhas: ${failed})`)
  console.log(`Relatório: ${outPath}\n`)
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL"
    console.log(`${mark}\tHTTP ${r.status}\t${r.method}\t${r.path}\t${r.name}`)
  }

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
