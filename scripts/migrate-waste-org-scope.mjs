#!/usr/bin/env node
/**
 * Migra catálogo de resíduos para scope por organização (organizacao_id).
 * Idempotente — seguro correr várias vezes antes de `pnpm dev`.
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { IDS } from "./seed/ids.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

async function columnExists(sequelize, table, column) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    { replacements: [table, column] }
  )
  return rows.length > 0
}

async function indexExists(sequelize, table, indexName) {
  const [rows] = await sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, {
    replacements: [indexName]
  })
  return rows.length > 0
}

async function resolveDefaultOrgId(sequelize) {
  const [rows] = await sequelize.query(
    `SELECT id FROM organizacao WHERE concelho = ? LIMIT 1`,
    { replacements: ["Vila do Conde"] }
  )
  if (rows[0]?.id) {
    return rows[0].id
  }
  const [any] = await sequelize.query(`SELECT id FROM organizacao ORDER BY created_at ASC LIMIT 1`)
  if (any[0]?.id) {
    return any[0].id
  }
  return IDS.organizations.vilaConde
}

async function main() {
  const { sequelize } = await import("../models/sequelize.js")
  const defaultOrgId = await resolveDefaultOrgId(sequelize)
  console.log(`Organização por defeito para backfill: ${defaultOrgId}`)

  if (!(await columnExists(sequelize, "tipo_residuo", "organizacao_id"))) {
    console.log("A adicionar coluna tipo_residuo.organizacao_id…")
    await sequelize.query(
      `ALTER TABLE tipo_residuo ADD COLUMN organizacao_id CHAR(36) NULL AFTER id`
    )
  }

  const [tipoNull] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM tipo_residuo WHERE organizacao_id IS NULL`
  )
  if (Number(tipoNull[0]?.c ?? 0) > 0) {
    console.log(`A preencher ${tipoNull[0].c} categorias sem organização…`)
    await sequelize.query(`UPDATE tipo_residuo SET organizacao_id = ? WHERE organizacao_id IS NULL`, {
      replacements: [defaultOrgId]
    })
  }

  await sequelize.query(
    `ALTER TABLE tipo_residuo MODIFY COLUMN organizacao_id CHAR(36) NOT NULL`
  )

  if (!(await indexExists(sequelize, "tipo_residuo", "uk_tipo_residuo_org_nome"))) {
    console.log("A criar índice uk_tipo_residuo_org_nome…")
    await sequelize.query(
      `ALTER TABLE tipo_residuo ADD UNIQUE INDEX uk_tipo_residuo_org_nome (organizacao_id, nome)`
    )
  }

  if (!(await columnExists(sequelize, "residuo", "organizacao_id"))) {
    console.log("A adicionar coluna residuo.organizacao_id…")
    await sequelize.query(`ALTER TABLE residuo ADD COLUMN organizacao_id CHAR(36) NULL AFTER id`)
  }

  await sequelize.query(
    `UPDATE residuo r
     INNER JOIN tipo_residuo t ON t.id = r.tipo_residuo_id
     SET r.organizacao_id = t.organizacao_id
     WHERE r.organizacao_id IS NULL`
  )

  const [resNull] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM residuo WHERE organizacao_id IS NULL`
  )
  if (Number(resNull[0]?.c ?? 0) > 0) {
    console.log(`A preencher ${resNull[0].c} resíduos órfãos…`)
    await sequelize.query(`UPDATE residuo SET organizacao_id = ? WHERE organizacao_id IS NULL`, {
      replacements: [defaultOrgId]
    })
  }

  await sequelize.query(`ALTER TABLE residuo MODIFY COLUMN organizacao_id CHAR(36) NOT NULL`)

  if (await indexExists(sequelize, "residuo", "uk_residuo_nome")) {
    console.log("A remover índice global uk_residuo_nome…")
    await sequelize.query(`ALTER TABLE residuo DROP INDEX uk_residuo_nome`)
  }

  if (await indexExists(sequelize, "residuo", "nome")) {
    console.log("A remover índice legacy nome…")
    await sequelize.query(`ALTER TABLE residuo DROP INDEX nome`)
  }

  if (!(await indexExists(sequelize, "residuo", "uk_residuo_org_nome"))) {
    console.log("A criar índice uk_residuo_org_nome…")
    await sequelize.query(
      `ALTER TABLE residuo ADD UNIQUE INDEX uk_residuo_org_nome (organizacao_id, nome)`
    )
  }

  console.log("\n✓ Migração concluída. Corre `pnpm dev` ou `pnpm run db:seed` para dados demo completos.")
  await sequelize.close()
}

main().catch((err) => {
  console.error("Erro na migração:", err)
  process.exit(1)
})
