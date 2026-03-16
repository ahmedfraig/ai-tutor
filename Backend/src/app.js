const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Papyrus Server running on port ${PORT}`);
});