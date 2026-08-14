import pool from '../../config/db';

const normalizeStatus = (value: unknown) => {
  const status = String(value || 'pending').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    DRAFT: 'PENDING',
    IN_REVIEW: 'UNDER_REVIEW',
    LOAN_REJECT: 'REJECTED',
    DOCUMENT_PENDING: 'DOCUMENT_PENDING',
  };
  return aliases[status] || status;
};

const initialsFor = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'NA';

export const findAllCases = async (): Promise<any[]> => {
  try {
    const [rows]: any = await pool.query(`
      SELECT
        a.id AS application_id,
        a.user_id,
        a.loan_amount,
        a.loan_purpose,
        a.existing_loan,
        a.status AS application_status,
        DATE_FORMAT(a.created_at, '%d %b %Y') AS applied_on,
        DATE_FORMAT(a.updated_at, '%d %b %Y') AS updated_on,
        u.lead_number,
        u.mobile_number,
        up.full_name,
        up.father_name,
        up.personal_email,
        DATE_FORMAT(up.dob, '%d %b %Y') AS dob,
        up.gender,
        up.marital_status,
        up.religion,
        up.address_type,
        up.address,
        up.city,
        up.state,
        up.pincode,
        ed.employment_type,
        ed.company_name,
        ed.role,
        ed.monthly_income,
        ed.official_email,
        ed.work_address,
        ed.work_city,
        ed.work_state,
        pc.pan_number,
        pc.pan_name,
        pc.is_verified AS pan_verified,
        pc.api_response AS pan_api_response,
        DATE_FORMAT(pc.updated_at, '%d %b %Y') AS pan_verified_on,
        ac.aadhaar_number,
        ac.full_name AS aadhaar_name,
        ac.dob AS aadhaar_dob,
        ac.gender AS aadhaar_gender,
        ac.address AS aadhaar_address,
        ac.is_verified AS aadhaar_verified,
        ac.api_response AS aadhaar_api_response,
        DATE_FORMAT(ac.updated_at, '%d %b %Y') AS aadhaar_verified_on,
        ud.uan,
        ud.employer_name AS uan_employer_name,
        ud.claim_status AS uan_claim_status,
        ud.kyc_status AS uan_kyc_status,
        ud.employment_type AS uan_employment_type,
        ud.designation AS uan_designation,
        ud.joined_on AS uan_joined_on,
        ud.office_location AS uan_office_location,
        ud.employee_status AS uan_employee_status,
        ud.previous_employer AS uan_previous_employer,
        ud.is_verified AS uan_verified,
        DATE_FORMAT(ud.updated_at, '%d %b %Y') AS uan_verified_on,
        cr.cibil_score,
        bd.bank_name,
        bd.account_number,
        kd.selfie_path,
        tc.name AS assigned_to,
        (SELECT bi.device_model FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS device_model,
        (SELECT bi.device_type FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS device_type,
        (SELECT bi.browser_info FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS browser_info,
        (SELECT bi.ip_address FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS ip_address,
        (SELECT bi.latitude FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS latitude,
        (SELECT bi.longitude FROM browser_info bi WHERE bi.user_id = u.id ORDER BY bi.id DESC LIMIT 1) AS longitude,
        (SELECT fv.residence_data FROM fcu_field_verifications fv WHERE fv.application_id = a.id LIMIT 1) AS residence_verification,
        (SELECT fv.office_data FROM fcu_field_verifications fv WHERE fv.application_id = a.id LIMIT 1) AS office_verification,
        (SELECT fvr.report_data FROM field_verification_reports fvr WHERE fvr.application_id = a.id ORDER BY fvr.id DESC LIMIT 1) AS field_report_data,
        (SELECT fvr.outcome FROM field_verification_reports fvr WHERE fvr.application_id = a.id ORDER BY fvr.id DESC LIMIT 1) AS field_report_outcome,
        (SELECT fvr.submitted_at FROM field_verification_reports fvr WHERE fvr.application_id = a.id ORDER BY fvr.id DESC LIMIT 1) AS field_report_submitted_at,
        (SELECT l.fcu_user_id FROM fcu_case_locks l WHERE l.application_id = a.id AND l.lock_expires_at > NOW()) AS lock_user_id,
        (SELECT fu.name FROM fcu_case_locks l LEFT JOIN fcu_users fu ON fu.id = l.fcu_user_id WHERE l.application_id = a.id AND l.lock_expires_at > NOW()) AS lock_user_name,
        (SELECT l.lock_expires_at FROM fcu_case_locks l WHERE l.application_id = a.id AND l.lock_expires_at > NOW()) AS lock_expires_at,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'name', rd.reference_name,
          'relation', rd.relationship,
          'mobile', rd.mobile_number
        )) FROM references_details rd WHERE rd.user_id = u.id) AS reference_data
      FROM applications a
      INNER JOIN users u ON u.id = a.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN employment_details ed ON ed.user_id = u.id
      LEFT JOIN pan_card_details pc ON pc.user_id = u.id
      LEFT JOIN aadhaar_card_details ac ON ac.user_id = u.id
      LEFT JOIN uan_details ud ON ud.user_id = u.id
      LEFT JOIN credit_report_details cr ON cr.user_id = u.id
      LEFT JOIN bank_details bd ON bd.user_id = u.id
      LEFT JOIN kyc_documents kd ON kd.id = (
        SELECT kd2.id FROM kyc_documents kd2 WHERE kd2.user_id = u.id ORDER BY kd2.id DESC LIMIT 1
      )
      LEFT JOIN telecallers tc ON tc.id = u.telecaller_id
      ORDER BY a.created_at DESC, a.id DESC
    `);

    const [reviewRows]: any = await pool.query('SELECT application_id, document_id, status FROM fcu_document_reviews');
    const [workflowRows]: any = await pool.query('SELECT * FROM fcu_case_workflows');
    const [historyRows]: any = await pool.query(`SELECT h.*,fu.name AS performed_by_name FROM fcu_case_history h LEFT JOIN fcu_users fu ON fu.id=h.performed_by ORDER BY h.created_at DESC,h.id DESC`);
    const reviewsByApplication = new Map<number, Map<string, string>>();
    for (const review of reviewRows) {
      if (!reviewsByApplication.has(review.application_id)) reviewsByApplication.set(review.application_id, new Map());
      reviewsByApplication.get(review.application_id)!.set(review.document_id, review.status);
    }
    const workflowByApplication = new Map<number, any>(workflowRows.map((workflow: any) => [workflow.application_id, workflow]));
    const historyByApplication = new Map<number, any[]>();
    for (const item of historyRows) { if (!historyByApplication.has(item.application_id)) historyByApplication.set(item.application_id, []); historyByApplication.get(item.application_id)!.push({ id:item.id, type:item.event_type, title:item.title, description:item.description, performedBy:item.performed_by_name || 'System', createdAt:item.created_at }); }

    const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#4f46e5', '#db2777'];
    const cases = rows.map((row: any, index: number) => {
      const parseJson = (value: any) => value ? (typeof value === 'string' ? JSON.parse(value) : value) : {};
      const applicationStatus = normalizeStatus(row.application_status);
      const borrower = row.full_name || `Customer ${row.user_id}`;
      const amount = Number(row.loan_amount || 0);
      const income = Number(row.monthly_income || 0);
      const lti = income > 0 ? `${Math.round((amount / income) * 100)}%` : 'N/A';
      const aadhaar = row.aadhaar_number ? `XXXX-XXXX-${String(row.aadhaar_number).slice(-4)}` : 'Not available';
      const references = row.reference_data
        ? (typeof row.reference_data === 'string' ? JSON.parse(row.reference_data) : row.reference_data)
        : [];
      const aadhaarApi = parseJson(row.aadhaar_api_response);
      const panApi = parseJson(row.pan_api_response);

      const savedReviews = reviewsByApplication.get(row.application_id);
      const workflow = workflowByApplication.get(row.application_id);
      const status = normalizeStatus(workflow?.case_status || applicationStatus);
      const docs = [
        { id: 'aadhaar', name: 'Aadhaar Card', type: 'Identity', exists: Boolean(row.aadhaar_number), approved: Boolean(row.aadhaar_verified) },
        { id: 'pan', name: 'PAN Card', type: 'Identity', exists: Boolean(row.pan_number), approved: Boolean(row.pan_verified) },
        { id: 'bank', name: 'Bank Details', type: 'Banking', exists: Boolean(row.account_number), approved: Boolean(row.account_number) },
        { id: 'selfie', name: 'Customer Selfie', type: 'Photo', exists: Boolean(row.selfie_path), approved: Boolean(row.selfie_path) },
      ].map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        uploaded: doc.exists ? row.updated_on : 'Not uploaded',
        status: savedReviews?.get(doc.id) || (doc.approved ? 'APPROVED' : 'PENDING'),
      }));

      return {
        id: `APP${String(row.application_id).padStart(7, '0')}`,
        ref: row.lead_number || `USR-${row.user_id}`,
        loanLeadId: row.lead_number || `USR-${row.user_id}`,
        borrower,
        initials: initialsFor(borrower),
        avatar: colors[index % colors.length],
        mobile: row.mobile_number || 'N/A',
        email: row.personal_email || 'N/A',
        loan: `₹${amount.toLocaleString('en-IN')}`,
        loanRaw: amount,
        purpose: String(row.loan_purpose || 'Personal').toUpperCase(),
        lti,
        branch: row.work_city ? `${row.work_city}${row.work_state ? `, ${row.work_state}` : ''}`.toUpperCase() : (row.city || 'UNASSIGNED').toUpperCase(),
        rm: row.assigned_to || 'Unassigned',
        owner: row.assigned_to || 'Unassigned',
        website: 'DATABASE',
        loanSource: 'Database',
        status,
        databaseId: row.application_id,
        workflowStage: workflow?.stage || 'DOCUMENT_REVIEW',
        applied: row.applied_on || 'N/A',
        disburse: status === 'DISBURSED' ? row.updated_on : '—',
        flags: status === 'REJECTED' ? ['REJECTED'] : status === 'DOCUMENT_PENDING' ? ['DOCUMENT PENDING'] : [],
        dob: row.dob || 'N/A',
        gender: row.gender || 'N/A',
        pan: row.pan_number || 'Not available',
        aadhar: aadhaar,
        address: row.address || 'Not available',
        residenceAddressLine1: row.address || 'Not available',
        residenceType: row.address_type || 'N/A',
        city: row.city || 'N/A',
        state: row.state || 'N/A',
        pincode: row.pincode || 'N/A',
        employer: row.company_name || row.employment_type || 'N/A',
        emailOffice: row.official_email || 'N/A',
        contactOffice: row.work_address || 'N/A',
        income: income ? `₹${income.toLocaleString('en-IN')}/mo` : 'N/A',
        tenure: 'N/A',
        cibil: row.cibil_score ? String(row.cibil_score) : 'N/A',
        religion: row.religion || 'N/A',
        maritalStatus: row.marital_status || 'N/A',
        obligations: row.existing_loan ? 'Existing loan declared' : 'No existing loan declared',
        deviceModel: row.device_model || 'N/A',
        deviceType: row.device_type || 'N/A',
        browserInfo: row.browser_info || 'N/A',
        ipAddress: row.ip_address || 'N/A',
        locationLat: row.latitude ? String(row.latitude) : 'N/A',
        locationLng: row.longitude ? String(row.longitude) : 'N/A',
        ekycDetails: {
          aadhaar: {
            linkedMobile: row.mobile_number || 'N/A',
            number: aadhaar,
            status: row.aadhaar_verified ? 'Verified' : 'Not verified',
            name: row.aadhaar_name || borrower,
            dob: row.aadhaar_dob || row.dob || 'N/A',
            gender: row.aadhaar_gender || row.gender || 'N/A',
            issuedBy: 'UIDAI',
            verifiedOn: row.aadhaar_verified_on || 'N/A',
            addressType: row.address_type || 'N/A',
            photo: aadhaarApi?.photo || aadhaarApi?.data?.photo || null,
            address: row.aadhaar_address || row.address || 'N/A',
            addressLine2: row.city || 'N/A', city: row.city || 'N/A', state: row.state || 'N/A', pincode: row.pincode || 'N/A', country: 'India',
          },
          pan: {
            number: row.pan_number || 'N/A', status: row.pan_verified ? 'Verified' : 'Not verified',
            name: row.pan_name || borrower, fatherName: panApi?.father_name || panApi?.data?.father_name || row.father_name || 'N/A',
            dob: panApi?.dob || panApi?.data?.dob || row.dob || 'N/A', issuedOn: panApi?.issued_on || panApi?.data?.issued_on || row.pan_verified_on || 'N/A',
            city: row.city || 'N/A', office: panApi?.office || panApi?.data?.office || 'N/A',
          },
          ckyc: { number: 'N/A', status: 'Not available', registeredOn: 'N/A', issuer: 'N/A', proofType: row.aadhaar_number ? 'AADHAAR' : 'N/A', matchingStatus: 'N/A' },
          uan: {
            number: row.uan || 'N/A', status: row.uan_verified ? 'Active' : 'Not available', verifiedOn: row.uan_verified_on || 'N/A',
            employerName: row.uan_employer_name || row.company_name || 'N/A', claimStatus: row.uan_claim_status || 'N/A', kycStatus: row.uan_kyc_status || 'N/A',
            employmentType: row.uan_employment_type || row.employment_type || 'N/A', designation: row.uan_designation || row.role || 'N/A',
            joinedOn: row.uan_joined_on || 'N/A', officeLocation: row.uan_office_location || row.work_city || 'N/A', employeeStatus: row.uan_employee_status || 'N/A', previousEmployer: row.uan_previous_employer || 'N/A',
          },
          selfie: row.selfie_path || null,
        },
        fieldDetails: {
          residence: parseJson(row.residence_verification),
          office: parseJson(row.office_verification),
        },
        fieldReport: row.field_report_data ? {
          ...parseJson(row.field_report_data),
          outcome: row.field_report_outcome,
          submittedAt: parseJson(row.field_report_data).submittedAt || row.field_report_submitted_at,
        } : null,
        lock: row.lock_user_id ? {
          userId: Number(row.lock_user_id),
          userName: row.lock_user_name || 'Another FCU user',
          expiresAt: row.lock_expires_at,
        } : null,
        docs,
        checks: [
          { id: 'identity', label: 'Identity Verification', status: row.pan_verified && row.aadhaar_verified ? 'PASS' : 'PENDING', note: 'PAN and Aadhaar verification from database' },
          { id: 'credit', label: 'CIBIL Score Check', status: row.cibil_score ? (Number(row.cibil_score) >= 650 ? 'PASS' : 'FAIL') : 'PENDING', note: row.cibil_score ? `Score ${row.cibil_score}` : 'Credit report pending' },
          { id: 'bank', label: 'Bank Details Review', status: row.account_number ? 'PASS' : 'PENDING', note: row.bank_name || 'Bank details pending' },
        ],
        remarks: [],
        history: historyByApplication.get(row.application_id) || [],
        fieldVerificationReport: workflow?.stage === 'FIELD_ASSIGNED' ? {
          status: 'PENDING',
          requestedOn: workflow.field_assigned_at ? new Date(workflow.field_assigned_at).toLocaleDateString('en-IN') : 'N/A',
          assignedOfficer: workflow.field_assigned_to || 'Field Verification Team',
          visitDate: 'To be scheduled',
          summary: 'Case has been assigned for physical field verification.',
          result: 'Pending field verification',
          nextAction: 'Await field officer report before final decision.',
        } : workflow?.stage === 'FIELD_WAIVED' ? {
          status: 'WAIVED',
          requestedOn: workflow.updated_at ? new Date(workflow.updated_at).toLocaleDateString('en-IN') : 'N/A',
          assignedOfficer: 'FCU Manager',
          visitDate: 'N/A',
          summary: 'Physical field verification was waived by the FCU reviewer.',
          result: 'Waived',
          nextAction: 'Final FCU actions are available.',
        } : undefined,
        references: references.map((reference: any, referenceIndex: number) => ({
          srNo: referenceIndex + 1,
          name: reference.name || 'N/A',
          relation: reference.relation || 'N/A',
          mobile: reference.mobile || 'N/A',
          loanLeadId: 'N/A',
        })),
      };
    });

    return cases;
  } catch (error: any) {
    throw error;
  }
};

