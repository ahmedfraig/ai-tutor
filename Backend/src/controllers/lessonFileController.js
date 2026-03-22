// src/controllers/lessonFileController.js
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');
const https = require('https');
const http = require('http');

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

// POST /api/lesson-files/upload — upload a file to Cloudinary
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
        // Store the plain Cloudinary URL — frontend handles display via Google Docs Viewer
        const file_path = req.file.path;

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

// Extract Cloudinary public_id from a full URL
// e.g. https://res.cloudinary.com/xxx/image/upload/v123/papyrus/abc.pdf → papyrus/abc
function extractPublicId(url) {
    if (!url) return null;
    try {
        const parts = url.split('/upload/');
        if (parts.length < 2) return null;
        // Remove version prefix (v1234567890/) and file extension
        const afterUpload = parts[1].replace(/^v\d+\//, '');
        return afterUpload.replace(/\.[^/.]+$/, '');
    } catch {
        return null;
    }
}

// DELETE /api/lesson-files/:id — delete record and remove file from Cloudinary
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

        // Delete from Cloudinary if it's a Cloudinary URL
        if (record.file_path && record.file_path.includes('cloudinary')) {
            const publicId = extractPublicId(record.file_path);
            if (publicId) {
                // Determine resource type from URL
                const resourceType = record.file_path.includes('/image/upload/') ? 'image' : 'raw';
                try {
                    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                } catch (cloudErr) {
                    console.error('Cloudinary delete error (non-fatal):', cloudErr.message);
                }
            }
        }

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error in deleteFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// GET /api/lesson-files/download/:id — proxy download with correct filename
const downloadFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await db.query(
            'SELECT * FROM lesson_files WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        const record = result.rows[0];
        if (!record.file_path) {
            return res.status(404).json({ message: 'No file available' });
        }

        // Strip any broken Cloudinary flags (attachment:false → filename becomes "false")
        const cleanUrl = record.file_path.replace(/\/fl_attachment[^/]*\//g, '/');

        // Use the original name stored in DB for the download filename
        const filename = record.name || 'download.pdf';
        const safeFilename = encodeURIComponent(filename);

        // Set headers so browser downloads with correct name
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${safeFilename}`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // Stream the file from Cloudinary to the client
        const protocol = cleanUrl.startsWith('https') ? https : http;
        protocol.get(cleanUrl, (fileRes) => {
            fileRes.pipe(res);
        }).on('error', (err) => {
            console.error('Proxy download error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Failed to download file' });
            }
        });

    } catch (error) {
        console.error('Error in downloadFile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getFilesByLesson,
    uploadFile,
    createRecord,
    renameFile,
    deleteFile,
    downloadFile,
};
