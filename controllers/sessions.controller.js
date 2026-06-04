import { passControllerError } from "../utils/error.utils.js"
import { attachAuthSession, clearAuthSession, rotateAuthSession, signAccessToken, buildSessionResource, buildSessionTokenResource, SESSION_CURRENT_PATH, parseSessionCredentials, authenticateUser, findActiveUserById } from "../utils/auth.js"
import { USERS_BASE } from "../utils/response.utils.js"

// Criar sessão com credenciais e devolver token de acesso
export const createSession = async (req, res, next) => {
  try {
    const { email, password } = parseSessionCredentials(req.body ?? {})
    const user = await authenticateUser(email, password)
    await attachAuthSession(res, user)
    const token = signAccessToken(user)
    const resource = buildSessionResource(token, user, {
      createUser: { href: USERS_BASE, method: "POST" }
    })
    res.status(201).location(SESSION_CURRENT_PATH).json(resource)
  } catch (error) {
    passControllerError(error, next, "Error creating session")
  }
}

// Obter a sessão actual do utilizador autenticado
export const getCurrentSession = async (req, res, next) => {
  try {
    const user = await findActiveUserById(req.user.sub)
    const token = signAccessToken(user)
    res.json(buildSessionResource(token, user))
  } catch (error) {
    passControllerError(error, next, "Error fetching session")
  }
}

// Renovar o token da sessão actual
export const patchCurrentSession = async (req, res, next) => {
  try {
    const token = await rotateAuthSession(req, res)
    res.json(buildSessionTokenResource(token))
  } catch (error) {
    passControllerError(error, next, "Error updating session")
  }
}

// Terminar a sessão actual
export const deleteCurrentSession = async (req, res, next) => {
  try {
    await clearAuthSession(req, res)
    res.status(204).send()
  } catch (error) {
    passControllerError(error, next, "Error deleting session")
  }
}
