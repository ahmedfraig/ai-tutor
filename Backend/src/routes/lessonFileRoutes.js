// src/routes/lessonFileRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');
const {
    getFilesByLesson,
    uploadFile,
    createRecord,
    renameFile,
    deleteFile,
    downloadFile,
} = require('../controllers/lessonFileController');

// --- Cloudinary Multer Config ---
const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        // Strip extension from filename for public_id (Cloudinary adds it via format)
        const originalName = file.originalname.replace(/\s+/g, '_');
        const ext = originalName.split('.').pop().toLowerCase();
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        const uniqueName = `${Date.now()}-${baseName}`;

        // PDFs: upload as 'image' type so Cloudinary serves them inline (not forced download)
        // Other files: upload as 'raw'
        const isPdf = ext === 'pdf';

        return {
            folder: 'papyrus',
            resource_type: isPdf ? 'image' : 'raw',
            type: 'upload',
            access_mode: 'public',
            format: ext,
            public_id: uniqueName,
        };
    },
});

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

// POST /api/lesson-files/upload     — upload a file to Cloudinary
router.post('/upload', upload.single('file'), uploadFile);

// POST /api/lesson-files            — create a name-only record (AI video/audio)
router.post('/', createRecord);

// PUT  /api/lesson-files/:id        — rename
router.put('/:id', renameFile);

// DELETE /api/lesson-files/:id      — delete record + Cloudinary asset
router.delete('/:id', deleteFile);

module.exports = router;
