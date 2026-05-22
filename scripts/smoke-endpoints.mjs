/**
 * Smoke test: todas as rotas em /api/v1 (matriz fixa + passos dinâmicos com IDs da BD).
 *
 * Pré-requisitos: API a correr, MySQL com seed (pnpm run db:seed), .env com JWT_SECRET,
 * REFRESH_TOKEN_SECRET, SEED_USER_PASSWORD (ou palavra-passe por omissão do seed).
 *
 * Execução: pnpm run smoke:api (a partir de api/)
 *
 * Variáveis opcionais: API_BASE_URL (default http://127.0.0.1:3000), SMOKE_ORG_EMAIL,
 * SMOKE_VOL_EMAIL, SMOKE_ADMIN_EMAIL
 */
import "dotenv/config"
import { randomUUID } from "node:crypto"
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const API_BASE = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")
const PREFIX = `${API_BASE}/api/v1`
const PASSWORD =
  typeof process.env.SEED_USER_PASSWORD === "string" && process.env.SEED_USER_PASSWORD.trim().length > 0
    ? process.env.SEED_USER_PASSWORD.trim()
    : "SeedDemo2026!"

const EMAIL_ORG = process.env.SMOKE_ORG_EMAIL?.trim() || "organizador1@demo.local"
const EMAIL_VOL = process.env.SMOKE_VOL_EMAIL?.trim() || "voluntario01@demo.local"
const EMAIL_ADMIN = process.env.SMOKE_ADMIN_EMAIL?.trim() || "admin@demo.local"

/** @type {{ org: string, vol: string, admin: string }} */
const access = { org: "", vol: "", admin: "" }
/** @type {{ org: string, vol: string, admin: string }} */
const cookieJar = { org: "", vol: "", admin: "" }

const results = []

function mergeCookieHeader(prev, res) {
  const h = res.headers
  let lines = []
  if (typeof h.getSetCookie === "function") {
    lines = h.getSetCookie()
  } else {
    const single = h.get("set-cookie")
    if (single) lines = [single]
  }
  const pairs = lines.map((line) => line.split(";")[0].trim()).filter(Boolean)
  if (pairs.length === 0) return prev
  const map = new Map()
  for (const part of (prev || "").split(";")) {
    const p = part.trim()
    if (!p.includes("=")) continue
    const [k, ...rest] = p.split("=")
    map.set(k.trim(), rest.join("=").trim())
  }
  for (const p of pairs) {
    const [k, ...rest] = p.split("=")
    map.set(k.trim(), rest.join("=").trim())
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}

async function http(method, path, opts = {}) {
  const { token, cookie, jsonBody, rawBody, headers: extraHeaders } = opts
  const headers = new Headers({ Accept: "application/json", ...(extraHeaders || {}) })
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (cookie) headers.set("Cookie", cookie)
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
  const res = await http("POST", "/auth/login", {
    jsonBody: { email, password: PASSWORD }
  })
  const token = res.json?.data?.accessToken
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`Login falhou para ${email} (${role}): HTTP ${res.status}`)
  }
  const merged = mergeCookieHeader(cookieJar[role], res)
  cookieJar[role] = merged
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

async function findCampaignIdForOrganizer(orgToken, orgUserId) {
  const cl = await http("GET", "/campaigns?page=1&pageSize=50", { token: orgToken })
  if (cl.status !== 200) return null
  const items = cl.json?.data?.items ?? []
  let fallback = null
  for (const row of items) {
    const det = await http("GET", `/campaigns/${row.id}`, { token: orgToken })
    if (det.status !== 200) continue
    if (det.json?.data?.organizer?.id !== orgUserId) continue
    const beaches = det.json?.data?.beaches ?? []
    if (beaches.length > 0) {
      return row.id
    }
    if (!fallback) {
      fallback = row.id
    }
  }
  return fallback ?? items[0]?.id ?? null
}

