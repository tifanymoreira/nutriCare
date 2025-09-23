import express from 'express';
import { 
    register, login, logout, getMe, getPatientCount, getScoreMedium, 
    generateLink, patientList, patientDetails, anamneseDetails, sendMsg, 
    mealPlan, getMetrics, getNutricionistaDetails, updateNutricionistaDetails, 
    updateNutricionistaPassword, getInvoices, createInvoice, getDashboardOverview 
} from '../controllers/auth.controller.js'; 
import checkAuth from '../middlewares/checkAuth.js';
import { pool } from '../config/dbConnect.js';
const router = express.Router();

router.post('/register', register); 
router.post('/login', login);
router.post('/logout', checkAuth, logout);
router.get('/me', checkAuth, getMe);

router.get('/dashboard-overview', checkAuth, getDashboardOverview);
router.get('/getPatientCount', getPatientCount);
router.get('/getScoreMedium', getScoreMedium);
router.get('/generateLink', generateLink);
router.get('/patientList', patientList);
router.get('/patientDetails/:id', patientDetails);
router.get('/anamneseDetails/:id', anamneseDetails);
router.get('/metrics', checkAuth, getMetrics);
router.get('/nutricionista/details', checkAuth, getNutricionistaDetails);
router.put('/nutricionista/details', checkAuth, updateNutricionistaDetails);
router.put('/nutricionista/password', checkAuth, updateNutricionistaPassword);
router.get('/invoices', checkAuth, getInvoices);
router.post('/invoices', checkAuth, createInvoice);

router.get('/sendMsg/:id', sendMsg);
router.get('/mealplan/:id', mealPlan);

router.get('/nutricionista/:id', checkAuth, async (req, res) => {
    if (req.session.user.role !== 'paciente') {
        return res.status(403).json({ success: false, message: 'Acesso não autorizado para este tipo de conta.' });
    }

    try {
        const [rows] = await pool.query('SELECT name FROM nutricionista WHERE id = ?', [req.params.id]);
        if (rows.length > 0) {
            res.json({ success: true, nutricionista: rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Nutricionista não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao buscar dados do nutricionista:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor.' });
    }
});

export default router;