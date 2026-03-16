// src/routes/lessonRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAllLessons,
    getLessonById,
    createLesson,
    updateLesson,
    deleteLesson,
} = require('../controllers/lessonController');
const { protect } = require('../middleware/authMiddleware');

// All lesson routes require authentication
router.use(protect);

// GET /api/lessons
router.get('/', getAllLessons);

// GET /api/lessons/:id
router.get('/:id', getLessonById);

// POST /api/lessons
router.post('/', createLesson);

// PUT /api/lessons/:id
router.put('/:id', updateLesson);

// DELETE /api/lessons/:id
router.delete('/:id', deleteLesson);

module.exports = router;