async function main() {
  const invalidLogin = await http("POST", "/auth/login", { jsonBody: {} })
  record("auth login corpo inválido", "POST", "/auth/login", [400], invalidLogin.status, invalidLogin.status === 400)

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

  await expect("users/me avatar sem ficheiro", "POST", "/users/me/avatar", [400], () =>
    http("POST", "/users/me/avatar", { token: access.org, jsonBody: {} })
  )

  await expect("dashboard overview org", "GET", "/dashboard/overview", [200], () =>
    http("GET", "/dashboard/overview", { token: access.org })
  )

  const beachesList = await http("GET", "/beaches?page=1&pageSize=5", { token: access.org })
  record("beaches list", "GET", "/beaches?page=1&pageSize=5", [200], beachesList.status, beachesList.status === 200)

  const beachItems = beachesList.json?.data?.items ?? []
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
      district: "braga"
    }
  })
  record("beaches create", "POST", "/beaches", [201], createBeach.status, createBeach.status === 201)
  const newBeachId = createBeach.json?.data?.id

  if (newBeachId) {
    const patchBeach = await http("PATCH", `/beaches/${newBeachId}`, {
      token: access.org,
      jsonBody: { name: smokeBeachName, municipality: "Esposende", district: "braga" }
    })
    record("beaches patch", "PATCH", "/beaches/:id", [200], patchBeach.status, patchBeach.status === 200)

    const delBeach = await http("DELETE", `/beaches/${newBeachId}`, { token: access.org })
    record("beaches delete", "DELETE", "/beaches/:id", [200], delBeach.status, delBeach.status === 200)
  }

  await expect("waste POST voluntário (403)", "POST", "/waste", [403], () =>
    http("POST", "/waste", {
      token: access.vol,
      jsonBody: { name: "x", category: "plastic", unit: "unit" }
    })
  )

  const wasteName = `Smoke residuo ${randomUUID().slice(0, 8)}`
  const createWaste = await http("POST", "/waste", {
    token: access.org,
    jsonBody: { name: wasteName, category: "plastic", unit: "unit" }
  })
  record("waste create org", "POST", "/waste", [201], createWaste.status, createWaste.status === 201)
  const newWasteId = createWaste.json?.data?.id

  if (newWasteId) {
    const patchWaste = await http("PATCH", `/waste/${newWasteId}`, {
      token: access.org,
      jsonBody: { name: `${wasteName} b`, category: "plastic", unit: "kg" }
    })
    record("waste patch", "PATCH", "/waste/:id", [200], patchWaste.status, patchWaste.status === 200)

    const getWaste = await http("GET", `/waste/${newWasteId}`, { token: access.org })
    record("waste getById", "GET", "/waste/:id", [200], getWaste.status, getWaste.status === 200)

    const delWaste = await http("DELETE", `/waste/${newWasteId}`, { token: access.org })
    record("waste delete", "DELETE", "/waste/:id", [200], delWaste.status, delWaste.status === 200)
  }

  const wasteList = await http("GET", "/waste?page=1&pageSize=5", { token: access.org })
  record("waste list", "GET", "/waste", [200], wasteList.status, wasteList.status === 200)
  const wasteRow = (wasteList.json?.data?.items ?? [])[0]
  const wasteIdForCollection = wasteRow?.id

  const campList = await http("GET", "/campaigns?page=1&pageSize=50", { token: access.org })
  record("campaigns list", "GET", "/campaigns", [200], campList.status, campList.status === 200)

  const orgMe = await http("GET", "/users/me", { token: access.org })
  const orgUserId = orgMe.json?.data?.id
  const campaignId = await findCampaignIdForOrganizer(access.org, orgUserId)

  if (campaignId) {
    const campDetail = await http("GET", `/campaigns/${campaignId}`, { token: access.org })
    record("campaigns getById", "GET", "/campaigns/:id", [200], campDetail.status, campDetail.status === 200)

    const d = campDetail.json?.data
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
    const regListPayload = regList.json?.data
    const regListArr = Array.isArray(regListPayload)
      ? regListPayload
      : Array.isArray(regListPayload?.items)
        ? regListPayload.items
        : []

    const regPost = await http("POST", `/campaigns/${campaignId}/registrations`, { token: access.vol })
    record(
      "campaigns registrations create (vol)",
      "POST",
      "/campaigns/:id/registrations",
      [201, 400],
      regPost.status,
      regPost.status === 201 || regPost.status === 400
    )

    const regListAfter = await http("GET", `/campaigns/${campaignId}/registrations`, { token: access.admin })
    const regListAfterPayload = regListAfter.json?.data
    const regArrAfter = Array.isArray(regListAfterPayload)
      ? regListAfterPayload
      : Array.isArray(regListAfterPayload?.items)
        ? regListAfterPayload.items
        : []
    const volWho = await http("GET", "/users/me", { token: access.vol })
    const volUid = volWho.json?.data?.id
    const regId = regArrAfter.find((r) => r.user?.id === volUid)?.id

    if (regId) {
      const regPatch = await http("PATCH", `/registrations/${regId}`, {
        token: access.org,
        jsonBody: { status: 1 }
      })
      record("registrations patch (org)", "PATCH", "/registrations/:id", [200], regPatch.status, regPatch.status === 200)
    }

    const badReg = await http("PATCH", "/registrations/00000000-0000-4000-8000-000000000000", {
      token: access.org,
      jsonBody: { status: 1 }
    })
    record("registrations patch id inválido", "PATCH", "/registrations/:id", [400, 404], badReg.status, [400, 404].includes(badReg.status))

    const badWc = await http("PATCH", "/waste-collections/00000000-0000-4000-8000-000000000000", {
      token: access.org,
      jsonBody: { unitQuantity: 1 }
    })
    record(
      "waste-collections patch id inválido",
      "PATCH",
      "/waste-collections/:id",
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
      const wcId = wc.json?.data?.id
      if (wcId) {
        const wcPatch = await http("PATCH", `/waste-collections/${wcId}`, {
          token: access.org,
          jsonBody: { unitQuantity: 2 }
        })
        record("waste-collections patch", "PATCH", "/waste-collections/:id", [200], wcPatch.status, wcPatch.status === 200)

        const wcDel = await http("DELETE", `/waste-collections/${wcId}`, { token: access.org })
        record("waste-collections delete", "DELETE", "/waste-collections/:id", [200], wcDel.status, wcDel.status === 200)
      }
    }

    const comPost = await http("POST", `/campaigns/${campaignId}/comments`, {
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

    const detailAfterComment = await http("GET", `/campaigns/${campaignId}`, { token: access.vol })
    const comments2 = detailAfterComment.json?.data?.comments ?? []
    const myComment2 = comments2.find((c) => c.user?.id === volUid)
    const commentId2 = myComment2?.id ?? comments2[0]?.id

    if (commentId2) {
      const vis = await http("PATCH", `/comments/${commentId2}`, {
        token: access.org,
        jsonBody: { isVisible: false }
      })
      record("comments patch visibility (org)", "PATCH", "/comments/:id", [200], vis.status, vis.status === 200)

      await http("PATCH", `/comments/${commentId2}`, {
        token: access.org,
        jsonBody: { isVisible: true }
      })
    }

    const delComBad = await http("DELETE", "/comments/00000000-0000-4000-8000-000000000000", { token: access.vol })
    record("comments delete id inválido", "DELETE", "/comments/:id", [400, 404], delComBad.status, [400, 404].includes(delComBad.status))

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
      const newCampId = newCamp.json?.data?.id
      if (newCampId) {
        const detailNew = await http("GET", `/campaigns/${newCampId}`, { token: access.org })
        const dn = detailNew.json?.data
        if (dn) {
          const mt = (dn.meetingTime ?? "09:00").toString().slice(0, 5)
          const patchCamp = await http("PATCH", `/campaigns/${newCampId}`, {
            token: access.org,
            jsonBody: {
              title: dn.title,
              meetingTime: mt,
              startDate: dn.startDate,
              endDate: dn.endDate,
              status: dn.editStatus ?? "draft",
              information: dn.description ?? ""
            }
          })
          record("campaigns patch", "PATCH", "/campaigns/:id", [200], patchCamp.status, patchCamp.status === 200)
        }

        const delCamp = await http("DELETE", `/campaigns/${newCampId}`, { token: access.org })
        record("campaigns delete", "DELETE", "/campaigns/:id", [200], delCamp.status, delCamp.status === 200)
      }
    }
  }

  const adminList = await http("GET", "/admin/users?page=1&pageSize=5", { token: access.admin })
  record("admin users list", "GET", "/admin/users", [200], adminList.status, adminList.status === 200)
  const volUser = (adminList.json?.data?.items ?? []).find((u) => u.email === EMAIL_VOL) ?? adminList.json?.data?.items?.[0]
  const volUserId = volUser?.id

  const invalidAdminUuid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

  const blockBad = await http("PATCH", `/admin/users/${invalidAdminUuid}/block`, {
    token: access.admin,
    jsonBody: { reason: "x" }
  })
  record("admin block id inválido", "PATCH", "/admin/users/:id/block", [400], blockBad.status, blockBad.status === 400)

  if (volUserId) {
    const blockNoReason = await http("PATCH", `/admin/users/${volUserId}/block`, {
      token: access.admin,
      jsonBody: { reason: 123 }
    })
    record(
      "admin block reason inválido",
      "PATCH",
      "/admin/users/:id/block",
      [400],
      blockNoReason.status,
      blockNoReason.status === 400
    )
  }

  const unbBad = await http("PATCH", `/admin/users/${invalidAdminUuid}/unblock`, { token: access.admin })
  record("admin unblock id inválido", "PATCH", "/admin/users/:id/unblock", [400], unbBad.status, unbBad.status === 400)

  const refreshRes = await http("POST", "/auth/refresh", { cookie: cookieJar.org })
  record("auth refresh", "POST", "/auth/refresh", [200], refreshRes.status, refreshRes.status === 200)
  if (refreshRes.status === 200) {
    cookieJar.org = mergeCookieHeader(cookieJar.org, refreshRes)
    const t = refreshRes.json?.data?.accessToken
    if (typeof t === "string" && t.length > 0) access.org = t
  }

  const logoutRes = await http("POST", "/auth/logout", { cookie: cookieJar.org })
  record("auth logout", "POST", "/auth/logout", [200], logoutRes.status, logoutRes.status === 200)

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
