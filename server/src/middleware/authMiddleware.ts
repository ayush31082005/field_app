import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      res.status(401).json({ status: 'error', message: 'Unauthorized - No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'GeetPaySuperSecureSecretKey2026!');
    req.user = decoded;
    
    // Inject userId into body and params for backward compatibility with existing controllers
    if (req.user && req.user.userId) {
      if (!req.body) req.body = {};
      req.body.userId = req.user.userId;
      
      if (!req.params) req.params = {};
      req.params.userId = req.user.userId.toString();
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ status: 'error', message: 'Unauthorized - Invalid or expired token' });
  }
};
