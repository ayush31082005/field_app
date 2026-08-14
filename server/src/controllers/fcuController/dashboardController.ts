import { Request, Response } from 'express';
import { getDashboardData } from '../../models/fcuModels/dashboardModel';

export const getDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ status: 'success', data: await getDashboardData() });
  } catch (error: any) {
    console.error('FCU dashboard error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load FCU dashboard', code: error?.code });
  }
};
