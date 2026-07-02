import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../config/database.js';

/**
 * Middleware xác thực JWT access token.
 * Nếu hợp lệ → đính kèm req.user, gọi next().
 * Nếu lỗi   → chuyển đến errorHandler.
 */
export const authenticate = async (req, res, next) => {
  try {
    // 1. Lấy token từ Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Vui lòng đăng nhập để tiếp tục');
    }

    const token = authHeader.slice(7); // Bỏ "Bearer "

    // 2. Verify token
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    // 3. Kiểm tra user vẫn tồn tại và đang active trong DB
    // (Xử lý trường hợp user bị ban sau khi đã đăng nhập)
    const [rows] = await pool.query(
      `SELECT id, username, email, role, avatar, xp, level,
              is_active, is_email_verified
       FROM users
       WHERE id = ? LIMIT 1`,
      [decoded.sub],
    );

    const user = rows[0];
    if (!user)            throw AppError.unauthorized('Tài khoản không tồn tại');
    if (!user.is_active)  throw AppError.forbidden('Tài khoản đã bị vô hiệu hóa');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware kiểm tra role.
 * Dùng sau authenticate: router.get('/admin', authenticate, requireRole('admin'), ...)
 *
 * @param {'admin'|'user'} role
 */
export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return next(AppError.forbidden('Không có quyền thực hiện hành động này'));
  }
  next();
};
