import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { UserModel } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

// ─── JWT Helpers ──────────────────────────────────────────────────────────────
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (ms)
};

const signAccessToken = (userId, role) =>
  jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  });

const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  });

// ─── Controllers ─────────────────────────────────────────────────────────────
/**
 * POST /api/auth/register
 * Body: { username, email, password }
 */
export const register = asyncHandler(async (req, res) => {
  // 1. Kiểm tra validation errors từ express-validator
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw AppError.badRequest('Dữ liệu không hợp lệ', errors.array());
  }

  const { username, email, password } = req.body;

  // 2. Kiểm tra duplicate trước (lỗi rõ ràng hơn ER_DUP_ENTRY)
  const existing = await UserModel.existsByEmailOrUsername(email, username);
  if (existing.length > 0) {
    const taken = existing.find((u) => u.email === email) ? 'Email' : 'Username';
    throw AppError.conflict(`${taken} đã được sử dụng`);
  }

  // 3. Hash password (cost factor 12 — cân bằng bảo mật/performance)
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. Tạo user
  const userId = await UserModel.create({ username, email, passwordHash });

  // 5. Tạo tokens
  const accessToken  = signAccessToken(userId, 'user');
  const refreshToken = signRefreshToken(userId);
  await UserModel.setRefreshToken(userId, refreshToken);

  // 6. Trả về user data + set refresh token cookie
  const user = await UserModel.findById(userId);
  res.cookie('refreshToken', refreshToken, cookieOptions);

  return ApiResponse.created(res, { user, accessToken }, 'Đăng ký thành công');
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw AppError.badRequest('Dữ liệu không hợp lệ', errors.array());
  }

  const { email, password } = req.body;

  // 1. Tìm user (có password hash)
  const userWithPwd = await UserModel.findByEmailWithPassword(email);

  // 2. Dùng cùng message cho "email sai" và "password sai" — tránh user enumeration
  const INVALID_MSG = 'Email hoặc mật khẩu không đúng';
  if (!userWithPwd) throw AppError.unauthorized(INVALID_MSG);
  if (!userWithPwd.is_active) throw AppError.forbidden('Tài khoản đã bị vô hiệu hóa');

  const isMatch = await bcrypt.compare(password, userWithPwd.password);
  if (!isMatch) throw AppError.unauthorized(INVALID_MSG);

  // 3. Tạo & lưu tokens
  const accessToken  = signAccessToken(userWithPwd.id, userWithPwd.role);
  const refreshToken = signRefreshToken(userWithPwd.id);
  await UserModel.setRefreshToken(userWithPwd.id, refreshToken);

  // 4. Lấy user data sạch (không có password)
  const user = await UserModel.findById(userWithPwd.id);
  res.cookie('refreshToken', refreshToken, cookieOptions);

  return ApiResponse.success(res, { user, accessToken }, 'Đăng nhập thành công');
});

/**
 * POST /api/auth/refresh
 * Dùng refresh token trong httpOnly cookie để lấy access token mới.
 * Áp dụng Refresh Token Rotation: đổi refresh token mới mỗi lần refresh.
 */
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw AppError.unauthorized('Không tìm thấy refresh token');

  // 1. Verify chữ ký & hạn
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw AppError.unauthorized('Refresh token không hợp lệ hoặc đã hết hạn');
  }

  // 2. Kiểm tra token có khớp với DB không (phát hiện token bị đánh cắp & reuse)
  const user = await UserModel.findByRefreshToken(token);
  if (!user) {
    // Token hợp lệ nhưng không có trong DB → có thể đã bị dùng (replay attack)
    throw AppError.unauthorized('Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại');
  }

  // 3. Rotate tokens
  const newAccessToken  = signAccessToken(user.id, user.role);
  const newRefreshToken = signRefreshToken(user.id);
  await UserModel.setRefreshToken(user.id, newRefreshToken);

  res.cookie('refreshToken', newRefreshToken, cookieOptions);
  return ApiResponse.success(res, { accessToken: newAccessToken }, 'Token đã được làm mới');
});

/**
 * POST /api/auth/logout
 * Xoá refresh token khỏi DB và clear cookie.
 */
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const user = await UserModel.findByRefreshToken(token);
    if (user) await UserModel.clearRefreshToken(user.id);
  }
  res.clearCookie('refreshToken');
  return ApiResponse.success(res, null, 'Đăng xuất thành công');
});

/**
 * GET /api/auth/me
 * Trả về thông tin user hiện tại (req.user được gắn bởi authenticate middleware).
 */
export const me = asyncHandler(async (req, res) => {
  // Lấy lại user đầy đủ từ DB (req.user từ middleware chỉ có vài field)
  const user = await UserModel.findById(req.user.id);
  return ApiResponse.success(res, { user });
});
