const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// LOW-2: Patch console.error in production to strip stack traces from logs.
// Must be called before routes load so all controllers are covered.
const { installProductionLogger } = require('./utils/logger');
installProductionLogger();

// ── Startup environment guard ─────────────────────────────────────────────
// Fail loudly if any critical secret is missing. This prevents the app from
// running with insecure fallback values (e.g. a hardcoded JWT secret).
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
    console.error(`\n[FATAL] Missing required environment variables: ${missingEnv.join(', ')}`);
    console.error('[FATAL] Set them in your .env file or deployment environment before starting the server.');
    process.exit(1);
}

// LOW-1: Warn in dev if CORS_ORIGIN is not set (in production this should be required).
if (!process.env.CORS_ORIGIN) {
    if (process.env.NODE_ENV === 'production') {
        console.error('[FATAL] CORS_ORIGIN must be set in production. Exiting.');
        process.exit(1);
    }
    console.warn('[WARN] CORS_ORIGIN not set — falling back to Vite dev origins only.');
}


const app = express();

// ── MED-4: Security headers (helmet) ─────────────────────────────────────
// Adds X-Content-Type-Options, X-Frame-Options, HSTS, CSP, and more.
app.use(helmet());

// MED-3: Parse cookies so authMiddleware can read the HttpOnly JWT cookie
app.use(cookieParser());

// ── MED-1: Rate limiting ──────────────────────────────────────────────────
// Auth endpoints: 10 requests per 15 minutes (brute-force / credential stuffing)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,  // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
    message: { message: 'Too many attempts from this IP. Please try again in 15 minutes.' },
});

// General API: 100 requests per minute (abuse / scraping protection)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' },
});

// CORS — credentials:true is required for the browser to send the HttpOnly auth cookie.
// With credentials:true, origin CANNOT be '*', so we use CORS_ORIGIN or the Vite dev default.
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: corsOrigins,
    credentials: true,
}));

// MED-2/3: Explicit JSON body size limit
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ────────────────────────────────────────────────────────────────
// Apply the strict limiter to auth before registering the routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authLimiter, authRoutes);

// Apply the general limiter to all other API routes
app.use('/api', apiLimiter);

const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

const lessonRoutes = require('./routes/lessonRoutes');
app.use('/api/lessons', lessonRoutes);

const userLessonRoutes = require('./routes/userLessonRoutes');
app.use('/api/user-lessons', userLessonRoutes);

const aiGenerationRoutes = require('./routes/aiGenerationRoutes');
app.use('/api/ai-generations', aiGenerationRoutes);

const reminderRoutes = require('./routes/reminderRoutes');
app.use('/api/reminders', reminderRoutes);

const lessonFileRoutes = require('./routes/lessonFileRoutes');
app.use('/api/lesson-files', lessonFileRoutes);

const studyDaysRoutes = require('./routes/studyDaysRoutes');
app.use('/api/study-days', studyDaysRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Papyrus Server running on port ${PORT}`);
});