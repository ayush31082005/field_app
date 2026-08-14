import pool from '../../config/db';

export interface FieldUserRow {
  id: number;
  employee_id: string;
  name: string;
  pin_hash: string;
  role: string;
  status: 'active' | 'inactive';
}

export const createFieldUser = (employeeId: string, name: string, pinHash: string, role: string) =>
  pool.query(
    'INSERT INTO field_users (employee_id, name, pin_hash, role) VALUES (?, ?, ?, ?)',
    [employeeId, name, pinHash, role]
  );

export const findFieldUserByEmployeeId = async (employeeId: string): Promise<FieldUserRow | null> => {
  const [rows]: any = await pool.query(
    'SELECT id, employee_id, name, pin_hash, role, status FROM field_users WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );
  return rows[0] || null;
};

export const updateFieldUserLastLogin = (userId: number) =>
  pool.query('UPDATE field_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
