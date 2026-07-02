import { pool } from '../config/database.js';

/**
 * WordModel — SQL queries cho bảng `words`, `definitions`, `tags`, `word_tags`.
 * Phase 2: chỉ scaffold cơ bản. Phase 3+ sẽ bổ sung thêm.
 */
export const WordModel = {
  /**
   * Lấy danh sách từ có phân trang, filter theo difficulty/cefr/tag.
   */
  async findAll({ page = 1, limit = 20, difficulty, cefr, tagName, search } = {}) {
    const offset = (page - 1) * limit;
    const params = [];

    let query = `
      SELECT
        w.id, w.word, w.phonetic_uk, w.phonetic_us,
        w.audio_url_uk, w.audio_url_us,
        w.difficulty, w.cefr_level, w.frequency_rank,
        w.is_published,
        JSON_ARRAYAGG(
          JSON_OBJECT('pos', d.part_of_speech, 'definition', d.definition, 'example', d.example)
          ORDER BY d.sort_order
        ) AS definitions
      FROM words w
      LEFT JOIN definitions d ON d.word_id = w.id
    `;

    if (tagName) {
      query += ` INNER JOIN word_tags wt ON wt.word_id = w.id
                 INNER JOIN tags t ON t.id = wt.tag_id AND t.name = ?`;
      params.push(tagName);
    }

    query += ` WHERE w.is_published = TRUE`;
    if (difficulty)  { query += ' AND w.difficulty = ?';   params.push(difficulty); }
    if (cefr)        { query += ' AND w.cefr_level = ?';   params.push(cefr); }
    if (search)      { query += ' AND MATCH(w.word) AGAINST(? IN BOOLEAN MODE)'; params.push(`${search}*`); }

    query += ` GROUP BY w.id ORDER BY w.frequency_rank ASC, w.id ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    return rows;
  },

  /**
   * Lấy chi tiết một từ kèm definitions, synonyms, antonyms, tags.
   */
  async findById(id) {
    const [words] = await pool.query(
      `SELECT id, word, phonetic_uk, phonetic_us, audio_url_uk, audio_url_us,
              etymology, mnemonic, difficulty, cefr_level, frequency_rank, source
       FROM words WHERE id = ? AND is_published = TRUE LIMIT 1`,
      [id],
    );
    if (!words[0]) return null;

    const [definitions] = await pool.query(
      `SELECT id, part_of_speech, definition, example, image_url
       FROM definitions WHERE word_id = ? ORDER BY sort_order`,
      [id],
    );
    const [synonyms] = await pool.query(
      `SELECT synonym FROM word_synonyms WHERE word_id = ?`, [id],
    );
    const [antonyms] = await pool.query(
      `SELECT antonym FROM word_antonyms WHERE word_id = ?`, [id],
    );
    const [tags] = await pool.query(
      `SELECT t.name FROM tags t INNER JOIN word_tags wt ON wt.tag_id = t.id WHERE wt.word_id = ?`,
      [id],
    );

    return {
      ...words[0],
      definitions,
      synonyms: synonyms.map((r) => r.synonym),
      antonyms: antonyms.map((r) => r.antonym),
      tags: tags.map((r) => r.name),
    };
  },
};
