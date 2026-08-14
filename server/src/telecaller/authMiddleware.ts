import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const requireTelecallerAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies.telecaller_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!') as any;
    
    if (decoded.role !== 'telecaller') {
      res.status(403).json({ status: 'error', message: 'Access denied: Telecaller only' });
      return;
    }

    // Attach telecaller to request object
    (req as any).telecaller = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
};
