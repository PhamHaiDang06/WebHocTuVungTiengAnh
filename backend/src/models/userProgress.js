import { pool } from '../config/database.js';

/**
 * UserProgressModel — queries cho bảng `user_progress` và `review_history`.
 * Phase 2: scaffold. Phase 3 (SM-2) sẽ bổ sung submitReview(), getDueCards().
 */
export const UserProgressModel = {
  /**
   * Lấy danh sách từ đến hạn ôn tập của user.
   * Index `idx_due_cards (user_id, next_review_date, status, is_ignored)` cover query này.
   */
  async getDueCards(userId, limit = 20) {
    const [rows] = await pool.query(
      `SELECT
          up.id, up.word_id, up.status,
          up.interval_days, up.repetition, up.ease_factor,
          up.next_review_date, up.total_reviews, up.correct_reviews,
          w.word, w.phonetic_uk, w.phonetic_us, w.audio_url_uk
       FROM user_progress up
       INNER JOIN words w ON w.id = up.word_id
       WHERE up.user_id = ?
         AND up.is_ignored = FALSE
         AND up.next_review_date <= NOW()
         AND up.status != 'mastered'
       ORDER BY up.next_review_date ASC
       LIMIT ?`,
      [userId, limit],
    );
    return rows;
  },

  /**
   * Tìm bản ghi progress cụ thể (user + word).
   */
  async findByUserAndWord(userId, wordId) {
    const [rows] = await pool.query(
      `SELECT * FROM user_progress WHERE user_id = ? AND word_id = ? LIMIT 1`,
      [userId, wordId],
    );
    return rows[0] ?? null;
  },

  /**
   * Tạo progress record mới khi user bắt đầu học một từ.
   */
  async create(userId, wordId) {
    const [result] = await pool.query(
      `INSERT INTO user_progress (user_id, word_id) VALUES (?, ?)`,
      [userId, wordId],
    );
    return result.insertId;
  },

  /**
   * Cập nhật SM-2 state sau một lần review.
   * Được gọi từ sm2.service.js với dữ liệu đã tính.
   */
  async updateSM2(progressId, { intervalDays, repetition, easeFactor, nextReviewDate, status, isCorrect }) {
    await pool.query(
      `UPDATE user_progress SET
          interval_days    = ?,
          repetition       = ?,
          ease_factor      = ?,
          next_review_date = ?,
          last_review_date = NOW(),
          status           = ?,
          total_reviews    = total_reviews + 1,
          correct_reviews  = correct_reviews + ?
       WHERE id = ?`,
      [intervalDays, repetition, easeFactor, nextReviewDate, status, isCorrect ? 1 : 0, progressId],
    );
  },

  /**
   * Ghi lịch sử review vào review_history (dùng cho dashboard, analytics).
   */
  async addReviewHistory(progressId, { quality, timeTakenMs, sessionType }) {
    await pool.query(
      `INSERT INTO review_history (user_progress_id, quality, time_taken_ms, session_type)
       VALUES (?, ?, ?, ?)`,
      [progressId, quality, timeTakenMs, sessionType],
    );
  },
};
