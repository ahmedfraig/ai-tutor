// src/routes/lessonFileRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
    getFilesByLesson,
    uploadFile,
    createRecord,
    renameFile,
    deleteFile,
    downloadFile,
} = require('../controllers/lessonFileController');

// --- Multer in-memory storage (buffer passed to Google Drive uploader) ---
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
});

// All routes require authentication
router.use(protect);

// GET  /api/lesson-files/download/:id  — proxy download with correct filename
router.get('/download/:id', downloadFile);

// GET  /api/lesson-files/:lessonId  — list files for a lesson
router.get('/:lessonId', getFilesByLesson);

// POST /api/lesson-files/upload     — upload a file to Google Drive
router.post('/upload', upload.single('file'), uploadFile);

// POST /api/lesson-files            — create a name-only record (AI video/audio)
router.post('/', createRecord);

// PUT  /api/lesson-files/:id        — rename
router.put('/:id', renameFile);

// DELETE /api/lesson-files/:id      — delete record + Google Drive file
router.delete('/:id', deleteFile);

module.exports = router;
