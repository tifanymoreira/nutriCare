// nutricare-project/server/routes/auth.routes.js
import express from 'express';
import { 
    register, login, logout, getMe, getPatientCount, getScoreMedium, 
    generateLink, patientDetails, anamneseDetails, sendMsg, 
    getMetrics, getNutricionistaDetails, updateNutricionistaDetails, 
    updateNutricionistaPassword, getInvoices, createInvoice, getDashboardOverview, 
    generateAgenda, getNutriSchedule, bookAppointment, getAppointmentsForDay, 
    getPendingAppointments, updateAppointmentStatus, getPatientNotifications,
    getPatientDashboardOverview,
    getPatientAppointments, cancelAppointment,
    submitSurvey,
    createConsultation,
    getConsultationHistory,
    patientList,
    getFoods, 
    saveMealPlan, 
    getMealPlan,
    scheduleReturnAppointment // IMPORTA A NOVA FUNÇÃO
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
router.get('/generateLink', checkAuth, generateLink);
router.get('/patientList', checkAuth, patientList);
router.get('/patientDetails/:id', checkAuth, patientDetails);
router.get('/anamneseDetails/:id', checkAuth, anamneseDetails);
router.get('/metrics', checkAuth, getMetrics);

// ROTAS DO PLANO ALIMENTAR (NOVAS E ATUALIZADAS)
router.get('/foods', checkAuth, getFoods);
router.post('/mealplan', checkAuth, saveMealPlan);
router.get('/mealplan/:patientId', checkAuth, getMealPlan);

// Rotas de Configuração e Agenda do Nutricionista
router.get('/nutricionista/details', checkAuth, getNutricionistaDetails);
router.put('/nutricionista/details', checkAuth, updateNutricionistaDetails);
router.put('/nutricionista/generateAgenda', checkAuth, generateAgenda);
router.put('/nutricionista/password', checkAuth, updateNutricionistaPassword);
router.get('/nutricionista/appointments', checkAuth, getAppointmentsForDay); 

// Rotas de Acompanhamento (Consulta)
router.post('/consultations', checkAuth, createConsultation);
router.get('/consultations/:patientId', checkAuth, getConsultationHistory);


// Rotas de Aprovação
router.get('/nutricionista/appointments/pending', checkAuth, getPendingAppointments);
router.put('/nutricionista/appointments/status', checkAuth, updateAppointmentStatus);

// ROTA ADICIONADA: Rota dedicada para agendar retornos.
router.post('/appointments/schedule-return', checkAuth, scheduleReturnAppointment);


// Rotas de Faturamento
router.get('/invoices', checkAuth, getInvoices);
router.post('/invoices', checkAuth, createInvoice);

// Rotas de Agendamento do Paciente (Pré-Login/Público)
router.get('/schedule/available', getNutriSchedule); 
router.post('/schedule/book', bookAppointment); 

// Rotas de Paciente
router.get('/patient/dashboard-overview', checkAuth, getPatientDashboardOverview); 
router.get('/patient/notifications', checkAuth, getPatientNotifications); 
router.get('/patient/appointments', checkAuth, getPatientAppointments); 
router.delete('/patient/appointments', checkAuth, cancelAppointment); 
router.post('/patient/submit-survey', checkAuth, submitSurvey);
router.get('/sendMsg/:id', sendMsg);

router.get('/nutricionista/:id', async (req, res) => { 
    if (req.session.user && req.session.user.role !== 'paciente') {
        return res.status(403).json({ success: false, message: 'Acesso não autorizado para este tipo de conta.' });
    }

    try {
        const [rows] = await pool.query('SELECT name, phone FROM nutricionista WHERE id = ?', [req.params.id]);
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