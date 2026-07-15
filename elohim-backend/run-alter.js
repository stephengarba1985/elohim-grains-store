require('dotenv').config();
const fs = require('fs');
const pool = require('./src/config/db');

async function runSchema() {
  try {
    const sql = fs.readFileSync('./alter.sql', 'utf8');
    await pool.query(sql);
    console.log('Schema updated successfully');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    pool.end();
  }
}

runSchema();