import crypto from 'crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createFieldUser, findFieldUserByEmployeeId, updateFieldUserLastLogin } from '../../models/fieldModels/authModel';

const COOKIE_NAME = 'field_token';
const JWT_SECRET = process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!';
const EMPLOYEE_ID_PATTERN = /^FV-\d{4}-\d{4}$/;
const PIN_PATTERN = /^\d{4}$/;

const hashPin = (pin: string, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(pin, salt, 64).toString('hex')}`;

const verifyPin = (pin: string, storedHash: string) => {
  const [salt, savedHash] = storedHash.split(':');
  if (!salt || !savedHash) return false;
  const candidate = crypto.scryptSync(pin, salt, 64);
  const saved = Buffer.from(savedHash, 'hex');
  return candidate.length === saved.length && crypto.timingSafeEqual(candidate, saved);
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 8 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, name, pin, role = 'Field Agent' } = req.body;
    const normalizedId = String(employeeId || '').trim().toUpperCase();
    if (!normalizedId || !name || !pin) {
      res.status(400).json({ status: 'error', message: 'employeeId, name and pin are required' });
      return;
    }
    if (!EMPLOYEE_ID_PATTERN.test(normalizedId)) {
      res.status(400).json({ status: 'error', message: 'Employee ID must use FV-YYYY-XXXX format' });
      return;
    }
    if (!PIN_PATTERN.test(String(pin))) {
      res.status(400).json({ status: 'error', message: 'PIN must contain exactly 4 digits' });
      return;
    }
    await createFieldUser(normalizedId, String(name).trim(), hashPin(String(pin)), String(role).trim());
    res.status(201).json({ status: 'success', message: 'Field agent registered successfully' });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ status: 'error', message: 'Employee ID is already registered' });
      return;
    }
    console.error('Field registration error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to register field agent' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = String(req.body.employeeId || '').trim().toUpperCase();
    const pin = String(req.body.pin || '');
    if (!employeeId || !pin) {
      res.status(400).json({ status: 'error', message: 'Employee ID and PIN are required' });
      return;
    }
    const user = await findFieldUserByEmployeeId(employeeId);
    if (!user || user.status !== 'active' || !verifyPin(pin, user.pin_hash)) {
      res.status(401).json({ status: 'error', message: 'Invalid Employee ID or PIN' });
      return;
    }
    const data = { id: user.id, employeeId: user.employee_id, name: user.name, role: user.role };
    const token = jwt.sign({ ...data, type: 'field' }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie(COOKIE_NAME, token, cookieOptions);
    await updateFieldUserLastLogin(user.id);
    res.json({ status: 'success', message: 'Login successful', data });
  } catch (error) {
    console.error('Field login error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to login' });
  }
};

export const me = (req: Request, res: Response): void => {
  res.json({ status: 'success', data: (req as any).fieldUser });
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ status: 'success', message: 'Logged out successfully' });
};
