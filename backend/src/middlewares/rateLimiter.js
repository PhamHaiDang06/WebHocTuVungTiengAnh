import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

/**
 * Giới hạn nghiêm ngặt cho auth routes (register, login).
 * 10 request / 15 phút — ngăn brute force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,          // Thoải mái hơn khi dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều lần thử, vui lòng đợi 15 phút rồi thử lại',
  },
});

/**
 * Giới hạn chung cho /api/*.
 * 200 request / 15 phút — bảo vệ server khỏi spam.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều request, vui lòng thử lại sau',
  },
});
