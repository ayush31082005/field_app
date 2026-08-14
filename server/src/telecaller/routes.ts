import { Router } from 'express';
import { login, register, logout } from './authController';
import { requireTelecallerAuth } from './authMiddleware';
import { getLeads, getLeadLogs, addLeadLog } from './leadsController';
import { 
  getTelecallerData, 
  updateTelecallerDetails, 
  addFollowUp, 
  addShareLink, 
  updateShareLinkStatus, 
  addNote, 
  addSalaryCredit,
  uploadDocument,
  getTelecallersList,
  assignTelecaller,
  findDuplicates,
  getTasks,
  addTask,
  updateTaskStatus
} from './telecallerSubController';

const router = Router();

// Public auth routes
router.post('/auth/login', login);
router.post('/auth/register', register); // Used for initial setup

// Protected routes
router.post('/auth/logout', requireTelecallerAuth, logout);

// Protected routes
router.get('/dashboard', requireTelecallerAuth, (req, res) => {
  res.json({ status: 'success', data: { message: 'Welcome to the telecaller dashboard!' } });
});
router.get('/leads', requireTelecallerAuth, getLeads);
router.get('/leads/:userId/logs', requireTelecallerAuth, getLeadLogs);
router.post('/leads/:userId/logs', requireTelecallerAuth, addLeadLog);

// Telecaller dynamic subtab routes
router.get('/lead/:userId/telecaller-data', requireTelecallerAuth, getTelecallerData);
router.put('/lead/:userId/details', requireTelecallerAuth, updateTelecallerDetails);
router.post('/lead/:userId/follow-up', requireTelecallerAuth, addFollowUp);
router.post('/lead/:userId/share-link', requireTelecallerAuth, addShareLink);
router.put('/lead/:userId/share-link/:linkId/status', requireTelecallerAuth, updateShareLinkStatus);
router.post('/lead/:userId/note', requireTelecallerAuth, addNote);
router.post('/lead/:userId/salary-credit', requireTelecallerAuth, addSalaryCredit);
router.post('/lead/:userId/upload-doc', requireTelecallerAuth, uploadDocument);
router.get('/lead/:userId/duplicates', requireTelecallerAuth, findDuplicates);
router.get('/lead/:userId/tasks', requireTelecallerAuth, getTasks);
router.post('/lead/:userId/tasks', requireTelecallerAuth, addTask);
router.put('/lead/:userId/tasks/:taskId/status', requireTelecallerAuth, updateTaskStatus);

// Telecaller management routes
router.get('/list', requireTelecallerAuth, getTelecallersList);
router.put('/lead/:userId/assign', requireTelecallerAuth, assignTelecaller);

export default router;
