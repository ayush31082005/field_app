import { Router } from 'express';
import { verifyPan, verifyAadhaar, verifyUan, verifyCibil } from '../controllers/enrichmentController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Apply auth middleware to all enrichment routes
router.use(authMiddleware);

router.post('/pan', verifyPan);
router.post('/aadhaar', verifyAadhaar);
router.post('/uan', verifyUan);
router.post('/cibil', verifyCibil);

export default router;
