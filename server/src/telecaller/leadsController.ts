import { Request, Response } from 'express';
import pool from '../config/db';

export const getLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        u.id as user_id,
        u.lead_number as leadId,
        u.mobile_number as mobile,
        u.telecaller_id,
        u.lead_source as lead_source,
        DATE_FORMAT(u.created_at, '%d-%m-%Y') as receivedOn,
        u.created_at as raw_created_at,
        up.full_name as name,
        up.personal_email as email,
        up.address,
        up.city as city,
        up.state as state,
        up.pincode,
        up.address_type,
        up.gender,
        up.father_name,
        up.religion,
        up.marital_status,
        DATE_FORMAT(up.dob, '%d-%m-%Y') as dob,
        ed.employment_type,
        ed.company_name,
        ed.company_type,
        ed.role,
        ed.work_address,
        ed.work_pincode,
        ed.experience_years,
        ed.monthly_income,
        ed.official_email,
        bi.device_model,
        bi.device_type,
        bi.browser_info as browser,
        bi.ip_address,
        bi.latitude,
        bi.longitude,
        p.pan_number,
        a.status as application_status,
        a.loan_amount as loanAmount,
        a.loan_purpose as purpose,
        DATE_FORMAT(a.created_at, '%d-%m-%Y') as appliedOn,
        ad.address as aadhaar_address,
        ad.aadhaar_number,
        ad.full_name as aadhaar_name,
        ad.dob as aadhaar_dob,
        ad.gender as aadhaar_gender,
        ad.is_verified as aadhaar_verified,
        DATE_FORMAT(ad.updated_at, '%d-%m-%Y') as aadhaar_verified_on,
        p.pan_name,
        p.is_verified as pan_verified,
        DATE_FORMAT(p.updated_at, '%d-%m-%Y') as pan_verified_on,
        uan.uan as uan_number,
        uan.employer_name as uan_employer,
        uan.claim_status as uan_claim_status,
        uan.kyc_status as uan_kyc_status,
        uan.employment_type as uan_employment_type,
        uan.designation as uan_designation,
        uan.joined_on as uan_joined_on,
        uan.office_location as uan_office_location,
        uan.employee_status as uan_employee_status,
        uan.previous_employer as uan_previous_employer,
        uan.is_verified as uan_verified,
        DATE_FORMAT(uan.updated_at, '%d-%m-%Y') as uan_verified_on,
        kd.selfie_path,
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'name', r.reference_name, 
            'mobile', r.mobile_number, 
            'reference', r.relationship, 
            'loanId', (SELECT u2.lead_number FROM users u2 WHERE u2.mobile_number = r.mobile_number LIMIT 1)
          )
        ) FROM references_details r WHERE r.user_id = u.id) as references_json,
        tc.name as telecaller_name
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN applications a ON u.id = a.user_id
      LEFT JOIN employment_details ed ON u.id = ed.user_id
      LEFT JOIN browser_info bi ON u.id = bi.user_id
      LEFT JOIN pan_card_details p ON u.id = p.user_id
      LEFT JOIN aadhaar_card_details ad ON u.id = ad.user_id
      LEFT JOIN uan_details uan ON u.id = uan.user_id
      LEFT JOIN kyc_documents kd ON u.id = kd.user_id
      LEFT JOIN telecallers tc ON u.telecaller_id = tc.id
      ORDER BY u.created_at DESC
    `);

    // Map database results to frontend format
    const leads = rows.map((row: any) => {

      let stage = "Follow Up";
      if (row.application_status === 'pending') stage = "Call Back";
      if (row.application_status === 'approved') stage = "Follow Up";
      if (row.application_status === 'loan reject') stage = "Reject";
      if (!row.application_status) stage = "Follow Up"; // No application yet

      return {
        id: row.leadId || `USR-${row.user_id}`,
        leadId: row.leadId || `USR-${row.user_id}`,
        name: row.name || 'Unknown',
        mobile: row.mobile || 'N/A',
        email: row.email || 'N/A',
        official_email: row.official_email || null,
        city: row.city || 'Unknown',
        state: row.state || 'Unknown',
        stage: stage,
        receivedOn: row.receivedOn || 'Unknown',
        source: row.lead_source || 'Website',
        priority: 'High',
        loanAmount: row.loanAmount ? parseFloat(row.loanAmount) : 0,
        disbursed: 0,
        cif: 'N/A',
        branch: 'N/A',
        appliedOn: row.appliedOn || 'N/A',
        purpose: row.purpose || 'Personal',
        tenure: 30,
        roi: 0,
        rm: row.telecaller_name || 'Unassigned',
        telecallerId: row.telecaller_id || null,
        isNew: true,
        status: row.application_status ? row.application_status.toUpperCase() : 'IN REVIEW',
        gender: row.gender || 'N/A',
        fatherName: row.father_name || 'N/A',
        religion: row.religion || 'N/A',
        maritalStatus: row.marital_status || 'N/A',
        dob: row.dob || 'N/A',
        incomeType: row.employment_type || 'N/A',
        salary: row.monthly_income ? parseFloat(row.monthly_income) : 0,
        deviceModel: row.device_model || 'N/A',
        deviceType: row.device_type || 'N/A',
        browser: row.browser || 'N/A',
        ipAddress: row.ip_address || '106.201.177.106',
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        applicationNo: row.user_id ? `GP-LEAD-${row.user_id}` : 'N/A',
        pan: row.pan_number || null,
        address1: row.address || row.aadhaar_address || null,
        pincode1: row.pincode || null,
        residence1Type: row.address_type || null,
        employerName: row.company_name || null,
        employerType: row.company_type || null,
        employerAddress: row.work_address || null,
        employerPincode: row.work_pincode || null,
        designation: row.role || null,
        employedSince: row.experience_years ? `${row.experience_years} Years` : null,
        references: row.references_json ? (typeof row.references_json === 'string' ? JSON.parse(row.references_json) : row.references_json) : null,
        ekyc: {
          aadhaar: {
            number: row.aadhaar_number || null,
            name: row.aadhaar_name || null,
            dob: row.aadhaar_dob || null,
            gender: row.aadhaar_gender || null,
            verified: row.aadhaar_verified ? true : false,
            verifiedOn: row.aadhaar_verified_on || null
          },
          pan: {
            name: row.pan_name || null,
            verified: row.pan_verified ? true : false,
            verifiedOn: row.pan_verified_on || null
          },
          uan: {
            number: row.uan_number || null,
            employer: row.uan_employer || null,
            claimStatus: row.uan_claim_status || null,
            kycStatus: row.uan_kyc_status || null,
            employmentType: row.uan_employment_type || null,
            designation: row.uan_designation || null,
            joinedOn: row.uan_joined_on || null,
            officeLocation: row.uan_office_location || null,
            employeeStatus: row.uan_employee_status || null,
            previousEmployer: row.uan_previous_employer || null,
            verified: row.uan_verified ? true : false,
            verifiedOn: row.uan_verified_on || null
          },
          selfie: row.selfie_path || null
        }
      };
    });

    res.status(200).json({
      status: 'success',
      data: leads
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch leads' });
  }
};

export const getLeadLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const [userRows]: any = await pool.query(
      'SELECT id FROM users WHERE id = ? OR lead_number = ? OR lead_number = ? LIMIT 1',
      [userId, `GP-LEAD-${userId}`, `USR-${userId}`]
    );

    if (userRows.length === 0) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }
    const realUserId = userRows[0].id;

    const [rows]: any = await pool.query(`
      SELECT 
        l.id,
        DATE_FORMAT(l.created_at, '%d-%m-%Y %H:%i:%s') as date,
        l.action as status,
        l.details as details,
        t.name as user
      FROM application_logs l
      LEFT JOIN telecallers t ON l.telecaller_id = t.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
    `, [realUserId]);

    res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error fetching lead logs:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch logs' });
  }
};

export const addLeadLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { action, status, details } = req.body;
    const telecallerId = (req as any).telecaller?.id || null;

    if (!action) {
      res.status(400).json({ status: 'error', message: 'Action is required' });
      return;
    }

    const [userRows]: any = await pool.query(
      'SELECT id FROM users WHERE id = ? OR lead_number = ? OR lead_number = ? LIMIT 1',
      [userId, `GP-LEAD-${userId}`, `USR-${userId}`]
    );

    if (userRows.length === 0) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }
    const realUserId = userRows[0].id;

    await pool.query(`
      INSERT INTO application_logs (user_id, telecaller_id, action, status, details)
      VALUES (?, ?, ?, ?, ?)
    `, [realUserId, telecallerId, action, status || null, details || null]);

    res.status(201).json({ status: 'success', message: 'Log added successfully' });
  } catch (error) {
    console.error('Error adding lead log:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add log' });
  }
};

export const updateLeadStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    const telecallerId = (req as any).telecaller?.id || null;

    if (!status) {
      res.status(400).json({ status: 'error', message: 'Status is required' });
      return;
    }

    const [userRows]: any = await pool.query(
      'SELECT id FROM users WHERE id = ? OR lead_number = ? OR lead_number = ? LIMIT 1',
      [userId, `GP-LEAD-${userId}`, `USR-${userId}`]
    );

    if (userRows.length === 0) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }
    const realUserId = userRows[0].id;

    await pool.query(
      'UPDATE applications SET status = ? WHERE user_id = ?',
      [status.toLowerCase(), realUserId]
    );

    await pool.query(`
      INSERT INTO application_logs (user_id, telecaller_id, action, status)
      VALUES (?, ?, ?, ?)
    `, [realUserId, telecallerId, 'STATUS UPDATED', status.toUpperCase()]);

    res.status(200).json({ status: 'success', message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating lead status:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update status' });
  }
};
