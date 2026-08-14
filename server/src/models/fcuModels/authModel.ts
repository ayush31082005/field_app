import pool from '../../config/db';

export interface FcuUserRow {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string;
  status: 'active' | 'inactive';
}

export const createFcuUser = async (name: string, email: string, password: string, role: string) => {
  return pool.query(
    'INSERT INTO fcu_users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, password, role]
  );
};

export const findFcuUserByEmail = async (email: string): Promise<FcuUserRow | null> => {
  const [rows]: any = await pool.query(
    'SELECT id, name, email, password, role, status FROM fcu_users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
};

export const updateLastLogin = async (userId: number) => {
  return pool.query('UPDATE fcu_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
};

export const recordFcuActivity = async (
  userId: number,
  action: 'login' | 'logout',
  ipAddress: string,
  userAgent: string
) => {
  return pool.query(
    'INSERT INTO fcu_login_activity (fcu_user_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
    [userId, action, ipAddress, userAgent]
  );
};
