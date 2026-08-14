import { Request, Response } from 'express';
import pool from '../config/db';
import fs from 'fs';
import path from 'path';

export const saveBasicDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, employment, salary, loanAmount, purpose, runningLoan, email, officialEmail } = req.body;

    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    // 1. Create or update user_profiles (for personal_email)
    const profileQuery = `
      INSERT INTO user_profiles (user_id, personal_email) 
      VALUES (?, ?) 
      ON DUPLICATE KEY UPDATE 
      personal_email = VALUES(personal_email),
      updated_at = CURRENT_TIMESTAMP
    `;
    await pool.query(profileQuery, [userId, email]);

    // 2. Create or update employment_details (for employment_type, monthly_income, official_email)
    const empQuery = `
      INSERT INTO employment_details (user_id, employment_type, monthly_income, official_email) 
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      employment_type = VALUES(employment_type),
      monthly_income = VALUES(monthly_income),
      official_email = VALUES(official_email),
      updated_at = CURRENT_TIMESTAMP
    `;
    await pool.query(empQuery, [userId, employment, salary || 0, officialEmail]);

    // 3. Create or update applications
    const hasRunningLoan = runningLoan === 'yes' ? 1 : 0;
    
    // Check if an application already exists for this user (for simplicity, we'll assume 1 active application per user)
    const [appRows]: any = await pool.query('SELECT id FROM applications WHERE user_id = ?', [userId]);
    
    if (appRows.length > 0) {
      const updateAppQuery = `
        UPDATE applications 
        SET loan_amount = ?, loan_purpose = ?, existing_loan = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `;
      await pool.query(updateAppQuery, [loanAmount || 0, purpose, hasRunningLoan, userId]);
    } else {
      const insertAppQuery = `
        INSERT INTO applications (user_id, loan_amount, loan_purpose, existing_loan, status) 
        VALUES (?, ?, ?, ?, 'in review')
      `;
      await pool.query(insertAppQuery, [userId, loanAmount || 0, purpose, hasRunningLoan]);
    }

    res.status(200).json({ status: 'success', message: 'Basic details saved successfully' });
  } catch (error: any) {
    console.error('saveBasicDetails error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save basic details', error: error?.message });
  }
};

export const savePersonalDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, name, father, mother, dob, gender, marital, religion, education, address, city, state, pincode, rent, addressType } = req.body;

    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    const query = `
      INSERT INTO user_profiles (user_id, full_name, father_name, mother_name, dob, gender, marital_status, religion, education, address_type, address, city, state, pincode, rent_amount) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      full_name = VALUES(full_name),
      father_name = VALUES(father_name),
      mother_name = VALUES(mother_name),
      dob = VALUES(dob),
      gender = VALUES(gender),
      marital_status = VALUES(marital_status),
      religion = VALUES(religion),
      education = VALUES(education),
      address_type = VALUES(address_type),
      address = VALUES(address),
      city = VALUES(city),
      state = VALUES(state),
      pincode = VALUES(pincode),
      rent_amount = VALUES(rent_amount),
      updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [userId, name, father, mother, dob || null, gender, marital, religion, education, addressType, address, city, state, pincode, rent || 0]);

    res.status(200).json({ status: 'success', message: 'Personal details saved successfully' });
  } catch (error: any) {
    console.error('savePersonalDetails error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save personal details', error: error?.message });
  }
};

export const saveEmploymentDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, company, companyType, industry, role, salary, email, address, pincode, city, state, experience, salaryDate } = req.body;

    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    const query = `
      INSERT INTO employment_details (user_id, company_name, company_type, industry, role, monthly_income, official_email, work_address, work_pincode, work_city, work_state, experience_years, salary_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      company_name = VALUES(company_name),
      company_type = VALUES(company_type),
      industry = VALUES(industry),
      role = VALUES(role),
      monthly_income = VALUES(monthly_income),
      official_email = VALUES(official_email),
      work_address = VALUES(work_address),
      work_pincode = VALUES(work_pincode),
      work_city = VALUES(work_city),
      work_state = VALUES(work_state),
      experience_years = VALUES(experience_years),
      salary_date = VALUES(salary_date),
      updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [userId, company, companyType, industry, role, salary || 0, email, address, pincode || null, city || null, state || null, experience, salaryDate || null]);

    res.status(200).json({ status: 'success', message: 'Employment details saved successfully' });
  } catch (error: any) {
    console.error('saveEmploymentDetails error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save employment details', error: error?.message });
  }
};

