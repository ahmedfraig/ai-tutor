const db = require('./src/config/db');

async function migrateChat() {
  try {
    console.log("Creating chat_messages table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
          role VARCHAR(10) CHECK (role IN ('user', 'ai')),
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_lesson
          ON chat_messages (lesson_id, created_at ASC);
    `);
    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrateChat();
