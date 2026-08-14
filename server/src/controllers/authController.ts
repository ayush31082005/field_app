import { Request, Response } from 'express';
import pool from '../config/db';
import { sendWhatsAppOTP } from '../utils/whatsapp';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Send OTP function
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mobile, isLogin } = req.body;

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      res.status(400).json({ status: 'error', message: 'Valid 10-digit mobile number is required' });
      return;
    }

    if (isLogin) {
      const [userRows]: any = await pool.query('SELECT id FROM users WHERE mobile_number = ?', [mobile]);
      if (userRows.length === 0) {
        res.status(404).json({ status: 'error', message: 'You need to register first. Please apply for a loan.' });
        return;
      }
    }

    // Generate a 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes expiry

    // Save to otp_requests table
    const query = `
      INSERT INTO otp_requests (mobile_number, otp, expires_at) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP
    `;
    await pool.query(query, [mobile, otp, expiresAt]);

    console.log('\n=============================================');
    console.log(` 🔑 OTP for ${mobile} is: ${otp} `);
    console.log('=============================================\n');

    // Send WhatsApp OTP
    await sendWhatsAppOTP(mobile, otp);

    // For development, we return the OTP in the response (useful if WhatsApp API is delayed/out of balance)
    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully to WhatsApp',
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp })
    });
  } catch (error) {
    console.error('sendOtp error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send OTP' });
  }
};

// Verify OTP function
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mobile, otp, isLogin, leadSource = 'Website' } = req.body;

    if (!mobile || !otp) {
      res.status(400).json({ status: 'error', message: 'Mobile and OTP are required' });
      return;
    }

    const [rows]: any = await pool.query(
      'SELECT otp, expires_at FROM otp_requests WHERE mobile_number = ?',
      [mobile]
    );

    if (rows.length === 0) {
      res.status(400).json({ status: 'error', message: 'No OTP requested for this mobile number' });
      return;
    }

    const request = rows[0];

    // Check expiration
    if (new Date() > new Date(request.expires_at)) {
      res.status(400).json({ status: 'error', message: 'OTP has expired' });
      return;
    }

    // Check OTP match
    if (request.otp !== otp.toString()) {
      res.status(400).json({ status: 'error', message: 'Invalid OTP' });
      return;
    }

    // Remove the OTP now that it has been verified
    await pool.query('DELETE FROM otp_requests WHERE mobile_number = ?', [mobile]);

    // Create or find user
    const [userRows]: any = await pool.query('SELECT id, uuid, lead_number FROM users WHERE mobile_number = ?', [mobile]);
    let user = userRows[0];

    if (!user) {
      if (isLogin) {
        res.status(404).json({ status: 'error', message: 'You need to register first. Please apply for a loan.' });
        return;
      }

      const uuid = crypto.randomUUID();
      const leadNumber = `GP-LEAD-${Math.floor(1000 + Math.random() * 9000)}`; // Simple lead number generation

      const [insertResult]: any = await pool.query(
        'INSERT INTO users (mobile_number, uuid, lead_number, lead_source) VALUES (?, ?, ?, ?)',
        [mobile, uuid, leadNumber, leadSource]
      );

      user = {
        id: insertResult.insertId,
        uuid,
        lead_number: leadNumber,
        mobile_number: mobile
      };
    }

    let nextRoute = '/basic-details';

    // Check Basic Details (applications table)
    const [appRows]: any = await pool.query('SELECT id, status FROM applications WHERE user_id = ? ORDER BY id DESC LIMIT 1', [user.id]);
    
    if (appRows.length > 0) {
      const appStatus = appRows[0].status;
      
      // If application is already submitted, skip onboarding checks
      if (appStatus === 'approved') {
        nextRoute = '/user-dashboard';
      } else if (appStatus !== 'in review') {
        // Includes 'pending', 'loan reject', etc.
        nextRoute = '/loan-dashboard';
      } else {
        // Application is still in review, determine where they left off
        nextRoute = '/pan-verification';

        // Check PAN Verification (pan_card_details table)
        const [panRows]: any = await pool.query('SELECT id FROM pan_card_details WHERE user_id = ? AND is_verified = 1', [user.id]);
        if (panRows.length > 0) {
          nextRoute = '/aadhaar-verification';

          // Check Aadhaar Verification (aadhaar_card_details table)
          const [aadhaarRows]: any = await pool.query('SELECT id FROM aadhaar_card_details WHERE user_id = ?', [user.id]);
          if (aadhaarRows.length > 0) {
            nextRoute = '/personal-details';

            // Check Personal Details (user_profiles table)
            const [profileRows]: any = await pool.query('SELECT address FROM user_profiles WHERE user_id = ? AND address IS NOT NULL', [user.id]);
            if (profileRows.length > 0) {
              nextRoute = '/employment-details';

              // Check Employment Details (employment_details table)
              const [empRows]: any = await pool.query('SELECT company_name FROM employment_details WHERE user_id = ? AND company_name IS NOT NULL', [user.id]);
              if (empRows.length > 0) {
                nextRoute = '/bank-details';

                // Check Bank Details (bank_details table)
                const [bankRows]: any = await pool.query('SELECT id FROM bank_details WHERE user_id = ?', [user.id]);
                if (bankRows.length > 0) {
                  nextRoute = '/reference-details';

                  // Check Reference Details (references_details table)
                  const [refRows]: any = await pool.query('SELECT id FROM references_details WHERE user_id = ?', [user.id]);
                  if (refRows.length > 0) {
                    nextRoute = '/kcy-verification';

                    // Check KYC Verification (kyc_documents table)
                    const [kycRows]: any = await pool.query('SELECT id FROM kcy_documents WHERE user_id = ?', [user.id]).catch(() => [[]]); // Handle table name typo fallback
                    const [kycRows2]: any = await pool.query('SELECT id FROM kyc_documents WHERE user_id = ?', [user.id]);
                    if (kycRows.length > 0 || kycRows2.length > 0) {
                      nextRoute = '/loan-dashboard';
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Generate JWT token (15 mins expiry)
    const token = jwt.sign(
      { userId: user.id, uuid: user.uuid },
      process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!',
      { expiresIn: '15m' }
    );

    // Set JWT in HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully',
      data: {
        userId: user.id,
        uuid: user.uuid,
        leadNumber: user.lead_number,
        nextRoute
      }
    });
  } catch (error) {
    console.error('verifyOtp error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify OTP' });
  }
};

// Send Status OTP (using mobile number or application ID)
export const sendStatusOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      res.status(400).json({ status: 'error', message: 'Mobile number or Application ID is required' });
      return;
    }

    let userQuery = '';
    let queryParams: any[] = [];

    if (identifier.toUpperCase().startsWith('LN-2026-')) {
      const appId = parseInt(identifier.split('-')[2], 10);
      userQuery = `
        SELECT u.id, u.mobile_number FROM users u
        JOIN applications a ON u.id = a.user_id
        WHERE a.id = ?
      `;
      queryParams = [appId];
    } else if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(identifier)) {
      userQuery = `
        SELECT u.id, u.mobile_number FROM users u
        JOIN pan_card_details p ON u.id = p.user_id
        WHERE p.pan_number = ?
      `;
      queryParams = [identifier.toUpperCase()];
    } else {
      userQuery = 'SELECT id, mobile_number FROM users WHERE mobile_number = ?';
      queryParams = [identifier];
    }

    const [rows]: any = await pool.query(userQuery, queryParams);

    if (rows.length === 0) {
      res.status(404).json({ status: 'error', message: 'No application found with this identifier' });
      return;
    }

    const user = rows[0];
    const mobile = user.mobile_number;

    // Generate a 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes expiry

    // Save to otp_requests table
    const query = `
      INSERT INTO otp_requests (mobile_number, otp, expires_at) 
      VALUES (?, ?, ?) 
      ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP
    `;
    await pool.query(query, [mobile, otp, expiresAt]);

    // Send WhatsApp OTP
    await sendWhatsAppOTP(mobile, otp);

    const maskedMobile = mobile.substring(0, 2) + '******' + mobile.substring(8);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully',
      data: {
        maskedMobile
      }
    });
  } catch (error) {
    console.error('sendStatusOtp error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send OTP' });
  }
};

