import crypto from 'crypto';
import pool from '../src/config/db';

const cases = [
  { lead: 'FCU-SEED-1001', mobile: '9000011001', name: 'Rohan Verma', email: 'rohan.verma@test.in', amount: 75000, purpose: 'Personal Loan', city: 'Lucknow', state: 'Uttar Pradesh', company: 'Nova Retail Pvt Ltd', income: 42000, pan: 'ABCDE1001F', aadhaar: '700000001001', cibil: 728, bank: 'HDFC Bank' },
  { lead: 'FCU-SEED-1002', mobile: '9000011002', name: 'Neha Singh', email: 'neha.singh@test.in', amount: 120000, purpose: 'Education', city: 'New Delhi', state: 'Delhi', company: 'Bright Learning', income: 52000, pan: 'ABCDE1002G', aadhaar: '700000001002', cibil: 746, bank: 'ICICI Bank' },
  { lead: 'FCU-SEED-1003', mobile: '9000011003', name: 'Amit Kumar', email: 'amit.kumar@test.in', amount: 90000, purpose: 'Business', city: 'Varanasi', state: 'Uttar Pradesh', company: 'Kumar Enterprises', income: 48000, pan: 'ABCDE1003H', aadhaar: '700000001003', cibil: 701, bank: 'State Bank of India' },
  { lead: 'FCU-SEED-1004', mobile: '9000011004', name: 'Pooja Sharma', email: 'pooja.sharma@test.in', amount: 60000, purpose: 'Medical', city: 'Jaipur', state: 'Rajasthan', company: 'Care Health Services', income: 38000, pan: 'ABCDE1004J', aadhaar: '700000001004', cibil: 719, bank: 'Axis Bank' },
];

const seed = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of cases) {
      const [existing]: any = await connection.query('SELECT id FROM users WHERE lead_number = ? LIMIT 1', [item.lead]);
      let userId = existing[0]?.id;
      if (!userId) {
        const [userResult]: any = await connection.query(
          'INSERT INTO users (uuid, lead_number, mobile_number, lead_source) VALUES (?, ?, ?, ?)',
          [crypto.randomUUID(), item.lead, item.mobile, 'FCU Test Seed']
        );
        userId = userResult.insertId;
      }

      await connection.query(`INSERT INTO user_profiles
        (user_id, full_name, dob, gender, marital_status, address_type, address, city, state, pincode, personal_email)
        VALUES (?, ?, '1994-05-15', 'Male', 'Single', 'rented', ?, ?, ?, '226010', ?)
        ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), personal_email=VALUES(personal_email), city=VALUES(city), state=VALUES(state)`,
        [userId, item.name, `Test address, ${item.city}`, item.city, item.state, item.email]);

      await connection.query(`INSERT INTO employment_details
        (user_id, employment_type, company_name, role, monthly_income, official_email, work_address, work_city, work_state)
        VALUES (?, 'salaried', ?, 'Executive', ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), monthly_income=VALUES(monthly_income), work_city=VALUES(work_city), work_state=VALUES(work_state)`,
        [userId, item.company, item.income, item.email, `${item.company}, ${item.city}`, item.city, item.state]);

      await connection.query(`INSERT INTO pan_card_details (user_id, pan_number, pan_name, is_verified)
        VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE pan_name=VALUES(pan_name), is_verified=1`, [userId, item.pan, item.name]);
      await connection.query(`INSERT INTO aadhaar_card_details (user_id, aadhaar_number, full_name, is_verified)
        VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), is_verified=1`, [userId, item.aadhaar, item.name]);
      await connection.query(`INSERT INTO credit_report_details (user_id, cibil_score, total_accounts, active_accounts)
        VALUES (?, ?, 3, 1) ON DUPLICATE KEY UPDATE cibil_score=VALUES(cibil_score)`, [userId, item.cibil]);
      await connection.query(`INSERT INTO bank_details
        (user_id, account_type, is_salary_account, account_holder_name, bank_name, account_number, ifsc_code, branch_name)
        VALUES (?, 'Savings', 1, ?, ?, ?, 'TEST0001001', ?)
        ON DUPLICATE KEY UPDATE bank_name=VALUES(bank_name), account_holder_name=VALUES(account_holder_name)`,
        [userId, item.name, item.bank, `100000${userId}`, item.city]);

      const [application]: any = await connection.query('SELECT id FROM applications WHERE user_id = ? LIMIT 1', [userId]);
      if (!application.length) {
        await connection.query(
          `INSERT INTO applications (user_id, loan_amount, loan_purpose, existing_loan, status)
           VALUES (?, ?, ?, 0, 'pending')`,
          [userId, item.amount, item.purpose]
        );
      }
    }
    await connection.commit();
    console.log(`Seeded ${cases.length} FCU new applications successfully.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
};

seed().catch(error => {
  console.error('FCU seed failed:', error);
  process.exit(1);
});
