/**
 * @file word.controller.js
 * @description Word management: browse, search, seed from dictionary API, add to user deck.
 *
 * Endpoints:
 *   GET    /api/words              → Browse/search words (public)
 *   GET    /api/words/:id          → Get single word (public)
 *   POST   /api/words/seed/:word   → Fetch from Dictionary API & save (auth)
 *   POST   /api/words              → Create word manually (admin)
 *   PUT    /api/words/:id          → Update word (admin)
 *   DELETE /api/words/:id          → Soft-delete word (admin)
 *   POST   /api/words/:id/deck     → Add word to user's learning deck (auth)
 */

const Word             = require('../models/Word');
const UserProgress     = require('../models/UserProgress');
const AppError         = require('../utils/AppError');
const ApiResponse      = require('../utils/ApiResponse');
const { fetchWordFromAPI } = require('../services/gamification.service');

// ─────────────────────────────────────────────
// Public Endpoints
// ─────────────────────────────────────────────

/**
 * GET /api/words
 * Query params: page, limit, difficulty, cefrLevel, tags (comma-separated), search, sortBy, order
 */
const getWords = async (req, res, next) => {
  try {
    const {
      page       = 1,
      limit      = 20,
      difficulty,
      cefrLevel,
      tags,
      search,
      sortBy     = 'frequencyRank',
      order      = 'asc',
    } = req.query;

    const filter = { isPublished: true };

    if (difficulty) filter.difficulty = difficulty;
    if (cefrLevel)  filter.cefrLevel  = cefrLevel;
    if (tags) {
      filter.tags = { $in: tags.split(',').map((t) => t.toLowerCase().trim()) };
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const skip      = (Number(page) - 1) * Number(limit);
    const sortDir   = order === 'asc' ? 1 : -1;
    const sortField = search ? { score: { $meta: 'textScore' } } : { [sortBy]: sortDir };

    const [words, total] = await Promise.all([
      Word.find(filter)
        .sort(sortField)
        .skip(skip)
        .limit(Number(limit))
        .select('-__v -source -etymology'), // Trim response for list views
      Word.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, words, {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      hasNext:    Number(page) < Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/words/:id
 * Returns full word data including etymology and all definitions.
 */
const getWordById = async (req, res, next) => {
  try {
    const word = await Word.findOne({ _id: req.params.id, isPublished: true });
    if (!word) return next(new AppError('Word not found.', 404));
    return ApiResponse.success(res, { word });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// Authenticated Endpoints
// ─────────────────────────────────────────────

/**
 * POST /api/words/seed/:word
 * Fetches word from Dictionary API and saves to DB if not already present.
 * Accessible to any authenticated user (rate-limited separately).
 */
const seedWord = async (req, res, next) => {
  try {
    const query = req.params.word.toLowerCase().trim();

    // Return early if already in our DB
    const existing = await Word.findOne({ word: query });
    if (existing) {
      return ApiResponse.success(res, { word: existing }, `'${query}' already exists in the database.`);
    }

    // Fetch from external API
    const wordData = await fetchWordFromAPI(query);
    if (!wordData) {
      return next(new AppError(`'${query}' was not found in the dictionary.`, 404));
    }

    const newWord = await Word.create(wordData);
    return ApiResponse.created(res, { word: newWord }, `'${query}' seeded successfully.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/words/:id/deck
 * Add an existing word to the authenticated user's learning deck.
 * Creates a UserProgress document with SM-2 defaults (status: 'new').
 */
const addToDeck = async (req, res, next) => {
  try {
    const wordId = req.params.id;
    const userId = req.user._id;

    // Confirm word exists and is published
    const word = await Word.findOne({ _id: wordId, isPublished: true });
    if (!word) return next(new AppError('Word not found.', 404));

    // Upsert: create if not exists, ignore if already in deck
    const progress = await UserProgress.findOneAndUpdate(
      { userId, wordId },
      { $setOnInsert: { userId, wordId } }, // Only write on INSERT (no overwrite)
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('wordId', 'word phonetics difficulty cefrLevel');

    const alreadyInDeck = !progress.createdAt || // was not just created
      (Date.now() - new Date(progress.createdAt).getTime() > 1000);

    return ApiResponse.created(
      res,
      { progress },
      alreadyInDeck ? `'${word.word}' is already in your deck.` : `'${word.word}' added to your deck!`
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// Admin Endpoints
// ─────────────────────────────────────────────

/**
 * POST /api/words
 * Create a word manually (admin-only).
 * Body: Full Word schema fields
 */
const createWord = async (req, res, next) => {
  try {
    const word = await Word.create(req.body);
    return ApiResponse.created(res, { word }, 'Word created.');
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/words/:id
 * Replace word fields (admin-only).
 */
const updateWord = async (req, res, next) => {
  try {
    const word = await Word.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!word) return next(new AppError('Word not found.', 404));
    return ApiResponse.success(res, { word }, 'Word updated.');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/words/:id
 * Soft-delete: sets isPublished = false (admin-only).
 * Preserves UserProgress records (users' learning history is kept).
 */
const deleteWord = async (req, res, next) => {
  try {
    const word = await Word.findByIdAndUpdate(
      req.params.id,
      { isPublished: false },
      { new: true }
    );
    if (!word) return next(new AppError('Word not found.', 404));
    return ApiResponse.success(res, null, `'${word.word}' has been unpublished.`);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWords, getWordById, seedWord, addToDeck,
  createWord, updateWord, deleteWord,
};