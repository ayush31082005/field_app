-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS geetpay;
USE geetpay;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    lead_number VARCHAR(50) NOT NULL UNIQUE,
    mobile_number VARCHAR(15) NOT NULL UNIQUE,
    telecaller_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    loan_amount DECIMAL(10, 2) NOT NULL,
    loan_purpose VARCHAR(100) NOT NULL,
    existing_loan BOOLEAN DEFAULT FALSE,
    status ENUM('draft', 'pending', 'approved', 'rejected') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(100),
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    dob DATE,
    gender ENUM('Male', 'Female', 'Other'),
    marital_status VARCHAR(50),
    religion VARCHAR(50),
    education VARCHAR(100),
    address_type ENUM('own', 'rented'),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    rent_amount DECIMAL(10, 2),
    personal_email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. PAN Card Details
CREATE TABLE IF NOT EXISTS pan_card_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    pan_number VARCHAR(10) UNIQUE,
    pan_name VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    api_response JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4b. Aadhaar Card Details
CREATE TABLE IF NOT EXISTS aadhaar_card_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    aadhaar_number VARCHAR(12) UNIQUE,
    full_name VARCHAR(100),
    dob VARCHAR(20),
    gender VARCHAR(20),
    address TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    api_response JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4c. UAN Details
CREATE TABLE IF NOT EXISTS uan_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    uan VARCHAR(20) UNIQUE,
    employer_name VARCHAR(150),
    claim_status VARCHAR(50),
    kyc_status VARCHAR(50),
    employment_type VARCHAR(50),
    designation VARCHAR(100),
    joined_on VARCHAR(20),
    office_location VARCHAR(150),
    employee_status VARCHAR(50),
    previous_employer VARCHAR(150),
    is_verified BOOLEAN DEFAULT FALSE,
    api_response JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4d. Credit Report Details
CREATE TABLE IF NOT EXISTS credit_report_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    cibil_score INT,
    total_accounts INT,
    active_accounts INT,
    api_response JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Employment Details Table
CREATE TABLE IF NOT EXISTS employment_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    employment_type ENUM('salaried', 'self-employed'),
    company_name VARCHAR(150),
    company_type VARCHAR(100),
    industry VARCHAR(100),
    role VARCHAR(100),
    monthly_income DECIMAL(10, 2),
    official_email VARCHAR(150),
    work_address TEXT,
    work_pincode VARCHAR(10),
    work_city VARCHAR(100),
    work_state VARCHAR(100),
    experience_years VARCHAR(50),
    salary_date INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Bank Details Table
CREATE TABLE IF NOT EXISTS bank_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    account_type VARCHAR(50),
    is_salary_account BOOLEAN,
    account_holder_name VARCHAR(150),
    bank_name VARCHAR(150),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),
    branch_name VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. References Table
CREATE TABLE IF NOT EXISTS references_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    reference_name VARCHAR(100),
    mobile_number VARCHAR(15),
    relationship VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. OTP Requests Table
CREATE TABLE IF NOT EXISTS otp_requests (
    mobile_number VARCHAR(15) PRIMARY KEY,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. KYC Documents Table
CREATE TABLE IF NOT EXISTS kyc_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    selfie_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Browser Info Table
CREATE TABLE IF NOT EXISTS browser_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    browser_info TEXT,
    device_type VARCHAR(100),
    device_model VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 11. Telecallers Table
CREATE TABLE IF NOT EXISTS telecallers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    secure_pin VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 12. Telecaller Logs Table
CREATE TABLE IF NOT EXISTS telecaller_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telecaller_id INT NOT NULL,
    action ENUM('login', 'logout') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telecaller_id) REFERENCES telecallers(id) ON DELETE CASCADE
);

-- 13. Telecaller Lead Details
CREATE TABLE IF NOT EXISTS telecaller_details (
  user_id INT PRIMARY KEY,
  file_stage VARCHAR(100),
  customer_status VARCHAR(100),
  last_contact VARCHAR(100),
  salary_on_time VARCHAR(20),
  delay_in_other_loans VARCHAR(20),
  salary_submit_status VARCHAR(100),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 14. Telecaller Follow-ups
CREATE TABLE IF NOT EXISTS telecaller_follow_ups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scheduled_on VARCHAR(50),
  initiated_on VARCHAR(50),
  followed_by VARCHAR(100),
  mode VARCHAR(50),
  note TEXT,
  status VARCHAR(50),
  next_action VARCHAR(200),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 15. Telecaller Share Links
CREATE TABLE IF NOT EXISTS telecaller_share_links (
  id VARCHAR(100) PRIMARY KEY,
  user_id INT NOT NULL,
  doc_types JSON,
  status VARCHAR(50),
  created_on VARCHAR(50),
  link VARCHAR(255),
  enabled BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 16. Telecaller Missing Docs
CREATE TABLE IF NOT EXISTS telecaller_missing_docs (
  id VARCHAR(100) PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100),
  status VARCHAR(50),
  requested_on VARCHAR(50),
  customer_update VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 17. Telecaller Notes
CREATE TABLE IF NOT EXISTS telecaller_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  text TEXT,
  created_on VARCHAR(50),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 18. Telecaller Salary Credits
CREATE TABLE IF NOT EXISTS telecaller_salary_credits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date VARCHAR(50),
  amount DECIMAL(10,2),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 19. Telecaller Recovery History
CREATE TABLE IF NOT EXISTS telecaller_recovery_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date VARCHAR(50),
  description VARCHAR(255),
  amount DECIMAL(10,2),
  status VARCHAR(50),
  type VARCHAR(50),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 20. Telecaller New Payments
CREATE TABLE IF NOT EXISTS telecaller_new_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date VARCHAR(50),
  amount DECIMAL(10,2),
  method VARCHAR(100),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add foreign key to users table for telecaller
ALTER TABLE users ADD FOREIGN KEY (telecaller_id) REFERENCES telecallers(id) ON DELETE SET NULL;

-- FCU dashboard users. Accounts are created through the API (for example, Postman).
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
);

CREATE TABLE IF NOT EXISTS fcu_document_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  document_id VARCHAR(50) NOT NULL,
  status ENUM('APPROVED', 'REJECTED') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_application_document (application_id, document_id),
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS fcu_login_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fcu_user_id INT NOT NULL,
  action ENUM('login', 'logout') NOT NULL,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fcu_activity_user_date (fcu_user_id, created_at),
  FOREIGN KEY (fcu_user_id) REFERENCES fcu_users(id) ON DELETE CASCADE
);

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
);

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
);

CREATE TABLE IF NOT EXISTS fcu_field_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL UNIQUE,
  residence_data JSON NOT NULL,
  office_data JSON NOT NULL,
  assignment_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  assigned_to VARCHAR(150) NULL,
  assigned_by INT NULL,
  assigned_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