// Verify Status OTP
export const verifyStatusOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      res.status(400).json({ status: 'error', message: 'Identifier and OTP are required' });
      return;
    }

    let userQuery = '';
    let queryParams: any[] = [];

    if (identifier.toUpperCase().startsWith('LN-2026-')) {
      const appId = parseInt(identifier.split('-')[2], 10);
      userQuery = `
        SELECT u.id, u.uuid, u.mobile_number FROM users u
        JOIN applications a ON u.id = a.user_id
        WHERE a.id = ?
      `;
      queryParams = [appId];
    } else if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(identifier)) {
      userQuery = `
        SELECT u.id, u.uuid, u.mobile_number FROM users u
        JOIN pan_card_details p ON u.id = p.user_id
        WHERE p.pan_number = ?
      `;
      queryParams = [identifier.toUpperCase()];
    } else {
      userQuery = 'SELECT id, uuid, mobile_number FROM users WHERE mobile_number = ?';
      queryParams = [identifier];
    }

    const [userRows]: any = await pool.query(userQuery, queryParams);

    if (userRows.length === 0) {
      res.status(404).json({ status: 'error', message: 'No application found with this identifier' });
      return;
    }

    const user = userRows[0];
    const mobile = user.mobile_number;

    const [otpRows]: any = await pool.query(
      'SELECT otp, expires_at FROM otp_requests WHERE mobile_number = ?',
      [mobile]
    );

    if (otpRows.length === 0) {
      res.status(400).json({ status: 'error', message: 'No OTP requested for this application' });
      return;
    }

    const request = otpRows[0];

    // Check expiration
    if (new Date() > new Date(request.expires_at)) {
      res.status(400).json({ status: 'error', message: 'OTP has expired' });
      return;
    }

    // Check OTP match
    if (request.otp !== otp.toString()) {
      res.status(400).json({ status: 'error', message: 'Invalid OTP' });
      return;
    }

    // Remove the OTP now that it has been verified
    await pool.query('DELETE FROM otp_requests WHERE mobile_number = ?', [mobile]);

    // Generate JWT token (15 mins expiry)
    const token = jwt.sign(
      { userId: user.id, uuid: user.uuid },
      process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!',
      { expiresIn: '15m' }
    );

    // Set JWT in HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(200).json({
      status: 'success',
      message: 'Status OTP verified successfully',
      data: {
        userId: user.id,
        nextRoute: '/loan-dashboard'
      }
    });
  } catch (error) {
    console.error('verifyStatusOtp error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify status OTP' });
  }
};
