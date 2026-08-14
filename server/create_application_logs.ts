import pool from './src/config/db';

async function migrate() {
  try {
    console.log('Creating application_logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS application_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        telecaller_id INT DEFAULT NULL,
        action VARCHAR(255) NOT NULL,
        status VARCHAR(255),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (telecaller_id) REFERENCES telecallers(id) ON DELETE SET NULL
      )
    `);
    console.log('Table application_logs created successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
