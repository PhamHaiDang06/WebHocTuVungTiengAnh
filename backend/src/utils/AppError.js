export class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', errors = null) {
    return new AppError(message, 400, errors);
  }
  static unauthorized(message = 'Chưa xác thực') {
    return new AppError(message, 401);
  }
  static forbidden(message = 'Không có quyền') {
    return new AppError(message, 403);
  }
  static notFound(message = 'Không tìm thấy') {
    return new AppError(message, 404);
  }
  static conflict(message = 'Dữ liệu đã tồn tại') {
    return new AppError(message, 409);
  }
}
