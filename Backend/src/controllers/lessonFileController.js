// src/controllers/lessonFileController.js
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// GET /api/lesson-files/:lessonId — list all files for a lesson
const getFilesByLesson = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lessonId } = req.params;

        const result = await db.query(
            `SELECT * FROM lesson_files
             WHERE lesson_id = $1 AND user_id = $2
             ORDER BY created_at ASC`,
            [lessonId, userId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getFilesByLesson:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// POST /api/lesson-files/upload — upload a real file (Multer handles the disk save)
const uploadFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lesson_id } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' });
        }
        if (!lesson_id) {
            return res.status(400).json({ message: 'lesson_id is required' });
        }

        const name = req.file.originalname;
        const file_path = `uploads/${req.file.filename}`;

        const result = await db.query(
            `INSERT INTO lesson_files (lesson_id, user_id, type, name, file_path)
             VALUES ($1, $2, 'upload', $3, $4) RETURNING *`,
            [lesson_id, userId, name, file_path]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in uploadFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// POST /api/lesson-files — create a name-only record (AI-generated video/audio)
// When the AI model generates a file it calls this endpoint with the file_path included.
const createRecord = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { lesson_id, type, name, file_path } = req.body;

        if (!lesson_id || !type || !name) {
            return res.status(400).json({ message: 'lesson_id, type, and name are required' });
        }

        const result = await db.query(
            `INSERT INTO lesson_files (lesson_id, user_id, type, name, file_path)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [lesson_id, userId, type, name, file_path || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in createRecord:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// PUT /api/lesson-files/:id — rename a file record
const renameFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'name is required' });
        }

        const result = await db.query(
            `UPDATE lesson_files SET name = $1
             WHERE id = $2 AND user_id = $3 RETURNING *`,
            [name.trim(), id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in renameFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// DELETE /api/lesson-files/:id — delete record and remove file from disk
const deleteFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Fetch the record first to get the file_path
        const existing = await db.query(
            'SELECT * FROM lesson_files WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        const record = existing.rows[0];

        // Delete from DB
        await db.query('DELETE FROM lesson_files WHERE id = $1', [id]);

        // Remove physical file from disk if it exists
        if (record.file_path) {
            const fullPath = path.join(__dirname, '../../', record.file_path);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error in deleteFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getFilesByLesson,
    uploadFile,
    createRecord,
    renameFile,
    deleteFile,
};
