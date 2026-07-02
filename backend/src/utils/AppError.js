/**
 * Custom Error class — phân biệt "operational error" (có thể xử lý, trả về client)
 * với "programmer error" (bug thực sự, không nên expose).
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {Array|null} errors  - Chi tiết lỗi (validation errors...)
   */
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  // ─── Factory methods — dùng trong controllers thay vì `new AppError(...)` ───
  static badRequest(message = "Bad Request", errors = null) {
    return new AppError(message, 400, errors);
  }

  static unauthorized(message = "Chưa xác thực") {
    return new AppError(message, 401);
  }

  static forbidden(message = "Không có quyền") {
    return new AppError(message, 403);
  }

  static notFound(message = "Không tìm thấy") {
    return new AppError(message, 404);
  }

  static conflict(message = "Dữ liệu đã tồn tại") {
    return new AppError(message, 409);
  }
}
