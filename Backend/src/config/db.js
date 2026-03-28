// src/config/db.js
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(client => {
    console.log('✅ Connected to Papyrus Cloud Database successfully');
    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.stack);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
};