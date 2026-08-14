import { Router } from 'express';
import { sendOtp, verifyOtp, sendStatusOtp, verifyStatusOtp } from '../controllers/authController';

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/send-status-otp', sendStatusOtp);
router.post('/verify-status-otp', verifyStatusOtp);

export default router;
