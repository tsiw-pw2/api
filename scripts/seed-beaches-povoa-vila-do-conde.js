require("dotenv").config()

const { randomUUID } = require("node:crypto")
const { getPool } = require("../src/config/db")

const nuts3NameToCode = {
    "Alto Minho": "PT111",
    "Cávado": "PT112",
    Ave: "PT119",
    "Área Metropolitana do Porto": "PT11A",
    "Área Metropolitana de Lisboa": "PT170",
    "Grande Porto": "PT11A",
    "Grande Lisboa": "PT170",
    Oeste: "PT16B",
    "Região de Aveiro": "PT16D",
    "Região de Coimbra": "PT16E",
    "Região de Leiria": "PT16F",
    "Viseu Dão Lafões": "PT16G",
    "Beira Baixa": "PT16H",
    "Médio Tejo": "PT16I",
    "Beiras e Serra da Estrela": "PT16J",
    "Alentejo Litoral": "PT181",
    "Baixo Alentejo": "PT184",
    "Lezíria do Tejo": "PT185",
    "Alto Alentejo": "PT186",
    "Alentejo Central": "PT187",
    Algarve: "PT150",
    "Região Autónoma dos Açores": "PT200",
    "Região Autónoma da Madeira": "PT300",
}

function resolveNuts3Code(nuts3Name) {
    if (!nuts3Name) return ""
    const k = String(nuts3Name).trim()
    return nuts3NameToCode[k] || ""
}

async function fetchJson(url, init, timeoutMs) {
    let res
    try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), timeoutMs || 90000)
        const realInit = init ? { ...init } : {}
        if (realInit && typeof realInit === "object" && "__timeoutMs" in realInit) delete realInit.__timeoutMs
        try {
            res = await fetch(url, {
                ...realInit,
                headers: {
                    Accept: "application/json",
                    "User-Agent": "limpeza-praias-seeder/1.0 (pw2 projeto académico)",
                    ...(realInit && realInit.headers ? realInit.headers : {}),
                },
                signal: controller.signal,
            })
        } finally {
            clearTimeout(t)
        }
    } catch (e) {
        if (e && typeof e === "object") e.url = url
        throw e
    }
    if (!res.ok) {
        const e = new Error(`Falha a obter dados (${res.status})`)
        e.status = res.status
        e.url = url
        throw e
    }
    try {
        return await res.json()
    } catch {
        const txt = await res.text()
        const e = new Error("Resposta inválida do serviço externo")
        e.url = url
        e.preview = String(txt).slice(0, 160)
        throw e
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJsonWithRetry(url, init, attempts) {
    let lastErr = null
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await fetchJson(url, init, init && init.__timeoutMs ? init.__timeoutMs : undefined)
        } catch (e) {
            lastErr = e
            const status = e && typeof e === "object" && "status" in e ? Number(e.status) : null
            const backoff = status === 429 ? 2500 * (i + 1) : 700 * (i + 1)
            await sleep(backoff)
        }
    }
    throw lastErr || new Error("Falha a obter dados")
}

async function geoLocationByGps(lat, lng) {
    const url = `https://geoapi.pt/gps/${lat},${lng}/base/detalhes?json=1`
    const data = await fetchJsonWithRetry(url, undefined, 8)
    const distrito = String(data.distrito || "").trim()
    const concelho = String(data.concelho || "").trim()
    const freguesia = String(data.freguesia || "").trim()
    const codigoNuts = resolveNuts3Code(data.detalhesFreguesia && data.detalhesFreguesia.nuts3)
    if (!distrito || !concelho || !freguesia) throw new Error("Localização incompleta")
    return { distrito, concelho, freguesia, codigoNuts }
}

