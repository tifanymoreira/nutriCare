import express from 'express';
import { saveAssessment, getAssessmentHistory } from '../controllers/anthropometry.controller.js';
import checkAuth from '../middlewares/checkAuth.js';

const router = express.Router();

router.post('/save', checkAuth, saveAssessment);

router.get('/history/:patientId', checkAuth, getAssessmentHistory);

export default router;