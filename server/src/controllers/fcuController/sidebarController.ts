import { Request, Response } from 'express';
import { findFcuUserByEmail } from '../../models/fcuModels/authModel';
import { getSidebarData } from '../../models/fcuModels/sidebarModel';

const browserFrom = (agent: string) => {
  if (/Edg\//i.test(agent)) return 'Microsoft Edge';
  if (/Chrome\//i.test(agent)) return 'Chrome';
  if (/Firefox\//i.test(agent)) return 'Firefox';
  if (/Safari\//i.test(agent)) return 'Safari';
  return 'Unknown';
};

const TRANSIENT_DB_ERRORS = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
]);

const loadSidebarFromDatabase = async (email: string) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const user = await findFcuUserByEmail(email);
      if (!user) return null;
      return { user, data: await getSidebarData(user.id) };
    } catch (error: any) {
      if (!TRANSIENT_DB_ERRORS.has(error?.code) || attempt === 1) throw error;
      console.warn(`FCU sidebar database connection reset; retrying (${error.code}).`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  return null;
};

export const getSidebar = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionUser = (req as any).fcuUser;
    const sidebar = await loadSidebarFromDatabase(sessionUser.email);
    if (!sidebar) {
      res.status(401).json({ status: 'error', message: 'FCU session user no longer exists' });
      return;
    }
    const { user, data } = sidebar;
    const latestLogin = data.activities.find((item: any) => item.action === 'login');
    const currentSessionLogin = {
      id: `session-${user.id}-${sessionUser.issuedAt || Date.now()}`,
      action: 'login',
      ip_address: req.ip,
      user_agent: String(req.headers['user-agent'] || 'Unknown'),
      created_at: new Date((sessionUser.issuedAt || Math.floor(Date.now() / 1000)) * 1000),
    };
    const loginActivities = data.activities.filter((item: any) => item.action === 'login');

    // Older active sessions may have been created before login activity tracking
    // was enabled. Always show the authenticated session in that case.
    if (loginActivities.length === 0) loginActivities.push(currentSessionLogin);

    res.json({
      status: 'success',
      data: {
        session: {
          id: latestLogin?.id ? `FCU-${String(latestLogin.id).padStart(6, '0')}` : `FCU-${user.id}`,
          loginAt: latestLogin?.created_at || new Date((sessionUser.issuedAt || 0) * 1000),
          ipAddress: latestLogin?.ip_address || req.ip,
          browser: browserFrom(latestLogin?.user_agent || String(req.headers['user-agent'] || '')),
          device: /Mobile|Android|iPhone/i.test(latestLogin?.user_agent || '') ? 'Mobile' : 'Desktop',
        },
        activities: loginActivities.slice(0, 4),
        month: {
          reviewed: Number(data.month.reviewed || 0),
          fraudFound: Number(data.month.fraudFound || 0),
          cleared: Number(data.month.cleared || 0),
          pending: Number(data.month.pending || 0),
        },
      },
    });
  } catch (error: any) {
    console.error('FCU sidebar error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load live session details', code: error?.code });
  }
};
