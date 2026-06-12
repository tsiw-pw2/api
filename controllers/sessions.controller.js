import { passControllerError } from "../utils/error.utils.js"
import { attachAuthSession, clearAuthSession, rotateAuthSession, signAccessTokenForUser, buildSessionTokenResource, SESSION_CURRENT_PATH, parseSessionCredentials, authenticateUser, findActiveUserById } from "../utils/auth.js"
import { USERS_BASE } from "../utils/response.utils.js"

/**
 * Iniciar sessão com email e palavra-passe.
 * Método: POST
 * Rota: /sessions
 * Autenticação: não
 *
 * Regras de negócio:
 * - Recusar credenciais inválidas ou conta bloqueada (401/403).
 * - Após autenticação, emitir JWT de acesso e cookie httpOnly de refresh.
 *
 * Notas técnicas:
 * - Revogar tokens de actualização anteriores do utilizador antes de criar sessão nova.
 * - Resposta 201 com Location /sessions/current e ligações hipermedia.
 */
export const createSession = async (req, res, next) => {
  try {
    const { email, password, organizationId } = parseSessionCredentials(req.body ?? {})
    const user = await authenticateUser(email, password)
    await attachAuthSession(res, user)
    const token = await signAccessTokenForUser(user, organizationId)
    const resource = buildSessionTokenResource(token, {
      createUser: { href: USERS_BASE, method: "POST" }
    })
    res.status(201).location(SESSION_CURRENT_PATH).json(resource)
  } catch (error) {
    passControllerError(error, next, "Error creating session")
  }
}

/**
 * Consultar sessão actual e obter JWT renovado.
 * Método: GET
 * Rota: /sessions/current
 * Autenticação: sim (Bearer JWT)
 *
 * Regras de negócio:
 * - Devolver perfil público e token de acesso actualizado para o utilizador autenticado.
 *
 * Notas técnicas:
 * - verifyToken valida tokenVersion e estado is_blocked na BD.
 */
export const getCurrentSession = async (req, res, next) => {
  try {
    const user = await findActiveUserById(req.user.sub)
    const headerOrg =
      typeof req.headers["x-org-id"] === "string" ? req.headers["x-org-id"].trim() : null
    const tokenOrg = typeof req.user.orgId === "string" ? req.user.orgId : null
    const token = await signAccessTokenForUser(user, headerOrg || tokenOrg)
    res.json(buildSessionTokenResource(token))
  } catch (error) {
    passControllerError(error, next, "Error fetching session")
  }
}

/**
 * Renovar token de acesso via cookie de token de actualização.
 * Método: PATCH
 * Rota: /sessions/current
 * Autenticação: não (cookie refresh_token)
 *
 * Regras de negócio:
 * - Rodar sessão: invalidar token de actualização usado e emitir novo par cookie + JWT.
 *
 * Notas técnicas:
 * - Persistir apenas hash do token de actualização em refresh_token; rotação a cada PATCH.
 */
export const patchCurrentSession = async (req, res, next) => {
  try {
    // Rotação via cookie refresh_token; resposta só com token (sem perfil completo).
    const token = await rotateAuthSession(req, res)
    res.json(buildSessionTokenResource(token))
  } catch (error) {
    passControllerError(error, next, "Error updating session")
  }
}

/**
 * Terminar sessão actual.
 * Método: DELETE
 * Rota: /sessions/current
 * Autenticação: não (cookie refresh_token opcional)
 *
 * Regras de negócio:
 * - Revogar token de actualização associado e limpar cookie de sessão.
 *
 * Notas técnicas:
 * - Resposta 204 sem corpo; JWT em memória do cliente deixa de ser renovável.
 */
export const deleteCurrentSession = async (req, res, next) => {
  try {
    await clearAuthSession(req, res)
    // 204 sem corpo: JWT em memória deixa de ser renovável sem novo login.
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting session")
  }
}
