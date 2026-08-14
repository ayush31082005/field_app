import { Router } from 'express';
import { login, logout, me, register } from '../../controllers/fieldController/authController';
import { requireFieldAuth } from '../../middleware/fieldAuthMiddleware';
import { getCases, getHistory, getNetworkLocation, reverseGeocode, startCase, submitReport, uploadFieldImage } from '../../controllers/fieldController/casesController';

const router = Router();

// Registration is intentionally API-only (Postman/admin client).
router.post('/register', register);
router.post('/login', login);
router.get('/me', requireFieldAuth, me);
router.post('/logout', requireFieldAuth, logout);
router.get('/cases', requireFieldAuth, getCases);
router.get('/reverse-geocode', requireFieldAuth, reverseGeocode);
router.get('/network-location', requireFieldAuth, getNetworkLocation);
router.post('/cases/:applicationId/report', requireFieldAuth, submitReport);
router.post('/cases/:applicationId/images', requireFieldAuth, uploadFieldImage);
router.patch('/cases/:applicationId/start', requireFieldAuth, startCase);
router.get('/history', requireFieldAuth, getHistory);

export default router;
