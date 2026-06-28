// src/routes/aiGenerationRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAiGenerations,
    getAiGenerationsByLesson,
    getAiGenerationById,
    createAiGeneration,
    updateAiGeneration,
    deleteAiGeneration,
    triggerAiGeneration,
    getAiGenerationStatus,
    chatWithAi,
    getChatHistory,
    generateAudio,
    prepareAudio,
    generateVideo,
    prepareVideo,
} = require('../controllers/aiGenerationController');
const { protect } = require('../middleware/authMiddleware');

// All AI generation routes require authentication
router.use(protect);

// ── AI Actions ──────────────────────────────────────────────────────────

// POST /api/ai-generations/trigger
// Calls the AI pipeline to generate summary, quiz, or exam for a lesson.
// Requires at least one uploaded file for the lesson (used as document source).
router.post('/trigger', triggerAiGeneration);

// POST /api/ai-generations/chat
// RAG-based AI Tutor chat — answers questions grounded in lesson documents.
router.post('/chat', chatWithAi);

// GET /api/ai-generations/chat/history/:lessonId
// Retrieves the chat history for a lesson from the database.
router.get('/chat/history/:lessonId', getChatHistory);

// POST /api/ai-generations/audio
// Creates an audio record for the lesson sidebar.
router.post('/audio', generateAudio);

// POST /api/ai-generations/audio/prepare
// Proxies to the pipeline's /pipeline/audio/prepare endpoint.
// Returns a fresh pre-signed S3 URL for audio playback.
router.post('/audio/prepare', prepareAudio);

// POST /api/ai-generations/video
// Creates a video record for the lesson sidebar.
router.post('/video', generateVideo);

// POST /api/ai-generations/video/prepare
// Proxies to the pipeline's /pipeline/video/prepare endpoint.
// Returns a fresh pre-signed S3 URL for video playback.
router.post('/video/prepare', prepareVideo);

// ── Status & Retrieval ──────────────────────────────────────────────────

// GET /api/ai-generations/status/:lessonId
// Returns which types (summary, quiz, exam) have been generated + pipeline health.
router.get('/status/:lessonId', getAiGenerationStatus);

// GET /api/ai-generations
// All generations for the logged-in user (supports ?type=summary|quiz|exam)
router.get('/', getAiGenerations);

// GET /api/ai-generations/lesson/:lessonId
// All generations for a specific lesson (supports ?type=...)
router.get('/lesson/:lessonId', getAiGenerationsByLesson);

// GET /api/ai-generations/:id
// Single generation by ID
router.get('/:id', getAiGenerationById);

// ── CRUD ────────────────────────────────────────────────────────────────

// POST /api/ai-generations — create a new AI generation record manually
router.post('/', createAiGeneration);

// PUT /api/ai-generations/:id — update content/type
router.put('/:id', updateAiGeneration);

// DELETE /api/ai-generations/:id — delete a generation record
router.delete('/:id', deleteAiGeneration);

module.exports = router;
