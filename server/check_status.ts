import pool from './src/config/db';

async function check() {
  const [rows] = await pool.query('SHOW COLUMNS FROM applications WHERE Field = "status"');
  console.log(rows);
  process.exit(0);
}
check();
