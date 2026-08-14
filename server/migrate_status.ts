const pool = require('./src/config/db').default;

async function migrateStatus() {
  try {
    console.log('Altering applications status enum to include new values...');
    await pool.query("ALTER TABLE applications MODIFY status ENUM('draft', 'pending', 'approved', 'rejected', 'in review', 'loan reject') DEFAULT 'in review'");
    
    console.log('Updating existing statuses...');
    await pool.query("UPDATE applications SET status = 'in review' WHERE status = 'draft'");
    await pool.query("UPDATE applications SET status = 'loan reject' WHERE status = 'rejected'");
    
    console.log('Removing old values from enum...');
    await pool.query("ALTER TABLE applications MODIFY status ENUM('in review', 'pending', 'approved', 'loan reject') DEFAULT 'in review'");
    
    console.log('Successfully updated status stages.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    process.exit(0);
  }
}

migrateStatus();
