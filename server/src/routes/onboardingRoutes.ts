import { Router } from 'express';
import { saveBasicDetails, savePersonalDetails, saveEmploymentDetails, saveBankDetails, saveReferenceDetails, saveAadhaarDetails, uploadSelfie, saveMetadata, getUserData, getDashboardData } from '../controllers/onboardingController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Apply auth middleware to all onboarding routes
router.use(authMiddleware);

router.post('/basic-details', saveBasicDetails);
router.post('/personal-details', savePersonalDetails);
router.post('/employment-details', saveEmploymentDetails);
router.post('/bank-details', saveBankDetails);
router.post('/reference-details', saveReferenceDetails);
router.post('/aadhaar-details', saveAadhaarDetails);
router.post('/upload-selfie', uploadSelfie);
router.post('/metadata', saveMetadata);
router.get('/user-data/:userId', getUserData);
router.get('/dashboard/:userId', getDashboardData);

export default router;
