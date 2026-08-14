import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const requireFieldAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies.field_token;
    if (!token) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!') as any;
    if (decoded.type !== 'field') {
      res.status(403).json({ status: 'error', message: 'Field agent access required' });
      return;
    }
    (req as any).fieldUser = {
      id: decoded.id,
      employeeId: decoded.employeeId,
      name: decoded.name,
      role: decoded.role,
    };
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'Invalid or expired session' });
  }
};

