import bcrypt from "bcryptjs"
import multer from "multer"
import { Op } from "sequelize"
import { User, Registration, Campaign, Beach, WasteCollection } from "../models/db.config.js"
import { attachAuthSession, buildSessionTokenResource, bumpUserTokenVersion, clearAuthSession, revokeUserRefreshTokens, sessionResourceLinks, signAccessTokenForUser } from "../utils/auth.js"
import { isOrgAdminFor, listUserOrganizations, ORG_HEADER_NAME } from "../utils/organization.utils.js"
import { createError, passControllerError, notFoundError, validationError, isUuidParam } from "../utils/error.utils.js"
import { parsePhoneField, parseProfileBirthDateField, toIsoDateOnly } from "../utils/domain.utils.js"
import { CAMPAIGNS_BASE, ORGANIZATIONS_BASE, SESSIONS_BASE, USERS_BASE, listResponse, parsePaginationQuery, userSubResourcePath, withCampaignResourceLinks, withEmbeddedCampaignLinks, withMeResourceLinks, withRegistrationResourceLinks, withResourceLinks } from "../utils/response.utils.js"
import { deleteCloudinaryAvatar, isCloudinaryAvatarUrlForUser, isStoredCloudinaryAvatarUrl, uploadAvatarBuffer } from "../services/cloudinaryAvatar.service.js"

// --- Avatar (Cloudinary + validação de ficheiro) ---

async function removeStoredAvatarAsset(userId, avatarUrl) {
  if (!avatarUrl || !isStoredCloudinaryAvatarUrl(avatarUrl)) return
  await deleteCloudinaryAvatar(userId)
}

// Validar a assinatura do ficheiro (assinatura do ficheiro); não confiar só no mimetype do cliente.
function isAllowedAvatarImageMagic(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 3) {
    return false
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return true
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true
  }
  return false
}
const MAX_BLOCK_REASON_LENGTH = 2000
const BCRYPT_ROUNDS = 10
// --- Papéis e formato da API de perfil ---

function resolveUserRoleKey(user) {
  if (user.isOrganizer) return "organizer"
  return "volunteer"
}

/**
 * Registar conta de voluntário.
 * Método: POST
 * Rota: /users
 * Autenticação: não
 *
 * Regras de negócio:
 * - Criar utilizador com is_admin e is_organizer a false; exigir birthDate válida.
 * - Email único; palavra-passe com mínimo 8 caracteres.
 * - Iniciar sessão automaticamente após registo (JWT + cookie de token de actualização).
 *
 * Notas técnicas:
 * - Limite de pedidos de registo aplicado na rota (users.routes.js).
 * - Gravar palavra_passe com bcrypt; nunca devolver passwordHash.
 */
export const createUser = async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!name || !email || password.length < 8) {
      return next(validationError({ credentials: ["Invalid name, email or password"] }))
    }

    // birthDate obrigatória no registo público (idade mínima validada em inscrições).
    let birthDate
    try {
      birthDate = parseProfileBirthDateField(body.birthDate)
    } catch (error) {
      return next(error)
    }

    // Verificar email duplicado; mensagem genérica para não revelar contas existentes.
    const existing = await User.findOne({ where: { email } })
    if (existing) {
      return next(validationError({ credentials: ["Unable to create account"] }))
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const now = new Date()
    const user = await User.create({
      name,
      email,
      birthDate,
      passwordHash: hash,
      isAdmin: false,
      isOrganizer: false,
      isBlocked: false,
      createdAt: now,
      updatedAt: now
    })

    // Iniciar sessão automaticamente após registo (mesmo fluxo que POST /sessions).
    await attachAuthSession(res, user)
    const token = await signAccessTokenForUser(user, null)
    const resource = withMeResourceLinks(toProfileDto(user))
    resource.links.session = { href: SESSIONS_BASE, method: "POST" }
    resource.session = {
      id: "current",
      token,
      links: sessionResourceLinks()
    }
    res.status(201).location(`${USERS_BASE}/${user.id}`).json(resource)
  } catch (error) {
    passControllerError(error, next, "Error creating user")
  }
}