export const updateDocumentReview = async (applicationId: number, documentId: string, status: 'APPROVED' | 'REJECTED') => {
  await pool.query(`
    INSERT INTO fcu_document_reviews (application_id, document_id, status)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP
  `, [applicationId, documentId, status]);
};

export const reviewAllDocuments = async (applicationId: number, documentIds: string[]) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const documentId of documentIds) {
      await connection.query(`
        INSERT INTO fcu_document_reviews (application_id, document_id, status)
        VALUES (?, ?, 'APPROVED')
        ON DUPLICATE KEY UPDATE status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
      `, [applicationId, documentId]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getDocumentReviewSummary = async (applicationId: number) => {
  const [rows]: any = await pool.query(
    'SELECT document_id, status FROM fcu_document_reviews WHERE application_id = ?',
    [applicationId]
  );
  return rows;
};

export const getWorkflow = async (applicationId: number) => {
  const [rows]: any = await pool.query('SELECT * FROM fcu_case_workflows WHERE application_id = ? LIMIT 1', [applicationId]);
  return rows[0] || { application_id: applicationId, stage: 'DOCUMENT_REVIEW' };
};

export const saveWorkflowAction = async (
  applicationId: number,
  stage: string,
  caseStatus: string,
  reviewerId: number,
  fieldAssignedTo?: string
) => {
  const assignedTo = fieldAssignedTo || null;
  const [existingRows]: any = await pool.query(
    'SELECT id FROM fcu_case_workflows WHERE application_id = ? LIMIT 1',
    [applicationId]
  );

  if (existingRows.length === 0) {
    if (assignedTo) {
      await pool.query(`
        INSERT INTO fcu_case_workflows
          (application_id, stage, case_status, reviewed_by, field_assigned_to, field_assigned_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [applicationId, stage, caseStatus, reviewerId, assignedTo]);
    } else {
      await pool.query(`
        INSERT INTO fcu_case_workflows
          (application_id, stage, case_status, reviewed_by)
        VALUES (?, ?, ?, ?)
      `, [applicationId, stage, caseStatus, reviewerId]);
    }
    return;
  }

  if (assignedTo) {
    await pool.query(`
      UPDATE fcu_case_workflows
      SET stage = ?, case_status = ?, reviewed_by = ?, field_assigned_to = ?,
          field_assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE application_id = ?
    `, [stage, caseStatus, reviewerId, assignedTo, applicationId]);
  } else {
    await pool.query(`
      UPDATE fcu_case_workflows
      SET stage = ?, case_status = ?, reviewed_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE application_id = ?
    `, [stage, caseStatus, reviewerId, applicationId]);
  }
};

export const assignCaseToFieldVerification = async (
  applicationId: number,
  reviewerId: number,
  assignedTo: string
) => {
  const [result]: any = await pool.query(`
    UPDATE fcu_field_verifications
    SET assignment_status = 'ASSIGNED', assigned_to = ?, assigned_by = ?,
        assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE application_id = ?
  `, [assignedTo, reviewerId, applicationId]);

  if (result.affectedRows === 0) {
    await pool.query(`
      INSERT INTO fcu_field_verifications
        (application_id, residence_data, office_data, assignment_status, assigned_to, assigned_by, assigned_at)
      VALUES (?, JSON_OBJECT(), JSON_OBJECT(), 'ASSIGNED', ?, ?, CURRENT_TIMESTAMP)
    `, [applicationId, assignedTo, reviewerId]);
  }
};

export const claimCase = async (applicationId: number, userId: number) => {
  await pool.query('INSERT IGNORE INTO fcu_case_locks (application_id) VALUES (?)', [applicationId]);
  const [result]: any = await pool.query(`
    UPDATE fcu_case_locks
    SET fcu_user_id = ?, locked_at = IF(fcu_user_id = ?, locked_at, CURRENT_TIMESTAMP),
        heartbeat_at = CURRENT_TIMESTAMP, lock_expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)
    WHERE application_id = ?
      AND (fcu_user_id IS NULL OR fcu_user_id = ? OR lock_expires_at IS NULL OR lock_expires_at <= CURRENT_TIMESTAMP)
  `, [userId, userId, applicationId, userId]);
  if (result.affectedRows === 0) {
    const [rows]: any = await pool.query(`SELECT fu.name, l.lock_expires_at FROM fcu_case_locks l LEFT JOIN fcu_users fu ON fu.id=l.fcu_user_id WHERE l.application_id=?`, [applicationId]);
    return { claimed: false, owner: rows[0]?.name || 'Another FCU user', expiresAt: rows[0]?.lock_expires_at };
  }
  return { claimed: true };
};

export const heartbeatCase = async (applicationId: number, userId: number) => {
  const [result]: any = await pool.query(`UPDATE fcu_case_locks SET heartbeat_at=CURRENT_TIMESTAMP, lock_expires_at=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE) WHERE application_id=? AND fcu_user_id=? AND lock_expires_at>CURRENT_TIMESTAMP`, [applicationId, userId]);
  return result.affectedRows > 0;
};

export const releaseCase = async (applicationId: number, userId: number) => {
  await pool.query(`UPDATE fcu_case_locks SET fcu_user_id=NULL, locked_at=NULL, heartbeat_at=NULL, lock_expires_at=NULL WHERE application_id=? AND fcu_user_id=?`, [applicationId, userId]);
};

export const userOwnsCase = async (applicationId: number, userId: number) => {
  const [rows]: any = await pool.query(`SELECT 1 FROM fcu_case_locks WHERE application_id=? AND fcu_user_id=? AND lock_expires_at>CURRENT_TIMESTAMP LIMIT 1`, [applicationId, userId]);
  return rows.length > 0;
};

export const addCaseHistory = async (applicationId: number, eventType: string, title: string, description: string, userId?: number) => {
  const [result]: any = await pool.query('INSERT INTO fcu_case_history (application_id,event_type,title,description,performed_by) VALUES (?,?,?,?,?)', [applicationId,eventType,title,description,userId || null]);
  const [rows]: any = await pool.query(`SELECT h.*,fu.name AS performed_by_name FROM fcu_case_history h LEFT JOIN fcu_users fu ON fu.id=h.performed_by WHERE h.id=?`, [result.insertId]);
  const item = rows[0];
  return { id:item.id, type:item.event_type, title:item.title, description:item.description, performedBy:item.performed_by_name || 'System', createdAt:item.created_at };
};

export const getCaseHistory = async (applicationId: number) => {
  const [rows]: any = await pool.query(`SELECT h.*,fu.name AS performed_by_name FROM fcu_case_history h LEFT JOIN fcu_users fu ON fu.id=h.performed_by WHERE h.application_id=? ORDER BY h.created_at DESC,h.id DESC`, [applicationId]);
  return rows.map((item: any) => ({ id:item.id, type:item.event_type, title:item.title, description:item.description, performedBy:item.performed_by_name || 'System', createdAt:item.created_at }));
};
