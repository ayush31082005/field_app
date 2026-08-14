import pool, { queryWithRetry } from '../../config/db';

const normalizeLoanType = (purpose: unknown): 'home' | 'personal' | 'gold' | 'business' | 'education' => {
  const value = String(purpose || '').toLowerCase();
  if (value.includes('home') || value.includes('housing')) return 'home';
  if (value.includes('gold')) return 'gold';
  if (value.includes('business')) return 'business';
  if (value.includes('education')) return 'education';
  return 'personal';
};

const normalizeFieldStatus = (value: unknown): 'new' | 'pending' | 'in-progress' | 'completed' | 'rejected' | 'referred' => {
  const status = String(value || 'ASSIGNED').toUpperCase();
  if (['COMPLETED', 'VERIFIED', 'POSITIVE'].includes(status)) return 'completed';
  if (['REJECTED', 'NEGATIVE'].includes(status)) return 'rejected';
  if (['REFERRED', 'REFER'].includes(status)) return 'referred';
  if (['IN_PROGRESS', 'STARTED'].includes(status)) return 'in-progress';
  if (status === 'PENDING') return 'pending';
  return 'new';
};

const parseJsonObject = (value: any): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};

const formatExperience = (value: unknown): string => {
  const experience = String(value ?? '').trim();
  if (!experience) return 'N/A';
  return /\b(year|years|yr|yrs)\b/i.test(experience) ? experience : `${experience} years`;
};

export const claimFieldCase = async (applicationId: number, fieldUserId: number) => {
  const [result]: any = await pool.query(`
    UPDATE fcu_field_verifications fv
    INNER JOIN fcu_case_workflows fcw ON fcw.application_id = fv.application_id
    SET fv.assignment_status = 'PENDING', fv.assigned_field_user_id = ?,
        fv.claimed_at = CURRENT_TIMESTAMP, fv.updated_at = CURRENT_TIMESTAMP
    WHERE fv.application_id = ? AND fcw.stage = 'FIELD_ASSIGNED'
      AND fv.assignment_status IN ('ASSIGNED', 'DRAFT')
      AND fv.assigned_field_user_id IS NULL
  `, [fieldUserId, applicationId]);
  if (result.affectedRows > 0) return 'claimed' as const;
  const [rows]: any = await pool.query(
    'SELECT assignment_status, assigned_field_user_id FROM fcu_field_verifications WHERE application_id = ? LIMIT 1',
    [applicationId]
  );
  if (rows[0]?.assigned_field_user_id === fieldUserId && rows[0]?.assignment_status === 'PENDING') return 'owned' as const;
  return 'unavailable' as const;
};

export const assertFieldCaseOwnership = async (applicationId: number, fieldUserId: number) => {
  const [rows]: any = await pool.query(
    `SELECT assignment_status FROM fcu_field_verifications
     WHERE application_id = ? AND assigned_field_user_id = ? LIMIT 1`,
    [applicationId, fieldUserId]
  );
  if (!rows[0]) {
    const error: any = new Error('This case is assigned to another field agent');
    error.statusCode = 409;
    throw error;
  }
  return rows[0];
};

export const findFieldHistory = async () => {
  const [rows]: any = await pool.query(`
    SELECT
      r.application_id,
      r.outcome,
      r.submitted_at,
      JSON_UNQUOTE(JSON_EXTRACT(r.report_data, '$.reportId')) AS report_id,
      JSON_UNQUOTE(JSON_EXTRACT(r.report_data, '$.remarks')) AS remarks,
      up.full_name,
      a.loan_amount,
      a.loan_purpose,
      fu.name AS agent_name,
      fu.employee_id
    FROM field_verification_reports r
    INNER JOIN applications a ON a.id = r.application_id
    INNER JOIN users u ON u.id = a.user_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    INNER JOIN field_users fu ON fu.id = r.field_user_id
    ORDER BY r.submitted_at DESC
  `);
  const items = rows.map((row: any) => ({
    applicationId: row.application_id,
    caseId: `FV-${new Date(row.submitted_at).getFullYear()}-${String(row.application_id).padStart(4, '0')}`,
    reportId: row.report_id,
    applicant: row.full_name || `Customer ${row.application_id}`,
    loanAmount: Number(row.loan_amount || 0),
    loanType: normalizeLoanType(row.loan_purpose),
    outcome: row.outcome,
    status: row.outcome === 'positive' ? 'completed' : row.outcome === 'negative' ? 'rejected' : 'referred',
    submittedAt: new Date(row.submitted_at).toISOString(),
    remarks: row.remarks || '',
    agent: `${row.agent_name} · ${row.employee_id}`,
  }));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = items.filter((item: any) => new Date(item.submittedAt).getTime() >= weekAgo);
  return {
    summary: {
      total: thisWeek.length,
      positive: thisWeek.filter((item: any) => item.outcome === 'positive').length,
      negative: thisWeek.filter((item: any) => item.outcome === 'negative').length,
      referred: thisWeek.filter((item: any) => item.outcome === 'refer').length,
    },
    items,
  };
};

