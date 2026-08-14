// trigger nodemon restart
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import pool from './config/db';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

import path from 'path';

const sharedFieldUploadDirectory = process.env.FIELD_VERIFICATION_UPLOAD_DIR
  || path.resolve(__dirname, '../../../mobile app/server/uploads/field-verification');
app.use('/uploads/field-verification', express.static(sharedFieldUploadDirectory));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8443',
  'https://field-app-6q75.vercel.app',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '7mb' }));
app.use(cookieParser());

import authRoutes from './routes/authRoutes';
import enrichmentRoutes from './routes/enrichmentRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import telecallerRoutes from './telecaller/routes';
import fcuRoutes from './routes/fcuRoutes/fcuRoutes';
import fieldAuthRoutes from './routes/fieldRoutes/authRoutes';
app.use('/api/auth', authRoutes);
app.use('/api/enrichment', enrichmentRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/telecaller', telecallerRoutes);
app.use('/api/fcu/auth', fcuRoutes);
app.use('/api/field/auth', fieldAuthRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'success', message: 'API is running & DB is connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

const startServer = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL DEFAULT 'FCU Officer',
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_document_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        document_id VARCHAR(50) NOT NULL,
        status ENUM('APPROVED', 'REJECTED') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_application_document (application_id, document_id),
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_case_workflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL UNIQUE,
        stage ENUM('DOCUMENT_REVIEW', 'FCU_APPROVED', 'FIELD_ASSIGNED', 'FIELD_WAIVED', 'FINALIZED') NOT NULL DEFAULT 'DOCUMENT_REVIEW',
        case_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        reviewed_by INT NULL,
        field_assigned_to VARCHAR(150) NULL,
        field_assigned_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES fcu_users(id) ON DELETE SET NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_login_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fcu_user_id INT NOT NULL,
        action ENUM('login', 'logout') NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fcu_activity_user_date (fcu_user_id, created_at),
        FOREIGN KEY (fcu_user_id) REFERENCES fcu_users(id) ON DELETE CASCADE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_document_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        status ENUM('ACTIVE', 'COMPLETED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
        expires_at TIMESTAMP NOT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_fcu_document_request_application (application_id, created_at),
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES fcu_users(id) ON DELETE SET NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_requested_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        document_name VARCHAR(120) NOT NULL,
        status ENUM('PENDING', 'UPLOADED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        file_name VARCHAR(255) NULL,
        file_path VARCHAR(500) NULL,
        uploaded_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_fcu_requested_document (request_id, document_name),
        FOREIGN KEY (request_id) REFERENCES fcu_document_requests(id) ON DELETE CASCADE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_field_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL UNIQUE,
        residence_data JSON NOT NULL,
        office_data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcu_case_locks (
        application_id INT PRIMARY KEY,
        fcu_user_id INT NULL,
        locked_at TIMESTAMP NULL,
        heartbeat_at TIMESTAMP NULL,
        lock_expires_at TIMESTAMP NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
        FOREIGN KEY (fcu_user_id) REFERENCES fcu_users(id) ON DELETE SET NULL
      )
    `);
    await pool.query(`INSERT IGNORE INTO fcu_case_locks (application_id) SELECT id FROM applications`);
    await pool.query(`CREATE TABLE IF NOT EXISTS fcu_case_history (
      id INT AUTO_INCREMENT PRIMARY KEY, application_id INT NOT NULL, event_type VARCHAR(50) NOT NULL,
      title VARCHAR(180) NOT NULL, description TEXT NULL, performed_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fcu_history_app_date (application_id, created_at),
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
      FOREIGN KEY (performed_by) REFERENCES fcu_users(id) ON DELETE SET NULL
    )`);
    await pool.query(`INSERT INTO fcu_case_history (application_id,event_type,title,description,created_at)
      SELECT a.id,'APPLICATION_CREATED','Application submitted',CONCAT('Application created with status ',UPPER(a.status)),a.created_at
      FROM applications a WHERE NOT EXISTS (SELECT 1 FROM fcu_case_history h WHERE h.application_id=a.id AND h.event_type='APPLICATION_CREATED')`);
    for (const alter of [
      "ALTER TABLE fcu_field_verifications ADD COLUMN assignment_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'",
      'ALTER TABLE fcu_field_verifications ADD COLUMN assigned_to VARCHAR(150) NULL',
      'ALTER TABLE fcu_field_verifications ADD COLUMN assigned_by INT NULL',
      'ALTER TABLE fcu_field_verifications ADD COLUMN assigned_at TIMESTAMP NULL',
      'ALTER TABLE fcu_field_verifications ADD COLUMN assigned_field_user_id INT NULL',
      'ALTER TABLE fcu_field_verifications ADD COLUMN claimed_at TIMESTAMP NULL',
    ]) {
      try { await pool.query(alter); } catch (error: any) { if (error?.code !== 'ER_DUP_FIELDNAME') throw error; }
    }
    await pool.query(`
      UPDATE fcu_field_verifications
      SET assignment_status = 'ASSIGNED'
      WHERE assignment_status = 'PENDING' AND assigned_field_user_id IS NULL
    `);
    await pool.query(`
      INSERT IGNORE INTO fcu_field_verifications (application_id, residence_data, office_data)
      SELECT
        a.id,
        JSON_OBJECT(
          'initiatedOn', DATE_FORMAT(COALESCE(a.created_at, NOW()), '%d %b %Y'),
          'metWith', COALESCE(up.full_name, 'Applicant'),
          'residenceType', COALESCE(up.address_type, 'Owned'),
          'easeOfIdentification', 'Easy',
          'residingSince', '5 years',
          'earningMembers', '2',
          'neighbourCheck', 'Positive',
          'visitOn', DATE_FORMAT(DATE_ADD(COALESCE(a.created_at, NOW()), INTERVAL 2 DAY), '%d %b %Y'),
          'documentVerified', 'Aadhaar and address proof',
          'receivedOn', DATE_FORMAT(DATE_ADD(COALESCE(a.created_at, NOW()), INTERVAL 2 DAY), '%d %b %Y'),
          'relation', 'Self',
          'houseType', 'Independent house',
          'locality', COALESCE(up.city, 'Local area'),
          'totalMembers', '4',
          'livingStandard', 'Good',
          'geoCoordinates', CONCAT(COALESCE(bi.latitude, '26.9124'), ', ', COALESCE(bi.longitude, '75.7873')),
          'remarks', 'Residence details verified successfully.',
          'photo', 'Residence photo captured',
          'reportStatus', 'VERIFIED'
        ),
        JSON_OBJECT(
          'initiatedOn', DATE_FORMAT(COALESCE(a.created_at, NOW()), '%d %b %Y'),
          'metWith', 'HR / Reporting Manager',
          'entryAllowed', 'Yes',
          'signboardSighted', 'Yes',
          'staffSighted', '18',
          'employedSince', '3 years',
          'visitOn', DATE_FORMAT(DATE_ADD(COALESCE(a.created_at, NOW()), INTERVAL 3 DAY), '%d %b %Y'),
          'documentVerified', 'Employee ID and salary proof',
          'reportStatus', 'VERIFIED',
          'receivedOn', DATE_FORMAT(DATE_ADD(COALESCE(a.created_at, NOW()), INTERVAL 3 DAY), '%d %b %Y'),
          'relation', 'Employer',
          'employerName', COALESCE(ed.company_name, 'Self Employed'),
          'locality', COALESCE(ed.work_city, up.city, 'Business area'),
          'employeeStrength', '25+',
          'geoCoordinates', CONCAT(COALESCE(bi.latitude, '26.9124'), ', ', COALESCE(bi.longitude, '75.7873')),
          'remarks', 'Office and employment details verified.',
          'photo', 'Office photo captured'
        )
      FROM applications a
      INNER JOIN users u ON u.id = a.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN employment_details ed ON ed.user_id = u.id
      LEFT JOIN browser_info bi ON bi.id = (SELECT bi2.id FROM browser_info bi2 WHERE bi2.user_id = u.id ORDER BY bi2.id DESC LIMIT 1)
    `);
    console.log('FCU authentication and workflow tables are ready.');
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error: any) {
    console.error('Server startup failed because the database schema could not be prepared:', {
      code: error?.code,
      message: error?.message || String(error),
    });
    process.exit(1);
  }
};

// Vercel invokes the exported Express app as a serverless handler. Locally,
// nodemon/Node still starts the regular HTTP listener and prepares the schema.
if (!process.env.VERCEL) startServer();

export default app;

