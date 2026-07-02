import { pool } from '../config/database.js';

/**
 * UserModel — tập hợp tất cả SQL queries cho bảng `users`.
 *
 * Pattern: mỗi method là một async function trả về row(s) hoặc result.
 * Không dùng ORM để giữ queries minh bạch và dễ optimize.
 */
export const UserModel = {
  /**
   * Tìm user theo email — CÓ bao gồm password hash.
   * Chỉ dùng trong auth service (login), không expose ra ngoài.
   */
  async findByEmailWithPassword(email) {
    const [rows] = await pool.query(
      `SELECT id, username, email, password, role, is_active,
              refresh_token, avatar, xp, level
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  },

  /**
   * Tìm user theo ID — KHÔNG có password / refresh_token.
   * Dùng cho req.user, /me endpoint, v.v.
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT id, username, email, role, avatar, is_active,
              xp, level,
              streak_current, streak_longest, streak_last_studied_date, streak_freezes,
              stat_words_learned, stat_review_sessions,
              stat_study_time_minutes, stat_correct_answers, stat_total_answers,
              setting_daily_goal, setting_new_words_per_day, setting_reviews_per_day,
              setting_notifications_enabled, setting_sound_enabled,
              setting_theme, setting_preferred_difficulty,
              is_email_verified, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  },

  /**
   * Kiểm tra email hoặc username đã tồn tại chưa.
   * Dùng trước khi INSERT để trả lỗi rõ ràng hơn là để MySQL throw ER_DUP_ENTRY.
   */
  async existsByEmailOrUsername(email, username) {
    const [rows] = await pool.query(
      `SELECT id, email, username
       FROM users
       WHERE email = ? OR username = ?
       LIMIT 2`,
      [email, username],
    );
    return rows; // Array — có thể có 0, 1 hoặc 2 kết quả
  },

  /**
   * Tạo user mới — trả về insertId.
   * Các field còn lại (xp, level, streak...) dùng DEFAULT của schema.
   */
  async create({ username, email, passwordHash }) {
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, passwordHash],
    );
    return result.insertId;
  },

  /**
   * Cập nhật refresh token sau mỗi lần login/refresh.
   * Token được hash bằng bcrypt trước khi lưu (tuỳ chọn bảo mật cao hơn).
   */
  async setRefreshToken(userId, token) {
    await pool.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [token, userId],
    );
  },

  /**
   * Tìm user bằng refresh token — dùng trong /auth/refresh endpoint.
   */
  async findByRefreshToken(token) {
    const [rows] = await pool.query(
      `SELECT id, role, is_active
       FROM users
       WHERE refresh_token = ?
       LIMIT 1`,
      [token],
    );
    return rows[0] ?? null;
  },

  /**
   * Xoá refresh token khi logout (set NULL thay vì xoá row).
   */
  async clearRefreshToken(userId) {
    await pool.query(
      'UPDATE users SET refresh_token = NULL WHERE id = ?',
      [userId],
    );
  },
};
