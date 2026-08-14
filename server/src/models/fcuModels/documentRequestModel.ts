import pool from '../../config/db';

export const findDocumentRequestByApplication = async (applicationId: number) => {
  const [rows]: any = await pool.query(`
    SELECT r.id, r.application_id, r.token, r.status, r.expires_at, r.created_at,
      JSON_ARRAYAGG(JSON_OBJECT('id', d.id, 'documentName', d.document_name, 'status', d.status,
        'fileName', d.file_name, 'filePath', d.file_path, 'uploadedAt', d.uploaded_at)) AS documents
    FROM fcu_document_requests r
    LEFT JOIN fcu_requested_documents d ON d.request_id = r.id
    WHERE r.application_id = ?
    GROUP BY r.id
    ORDER BY r.id DESC LIMIT 1
  `, [applicationId]);
  return rows[0] || null;
};

export const findDocumentRequestByToken = async (token: string) => {
  const [rows]: any = await pool.query(`
    SELECT r.id, r.application_id, r.token, r.status, r.expires_at, r.created_at,
      JSON_ARRAYAGG(JSON_OBJECT('id', d.id, 'documentName', d.document_name, 'status', d.status,
        'fileName', d.file_name, 'filePath', d.file_path, 'uploadedAt', d.uploaded_at)) AS documents
    FROM fcu_document_requests r
    LEFT JOIN fcu_requested_documents d ON d.request_id = r.id
    WHERE r.token = ?
    GROUP BY r.id LIMIT 1
  `, [token]);
  return rows[0] || null;
};

export const createDocumentRequestRecord = async (applicationId: number, token: string, userId: number, documents: string[]) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("UPDATE fcu_document_requests SET status='CLOSED' WHERE application_id=? AND status='ACTIVE'", [applicationId]);
    const [result]: any = await connection.query(`
      INSERT INTO fcu_document_requests (application_id, token, status, expires_at, created_by)
      VALUES (?, ?, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 7 DAY), ?)
    `, [applicationId, token, userId]);
    for (const documentName of documents) {
      await connection.query('INSERT INTO fcu_requested_documents (request_id, document_name) VALUES (?, ?)', [result.insertId, documentName]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const saveRequestedDocumentUpload = async (token: string, documentId: number, fileName: string, filePath: string) => {
  const [result]: any = await pool.query(`
    UPDATE fcu_requested_documents d
    INNER JOIN fcu_document_requests r ON r.id=d.request_id
    SET d.status='UPLOADED', d.file_name=?, d.file_path=?, d.uploaded_at=NOW()
    WHERE d.id=? AND r.token=? AND r.status='ACTIVE' AND r.expires_at > NOW()
  `, [fileName, filePath, documentId, token]);
  if (!result.affectedRows) return false;
  await pool.query(`
    UPDATE fcu_document_requests r SET r.status='COMPLETED'
    WHERE r.token=? AND NOT EXISTS (
      SELECT 1 FROM fcu_requested_documents d WHERE d.request_id=r.id AND d.status='PENDING'
    )
  `, [token]);
  return true;
};