// Configuração multer em memória (limite 2 MB; tipos jpeg/png/webp).
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    cb(ok ? null : validationError(["Invalid avatar file type"]), ok)
  }
})

export async function prepareAvatarUpload(req, res, next) {
  try {
    const user = await User.findByPk(req.user.sub, { attributes: ["id", "avatarUrl"] })
    // Remover avatar Cloudinary anterior antes do novo upload (evitar ficheiros órfãos).
    if (user?.avatarUrl && isStoredCloudinaryAvatarUrl(user.avatarUrl)) {
      await removeStoredAvatarAsset(user.id, user.avatarUrl)
    }
    next()
  } catch (error) {
    passControllerError(error, next, "Error preparing avatar upload")
  }
}

// Mapear utilizador para formato da API de perfil (/users/me); nunca expor passwordHash.
function toProfileDto(user, options = {}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    birthDate: toIsoDateOnly(user.birthDate),
    role: resolveUserRoleKey(user),
    isAdmin: false,
    isRoot: Boolean(user.isRoot),
    isOrganizer: user.isOrganizer,
    isOrgAdmin: options.isOrgAdmin === true,
    isBlocked: user.isBlocked,
    blockedReason: user.blockedReason ?? null,
    blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null
  }
}

// Mapear utilizador para linha da listagem admin (campos extra face ao público).
function toAdminUserRow(user) {
  return {
    ...toPublicUser(user),
    phone: user.phone ?? null,
    birthDate: toIsoDateOnly(user.birthDate),
    avatarUrl: user.avatarUrl ?? null,
    role: resolveUserRoleKey(user),
    createdAt: user.createdAt ? user.createdAt.toISOString() : null
  }
}

// Mapear utilizador para vista pública mínima (sem dados de perfil sensíveis).
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isRoot: Boolean(user.isRoot),
    isOrganizer: user.isOrganizer,
    isBlocked: user.isBlocked,
    blockedReason: user.blockedReason,
    blockedAt: user.blockedAt ? user.blockedAt.toISOString() : null
  }
}

// --- Actualização de perfil e palavra-passe ---

async function getProfile(userId, organizationId = null) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["passwordHash"] }
  })
  if (!user) {
    throw notFoundError("User", userId)
  }
  if (user.deletedAt) {
    throw createError(401, "Unauthorized")
  }
  const organizations = await listUserOrganizations(userId)
  const isOrgAdmin =
    organizationId != null ? await isOrgAdminFor(userId, organizationId) : false
  return { ...toProfileDto(user, { isOrgAdmin }), organizations }
}

function resolveActiveOrganizationId(req) {
  const headerOrg =
    typeof req.headers[ORG_HEADER_NAME] === "string" ? req.headers[ORG_HEADER_NAME].trim() : ""
  const tokenOrg = typeof req.user?.orgId === "string" ? req.user.orgId : null
  return req.organizationId ?? (headerOrg || tokenOrg || null)
}

function profileExtraLinks(req, profile) {
  const orgId = resolveActiveOrganizationId(req)
  if (profile.isOrgAdmin && orgId) {
    return {
      orgMembers: { href: `${ORGANIZATIONS_BASE}/${orgId}/members`, method: "GET" }
    }
  }
  if (profile.isRoot) {
    return {
      organizations: { href: ORGANIZATIONS_BASE, method: "GET" }
    }
  }
  return {}
}

function isNonEmptyEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidAvatarUrlInput(raw, userId) {
  return isCloudinaryAvatarUrlForUser(raw, userId)
}

// Validar assinatura do ficheiro e enviar buffer para Cloudinary; gravar URL segura em avatar_url.
async function validateAndApplyUploadedAvatarFile(userId, user, file) {
  const buffer = file.buffer
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw validationError(["Invalid avatar file"])
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 16))
  if (!isAllowedAvatarImageMagic(head)) {
    throw validationError(["Invalid avatar file"])
  }
  try {
    const result = await uploadAvatarBuffer(userId, buffer)
    user.avatarUrl = result.secure_url
  } catch {
    throw validationError(["Invalid avatar file"])
  }
}

