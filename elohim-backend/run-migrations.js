const pool = require('./src/config/db');
const fs = require('fs');

async function runMigrations() {
  try {
    console.log('Running database migrations...');

    const sql = fs.readFileSync('./alter.sql', 'utf8');
    const commands = sql.split(';').filter(cmd => cmd.trim().length > 0);

    for (const command of commands) {
      if (command.trim()) {
        console.log('Executing:', command.trim().substring(0, 60) + '...');
        try {
          await pool.query(command);
          console.log('✓ Success');
        } catch (err) {
          console.log('✗ Error:', err.message);
        }
      }
    }

    console.log('Migrations completed!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    pool.end();
  }
}

runMigrations();