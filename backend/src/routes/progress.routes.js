import { Router } from "express";
import { body } from "express-validator";
import { authenticate } from "../middlewares/authenticate.js";
import * as ProgressController from "../controllers/progress.controller.js";

const router = Router();

// Tất cả progress routes yêu cầu đăng nhập
router.use(authenticate);

// ─── Validation Rules ─────────────────────────────────────────────────────────
const reviewRules = [
  body("progressId")
    .isInt({ min: 1 })
    .withMessage("progressId phải là số nguyên dương"),

  body("rating")
    .isIn(["again", "hard", "good", "easy"])
    .withMessage("rating phải là: again | hard | good | easy"),

  body("timeTakenMs")
    .optional()
    .isInt({ min: 0, max: 300_000 }) // Max 5 phút
    .withMessage("timeTakenMs không hợp lệ"),

  body("sessionType")
    .optional()
    .isIn(["flashcard", "multiple_choice", "typing", "pronunciation"])
    .withMessage("sessionType không hợp lệ"),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET  /api/progress/due       — Lấy thẻ đến hạn (?limit=20)
router.get("/due", ProgressController.getDueCards);

// GET  /api/progress/stats     — Thống kê học tập
router.get("/stats", ProgressController.getStats);

// POST /api/progress/review    — Submit kết quả 1 lần ôn
router.post("/review", reviewRules, ProgressController.submitReview);

// POST /api/progress/start/:wordId  — Bắt đầu học từ mới
router.post("/start/:wordId", ProgressController.startWord);

export default router;