async function updateProfile(userId, body, uploadedFile = null) {
  const user = await User.findByPk(userId)
  if (!user) {
    throw notFoundError("User", userId)
  }
  if (user.isBlocked) {
    throw createError(403, "Forbidden")
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (name.length === 0 || name.length > 150) {
      throw validationError(["Invalid name"])
    }
    user.name = name
  }

  if (body.email !== undefined) {
    const raw = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!isNonEmptyEmail(raw)) {
      throw validationError(["Invalid email"])
    }
    // Garantir unicidade de email excluindo o próprio utilizador.
    const existing = await User.findOne({
      where: { email: raw, id: { [Op.ne]: userId } }
    })
    if (existing) {
      throw validationError(["Email already in use"])
    }
    user.email = raw
  }

  if (body.phone !== undefined) {
    user.phone = parsePhoneField(body.phone)
  }

  if (uploadedFile != null) {
    // Carregamento multiparte: validar assinatura do ficheiro e enviar buffer para Cloudinary.
    await validateAndApplyUploadedAvatarFile(userId, user, uploadedFile)
  } else if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") {
      await removeStoredAvatarAsset(userId, user.avatarUrl)
      user.avatarUrl = null
    } else if (typeof body.avatarUrl === "string") {
      const raw = body.avatarUrl.trim()
      if (raw.length === 0) {
        await removeStoredAvatarAsset(userId, user.avatarUrl)
        user.avatarUrl = null
      } else if (!isValidAvatarUrlInput(raw, userId)) {
        throw validationError(["Invalid avatar URL"])
      } else {
        user.avatarUrl = raw
      }
    } else {
      throw validationError(["Invalid avatar URL"])
    }
  }

  await user.save()
  return getProfile(userId)
}

// Actualizar palavra-passe via PATCH /users/me (corpo JSON com currentPassword e newPassword).
async function applyPasswordChange(userId, body) {
  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""
  if (!currentPassword || newPassword.length < 8) {
    throw validationError({ password: ["Invalid password"] })
  }
  const user = await User.findByPk(userId)
  if (!user) {
    throw createError(401, "Unauthorized")
  }
  if (user.isBlocked) {
    throw createError(403, "Forbidden")
  }
  // Confirmar palavra-passe actual antes de gravar o novo hash.
  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    throw createError({
      status: 400,
      description: "A palavra-passe actual não está correcta.",
      errors: { currentPassword: ["Invalid current password"] }
    })
  }
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await user.save()
  return user
}

/**
 * Consultar perfil do utilizador autenticado.
 * Método: GET
 * Rota: /users/me
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Devolver formato da API de perfil sem dados sensíveis; admin recebe ligação allUsers.
 *
 * Notas técnicas:
 * - links.self canónico em /users/{id}; links.me em /users/me.
 */
export const getMe = async (req, res, next) => {
  try {
    const orgId = resolveActiveOrganizationId(req)
    const data = await getProfile(req.user.sub, orgId)
    res.json(withMeResourceLinks(data, { extraLinks: profileExtraLinks(req, data) }))
  } catch (error) {
    passControllerError(error, next, "Error fetching profile")
  }
}

/**
 * Actualizar perfil do utilizador autenticado.
 * Método: PATCH
 * Rota: /users/me
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Permitir alterar nome, email, telefone; recusar contas bloqueadas.
 * - Email único entre utilizadores; telefone normalizado para dígitos.
 *
 * Notas técnicas:
 * - Palavra-passe e avatar têm rotas dedicadas (/me/password, /me/avatar).
 * - Corpo JSON apenas; multipart rejeitado neste rota.
 */
