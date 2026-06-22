import { User } from "../../models/db.config.js"
import { campaignDetailUrl, clientBaseUrl, sendEmailSafe } from "./index.js"
import {
  organizerNewRegistrationEmail,
  passwordChangedEmail,
  registrationCancelledEmail,
  registrationConfirmedEmail,
  welcomeEmail
} from "./templates.js"

function formatDatePt(value) {
  if (!value) return "—"
  const s = String(value).slice(0, 10)
  const d = new Date(`${s}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })
}

async function shouldSendToUser(userId) {
  const user = await User.findByPk(userId, {
    attributes: ["email", "receiveEmailNotifications"]
  })
  if (!user?.email) return null
  if (user.receiveEmailNotifications === false) return null
  return user.email
}

// Confirmação de inscrição ao voluntário.
export async function notifyRegistrationConfirmed({ campaign, volunteerUserId }) {
  const to = await shouldSendToUser(volunteerUserId)
  if (!to) return

  const link = campaignDetailUrl(campaign.id)
  const location = campaign.meetingLocation ?? "Local a definir"
  const date = formatDatePt(campaign.startDate)
  const { text, html } = registrationConfirmedEmail({
    campaignTitle: campaign.title,
    date,
    location,
    link
  })

  sendEmailSafe({ to, subject: `Inscrição confirmada — ${campaign.title}`, text, html })
}

// Aviso ao organizador de novo inscrito.
export async function notifyOrganizerNewRegistration({ campaign, volunteerName }) {
  const to = await shouldSendToUser(campaign.organizerId)
  if (!to) return

  const link = campaignDetailUrl(campaign.id)
  const { text, html } = organizerNewRegistrationEmail({
    volunteerName,
    campaignTitle: campaign.title,
    link
  })

  sendEmailSafe({ to, subject: `Novo voluntário inscrito — ${campaign.title}`, text, html })
}

// Confirmação de cancelamento ao voluntário.
export async function notifyRegistrationCancelled({ campaign, volunteerUserId }) {
  const to = await shouldSendToUser(volunteerUserId)
  if (!to) return

  const { text, html } = registrationCancelledEmail({
    campaignTitle: campaign.title,
    campaignsUrl: `${clientBaseUrl()}/campanhas`
  })

  sendEmailSafe({ to, subject: `Inscrição cancelada — ${campaign.title}`, text, html })
}

// Boas-vindas após registo de conta.
export async function notifyWelcome({ userId, userName }) {
  const to = await shouldSendToUser(userId)
  if (!to) return

  const profileUrl = `${clientBaseUrl()}/definicoes/perfil`
  const { text, html } = welcomeEmail({ userName, profileUrl, homeUrl: clientBaseUrl() })

  sendEmailSafe({ to, subject: "Bem-vindo à Mariva", text, html })
}

// Alerta de segurança após alteração de palavra-passe.
export async function notifyPasswordChanged({ userId, userName }) {
  const to = await shouldSendToUser(userId)
  if (!to) return

  const securityUrl = `${clientBaseUrl()}/definicoes/seguranca`
  const { text, html } = passwordChangedEmail({ userName, securityUrl })

  sendEmailSafe({ to, subject: "Palavra-passe alterada — Mariva", text, html })
}

// Dispara emails de inscrição confirmada (voluntário + organizador).
export function dispatchRegistrationEmails({ campaign, volunteerUserId, volunteerName }) {
  void notifyRegistrationConfirmed({ campaign, volunteerUserId })
  void notifyOrganizerNewRegistration({ campaign, volunteerName })
}

// Dispara email de cancelamento de inscrição.
export function dispatchRegistrationCancelledEmail({ campaign, volunteerUserId }) {
  void notifyRegistrationCancelled({ campaign, volunteerUserId })
}
