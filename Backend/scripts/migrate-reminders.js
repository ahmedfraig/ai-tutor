// scripts/migrate-reminders.js
// Run once: node scripts/migrate-reminders.js
const db = require('../src/config/db');

async function migrate() {
    try {
        console.log('Running migration: create reminders table...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                remind_date DATE NOT NULL,
                notes       TEXT NOT NULL,
                created_at  TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('✅ reminders table created (or already exists).');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