async function overpassBeachesInMunicipalities() {
    const q = `
[out:json][timeout:180];
(
  nwr["natural"="beach"](41.33,-8.77,41.48,-8.57);
);
out center tags;
`
    const endpoints = String(process.env.OVERPASS_URL || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    const urls = endpoints.length
        ? endpoints
        : ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"]
    let data = null
    const errors = []
    for (const url of urls) {
        try {
            const body = new URLSearchParams({ data: q })
            data = await fetchJsonWithRetry(url, { method: "POST", body, __timeoutMs: 8 * 60 * 1000 }, 2)
            break
        } catch (e) {
            const status = e && typeof e === "object" && "status" in e ? String(e.status) : ""
            const msg = e instanceof Error ? e.message : String(e)
            errors.push(`${url}${status ? ` (${status})` : ""}: ${msg}`)
        }
    }
    if (!data) {
        const details = errors.length ? `\n${errors.join("\n")}` : ""
        throw new Error(`Falha a obter praias.${details}`)
    }
    const els = Array.isArray(data.elements) ? data.elements : []
    return els
        .map((e) => {
            const name = e.tags && e.tags.name ? String(e.tags.name).trim() : ""
            const lat = typeof e.lat === "number" ? e.lat : e.center && typeof e.center.lat === "number" ? e.center.lat : null
            const lon = typeof e.lon === "number" ? e.lon : e.center && typeof e.center.lon === "number" ? e.center.lon : null
            if (!name || lat == null || lon == null) return null
            return { name, lat, lon }
        })
        .filter(Boolean)
}

async function getUserIdByEmail(email) {
    const pool = getPool()
    const [rows] = await pool.query("SELECT id FROM utilizador WHERE email = ? LIMIT 1", [email])
    const id = rows[0] && rows[0].id ? String(rows[0].id) : ""
    if (!id) throw new Error("Email não encontrado na tabela utilizador")
    return id
}

async function ensureLocationId(cache, loc) {
    const key = `${loc.distrito}|${loc.concelho}|${loc.freguesia}|${loc.codigoNuts}`
    if (cache.has(key)) return cache.get(key)

    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT id FROM localizacao_praia
         WHERE distrito = ? AND concelho = ? AND freguesia = ? AND codigo_nuts = ? AND deleted_at IS NULL
         LIMIT 1`,
        [loc.distrito, loc.concelho, loc.freguesia, loc.codigoNuts],
    )
    if (rows.length) {
        const id = String(rows[0].id)
        cache.set(key, id)
        return id
    }
    const id = randomUUID()
    await pool.query(
        "INSERT INTO localizacao_praia (id, distrito, concelho, freguesia, codigo_nuts) VALUES (?, ?, ?, ?, ?)",
        [id, loc.distrito, loc.concelho, loc.freguesia, loc.codigoNuts],
    )
    cache.set(key, id)
    return id
}

async function beachExists(name, lat, lon) {
    const pool = getPool()
    const [rows] = await pool.query(
        `SELECT id FROM praia
         WHERE nome = ? AND latitude = ? AND longitude = ? AND deleted_at IS NULL
         LIMIT 1`,
        [name, lat, lon],
    )
    return rows.length > 0
}

async function insertBeach(userId, locId, b) {
    const pool = getPool()
    const id = randomUUID()
    await pool.query(
        `INSERT INTO praia (id, localizacao_praia_id, criado_por_utilizador_id, nome, latitude, longitude, descricao)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [id, locId, userId, b.name, b.lat, b.lon],
    )
}

async function main() {
    const email = process.argv[2]
    if (!email) {
        console.error("Uso: pnpm -C api run seed:beaches:povoa-vdc <email>")
        process.exitCode = 1
        return
    }

    const userId = await getUserIdByEmail(email)
    const beaches = await overpassBeachesInMunicipalities()
    const locCache = new Map()

    let inserted = 0
    let skipped = 0
    let processed = 0
    for (const b of beaches) {
        const exists = await beachExists(b.name, b.lat, b.lon)
        if (exists) {
            skipped += 1
            continue
        }
        await sleep(1200)
        const loc = await geoLocationByGps(b.lat, b.lon)
        if (loc.concelho !== "Póvoa de Varzim" && loc.concelho !== "Vila do Conde") {
            skipped += 1
            continue
        }
        if (!loc.codigoNuts) {
            skipped += 1
            continue
        }
        const locId = await ensureLocationId(locCache, loc)
        await insertBeach(userId, locId, b)
        inserted += 1
        processed += 1
        if (processed % 10 === 0) {
            console.log(`Processadas: ${processed}`)
        }
    }

    console.log(`Inseridas: ${inserted}`)
    console.log(`Ignoradas: ${skipped}`)
}

main().catch((e) => {
    const status = e && typeof e === "object" && "status" in e ? String(e.status) : ""
    const url = e && typeof e === "object" && "url" in e ? String(e.url) : ""
    const preview = e && typeof e === "object" && "preview" in e ? String(e.preview) : ""
    const suffix = url || status ? ` (${[status, url].filter(Boolean).join(" ")})` : ""
    console.error((e instanceof Error ? e.message : String(e)) + suffix)
    if (preview) console.error(preview)
    process.exit(1)
})