export const findExistingFieldReport = async (applicationId: number, fieldUserId: number) => {
  const [rows]: any = await pool.query(`
    SELECT outcome, report_data, submitted_at
    FROM field_verification_reports
    WHERE application_id = ? AND field_user_id = ?
    LIMIT 1
  `, [applicationId, fieldUserId]);
  if (!rows[0]) return null;
  const report = parseJsonObject(rows[0].report_data);
  return {
    reportId: report.reportId || `RPT-${applicationId}`,
    outcome: rows[0].outcome,
    submittedAt: rows[0].submitted_at,
    photos: report.photos || null,
  };
};

export const findAssignedFieldCases = async (fieldUserId: number) => {
  const [rows]: any = await queryWithRetry(`
    SELECT
      a.id AS application_id,
      a.loan_amount,
      a.loan_purpose,
      u.mobile_number,
      u.mobile_prefill_data,
      u.lead_number,
      up.full_name,
      up.gender,
      up.personal_email,
      DATE_FORMAT(up.dob, '%d %b %Y') AS dob,
      up.address,
      up.city,
      up.state,
      up.pincode,
      up.address_type,
      ed.company_name,
      ed.employment_type,
      ed.company_type,
      ed.role,
      ed.monthly_income,
      ed.official_email,
      ed.work_address,
      ed.work_pincode,
      ed.work_city,
      ed.work_state,
      ed.experience_years,
      pc.pan_number,
      pc.is_verified AS pan_verified,
      ac.aadhaar_number,
      ac.address AS aadhaar_address,
      ac.is_verified AS aadhaar_verified,
      ud.designation AS uan_designation,
      ud.joined_on AS employed_since,
      fv.assignment_status,
      fv.assigned_to,
      fv.assigned_at,
      fv.assigned_field_user_id,
      fv.residence_data,
      fv.office_data,
      fcw.case_status,
      (SELECT bi.latitude FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS latitude,
      (SELECT bi.longitude FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS longitude
    FROM fcu_field_verifications fv
    INNER JOIN fcu_case_workflows fcw ON fcw.application_id = fv.application_id
    LEFT JOIN field_verification_reports fvr ON fvr.application_id = fv.application_id
    INNER JOIN applications a ON a.id = fv.application_id
    INNER JOIN users u ON u.id = a.user_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN employment_details ed ON ed.user_id = u.id
    LEFT JOIN pan_card_details pc ON pc.user_id = u.id
    LEFT JOIN aadhaar_card_details ac ON ac.user_id = u.id
    LEFT JOIN uan_details ud ON ud.user_id = u.id
    WHERE (fcw.stage = 'FIELD_ASSIGNED' AND (
      (fv.assignment_status IN ('ASSIGNED', 'DRAFT') AND fv.assigned_field_user_id IS NULL)
      OR fv.assigned_field_user_id = ?
    )) OR fvr.id IS NOT NULL
    ORDER BY fv.assigned_at DESC, a.id DESC
  `, [fieldUserId]);

  return rows.map((row: any) => {
    const nameParts = String(row.full_name || '').trim().split(/\s+/).filter(Boolean);
    const mobilePrefill = parseJsonObject(row.mobile_prefill_data);
    const residenceVerification = parseJsonObject(row.residence_data);
    const officeVerification = parseJsonObject(row.office_data);
    return ({
    id: `FV-${new Date(row.assigned_at || Date.now()).getFullYear()}-${String(row.application_id).padStart(4, '0')}`,
    applicationId: row.application_id,
    applicant: row.full_name || `Customer ${row.application_id}`,
    mobile: row.mobile_number || 'N/A',
    address: row.address || 'Address not available',
    city: row.city || row.work_city || 'N/A',
    pinCode: row.pincode || 'N/A',
    loanType: normalizeLoanType(row.loan_purpose),
    loanAmount: Number(row.loan_amount || 0),
    bankBranch: row.work_city ? `${row.work_city} Branch` : 'Branch not available',
    status: normalizeFieldStatus(row.assignment_status),
    assignedAt: row.assigned_at ? new Date(row.assigned_at).toISOString() : null,
    dob: row.dob || 'N/A',
    email: row.personal_email || 'N/A',
    firstName: nameParts[0] || 'N/A',
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : 'N/A',
    surname: nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'N/A',
    alternateMobile: mobilePrefill.alternateMobile || mobilePrefill.alternate_mobile || 'N/A',
    screenedBy: row.assigned_to || 'N/A',
    screenedOn: row.assigned_at ? new Date(row.assigned_at).toISOString() : 'N/A',
    gender: row.gender || 'N/A',
    panNumber: row.pan_number || 'N/A',
    panVerified: Boolean(row.pan_verified),
    aadhaarNumber: row.aadhaar_number ? `XXXX-XXXX-${String(row.aadhaar_number).slice(-4)}` : 'N/A',
    aadhaarVerified: Boolean(row.aadhaar_verified),
    state: row.state || 'N/A',
    residenceType: row.address_type || 'N/A',
    secondaryAddress: row.aadhaar_address || row.address || 'N/A',
    residenceVerification,
    income: Number(row.monthly_income || 0),
    employer: row.company_name || row.employment_type || 'N/A',
    employmentType: row.employment_type || 'N/A',
    employerType: row.company_type || 'N/A',
    designation: row.uan_designation || row.role || 'N/A',
    officialEmail: row.official_email || 'N/A',
    workAddress: row.work_address || 'N/A',
    workCity: row.work_city || 'N/A',
    workState: row.work_state || 'N/A',
    workPinCode: row.work_pincode || 'N/A',
    // Always expose the applicant's real employment_details value here.
    // UAN joined date and field-verification JSON are separate information.
    employedSince: formatExperience(row.experience_years),
    officeVerification,
    gpsCoords: [Number(row.latitude || 0), Number(row.longitude || 0)],
    leadNumber: row.lead_number || null,
    assignedTo: row.assigned_to || 'Field Verification Team',
  });
  });
};

