import nodemailer from "nodemailer"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EMAIL_LOGO_CID } from "./templates.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EMAIL_LOGO_PATH = path.join(__dirname, "../../assets/email/mariva-logo.png")

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "1" || process.env.EMAIL_ENABLED === "true"
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Mariva <noreply@mariva.pt>"

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST?.trim()
  if (!host) return null
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "1",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
  })
  return transporter
}

// Envia email transaccional; em desenvolvimento (EMAIL_ENABLED=0) regista no consola.
export async function sendEmail({ to, subject, text, html }) {
  if (!to || !subject) return

  if (!EMAIL_ENABLED) {
    console.log("[email:dev]", { to, subject, text })
    return
  }

  const mailer = getTransporter()
  if (!mailer) {
    console.warn("[email] SMTP não configurado; mensagem não enviada:", subject)
    return
  }

  const attachments =
    html && html.includes(`cid:${EMAIL_LOGO_CID}`)
      ? [{ filename: "mariva-logo.png", path: EMAIL_LOGO_PATH, cid: EMAIL_LOGO_CID }]
      : undefined

  const info = await mailer.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html: html ?? text,
    attachments
  })
  console.log("[email:sent]", { to, subject, messageId: info.messageId })
}

export function sendEmailSafe(payload) {
  void sendEmail(payload).catch((error) => {
    console.error("[email] Falha no envio:", payload.subject, error)
  })
}

export function clientBaseUrl() {
  return (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "")
}

export function campaignDetailUrl(campaignId) {
  return `${clientBaseUrl()}/campanhas/${campaignId}/informacoes`
}
