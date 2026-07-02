/**
 * Pure SM-2 Algorithm — SuperMemo 2
 * Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * Không có side effects, không gọi DB.
 * Input: trạng thái hiện tại + quality → Output: trạng thái mới.
 */

const MIN_EASE_FACTOR = 1.3;

// Ngưỡng để xét từ đã "mastered"
const MASTERED_MIN_REPETITION = 5;
const MASTERED_MIN_EF = 2.5;

// ─── Core Algorithm ───────────────────────────────────────────────────────────

/**
 * Tính trạng thái SM-2 mới sau một lần review.
 *
 * @param {Object} current
 * @param {number} current.intervalDays  - Khoảng cách hiện tại (ngày)
 * @param {number} current.repetition    - Số lần review thành công liên tiếp
 * @param {number} current.easeFactor    - Hệ số dễ [1.3, ∞), default 2.5
 * @param {string} current.status        - 'new'|'learning'|'reviewing'|'mastered'
 * @param {number} quality               - Điểm đánh giá 0–5
 *   0: Quên hoàn toàn
 *   1: Sai, nhưng nhớ ra khi thấy đáp án
 *   2: Sai, nhưng đáp án có vẻ dễ nhớ
 *   3: Đúng, nhưng rất khó khăn
 *   4: Đúng sau một lúc do dự
 *   5: Đúng ngay lập tức, hoàn hảo
 *
 * @returns {Object} New SM-2 state
 */
export const calculateSM2 = (
  { intervalDays, repetition, easeFactor, status },
  quality,
) => {
  if (quality < 0 || quality > 5) {
    throw new Error("Quality phải trong khoảng 0–5");
  }

  let newInterval = intervalDays;
  let newRepetition = repetition;
  let newEaseFactor = Number(easeFactor);

  if (quality >= 3) {
    // ── Trả lời đúng: tăng interval theo cấp số nhân ──────────────────────────
    if (newRepetition === 0) newInterval = 1;
    else if (newRepetition === 1) newInterval = 6;
    else newInterval = Math.round(newInterval * newEaseFactor);

    newRepetition += 1;

    // EF Formula: EF' = EF + 0.1 − (5−q)(0.08 + (5−q)×0.02)
    newEaseFactor =
      newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    // ── Trả lời sai: reset về đầu, phạt EF ───────────────────────────────────
    newRepetition = 0;
    newInterval = 1;
    newEaseFactor = newEaseFactor - 0.2;
  }

  // Giới hạn dưới của EF
  newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor);
  // Làm tròn 4 chữ số thập phân (khớp với DECIMAL(5,4) trong DB)
  newEaseFactor = parseFloat(newEaseFactor.toFixed(4));

  // Tính ngày ôn tiếp theo
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  const newStatus = resolveStatus(newRepetition, newEaseFactor, quality);

  return {
    intervalDays: newInterval,
    repetition: newRepetition,
    easeFactor: newEaseFactor,
    nextReviewDate, // Date object — controller sẽ format khi cần
    status: newStatus,
    isCorrect: quality >= 3,
  };
};

/**
 * Xác định status lifecycle của card.
 *
 * new → learning (lần đầu ôn) → reviewing (repetition >= 2) → mastered
 * Nếu sai (quality < 3) → luôn về 'learning' dù đang ở bất kỳ status nào.
 */
const resolveStatus = (repetition, easeFactor, quality) => {
  if (quality < 3) return "learning";
  if (repetition >= MASTERED_MIN_REPETITION && easeFactor >= MASTERED_MIN_EF)
    return "mastered";
  if (repetition >= 2) return "reviewing";
  return "learning";
};

// ─── Rating → Quality Converter ───────────────────────────────────────────────

/**
 * Convert 4-button UI rating → SM-2 quality score (0–5).
 *
 * UI dùng 4 nút cho đơn giản:
 *   'again' (0) → quên hoàn toàn
 *   'hard'  (3) → đúng nhưng rất khó
 *   'good'  (4) → đúng sau do dự
 *   'easy'  (5) → đúng ngay lập tức
 */
export const ratingToQuality = (rating) => {
  const map = { again: 0, hard: 3, good: 4, easy: 5 };
  const quality = map[rating];
  if (quality === undefined) {
    throw new Error(
      `Rating không hợp lệ: "${rating}". Phải là again|hard|good|easy`,
    );
  }
  return quality;
};

/**
 * Ước tính % retention của một card dựa vào ngày đến hạn.
 * Dùng để hiển thị UI "từ này sắp quên" trên dashboard.
 *
 * @param {Date} nextReviewDate
 * @param {number} intervalDays
 * @returns {number} 0–100
 */
export const estimateRetention = (nextReviewDate, intervalDays) => {
  const now = Date.now();
  const due = new Date(nextReviewDate).getTime();
  const daysPassed = (now - (due - intervalDays * 86400000)) / 86400000;
  const retention = Math.exp((-0.7 / intervalDays) * daysPassed) * 100;
  return Math.max(0, Math.min(100, parseFloat(retention.toFixed(1))));
};
