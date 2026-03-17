// src/routes/lessonFileRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
    getFilesByLesson,
    uploadFile,
    createRecord,
    renameFile,
    deleteFile,
} = require('../controllers/lessonFileController');

// --- Multer Config ---
// Files are saved to Backend/uploads/ with a unique timestamped name
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
});

// All routes require authentication
router.use(protect);

// GET  /api/lesson-files/:lessonId  — list files for a lesson
router.get('/:lessonId', getFilesByLesson);

// POST /api/lesson-files/upload     — upload a real file (multipart/form-data)
router.post('/upload', upload.single('file'), uploadFile);

// POST /api/lesson-files            — create a name-only record (AI video/audio)
router.post('/', createRecord);

// PUT  /api/lesson-files/:id        — rename
router.put('/:id', renameFile);

// DELETE /api/lesson-files/:id      — delete record + file from disk
router.delete('/:id', deleteFile);

module.exports = router;
