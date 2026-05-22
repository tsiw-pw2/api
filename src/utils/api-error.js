export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   */
  constructor(statusCode, message) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
  }

  static invalidCredentials() {
    return new ApiError(401, "Invalid credentials")
  }

  static unauthorized() {
    return new ApiError(401, "Unauthorized")
  }

  static forbidden() {
    return new ApiError(403, "Forbidden")
  }

  /**
   * @param {string} reason
   */
  static accountBlocked(reason) {
    const trimmed = typeof reason === "string" ? reason.trim() : ""
    return new ApiError(403, trimmed.length > 0 ? trimmed : "Account blocked")
  }

  /**
   * @param {string} message
   */
  static badRequest(message) {
    return new ApiError(400, message)
  }

  static notFound() {
    return new ApiError(404, "Not found")
  }

  /**
   * @param {string} message
   */
  static conflict(message) {
    return new ApiError(409, message)
  }
}
