// src/config/db.js
// Uses @neondatabase/serverless HTTP mode instead of WebSocket Pool.
// HTTP mode creates a fresh connection per query — immune to Neon's
// compute auto-suspend dropping WebSocket connections mid-session.
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

// Warm-up ping — verifies connectivity at startup without crashing on failure
sql`SELECT 1`
  .then(() => console.log('✅ Connected to Papyrus Cloud Database successfully'))
  .catch(err => console.error('❌ Database connection error:', err.message));

// Drop-in replacement for the previous pool.query(text, params) API.
// Converts positional $1/$2 params into the tagged-template format neon() expects.
const query = async (text, params = []) => {
  // neon() supports raw SQL via sql.query() which accepts the same (text, params) signature
  // This keeps all existing controller code unchanged.
  return sql.query(text, params);
};

module.exports = { query };