export const saveFieldReport = async (applicationId: number, fieldUserId: number, outcome: string, report: object) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [workflowRows]: any = await connection.query(
      `SELECT fcw.stage, fv.assignment_status, fv.assigned_field_user_id
       FROM fcu_case_workflows fcw
       INNER JOIN fcu_field_verifications fv ON fv.application_id = fcw.application_id
       WHERE fcw.application_id = ? FOR UPDATE`,
      [applicationId]
    );
    if (!workflowRows[0] || workflowRows[0].stage !== 'FIELD_ASSIGNED') {
      const error: any = new Error('This case is not assigned for field verification');
      error.statusCode = 409;
      throw error;
    }
    if (workflowRows[0].assigned_field_user_id !== fieldUserId) {
      const error: any = new Error('This case is assigned to another field agent');
      error.statusCode = 409;
      throw error;
    }
    if (['COMPLETED', 'VERIFIED', 'POSITIVE', 'NEGATIVE', 'REJECTED', 'REFERRED', 'REFER'].includes(String(workflowRows[0].assignment_status || '').toUpperCase())) {
      const error: any = new Error('This field verification has already been submitted');
      error.statusCode = 409;
      throw error;
    }
    await connection.query(`
      INSERT INTO field_verification_reports (application_id, field_user_id, outcome, report_data)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        field_user_id = VALUES(field_user_id), outcome = VALUES(outcome),
        report_data = VALUES(report_data), submitted_at = CURRENT_TIMESTAMP
    `, [applicationId, fieldUserId, outcome, JSON.stringify(report)]);
    await connection.query(`
      UPDATE fcu_field_verifications
      SET assignment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE application_id = ?
    `, [outcome === 'negative' ? 'NEGATIVE' : outcome === 'refer' ? 'REFERRED' : 'COMPLETED', applicationId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
