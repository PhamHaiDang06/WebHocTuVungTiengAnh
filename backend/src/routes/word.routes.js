/**
 * @file word.routes.js
 * @description Word API routes.
 *
 * Public:
 *   GET  /api/words           → Browse/search words
 *   GET  /api/words/:id       → Get single word
 *
 * Authenticated (any user):
 *   POST /api/words/seed/:word    → Seed from Dictionary API
 *   POST /api/words/:id/deck      → Add word to personal deck
 *
 * Admin only:
 *   POST   /api/words         → Create word manually
 *   PUT    /api/words/:id     → Update word
 *   DELETE /api/words/:id     → Soft-delete word
 *
 * ⚠️ ORDER MATTERS in Express:
 *   /seed/:word must be declared BEFORE /:id to avoid Express
 *   treating "seed" as an ObjectId value for :id.
 */

const { Router } = require('express');
const {
  getWords, getWordById,
  seedWord, addToDeck,
  createWord, updateWord, deleteWord,
} = require('../controllers/word.controller');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { seedLimiter }             = require('../middlewares/rateLimiter');

const router = Router();

// ── Public ────────────────────────────────────────────
router.get('/',    getWords);

// ── Authenticated ─────────────────────────────────────
// Note: /seed/:word before /:id to avoid route collision
router.post('/seed/:word', authenticate, seedLimiter, seedWord);

// ── Admin only ────────────────────────────────────────
router.post('/', authenticate, authorize('admin'), createWord);

// ── Routes with :id ───────────────────────────────────
router.get('/:id',        getWordById);
router.post('/:id/deck',  authenticate, addToDeck);
router.put('/:id',        authenticate, authorize('admin'), updateWord);
router.delete('/:id',     authenticate, authorize('admin'), deleteWord);

module.exports = router;