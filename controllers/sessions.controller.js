import { handleControllerError } from "../utils/error.utils.js"
import { attachAuthSession, clearAuthSession, rotateAuthSession, signAccessToken, buildSessionResource, buildSessionTokenResource, SESSION_CURRENT_PATH, parseSessionCredentials, authenticateUser, findActiveUserById } from "../utils/auth.js"
import { hateoasLink, USERS_BASE } from "../utils/hateoas.utils.js"

// Crio sessão com credenciais e devolvo token de acesso
export const createSession = async (req, res, next) => {
  try {
    const { email, password } = parseSessionCredentials(req.body ?? {})
    const user = await authenticateUser(email, password)
    await attachAuthSession(res, user)
    const token = signAccessToken(user)
    const resource = buildSessionResource(token, user, {
      createUser: hateoasLink(USERS_BASE, "POST", "create-user")
    })
    res.status(201).location(SESSION_CURRENT_PATH).json(resource)
  } catch (error) {
    handleControllerError(error, next, "Error creating session")
  }
}

// Devolvo a sessão actual do utilizador autenticado
export const getCurrentSession = async (req, res, next) => {
  try {
    const user = await findActiveUserById(req.user.sub)
    const token = signAccessToken(user)
    res.json(buildSessionResource(token, user))
  } catch (error) {
    handleControllerError(error, next, "Error fetching session")
  }
}

// Renovo o token da sessão actual (rotação)
export const patchCurrentSession = async (req, res, next) => {
  try {
    const token = await rotateAuthSession(req, res)
    res.json(buildSessionTokenResource(token))
  } catch (error) {
    handleControllerError(error, next, "Error updating session")
  }
}

// Termino a sessão actual e limpo cookies de autenticação
export const deleteCurrentSession = async (req, res, next) => {
  try {
    await clearAuthSession(req, res)
    res.status(204).send()
  } catch (error) {
    handleControllerError(error, next, "Error deleting session")
  }
}

