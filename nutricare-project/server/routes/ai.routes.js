import express from 'express';
import { generateInsights } from '../controllers/ai.controller.js';
import checkAuth from '../middlewares/checkAuth.js';

const router = express.Router();

router.post('/insights', checkAuth, generateInsights);

export default router;