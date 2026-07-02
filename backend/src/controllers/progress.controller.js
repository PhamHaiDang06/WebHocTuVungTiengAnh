import { validationResult } from "express-validator";
import { pool } from "../config/database.js";
import { UserProgressModel } from "../models/userProgress.model.js";
import { calculateSM2, ratingToQuality } from "../services/sm2.service.js";
import { updateGamification } from "../services/gamification.service.js";
import { AppError } from "../utils/AppError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ─── GET /api/progress/due ────────────────────────────────────────────────────
/**
 * Lấy danh sách thẻ đến hạn ôn tập của user.
 * Query param: ?limit=20 (max 50)
 */
export const getDueCards = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const cards = await UserProgressModel.getDueCards(req.user.id, limit);

  return ApiResponse.success(res, { cards, count: cards.length });
});

// ─── POST /api/progress/start/:wordId ─────────────────────────────────────────
/**
 * Đưa một từ vào danh sách học của user (tạo user_progress record).
 * Nếu đã tồn tại → trả về record cũ, không tạo mới (idempotent).
 */
export const startWord = asyncHandler(async (req, res) => {
  const wordId = parseInt(req.params.wordId);
  if (!wordId || isNaN(wordId))
    throw AppError.badRequest("wordId không hợp lệ");

  // Kiểm tra từ tồn tại và đang published
  const [wordRows] = await pool.query(
    "SELECT id FROM words WHERE id = ? AND is_published = TRUE LIMIT 1",
    [wordId],
  );
  if (!wordRows[0])
    throw AppError.notFound("Từ không tồn tại hoặc chưa được duyệt");

  const existing = await UserProgressModel.findByUserAndWord(
    req.user.id,
    wordId,
  );
  if (existing) {
    return ApiResponse.success(
      res,
      { progress: existing, alreadyAdded: true },
      "Từ này đã có trong danh sách học",
    );
  }

  const progressId = await UserProgressModel.create(req.user.id, wordId);
  return ApiResponse.created(
    res,
    { progressId, alreadyAdded: false },
    "Đã thêm từ vào danh sách học",
  );
});

// ─── POST /api/progress/review ────────────────────────────────────────────────
/**
 * Submit kết quả 1 lần ôn tập.
 *
 * Flow:
 * 1. Validate input
 * 2. Lấy progress record (kiểm tra ownership)
 * 3. Tính SM-2 state mới
 * 4. Transaction: update SM-2 + ghi review_history + update gamification
 * 5. Trả về kết quả SM-2 + gamification để frontend cập nhật UI ngay
 *
 * Body: {
 *   progressId: number,
 *   rating: 'again'|'hard'|'good'|'easy',
 *   timeTakenMs?: number,
 *   sessionType?: 'flashcard'|'multiple_choice'|'typing'|'pronunciation'
 * }
 */
export const submitReview = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    throw AppError.badRequest("Dữ liệu không hợp lệ", errors.array());

  const {
    progressId,
    rating,
    timeTakenMs = null,
    sessionType = "flashcard",
  } = req.body;

  // 1. Lấy progress record — xác nhận thuộc về user đang đăng nhập
  const [rows] = await pool.query(
    `SELECT * FROM user_progress WHERE id = ? AND user_id = ? LIMIT 1`,
    [progressId, req.user.id],
  );
  const progress = rows[0];
  if (!progress) throw AppError.notFound("Không tìm thấy progress record");

  // 2. Tính SM-2
  let quality;
  try {
    quality = ratingToQuality(rating);
  } catch (e) {
    throw AppError.badRequest(e.message);
  }

  const sm2Result = calculateSM2(
    {
      intervalDays: progress.interval_days,
      repetition: progress.repetition,
      easeFactor: parseFloat(progress.ease_factor),
      status: progress.status,
    },
    quality,
  );

  // Phát hiện từ vừa đạt mastered lần đầu (để tính XP bonus)
  const isNewMastered =
    progress.status !== "mastered" && sm2Result.status === "mastered";

  // 3. Transaction: đảm bảo 3 bước cùng thành công hoặc cùng rollback
  const conn = await pool.getConnection();
  let gamificationResult;

  try {
    await conn.beginTransaction();

    // 3a. Cập nhật SM-2 state
    await conn.query(
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
      [
        sm2Result.intervalDays,
        sm2Result.repetition,
        sm2Result.easeFactor,
        sm2Result.nextReviewDate,
        sm2Result.status,
        sm2Result.isCorrect ? 1 : 0,
        progressId,
      ],
    );

    // 3b. Ghi lịch sử review
    await conn.query(
      `INSERT INTO review_history
         (user_progress_id, quality, time_taken_ms, session_type)
       VALUES (?, ?, ?, ?)`,
      [progressId, quality, timeTakenMs, sessionType],
    );

    // 3c. Cập nhật XP, level, streak
    gamificationResult = await updateGamification(req.user.id, {
      isCorrect: sm2Result.isCorrect,
      isNewMastered,
      conn,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return ApiResponse.success(
    res,
    {
      sm2: {
        status: sm2Result.status,
        intervalDays: sm2Result.intervalDays,
        nextReviewDate: sm2Result.nextReviewDate,
        isCorrect: sm2Result.isCorrect,
        isNewMastered,
      },
      gamification: gamificationResult,
    },
    "Đã ghi nhận kết quả ôn tập",
  );
});

// ─── GET /api/progress/stats ──────────────────────────────────────────────────
/**
 * Thống kê học tập của user: overview, phân bổ status, hoạt động 7 ngày.
 * Dùng Promise.all để chạy 3 query song song.
 */
export const getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [[statusRows], [activityRows], [overviewRows]] = await Promise.all([
    // Phân bổ thẻ theo status (new/learning/reviewing/mastered)
    pool.query(
      `SELECT status, COUNT(*) AS count
       FROM user_progress
       WHERE user_id = ? AND is_ignored = FALSE
       GROUP BY status`,
      [userId],
    ),

    // Lịch sử 7 ngày — dùng cho biểu đồ Activity Chart
    pool.query(
      `SELECT
          DATE(rh.reviewed_at)                                           AS date,
          COUNT(*)                                                       AS totalReviews,
          SUM(CASE WHEN rh.quality >= 3 THEN 1 ELSE 0 END)             AS correctReviews,
          ROUND(AVG(rh.time_taken_ms))                                  AS avgTimeTakenMs
       FROM review_history rh
       INNER JOIN user_progress up ON up.id = rh.user_progress_id
       WHERE up.user_id = ?
         AND rh.reviewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(rh.reviewed_at)
       ORDER BY date ASC`,
      [userId],
    ),

    // Stats tổng (pre-computed trong users table — đọc nhanh)
    pool.query(
      `SELECT xp, level,
              streak_current, streak_longest, streak_freezes,
              stat_words_learned, stat_review_sessions,
              stat_correct_answers, stat_total_answers
       FROM users WHERE id = ? LIMIT 1`,
      [userId],
    ),
  ]);

  const overview = overviewRows[0] || {};
  const accuracy =
    overview.stat_total_answers > 0
      ? parseFloat(
          (
            (overview.stat_correct_answers / overview.stat_total_answers) *
            100
          ).toFixed(1),
        )
      : 0;

  return ApiResponse.success(res, {
    overview: { ...overview, accuracy },
    statusBreakdown: statusRows,
    recentActivity: activityRows,
  });
});
