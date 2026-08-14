import { Router } from 'express';
import { login, logout, me, register } from '../../controllers/fcuController/authController';
import { requireFcuAuth } from '../../middleware/fcuMiddleware/authMiddleware';
import { addCaseNote, approveAllDocuments, claimCaseForReview, getCases, keepCaseClaimAlive, listCaseHistory, performWorkflowAction, releaseCaseReview, reviewDocument } from '../../controllers/fcuController/casesController';
import { getDashboard } from '../../controllers/fcuController/dashboardController';
import { getSidebar } from '../../controllers/fcuController/sidebarController';
import { createDocumentRequest, getCustomerDocumentRequest, getDocumentRequest, uploadCustomerDocument } from '../../controllers/fcuController/documentRequestController';

const router = Router();

// Registration is API-only by design; use Postman or another trusted admin client.
router.post('/register', register);
router.post('/login', login);
router.get('/me', requireFcuAuth, me);
router.post('/logout', requireFcuAuth, logout);
router.get('/cases', requireFcuAuth, getCases);
router.post('/cases/:caseId/claim', requireFcuAuth, claimCaseForReview);
router.post('/cases/:caseId/heartbeat', requireFcuAuth, keepCaseClaimAlive);
router.delete('/cases/:caseId/claim', requireFcuAuth, releaseCaseReview);
router.get('/dashboard', requireFcuAuth, getDashboard);
router.get('/sidebar', requireFcuAuth, getSidebar);
router.patch('/cases/:caseId/documents/:documentId', requireFcuAuth, reviewDocument);
router.post('/cases/:caseId/documents/approve-all', requireFcuAuth, approveAllDocuments);
router.post('/cases/:caseId/actions', requireFcuAuth, performWorkflowAction);
router.get('/cases/:caseId/history', requireFcuAuth, listCaseHistory);
router.post('/cases/:caseId/history', requireFcuAuth, addCaseNote);
router.get('/cases/:caseId/document-requests', requireFcuAuth, getDocumentRequest);
router.post('/cases/:caseId/document-requests', requireFcuAuth, createDocumentRequest);

// The random token authorizes a customer to view and upload only requested documents.
router.get('/customer-upload/:token', getCustomerDocumentRequest);
router.post('/customer-upload/:token/documents/:documentId', uploadCustomerDocument);

export default router;
