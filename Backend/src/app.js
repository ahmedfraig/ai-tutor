const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

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


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Papyrus Server running on port ${PORT}`);
});