const BRAND = "Mariva"
const BRAND_COLOR = "#2563eb"
const BRAND_ICON_BLUE = "#56BEEE"
const BRAND_ICON_GREEN = "#42DA54"
export const EMAIL_LOGO_CID = "mariva-logo@mariva"

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function paragraphHtml(text) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#404040;">${escapeHtml(text)}</p>`
}

function detailItemHtml(label, value) {
  return `
    <div style="margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#737373;">${escapeHtml(label)}</p>
      <p style="margin:0;font-size:15px;line-height:22px;color:#171717;font-weight:500;">${escapeHtml(value)}</p>
    </div>`
}

function logoHeaderHtml(headerLinkUrl) {
  const logo = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:10px;vertical-align:middle;line-height:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:28px;height:28px;">
            <tr>
              <td style="width:14px;height:28px;background:${BRAND_ICON_BLUE};border-radius:14px 0 0 14px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="width:14px;height:28px;background:${BRAND_ICON_GREEN};border-radius:0 14px 14px 0;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
        <td style="vertical-align:middle;font-size:20px;font-weight:700;line-height:28px;letter-spacing:0.06em;color:#171717;">MARIVA</td>
      </tr>
    </table>`

  if (!headerLinkUrl) return logo
  return `<a href="${escapeHtml(headerLinkUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${logo}</a>`
}

// Layout HTML reutilizável para emails transaccionais (compatível com clientes de email).
export function buildTransactionalEmail({
  title,
  intro,
  details = [],
  ctaLabel,
  ctaUrl,
  headerLinkUrl,
  outro
}) {
  const logoLink = headerLinkUrl ?? ctaUrl ?? null

  const detailsBlock =
    details.length > 0
      ? `<div style="margin:0 0 24px;">${details.map((row) => detailItemHtml(row.label, row.value)).join("")}</div>`
      : ""

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr>
            <td style="border-radius:8px;background:${BRAND_COLOR};">
              <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer"
                style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 16px;font-size:12px;line-height:18px;color:#737373;word-break:break-all;">
          Ou copie este link: <a href="${escapeHtml(ctaUrl)}" style="color:${BRAND_COLOR};text-decoration:underline;">${escapeHtml(ctaUrl)}</a>
        </p>`
      : ""

  const outroBlock = outro ? paragraphHtml(outro) : ""

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 12px;background:#ffffff;">
              ${logoHeaderHtml(logoLink)}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:30px;color:#171717;">${escapeHtml(title)}</h1>
              ${paragraphHtml(intro)}
              ${detailsBlock}
              ${ctaBlock}
              ${outroBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e5e5e5;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#737373;">
                Este email foi enviado automaticamente pela plataforma ${BRAND}.
                Não responda a esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function registrationConfirmedEmail({ campaignTitle, date, location, link }) {
  const title = "Inscrição confirmada"
  const intro = `A sua inscrição na campanha «${campaignTitle}» está confirmada. Obrigado por se juntar a esta ação de limpeza costeira.`
  const text = [
    intro,
    "",
    `Campanha: ${campaignTitle}`,
    `Data: ${date}`,
    `Local: ${location}`,
    "",
    `Ver detalhes: ${link}`
  ].join("\n")
  const html = buildTransactionalEmail({
    title,
    intro,
    details: [
      { label: "Campanha", value: campaignTitle },
      { label: "Data", value: date },
      { label: "Local", value: location }
    ],
    ctaLabel: "Ver campanha",
    ctaUrl: link,
    headerLinkUrl: link
  })
  return { text, html }
}

export function organizerNewRegistrationEmail({ volunteerName, campaignTitle, link }) {
  const title = "Novo voluntário inscrito"
  const intro = `${volunteerName} inscreveu-se na campanha «${campaignTitle}».`
  const text = [intro, "", `Ver campanha: ${link}`].join("\n")
  const html = buildTransactionalEmail({
    title,
    intro,
    details: [
      { label: "Voluntário", value: volunteerName },
      { label: "Campanha", value: campaignTitle }
    ],
    ctaLabel: "Ver campanha",
    ctaUrl: link,
    headerLinkUrl: link
  })
  return { text, html }
}

export function registrationCancelledEmail({ campaignTitle, campaignsUrl }) {
  const title = "Inscrição cancelada"
  const intro = `A sua inscrição na campanha «${campaignTitle}» foi cancelada.`
  const outro = "Se foi um engano, pode voltar a inscrever-se enquanto as inscrições estiverem abertas."
  const text = [intro, "", outro, "", `Ver campanhas: ${campaignsUrl}`].join("\n")
  const html = buildTransactionalEmail({
    title,
    intro,
    outro,
    ctaLabel: "Ver campanhas",
    ctaUrl: campaignsUrl,
    headerLinkUrl: campaignsUrl
  })
  return { text, html }
}

export function welcomeEmail({ userName, profileUrl, homeUrl }) {
  const title = "Bem-vindo à Mariva"
  const intro = `Olá ${userName}, a sua conta foi criada com sucesso. Complete o seu perfil para se inscrever em campanhas de limpeza costeira.`
  const text = [intro, "", `Perfil: ${profileUrl}`].join("\n")
  const html = buildTransactionalEmail({
    title,
    intro,
    ctaLabel: "Completar perfil",
    ctaUrl: profileUrl,
    headerLinkUrl: homeUrl
  })
  return { text, html }
}

export function passwordChangedEmail({ userName, securityUrl }) {
  const title = "Palavra-passe alterada"
  const intro = `Olá ${userName}, a palavra-passe da sua conta Mariva foi alterada com sucesso.`
  const outro = "Se não foi você, contacte-nos de imediato."
  const text = [intro, "", outro].join("\n")
  const html = buildTransactionalEmail({
    title,
    intro,
    outro,
    ctaLabel: "Definições de segurança",
    ctaUrl: securityUrl,
    headerLinkUrl: securityUrl
  })
  return { text, html }
}
