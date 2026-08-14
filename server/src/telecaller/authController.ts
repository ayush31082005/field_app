import { Request, Response } from 'express';
import pool from '../config/db';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const hashString = (str: string) => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, secure_pin } = req.body;
    
    if (!email || !password || !secure_pin) {
      res.status(400).json({ status: 'error', message: 'email, password, and secure_pin are required' });
      return;
    }

    const hashedPassword = hashString(password);
    const hashedPin = hashString(secure_pin);

    const [rows]: any = await pool.query(
      'SELECT * FROM telecallers WHERE email = ? AND password = ? AND secure_pin = ? AND status = "active"',
      [email, hashedPassword, hashedPin]
    );

    if (rows.length === 0) {
      res.status(401).json({ status: 'error', message: 'Invalid credentials or inactive account' });
      return;
    }

    const telecaller = rows[0];

    const token = jwt.sign(
      { id: telecaller.id, email: telecaller.email, role: 'telecaller' },
      process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!',
      { expiresIn: '8h' }
    );

    res.cookie('telecaller_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    // Log the login event
    await pool.query('INSERT INTO telecaller_logs (telecaller_id, action) VALUES (?, "login")', [telecaller.id]);

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully',
      data: {
        id: telecaller.id,
        name: telecaller.name,
        email: telecaller.email
      }
    });

  } catch (error) {
    console.error('Telecaller login error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to login' });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, secure_pin, name } = req.body;
    
    if (!email || !password || !secure_pin || !name) {
      res.status(400).json({ status: 'error', message: 'All fields are required' });
      return;
    }

    const hashedPassword = hashString(password);
    const hashedPin = hashString(secure_pin);

    await pool.query(
      'INSERT INTO telecallers (email, password, secure_pin, name) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, hashedPin, name]
    );

    res.status(201).json({
      status: 'success',
      message: 'Telecaller account created successfully'
    });
  } catch (error: any) {
    console.error('Telecaller register error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ status: 'error', message: 'Email already exists' });
    } else {
      res.status(500).json({ status: 'error', message: 'Failed to create telecaller' });
    }
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const telecallerId = (req as any).telecaller?.id;
    if (telecallerId) {
      await pool.query('INSERT INTO telecaller_logs (telecaller_id, action) VALUES (?, "logout")', [telecallerId]);
    }
    
    res.clearCookie('telecaller_token');
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
  } catch (error) {
    console.error('Telecaller logout error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to logout' });
  }
};
