// scripts/migrate-lessons-user-id.js
// Run once: node scripts/migrate-lessons-user-id.js
const db = require('../src/config/db');

async function migrate() {
    try {
        console.log('Running migration: add user_id to lessons table...');

        // Add user_id column if it doesn't exist
        await db.query(`
            ALTER TABLE lessons
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        `);

        console.log('✅ user_id column added (or already exists) on lessons table.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