export const patchMe = async (req, res, next) => {
  try {
    const body = req.body ?? {}
    // Palavra-passe e avatar têm rotas dedicadas; rejeitar campos neste rota.
    if (body.currentPassword !== undefined || body.newPassword !== undefined) {
      throw validationError({
        password: ["Use PATCH /users/me/password to change password"]
      })
    }
    if ((req.headers["content-type"] || "").toLowerCase().includes("multipart/form-data")) {
      throw validationError({
        avatar: ["Use PATCH /users/me/avatar to upload an avatar file"]
      })
    }
    const orgId = resolveActiveOrganizationId(req)
    const data = await updateProfile(req.user.sub, body, null)
    const profile = await getProfile(req.user.sub, orgId)
    res.json(withMeResourceLinks(profile, { extraLinks: profileExtraLinks(req, profile) }))
  } catch (error) {
    passControllerError(error, next, "Error updating profile")
  }
}

/**
 * Alterar palavra-passe do utilizador autenticado.
 * Método: PATCH
 * Rota: /users/me/password
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Exigir currentPassword correcta e newPassword com mínimo 8 caracteres.
 * - Recusar contas bloqueadas.
 *
 * Notas técnicas:
 * - Após alteração, renovar sessão (novo JWT + token de actualização) via attachAuthSession.
 * - Limite de pedidos aplicado na rota.
 */
export const patchMePassword = async (req, res, next) => {
  try {
    const user = await applyPasswordChange(req.user.sub, req.body ?? {})
    // Renovar sessão após alteração de palavra-passe (novo JWT + token de actualização).
    await attachAuthSession(res, user)
    const headerOrg =
      typeof req.headers["x-org-id"] === "string" ? req.headers["x-org-id"].trim() : null
    const tokenOrg = typeof req.user.orgId === "string" ? req.user.orgId : null
    const token = await signAccessTokenForUser(user, headerOrg || tokenOrg)
    res.json(buildSessionTokenResource(token))
  } catch (error) {
    passControllerError(error, next, "Error updating password")
  }
}

/**
 * Actualizar avatar por carregamento multiparte ou URL Cloudinary.
 * Método: PATCH
 * Rota: /users/me/avatar
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Ficheiro jpeg/png/webp até 2 MB; validar assinatura do ficheiro no servidor.
 * - URL externa só aceite se pertencer ao utilizador no Cloudinary.
 *
 * Notas técnicas:
 * - prepareAvatarUpload remove avatar Cloudinary anterior antes do carregamento.
 * - Pode combinar campos de perfil (nome, email, telefone) no mesmo pedido.
 */
export const patchMeAvatar = async (req, res, next) => {
  try {
    const body = {
      name: req.body?.name,
      email: req.body?.email,
      phone: req.body?.phone,
      avatarUrl: req.body?.avatarUrl
    }
    await updateProfile(req.user.sub, body, req.file ?? null)
    const orgId = resolveActiveOrganizationId(req)
    const profile = await getProfile(req.user.sub, orgId)
    res.json(withMeResourceLinks(profile, { extraLinks: profileExtraLinks(req, profile) }))
  } catch (error) {
    passControllerError(error, next, "Error updating avatar")
  }
}

/**
 * Apagar conta do utilizador autenticado (soft delete + anonimização).
 * Método: DELETE
 * Rota: /users/me
 */
export const deleteMe = async (req, res, next) => {
  try {
    const body = req.body ?? {}
    const confirmText = typeof body.confirmText === "string" ? body.confirmText.trim() : ""
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""

    if (confirmText !== "APAGAR" && !currentPassword) {
      throw validationError({
        confirm: ["Confirma com a palavra APAGAR ou a palavra-passe actual"]
      })
    }

    const user = await User.findByPk(req.user.sub)
    if (!user || user.deletedAt) {
      throw notFoundError("User", req.user.sub)
    }

    if (currentPassword) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!valid) {
        throw validationError({ currentPassword: ["Palavra-passe incorrecta"] })
      }
    }

    const now = new Date()
    user.name = "Utilizador apagado"
    user.email = `deleted-${user.id}@deleted.mariva.pt`
    user.phone = null
    user.avatarUrl = null
    user.isAdmin = false
    user.isOrganizer = false
    user.deletedAt = now
    await user.save()

    await bumpUserTokenVersion(user)
    await revokeUserRefreshTokens(user.id)
    await clearAuthSession(req, res)

    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting account")
  }
}

