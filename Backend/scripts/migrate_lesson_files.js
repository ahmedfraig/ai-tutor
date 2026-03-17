// scripts/migrate_lesson_files.js
// Run this ONCE to create the lesson_files table in your Neon DB:
//   node scripts/migrate_lesson_files.js

const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE TABLE IF NOT EXISTS lesson_files (
    id        SERIAL PRIMARY KEY,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    user_id   INTEGER REFERENCES users(id)   ON DELETE CASCADE,
    type      VARCHAR(20) CHECK (type IN ('upload', 'video', 'audio')) NOT NULL,
    name      TEXT NOT NULL,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

(async () => {
    try {
        await pool.query(sql);
        console.log('✅ lesson_files table created successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
})();