export const saveBankDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, holder, bank, account, ifsc, branch, accountType, salaryAccount } = req.body;

    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    const isSalaryAccount = salaryAccount === 'yes' ? 1 : 0;

    const query = `
      INSERT INTO bank_details (user_id, account_type, is_salary_account, account_holder_name, bank_name, account_number, ifsc_code, branch_name) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      account_type = VALUES(account_type),
      is_salary_account = VALUES(is_salary_account),
      account_holder_name = VALUES(account_holder_name),
      bank_name = VALUES(bank_name),
      account_number = VALUES(account_number),
      ifsc_code = VALUES(ifsc_code),
      branch_name = VALUES(branch_name),
      updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [userId, accountType, isSalaryAccount, holder, bank, account, ifsc, branch]);

    res.status(200).json({ status: 'success', message: 'Bank details saved successfully' });
  } catch (error: any) {
    console.error('saveBankDetails error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save bank details', error: error?.message });
  }
};

export const saveReferenceDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, references } = req.body;

    if (!userId || !Array.isArray(references)) {
      res.status(400).json({ status: 'error', message: 'userId and references array are required' });
      return;
    }

    // First delete old references for this user to avoid duplicates if they submit again
    await pool.query('DELETE FROM references_details WHERE user_id = ?', [userId]);

    const query = `
      INSERT INTO references_details (user_id, reference_name, mobile_number, relationship) 
      VALUES (?, ?, ?, ?)
    `;
    
    for (const ref of references) {
      if (ref.name && ref.mobile && ref.relationship) {
        await pool.query(query, [userId, ref.name, ref.mobile, ref.relationship]);
      }
    }

    res.status(200).json({ status: 'success', message: 'Reference details saved successfully' });
  } catch (error: any) {
    console.error('saveReferenceDetails error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save reference details', error: error?.message });
  }
};

export const saveAadhaarDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, aadhaarNumber } = req.body;

    if (!userId || !aadhaarNumber) {
      res.status(400).json({ status: 'error', message: 'userId and aadhaarNumber are required' });
      return;
    }

    const query = `
      INSERT INTO aadhaar_card_details (user_id, aadhaar_number, verified_status) 
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE 
      aadhaar_number = VALUES(aadhaar_number),
      verified_status = 1,
      updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [userId, aadhaarNumber]);

    res.status(200).json({ status: 'success', message: 'Aadhaar details saved successfully' });
  } catch (error: any) {
    console.error('saveAadhaarDetails error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save Aadhaar details', error: error?.message });
  }
};

export const uploadSelfie = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, imageBase64 } = req.body;

    if (!userId || !imageBase64) {
      res.status(400).json({ status: 'error', message: 'userId and imageBase64 are required' });
      return;
    }

    // Strip prefix if present (e.g. data:image/jpeg;base64,)
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadsDir = path.join(__dirname, '../../uploads/selfies');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `selfie_${userId}_${Date.now()}.jpg`;
    const filePath = path.join(uploadsDir, fileName);
    
    fs.writeFileSync(filePath, buffer);

    const relativePath = `uploads/selfies/${fileName}`;

    const query = `
      INSERT INTO kyc_documents (user_id, selfie_path) 
      VALUES (?, ?)
    `;
    
    await pool.query(query, [userId, relativePath]);

    res.status(200).json({ status: 'success', message: 'Selfie uploaded successfully', path: relativePath });
  } catch (error: any) {
    console.error('uploadSelfie error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to upload selfie', error: error?.message });
  }
};

