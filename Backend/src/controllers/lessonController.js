// src/controllers/lessonController.js
const db = require('../config/db');

// GET /api/lessons - Get all lessons
const getAllLessons = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM lessons ORDER BY created_at DESC'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getAllLessons:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// GET /api/lessons/:id - Get a single lesson by ID
const getLessonById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM lessons WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in getLessonById:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// POST /api/lessons - Create a new lesson
const createLesson = async (req, res) => {
    try {
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Title is required' });
        }

        const result = await db.query(
            'INSERT INTO lessons (title) VALUES ($1) RETURNING *',
            [title]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in createLesson:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// PUT /api/lessons/:id - Update a lesson
const updateLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Title is required' });
        }

        const result = await db.query(
            'UPDATE lessons SET title = $1 WHERE id = $2 RETURNING *',
            [title, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in updateLesson:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// DELETE /api/lessons/:id - Delete a lesson
const deleteLesson = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM lessons WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        res.status(200).json({ message: 'Lesson deleted successfully' });
    } catch (error) {
        console.error('Error in deleteLesson:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllLessons,
    getLessonById,
    createLesson,
    updateLesson,
    deleteLesson,
};
