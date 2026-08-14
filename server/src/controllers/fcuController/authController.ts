import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createFcuUser, findFcuUserByEmail, recordFcuActivity, updateLastLogin } from '../../models/fcuModels/authModel';

const COOKIE_NAME = 'fcu_token';
const JWT_SECRET = process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!';

const hashPassword = (password: string, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string) => {
  const [salt, savedHash] = storedHash.split(':');
  if (!salt || !savedHash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const saved = Buffer.from(savedHash, 'hex');
  return candidate.length === saved.length && crypto.timingSafeEqual(candidate, saved);
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 8 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'FCU Officer' } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ status: 'error', message: 'name, email and password are required' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    await createFcuUser(
      String(name).trim(),
      normalizedEmail,
      hashPassword(String(password)),
      String(role).trim()
    );
    res.status(201).json({ status: 'success', message: 'FCU user registered successfully' });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ status: 'error', message: 'Email is already registered' });
      return;
    }
    console.error('FCU register error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to register FCU user' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ status: 'error', message: 'Email and password are required' });
      return;
    }

    const user = await findFcuUserByEmail(String(email).trim().toLowerCase());
    if (!user || user.status !== 'active' || !verifyPassword(String(password), user.password)) {
      res.status(401).json({ status: 'error', message: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, type: 'fcu' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.cookie(COOKIE_NAME, token, cookieOptions);
    await updateLastLogin(user.id);
    await recordFcuActivity(
      user.id,
      'login',
      String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown').split(',')[0].trim(),
      String(req.headers['user-agent'] || 'Unknown')
    );
    res.json({
      status: 'success',
      message: 'Login successful',
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('FCU login error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to login' });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).fcuUser;
  res.json({ status: 'success', data: user });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const sessionUser = (req as any).fcuUser;
  const currentUser = sessionUser?.email ? await findFcuUserByEmail(sessionUser.email) : null;
  if (currentUser) {
    await recordFcuActivity(
      currentUser.id,
      'logout',
      String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown').split(',')[0].trim(),
      String(req.headers['user-agent'] || 'Unknown')
    );
  }
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  res.json({ status: 'success', message: 'Logged out successfully' });
};
