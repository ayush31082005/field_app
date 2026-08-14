const pool = require('./src/config/db').default;

async function migrate() {
  try {
    console.log('Adding lead_source column...');
    await pool.query("ALTER TABLE users ADD COLUMN lead_source VARCHAR(100) DEFAULT 'Website'");
    console.log('Successfully added lead_source column.');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column lead_source already exists.');
    } else {
      console.error('Error during migration:', error);
    }
  } finally {
    process.exit(0);
  }
}

migrate();
