const db = require("../config/db");

// CREATE Vocabulary
exports.createVocabulary = (req, res) => {
    const { word, meaning, example, topic_id } = req.body;

    const sql = `
        INSERT INTO Vocabulary(word, meaning, example, topic_id)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [word, meaning, example, topic_id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: "Create failed",
                    error: err
                });
            }

            res.status(201).json({
                message: "Vocabulary created successfully",
                id: result.insertId
            });
        }
    );
};

// READ All Vocabulary
exports.getAllVocabulary = (req, res) => {

    const sql = `
        SELECT v.*, t.topic_name
        FROM Vocabulary v
        LEFT JOIN Topics t
        ON v.topic_id = t.id
    `;

    db.query(sql, (err, result) => {

        if (err) {
            return res.status(500).json({
                message: "Get vocabulary failed",
                error: err
            });
        }

        res.status(200).json(result);
    });
};

// READ Vocabulary By ID
exports.getVocabularyById = (req, res) => {

    const id = req.params.id;

    const sql = `
        SELECT *
        FROM Vocabulary
        WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {

        if (err) {
            return res.status(500).json({
                message: "Get vocabulary failed",
                error: err
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                message: "Vocabulary not found"
            });
        }

        res.status(200).json(result[0]);
    });
};

// UPDATE Vocabulary
exports.updateVocabulary = (req, res) => {

    const id = req.params.id;

    const {
        word,
        meaning,
        example,
        topic_id
    } = req.body;

    const sql = `
        UPDATE Vocabulary
        SET word = ?,
            meaning = ?,
            example = ?,
            topic_id = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [word, meaning, example, topic_id, id],
        (err, result) => {

            if (err) {
                return res.status(500).json({
                    message: "Update failed",
                    error: err
                });
            }

            res.status(200).json({
                message: "Vocabulary updated successfully"
            });
        }
    );
};

// DELETE Vocabulary
exports.deleteVocabulary = (req, res) => {

    const id = req.params.id;

    const sql = `
        DELETE FROM Vocabulary
        WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {

        if (err) {
            return res.status(500).json({
                message: "Delete failed",
                error: err
            });
        }

        res.status(200).json({
            message: "Vocabulary deleted successfully"
        });
    });
};
