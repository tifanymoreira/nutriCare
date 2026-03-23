const router = express.Router();

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
    scheduleReturnAppointment,
    getScheduleConfig,
    updateScheduleConfig,
    getTodayAppointment, saveAppointmentNotes, getPatientInvoices, getPatientDocuments
} from '../controllers/auth.controller.js';

import checkAuth from '../middlewares/checkAuth.js';
import { pool } from '../config/dbConnect.js';
import { saveAssessment, getAssessmentHistory } from '../controllers/anthropometry.controller.js';

router.post('/save', checkAuth, saveAssessment);
router.get('/history/:patientId', checkAuth, getAssessmentHistory); // NOVA ROTA

router.get('/patient/:userId/invoices', checkAuth, getPatientInvoices);
router.get('/patient/:userId/documents', checkAuth, getPatientDocuments);

router.get('/nutricionista/appointment/today/:patientId', checkAuth, getTodayAppointment);
router.post('/nutricionista/appointment/save-notes', checkAuth, saveAppointmentNotes);

// Rotas de Autenticação Básica
router.post('/register', register);
router.post('/login', login);
router.post('/logout', checkAuth, logout);
router.get('/me', checkAuth, getMe);

// Rotas de Dashboard e Métricas
router.get('/dashboard-overview', checkAuth, getDashboardOverview);
router.get('/getPatientCount', getPatientCount);
router.get('/getScoreMedium', getScoreMedium);
router.get('/metrics', checkAuth, getMetrics);

// Rotas de Pacientes
router.get('/patientList', checkAuth, patientList);
router.get('/patientDetails/:id', checkAuth, patientDetails);
router.get('/anamneseDetails/:id', checkAuth, anamneseDetails);
router.get('/generateLink', checkAuth, generateLink);
router.get('/sendMsg/:id', sendMsg);

// Rotas do Plano Alimentar
router.get('/foods', checkAuth, getFoods);
router.post('/mealplan', checkAuth, saveMealPlan);
router.get('/mealplan/:patientId', checkAuth, getMealPlan);

// --- ROTAS DO NUTRICIONISTA (PERFIL E AGENDA) ---
router.get('/nutricionista/details', checkAuth, getNutricionistaDetails);
router.put('/nutricionista/details', checkAuth, updateNutricionistaDetails);
router.put('/nutricionista/password', checkAuth, updateNutricionistaPassword);

// Agenda Profissional (Visualização e Geração)
router.get('/nutricionista/appointments', checkAuth, getAppointmentsForDay);
router.put('/nutricionista/generateAgenda', checkAuth, generateAgenda);

// --- [NOVO] Configurações de Intervalos e Pausas ---
router.get('/schedule/config', checkAuth, getScheduleConfig);
router.post('/schedule/config/update', checkAuth, updateScheduleConfig);

// Rotas de Aprovação de Consultas
router.get('/nutricionista/appointments/pending', checkAuth, getPendingAppointments);
router.put('/nutricionista/appointments/status', checkAuth, updateAppointmentStatus);

// Rotas de Consulta/Acompanhamento
router.post('/consultations', checkAuth, createConsultation);
router.get('/consultations/:patientId', checkAuth, getConsultationHistory);
router.post('/appointments/schedule-return', checkAuth, scheduleReturnAppointment);

// Rotas de Faturamento
router.get('/invoices', checkAuth, getInvoices);
router.post('/invoices', checkAuth, createInvoice);

// --- ROTAS PÚBLICAS/PACIENTE (AGENDAMENTO) ---
router.get('/schedule/available', getNutriSchedule);
router.post('/schedule/book', bookAppointment);

// Rotas do Painel do Paciente
router.get('/patient/dashboard-overview', checkAuth, getPatientDashboardOverview);
router.get('/patient/notifications', checkAuth, getPatientNotifications);
router.get('/patient/appointments', checkAuth, getPatientAppointments);
router.delete('/patient/appointments', checkAuth, cancelAppointment);
router.post('/patient/submit-survey', checkAuth, submitSurvey);

// Rota auxiliar para pegar nome do Nutri na tela de agendamento público
router.get('/nutricionista/:id', async (req, res) => {
    // Permite acesso público para que a tela de agendamento funcione sem login
    try {
        const [rows] = await pool.query('SELECT name, phone, crnCode FROM nutricionista WHERE id = ?', [req.params.id]);
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