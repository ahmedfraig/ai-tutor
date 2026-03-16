// src/routes/userLessonRoutes.js
const express = require('express');
const router = express.Router();
const {
    getUserLessons,
    getUserLessonByLesson,
    createUserLesson,
    updateUserLesson,
    deleteUserLesson,
} = require('../controllers/userLessonController');
const { protect } = require('../middleware/authMiddleware');

// All user-lesson routes require authentication
router.use(protect);

// GET /api/user-lessons  - all tracking records for logged-in user
router.get('/', getUserLessons);

// GET /api/user-lessons/:lessonId  - tracking record for one lesson
router.get('/:lessonId', getUserLessonByLesson);

// POST /api/user-lessons/:lessonId  - start tracking a lesson
router.post('/:lessonId', createUserLesson);

// PUT /api/user-lessons/:lessonId  - update tracking data
router.put('/:lessonId', updateUserLesson);

// DELETE /api/user-lessons/:lessonId  - remove tracking record
router.delete('/:lessonId', deleteUserLesson);

module.exports = router;