export const saveMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, ipAddress, browserInfo, deviceType, deviceModel, latitude, longitude } = req.body;

    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    const query = `
      INSERT INTO browser_info (user_id, ip_address, browser_info, device_type, device_model, latitude, longitude) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.query(query, [userId, ipAddress, browserInfo, deviceType, deviceModel, latitude, longitude]);
    
    // Application is complete, update status to pending
    await pool.query('UPDATE applications SET status = ? WHERE user_id = ? AND status = ?', ['pending', userId, 'in review']);

    res.status(200).json({ status: 'success', message: 'Metadata saved successfully' });
  } catch (error: any) {
    console.error('saveMetadata error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save metadata', error: error?.message });
  }
};

export const getUserData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    const [panRows]: any = await pool.query('SELECT api_response FROM pan_card_details WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
    const [aadhaarRows]: any = await pool.query('SELECT api_response FROM aadhaar_card_details WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);

    let panData = null;
    let aadhaarData = null;

    if (panRows.length > 0 && panRows[0].api_response) {
      try {
        panData = typeof panRows[0].api_response === 'string' ? JSON.parse(panRows[0].api_response) : panRows[0].api_response;
      } catch(e) {}
    }

    if (aadhaarRows.length > 0 && aadhaarRows[0].api_response) {
      try {
        aadhaarData = typeof aadhaarRows[0].api_response === 'string' ? JSON.parse(aadhaarRows[0].api_response) : aadhaarRows[0].api_response;
      } catch(e) {}
    }

    res.status(200).json({
      status: 'success',
      data: {
        pan: panData,
        aadhaar: aadhaarData
      }
    });

  } catch (error: any) {
    console.error('getUserData error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch user data' });
  }
};

export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ status: 'error', message: 'userId is required' });
      return;
    }

    const [apps]: any = await pool.query('SELECT * FROM applications WHERE user_id = ? ORDER BY id DESC', [userId]);
    const [profiles]: any = await pool.query('SELECT full_name, personal_email FROM user_profiles WHERE user_id = ?', [userId]);
    const [users]: any = await pool.query('SELECT mobile_number FROM users WHERE id = ?', [userId]);

    const profile = profiles[0] || {};
    const user = users[0] || {};

    const activeLoans = apps.map((app: any) => {
      const amount = Number(app.loan_amount) || 0;
      const interestRate = 8.5; // per annum
      const tenureDays = 45; // Default tenure
      // Total Repayment Calculation for 45 days (Amount + Interest)
      const interestAmount = amount > 0 ? (amount * (interestRate / 100)) * (tenureDays / 365) : 0;
      const totalRepayment = Math.round(amount + interestAmount);

      const createdAt = new Date(app.created_at || new Date());
      const nextRepaymentDate = new Date(createdAt);
      nextRepaymentDate.setDate(nextRepaymentDate.getDate() + 45);

      return {
        id: `LN-2026-${String(app.id).padStart(3, '0')}`,
        amount: amount,
        disbursedDate: createdAt.toISOString(),
        repaymentDate: nextRepaymentDate.toISOString(),
        repaymentAmount: totalRepayment,
        outstandingBalance: totalRepayment, 
        tenureTotal: tenureDays,
        tenurePaid: 0,
        status: 'active',
        isOverdue: false,
        purpose: app.loan_purpose || 'Personal Use',
        appStatus: app.status
      };
    });

    const dashboardData = {
      applicantName: profile.full_name || 'User',
      email: profile.personal_email || user.mobile_number || 'No Email',
      activeLoans,
      closedLoans: []
    };

    res.status(200).json({ status: 'success', data: dashboardData });
  } catch (error: any) {
    console.error('getDashboardData error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard data' });
  }
};

