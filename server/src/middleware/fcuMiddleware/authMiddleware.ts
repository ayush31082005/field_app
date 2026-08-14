import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const requireFcuAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies.fcu_token;
    if (!token) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!') as any;
    if (decoded.type !== 'fcu') {
      res.status(403).json({ status: 'error', message: 'FCU access required' });
      return;
    }
    (req as any).fcuUser = { id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role, issuedAt: decoded.iat };
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'Invalid or expired session' });
  }
};
