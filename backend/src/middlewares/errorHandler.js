import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

/**
 * Global error handler — phải có 4 tham số để Express nhận diện là error middleware.
 * Đặt CUỐI CÙNG trong server.js, sau tất cả routes.
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // ─── Chuyển đổi lỗi thư viện → AppError có thể đọc được ─────────────────────
  // MySQL: duplicate entry (email/username đã tồn tại)
  if (err.code === 'ER_DUP_ENTRY') {
    const field = err.message.includes('uq_email') ? 'Email' : 'Username';
    error = AppError.conflict(`${field} đã được sử dụng`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') error = AppError.unauthorized('Token không hợp lệ');
  if (err.name === 'TokenExpiredError') error = AppError.unauthorized('Token đã hết hạn');

  // Express body-parser: body > 10kb
  if (err.type === 'entity.too.large') error = AppError.badRequest('Request body quá lớn');

  const statusCode = error.statusCode || 500;
  const message    = error.message   || 'Lỗi server';

  // ─── Response ─────────────────────────────────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message,
    ...(error.errors  && { errors: error.errors }),
    // Chỉ expose stack trace ở development
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
