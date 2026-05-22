import multer from "multer"
import { ApiError } from "../utils/api-error.js"

/**
 * @type {import("express").ErrorRequestHandler}
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    })
    return
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      message: "Invalid request"
    })
    return
  }

  if (err.name === "SequelizeValidationError") {
    res.status(400).json({
      success: false,
      message: "Validation error"
    })
    return
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    res.status(400).json({
      success: false,
      message: "Validation error"
    })
    return
  }

  if (err.name === "SequelizeDatabaseError") {
    console.error(err)
    res.status(500).json({
      success: false,
      message: "Internal server error"
    })
    return
  }

  console.error(err)
  res.status(500).json({
    success: false,
    message: "Internal server error"
  })
}
