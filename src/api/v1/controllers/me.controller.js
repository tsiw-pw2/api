import * as meService from "../services/me.service.js"

/**
 * @type {import("express").RequestHandler}
 */
export async function getMe(req, res, next) {
  try {
    const data = await meService.getProfile(req.auth.userId)
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function patchMe(req, res, next) {
  try {
    const multipart = (req.headers["content-type"] || "")
      .toLowerCase()
      .includes("multipart/form-data")
    const body = multipart
      ? {
          name: req.body?.name,
          email: req.body?.email,
          phone: req.body?.phone,
          avatarUrl: req.body?.avatarUrl
        }
      : (req.body ?? {})
    const uploadedFile = multipart && req.file ? req.file : null
    const data = await meService.updateProfile(req.auth.userId, body, uploadedFile)
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}

/**
 * @type {import("express").RequestHandler}
 */
export async function postAvatar(req, res, next) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Invalid request" })
      return
    }
    const data = await meService.finalizeUploadedAvatar(req.auth.userId, req.file)
    res.json({ success: true, data })
  } catch (e) {
    next(e)
  }
}
