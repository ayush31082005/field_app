import { Request, Response } from 'express';
import pool from '../config/db';

async function getInternalUserId(rawUserId: string | string[]): Promise<number | null> {
  const normalizedUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const [rows]: any = await pool.query(
    "SELECT id FROM users WHERE id = ? OR lead_number = ? OR lead_number = CONCAT('GP-LEAD-', ?) OR CONCAT('USR-', id) = ? LIMIT 1",
    [normalizedUserId, normalizedUserId, normalizedUserId, normalizedUserId]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function logAction(userId: number, req: Request, action: string, details: string = '') {
  const telecallerId = (req as any).telecaller?.id || null;
  await pool.query(
    'INSERT INTO application_logs (user_id, telecaller_id, action, status, details) VALUES (?, ?, ?, ?, ?)',
    [userId, telecallerId, action, 'SUCCESS', details]
  );
}


// Get list of active telecallers
export const getTelecallersList = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT id, name, email FROM telecallers WHERE status = "active"');
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error fetching telecallers:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Find Duplicates
export const findDuplicates = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  
  try {
    // Get current user details to match against
    const [userRows]: any = await pool.query(`
      SELECT u.id, u.mobile_number, p.personal_email, p.full_name, ad.aadhaar_number, p_tbl.pan_number 
      FROM users u
      LEFT JOIN personal_details p ON u.id = p.user_id
      LEFT JOIN aadhaar_details ad ON u.id = ad.user_id
      LEFT JOIN pan_details p_tbl ON u.id = p_tbl.user_id
      WHERE u.id = ?
    `, [userId]);
    
    if (userRows.length === 0) {
      res.json({ status: 'success', data: [] });
      return;
    }
    const current = userRows[0];
    
    // Log the action
    await logAction(userId, req, 'FIND DUPLICATES', 'Initiated duplicate search');
    
    // Find matches
    let query = `
      SELECT DISTINCT u.id, u.lead_number as leadId, u.mobile_number as mobile, p.full_name as name, p.personal_email as email
      FROM users u
      LEFT JOIN personal_details p ON u.id = p.user_id
      LEFT JOIN aadhaar_details ad ON u.id = ad.user_id
      LEFT JOIN pan_details p_tbl ON u.id = p_tbl.user_id
      WHERE u.id != ? AND (
        u.mobile_number = ?
    `;
    const params: any[] = [userId, current.mobile_number || 'NULL_VAL'];
    
    if (current.personal_email) {
      query += ` OR p.personal_email = ?`;
      params.push(current.personal_email);
    }
    if (current.full_name) {
      query += ` OR p.full_name = ?`;
      params.push(current.full_name);
    }
    if (current.aadhaar_number) {
      query += ` OR ad.aadhaar_number = ?`;
      params.push(current.aadhaar_number);
    }
    if (current.pan_number) {
      query += ` OR p_tbl.pan_number = ?`;
      params.push(current.pan_number);
    }
    
    query += ` ) LIMIT 20`;
    
    const [duplicateRows]: any = await pool.query(query, params);
    
    res.json({ status: 'success', data: duplicateRows });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Assign telecaller to a lead
export const assignTelecaller = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { telecaller_id } = req.body;
  
  try {
    await pool.query('UPDATE users SET telecaller_id = ? WHERE id = ?', [telecaller_id || null, userId]);
    res.json({ status: 'success', message: 'Telecaller assigned successfully' });
  } catch (error) {
    console.error('Error assigning telecaller:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Get all telecaller data for a specific lead
export const getTelecallerData = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  
  try {
    // 1. Details
    const [detailsRows]: any = await pool.query('SELECT * FROM telecaller_details WHERE user_id = ?', [userId]);
    const details = detailsRows.length > 0 ? detailsRows[0] : {};

    // 2. Follow Ups
    const [followUpsRows]: any = await pool.query('SELECT * FROM telecaller_follow_ups WHERE user_id = ? ORDER BY id DESC', [userId]);

    // 3. Share Links
    const [shareLinksRows]: any = await pool.query('SELECT * FROM telecaller_share_links WHERE user_id = ? ORDER BY created_on DESC', [userId]);
    const shareLinks = shareLinksRows.map((row: any) => ({
      ...row,
      enabled: row.enabled === 1,
      docTypes: typeof row.doc_types === 'string' ? JSON.parse(row.doc_types) : row.doc_types
    }));

    // 4. Missing Docs
    const [missingDocsRows]: any = await pool.query('SELECT * FROM telecaller_missing_docs WHERE user_id = ?', [userId]);

    // 5. Notes
    const [notesRows]: any = await pool.query('SELECT * FROM telecaller_notes WHERE user_id = ? ORDER BY id DESC', [userId]);

    // 6. Salary Credits
    const [salaryCreditsRows]: any = await pool.query('SELECT * FROM telecaller_salary_credits WHERE user_id = ?', [userId]);

    // 7. Recovery History
    const [recoveryHistoryRows]: any = await pool.query('SELECT * FROM telecaller_recovery_history WHERE user_id = ?', [userId]);

    // 8. New Payments
    const [newPaymentsRows]: any = await pool.query('SELECT * FROM telecaller_new_payments WHERE user_id = ?', [userId]);

    res.json({
      status: 'success',
      data: {
        details,
        followUps: followUpsRows,
        shareLinks,
        missingDocs: missingDocsRows,
        notes: notesRows,
        salaryCredits: salaryCreditsRows,
        recoveryHistory: recoveryHistoryRows,
        newPayments: newPaymentsRows,
      }
    });
  } catch (error) {
    console.error('Error fetching telecaller data:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Update Telecaller Details
export const updateTelecallerDetails = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { file_stage, customer_status, last_contact, salary_on_time, delay_in_other_loans, salary_submit_status } = req.body;

  try {
    const [existing]: any = await pool.query('SELECT * FROM telecaller_details WHERE user_id = ?', [userId]);
    
    if (existing.length > 0) {
      await pool.query(`
        UPDATE telecaller_details SET
          file_stage = COALESCE(?, file_stage),
          customer_status = COALESCE(?, customer_status),
          last_contact = COALESCE(?, last_contact),
          salary_on_time = COALESCE(?, salary_on_time),
          delay_in_other_loans = COALESCE(?, delay_in_other_loans),
          salary_submit_status = COALESCE(?, salary_submit_status)
        WHERE user_id = ?
      `, [file_stage, customer_status, last_contact, salary_on_time, delay_in_other_loans, salary_submit_status, userId]);
    } else {
      await pool.query(`
        INSERT INTO telecaller_details (user_id, file_stage, customer_status, last_contact, salary_on_time, delay_in_other_loans, salary_submit_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, file_stage, customer_status, last_contact, salary_on_time, delay_in_other_loans, salary_submit_status]);
    }
    
    await logAction(userId, req, 'UPDATED DETAILS', 'Telecaller updated user details');
    res.json({ status: 'success', message: 'Details updated successfully' });
  } catch (error) {
    console.error('Error updating details:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Add Follow Up
export const addFollowUp = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { scheduled_on, initiated_on, followed_by, mode, note, status, next_action } = req.body;

  try {
    await pool.query(`
      INSERT INTO telecaller_follow_ups (user_id, scheduled_on, initiated_on, followed_by, mode, note, status, next_action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, scheduled_on, initiated_on, followed_by, mode, note, status, next_action]);
    
    await logAction(userId, req, 'ADDED FOLLOW UP', `Mode: ${mode}, Status: ${status}`);
    res.json({ status: 'success', message: 'Follow up added successfully' });
  } catch (error) {
    console.error('Error adding follow up:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Add Share Link
export const addShareLink = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { id, doc_types, status, created_on, link, enabled } = req.body;

  try {
    const docTypesJson = JSON.stringify(doc_types || []);
    
    await pool.query(`
      INSERT INTO telecaller_share_links (id, user_id, doc_types, status, created_on, link, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, docTypesJson, status, created_on, link, enabled ? 1 : 0]);
    
    // Also push to missing docs
    for (const doc of (doc_types || [])) {
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await pool.query(`
        INSERT INTO telecaller_missing_docs (id, user_id, name, status, requested_on, customer_update)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [docId, userId, doc, 'PENDING', created_on, '']);
    }
    
    await logAction(userId, req, 'SHARE LINK GENERATED', `For documents: ${docTypesJson}`);
    res.json({ status: 'success', message: 'Share link added successfully' });
  } catch (error) {
    console.error('Error adding share link:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Update Share Link Status
export const updateShareLinkStatus = async (req: Request, res: Response) => {
  const { linkId } = req.params;
  const { status, enabled } = req.body;

  try {
    await pool.query(`
      UPDATE telecaller_share_links SET
        status = COALESCE(?, status),
        enabled = COALESCE(?, enabled)
      WHERE id = ?
    `, [status, enabled !== undefined ? (enabled ? 1 : 0) : null, linkId]);
    
    // We don't easily have userId here unless we query it first.
    // Let's do it:
    const [linkRows]: any = await pool.query('SELECT user_id FROM telecaller_share_links WHERE id = ?', [linkId]);
    if (linkRows.length > 0) {
      await logAction(linkRows[0].user_id, req, 'SHARE LINK UPDATED', `Status: ${status}`);
    }
    
    res.json({ status: 'success', message: 'Share link status updated' });
  } catch (error) {
    console.error('Error updating share link:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Add Note
export const addNote = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { text, created_on } = req.body;

  try {
    await pool.query(`
      INSERT INTO telecaller_notes (user_id, text, created_on)
      VALUES (?, ?, ?)
    `, [userId, text, created_on]);
    
    await logAction(userId, req, 'NOTE ADDED', text);
    res.json({ status: 'success', message: 'Note added successfully' });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Add Salary Credit
export const addSalaryCredit = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { date, amount } = req.body;

  try {
    await pool.query(`
      INSERT INTO telecaller_salary_credits (user_id, date, amount)
      VALUES (?, ?, ?)
    `, [userId, date, amount]);
    
    await logAction(userId, req, 'SALARY CREDIT ADDED', `Amount: ${amount}`);
    res.json({ status: 'success', message: 'Salary credit added successfully' });
  } catch (error) {
    console.error('Error adding salary credit:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

import * as fs from 'fs';
import * as path from 'path';

// Upload Document
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { linkId, docType, imageBase64, fileName } = req.body;

  try {
    if (!imageBase64) {
      res.status(400).json({ status: 'error', message: 'imageBase64 is required' });
      return;
    }

    // Decode base64
    const base64Data = imageBase64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Create directory if not exists
    const uploadsDir = path.join(__dirname, '../../uploads/customer_docs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const savedFileName = `doc_${userId}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const filePath = path.join(uploadsDir, savedFileName);
    fs.writeFileSync(filePath, buffer);

    const relativePath = `uploads/customer_docs/${savedFileName}`;

    // Update missing docs table for the specific doc
    await pool.query(`
      UPDATE telecaller_missing_docs 
      SET status = 'UPLOADED', customer_update = ? 
      WHERE user_id = ? AND name = ? AND status = 'PENDING'
    `, [`Uploaded: /${relativePath}`, userId, docType]);

    // Check if all requested docs for this link are now uploaded
    const [linkRows]: any = await pool.query(`SELECT doc_types FROM telecaller_share_links WHERE id = ?`, [linkId]);
    if (linkRows.length > 0) {
      const allDocTypes = typeof linkRows[0].doc_types === 'string' ? JSON.parse(linkRows[0].doc_types) : linkRows[0].doc_types;
      
      if (Array.isArray(allDocTypes) && allDocTypes.length > 0) {
        const [pendingRows]: any = await pool.query(`
          SELECT COUNT(*) as count FROM telecaller_missing_docs 
          WHERE user_id = ? AND name IN (?) AND status = 'PENDING'
        `, [userId, allDocTypes]);
        
        if (pendingRows[0].count === 0) {
          await pool.query(`UPDATE telecaller_share_links SET status = 'UPLOADED' WHERE id = ?`, [linkId]);
        } else {
          await pool.query(`UPDATE telecaller_share_links SET status = 'PARTIAL' WHERE id = ?`, [linkId]);
        }
      }
    }

    await logAction(userId, req, 'DOCUMENT UPLOADED', `Type: ${docType}`);
    res.json({ status: 'success', message: 'Document uploaded successfully', path: `/${relativePath}` });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error', error: error?.message });
  }
};

// Get Tasks
export const getTasks = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  
  try {
    const [rows]: any = await pool.query('SELECT id, title, DATE_FORMAT(due_date, "%Y-%m-%d") as due, assigned_to as assignedTo, status FROM telecaller_tasks WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Add Task
export const addTask = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = await getInternalUserId(rawUserId);
  if (!userId) {
    res.status(404).json({ status: 'error', message: 'User not found' });
    return;
  }
  const { title, due_date, assigned_to } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO telecaller_tasks (user_id, title, due_date, assigned_to) VALUES (?, ?, ?, ?)',
      [userId, title, due_date || null, assigned_to]
    );
    await logAction(userId, req, 'ADDED TASK', title);
    res.json({ status: 'success', message: 'Task added successfully' });
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Update Task Status
export const updateTaskStatus = async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { status } = req.body;
  
  try {
    await pool.query('UPDATE telecaller_tasks SET status = ? WHERE id = ?', [status, taskId]);
    
    // To log the action, we need user_id which we can get from task
    const [rows]: any = await pool.query('SELECT user_id, title FROM telecaller_tasks WHERE id = ?', [taskId]);
    if (rows.length > 0) {
      await logAction(rows[0].user_id, req, 'UPDATED TASK STATUS', `Task "${rows[0].title}" marked as ${status}`);
    }
    
    res.json({ status: 'success', message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};
