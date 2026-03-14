// src/controllers/aiGenerationController.js
const db = require('../config/db');

// GET /api/ai-generations - Get all AI generations for the logged-in user
const getAiGenerations = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { type } = req.query; // Optional filter: ?type=summary|quiz|exam

        let query = `
            SELECT ag.*, l.title AS lesson_title
            FROM ai_generations ag
            JOIN lessons l ON ag.lesson_id = l.id
            WHERE ag.user_id = $1
        `;
        const values = [userId];

        if (type) {
            query += ` AND ag.type = $2`;
            values.push(type);
        }

        query += ` ORDER BY ag.created_at DESC`;

        const result = await db.query(query, values);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getAiGenerations:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// GET /api/ai-generations/lesson/:lessonId - Get all AI generations for a specific lesson
const getAiGenerationsByLesson = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lessonId } = req.params;
        const { type } = req.query; // Optional filter: ?type=summary|quiz|exam

        let query = `
            SELECT ag.*, l.title AS lesson_title
            FROM ai_generations ag
            JOIN lessons l ON ag.lesson_id = l.id
            WHERE ag.user_id = $1 AND ag.lesson_id = $2
        `;
        const values = [userId, lessonId];

        if (type) {
            query += ` AND ag.type = $3`;
            values.push(type);
        }

        query += ` ORDER BY ag.created_at DESC`;

        const result = await db.query(query, values);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getAiGenerationsByLesson:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// GET /api/ai-generations/:id - Get a single AI generation by ID
const getAiGenerationById = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await db.query(
            `SELECT ag.*, l.title AS lesson_title
             FROM ai_generations ag
             JOIN lessons l ON ag.lesson_id = l.id
             WHERE ag.id = $1 AND ag.user_id = $2`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'AI generation not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in getAiGenerationById:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// POST /api/ai-generations - Create a new AI generation record
const createAiGeneration = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lesson_id, type, content } = req.body;

        // Validation
        if (!lesson_id || !type || !content) {
            return res.status(400).json({ message: 'lesson_id, type, and content are required' });
        }

        const validTypes = ['summary', 'quiz', 'exam'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ message: `type must be one of: ${validTypes.join(', ')}` });
        }

        // Check lesson exists
        const lessonCheck = await db.query('SELECT id FROM lessons WHERE id = $1', [lesson_id]);
        if (lessonCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        const result = await db.query(
            `INSERT INTO ai_generations (user_id, lesson_id, type, content)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, lesson_id, type, content]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in createAiGeneration:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// PUT /api/ai-generations/:id - Update an AI generation
const updateAiGeneration = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { type, content } = req.body;

        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (type !== undefined) {
            const validTypes = ['summary', 'quiz', 'exam'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({ message: `type must be one of: ${validTypes.join(', ')}` });
            }
            fields.push(`type = $${paramIndex++}`);
            values.push(type);
        }

        if (content !== undefined) {
            fields.push(`content = $${paramIndex++}`);
            values.push(content);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields provided to update' });
        }

        values.push(id, userId);

        const result = await db.query(
            `UPDATE ai_generations
             SET ${fields.join(', ')}
             WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'AI generation not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in updateAiGeneration:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// DELETE /api/ai-generations/:id - Delete an AI generation
const deleteAiGeneration = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM ai_generations WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'AI generation not found' });
        }

        res.status(200).json({ message: 'AI generation deleted successfully' });
    } catch (error) {
        console.error('Error in deleteAiGeneration:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAiGenerations,
    getAiGenerationsByLesson,
    getAiGenerationById,
    createAiGeneration,
    updateAiGeneration,
    deleteAiGeneration,
};
