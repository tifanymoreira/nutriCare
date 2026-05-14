// nutricare-project/server/controllers/auth.controller.js
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../config/dbConnect.js';
import { validarCRN } from '../middlewares/checkCrn.js';
const saltRounds = 10;

// -------------------------------------------------------------
// FUNÇÃO DE SANITIZAÇÃO (Prevenção XSS e Injections)
// -------------------------------------------------------------
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/[&<>"']/g, function(m) {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return m;
        }
    });
};

// -------------------------------------------------------------
// INTEGRAÇÃO META WHATSAPP CLOUD API
// -------------------------------------------------------------
async function sendWhatsAppMessage(phone, text) {
    const waToken = process.env.WA_TOKEN;
    const phoneId = process.env.WA_PHONE_ID;
    if (!waToken || !phoneId || !phone) return;
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
    try {
        await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: text } })
        });
    } catch (error) { console.error('Erro na automação do WhatsApp:', error); }
}

// Função utilitária para gerar horários baseados em um intervalo.
function generateTimeSlots(startTimeStr, endTimeStr, slotDuration) {
    const slots = [];
    let currentTime = new Date(`2000/01/01 ${startTimeStr}`);
    const endTime = new Date(`2000/01/01 ${endTimeStr}`);

    while (currentTime.getTime() < endTime.getTime()) {
        const hour = String(currentTime.getHours()).padStart(2, '0');
        const minute = String(currentTime.getMinutes()).padStart(2, '0');
        slots.push(`${hour}:${minute}`);
        currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
    }
    return slots;
}

export async function register(req, res) {
    const { role } = req.body;

    if (role === 'nutricionista') {
        return registerNutricionista(req, res);
    }
    if (role === 'paciente') {
        return registerPacienteWithAnamnese(req, res);
    }

    return res.status(400).json({ success: false, message: 'Role (função) inválida especificada.' });
}

async function registerNutricionista(req, res) {
    const { name, email, password, passwordConfirmation, phone, crn } = req.body;
    const role = 'nutricionista';

    if (!name || !email || !password || !passwordConfirmation || !crn || !phone) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    if (password !== passwordConfirmation) {
        return res.status(400).json({ success: false, message: 'As senhas não coincidem.' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{6,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ success: false, message: 'A senha não atende aos requisitos mínimos de segurança.' });
    }

    const crnValido = await validarCRN(crn);
    if (!crnValido) {
        return res.status(400).json({ success: false, message: 'CRN inválido.' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [userResult] = await connection.query(
            'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, new Date()]
        );
        const newUserId = userResult.insertId;

        await connection.query(
            'INSERT INTO nutricionista (id, name, email, phone, crnCode) VALUES (?, ?, ?, ?, ?)',
            [newUserId, name, email, phone, crn]
        );

        await connection.commit();
        res.status(201).json({ success: true, message: 'Conta de nutricionista criada com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro no registro de nutricionista:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao realizar o cadastro.' });
    } finally {
        connection.release();
    }
}

async function registerPacienteWithAnamnese(req, res) {
    const { registerData, anamneseData, appointmentId } = req.body;
    const { name, email, password, phone, nutriID } = registerData;
    const role = 'paciente';

    if (!name || !email || !password || !nutriID || !phone) {
        return res.status(400).json({ success: false, message: 'Dados de registro do paciente incompletos.' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{6,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ success: false, message: 'A senha não atende aos requisitos mínimos de segurança.' });
    }

    const connection = await pool.getConnection();

    try {
        const [existingUser] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            connection.release();
            return res.status(409).json({ success: false, message: 'Este e-mail já está cadastrado. Por favor, faça login ou use um e-mail diferente.' });
        }

        await connection.beginTransaction();

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [userResult] = await connection.query(
            'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, new Date()]
        );
        const patientId = userResult.insertId;

        await connection.query(
            'INSERT INTO pacientes (id, nome, email, phone, nutriID) VALUES (?, ?, ?, ?, ?)',
            [patientId, name, email, phone, nutriID]
        );

        if (appointmentId) {
            await connection.query(
                'UPDATE appointments SET patientID = ? WHERE id = ? AND nutriID = ?',
                [patientId, appointmentId, nutriID]
            );
        }

        const {
            peso, altura, data_nascimento, objetivos, problema_saude, cirurgia, digestao, intestino,
            consistencia_fezes, ingestao_agua, ciclo_menstrual, tratamento_anterior, mastigacao,
            alergias, aversao, gostos, alcool, medicacao, atividade_fisica, sono, exames_sangue, expectativas
        } = anamneseData;

        // Sanitização básica contra inserção de scripts em campos sensíveis
        const safeProblemaSaude = sanitizeInput(problema_saude);
        const safeExpectativas = sanitizeInput(expectativas);

        await connection.query(
            `INSERT INTO anamnese (
            nutriID, patientID, name, weight, height, birthdate, objective, 
            health_issue, surgerie, digestion, intestino, fezes, water_ingestion, 
            period_cicle, previous_diet, mastigacao, allergic, avoidment, fav_food, 
            alcohol, medicine, exercise, wake_up_time, blood_exam, final_question, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nutriID, patientId, name, peso, altura, data_nascimento, JSON.stringify(objetivos),
                safeProblemaSaude, cirurgia, digestao, intestino, consistencia_fezes, ingestao_agua,
                ciclo_menstrual, tratamento_anterior, mastigacao, alergias, aversao, gostos, alcool,
                medicacao, atividade_fisica, sono, exames_sangue, safeExpectativas, new Date()
            ]
        );

        await connection.commit();

        req.session.user = { id: patientId, name, email, role, nutriID };

        res.status(201).json({ success: true, message: 'Cadastro e anamnese realizados com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.log('Erro no registro do paciente com anamnese:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Este e-mail já está cadastrado. Por favor, faça login ou use um e-mail diferente.' });
        }
        res.status(500).json({ success: false, message: 'Erro interno ao processar o cadastro.' });
    } finally {
        connection.release();
    }
}

export async function sendMsg(req, res) {
    const nutriId = req.params.id;

    if (!nutriId) {
        return res.status(400).json({ success: false, message: 'ID do nutricionista não fornecido.' });
    }

    try {
        const [rows] = await pool.query('SELECT phone FROM nutricionista WHERE id = ?', [nutriId]);

        if (rows.length > 0) {
            res.json({ success: true, number: rows[0].phone });
        } else {
            res.status(404).json({ success: false, message: 'Nenhum telefone encontrado.' });
        }
    } catch (error) {
        console.error("Erro em sendMsg:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

export async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'E-mail ou senha inválidos.' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            let redirectUrl = '';
            let nutriID = null;

            if (user.role === 'nutricionista') {
                redirectUrl = '/pages/nutricionista/dashboard.html';
            } else if (user.role === 'paciente') {
                const [pacienteRows] = await pool.query('SELECT nutriID FROM pacientes WHERE id = ?', [user.id]);
                if (pacienteRows.length > 0) {
                    nutriID = pacienteRows[0].nutriID;
                }
                redirectUrl = '/pages/paciente/dashboard.html';
            } else {
                return res.status(500).json({ success: false, message: 'Tipo de usuário desconhecido.' });
            }

            req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, nutriID };
            res.json({ success: true, redirectUrl });

        } else {
            res.status(401).json({ success: false, message: 'E-mail ou senha inválidos.' });
        }
    } catch (error) {
        console.error('Erro no processo de login:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

export function logout(req, res) {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Não foi possível fazer logout.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, redirectUrl: '/pages/login.html' });
    });
}

export function getMe(req, res) {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Usuário não logado.' });
    }
}

export const getPatientInvoices = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (req.session.user.id !== parseInt(userId) && req.session.user.role !== 'nutricionista') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const [invoices] = await pool.query(
            `SELECT id, amount, status, due_date, issue_date 
             FROM invoices 
             WHERE patient_id = ? 
             ORDER BY due_date DESC`,
            [userId]
        );

        res.status(200).json({ success: true, invoices });
    } catch (error) {
        console.error('Erro ao buscar faturas do paciente:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar faturas.' });
    }
};

export const getPatientDocuments = async (req, res) => {
    try {
        const userId = req.params.userId;
        const docType = req.query.type;

        if (req.session.user.id !== parseInt(userId) && req.session.user.role !== 'nutricionista') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const [documents] = await pool.query(
            `SELECT id, title, type, file_url, created_at 
             FROM documents 
             WHERE patient_id = ? AND type = ? 
             ORDER BY created_at DESC`,
            [userId, docType]
        );

        res.status(200).json({ success: true, documents });
    } catch (error) {
        console.error('Erro ao buscar documentos do paciente:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar documentos.' });
    }
};

export async function getPatientCount(req, res) {
    const nutriId = req.session.user.id;

    try {
        const [rows] = await pool.query(
            'SELECT COUNT(*) AS totalPacientes FROM pacientes WHERE nutriId = ?',
            [nutriId]
        );
        res.json({ success: true, totalPacientes: rows[0].totalPacientes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar total de pacientes.' });
    }
}

export async function getScoreMedium(req, res) {
    const nutriId = req.session.user.id;

    try {
        const [rows] = await pool.query(
            'SELECT AVG(score) AS medium FROM score WHERE nutriId = ?',
            [nutriId]
        );
        res.json({ success: true, medium: rows[0].medium });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar total de pacientes.' });
    }
}

export async function generateAgenda(req, res) {
    const { dates, startTime, endTime, slotDuration } = req.body;
    const nutriId = req.session.user.id;

    if (!nutriId || !dates || dates.length === 0 || !startTime || !endTime || !slotDuration) {
        return res.status(400).json({ success: false, message: 'Dados de agenda incompletos ou inválidos.' });
    }

    try {
        const available_days_json = JSON.stringify(dates);

        const [existing] = await pool.query('SELECT nutriID FROM nutri_agenda WHERE nutriID = ?', [nutriId]);

        if (existing.length > 0) {
            await pool.query(
                'UPDATE nutri_agenda SET startTime = ?, endTime = ?, duration = ?, available_days = ? WHERE nutriID = ?',
                [startTime, endTime, slotDuration, available_days_json, nutriId]
            );
        } else {
            await pool.query(
                'INSERT INTO nutri_agenda (nutriID, startTime, endTime, duration, available_days) VALUES (?, ?, ?, ?, ?)',
                [nutriId, startTime, endTime, slotDuration, available_days_json]
            );
        }

        res.status(200).json({ success: true, message: 'Agenda gerada e salva com sucesso!' });

    } catch (error) {
        console.error('Erro ao gerar agenda:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar agenda.' });
    }
}

export async function getNutriSchedule(req, res) {
    const { nutriId, date } = req.query;

    if (!nutriId || !date) {
        return res.status(400).json({ success: false, message: 'ID do nutricionista e data são obrigatórios.' });
    }

    try {
        const [agendaRows] = await pool.query(
            `SELECT startTime, endTime, duration, 
                    buffer_time, break_times, 
                    JSON_UNQUOTE(available_days) as available_days 
             FROM nutri_agenda WHERE nutriID = ?`,
            [nutriId]
        );

        if (agendaRows.length === 0) {
            return res.json({ success: true, availableSlots: [], message: 'A agenda desta nutricionista ainda não foi configurada.' });
        }

        const agenda = agendaRows[0];
        const { startTime, endTime, duration: slotDuration } = agenda;
        const bufferTime = agenda.buffer_time || 0;

        let breakTimes = [];
        if (agenda.break_times) {
            breakTimes = typeof agenda.break_times === 'string' ? JSON.parse(agenda.break_times) : agenda.break_times;
        }

        const availableDays = agenda.available_days ? JSON.parse(agenda.available_days) : [];

        if (!availableDays.includes(date)) {
            return res.json({ success: true, availableSlots: [], message: 'Esta data não está disponível para agendamento.' });
        }

        const slots = [];
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currentMinutes + slotDuration <= endMinutes) {
            const h = Math.floor(currentMinutes / 60);
            const m = currentMinutes % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            if (!overlapsWithBreak(timeStr, slotDuration, breakTimes)) {
                slots.push(timeStr);
                currentMinutes += (slotDuration + bufferTime);
            } else {
                currentMinutes += 5;
            }
        }

        const [appointmentRows] = await pool.query(
            'SELECT TIME(appointment_date) as bookedTime, duration FROM appointments WHERE nutriID = ? AND DATE(appointment_date) = ? AND status != "Rejeitada"',
            [nutriId, date]
        );

        const bookedIntervals = appointmentRows.map(row => {
            const [bh, bm] = row.bookedTime.split(':').map(Number);
            const startMin = bh * 60 + bm;
            return { start: startMin, end: startMin + row.duration };
        });

        let availableSlots = slots.filter(slotTime => {
            const [sh, sm] = slotTime.split(':').map(Number);
            const slotStart = sh * 60 + sm;
            const slotEnd = slotStart + slotDuration;

            for (const booked of bookedIntervals) {
                if (slotStart < booked.end && slotEnd > booked.start) {
                    return false;
                }
            }
            return true;
        });

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        if (date === todayStr) {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            availableSlots = availableSlots.filter(slot => {
                const [h, m] = slot.split(':').map(Number);
                return (h * 60 + m) > nowMin;
            });
        }

        res.json({ success: true, availableSlots, slotDuration });

    } catch (error) {
        console.error('Erro ao buscar agenda do nutricionista:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar agenda.' });
    }
}

export async function bookAppointment(req, res) {
    const { nutriId, service, date, time, patientData, birthDate, objective } = req.body;

    const patientID = req.session?.user?.id || null;

    if (!nutriId || !service || !date || !time || !patientData || !patientData.name || !patientData.email || !patientData.phone || !birthDate || !objective) {
        return res.status(400).json({ success: false, message: 'Dados de agendamento incompletos.' });
    }

    const appointmentDateStr = `${date} ${time}:00`;

    try {
        const appointmentDateTime = new Date(appointmentDateStr);
        if (appointmentDateTime < new Date()) {
            return res.status(409).json({ success: false, message: 'Não é possível agendar uma consulta para um horário que já passou.', appointment: "not_allowed" });
        }

        const [checkRows] = await pool.query(
            'SELECT COUNT(*) as count FROM appointments WHERE nutriID = ? AND appointment_date = ? AND status != "Rejeitada"',
            [nutriId, appointmentDateStr]
        );

        if (checkRows[0].count > 0) {
            return res.status(409).json({ success: false, message: 'Este horário não está mais disponível. Por favor, escolha outro.' });
        }

        const [result] = await pool.query(
            `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, service_type, duration, appointment_date, status, birth_date, objective) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nutriId,
                patientID,
                patientData.name,
                patientData.email,
                patientData.phone,
                service.name,
                service.duration,
                appointmentDateStr,
                'Pendente',
                birthDate,
                sanitizeInput(objective)
            ]
        );

        res.json({
            success: true,
            message: 'Pré-agendamento realizado com sucesso! Aguarde a confirmação do seu nutricionista.',
            appointmentId: result.insertId
        });

    } catch (error) {
        console.error('Erro ao registrar pré-agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao realizar o pré-agendamento.' });
    }
}

export async function getPendingAppointments(req, res) {
    const nutriId = req.session.user.id;
    try {
        const [rows] = await pool.query(
            `SELECT 
                id, 
                patient_name, 
                patient_email,
                patient_phone,
                service_type, 
                duration,
                DATE_FORMAT(appointment_date, "%Y-%m-%d") as date,
                DATE_FORMAT(appointment_date, "%H:%i") as time,
                birth_date, 
                objective   
             FROM appointments 
             WHERE nutriID = ? AND status = 'Pendente' 
             ORDER BY appointment_date ASC`,
            [nutriId]
        );
        res.json({ success: true, pendingAppointments: rows });
    } catch (error) {
        console.error('Erro ao buscar agendamentos pendentes:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar dados.' });
    }
}

export async function updateAppointmentStatus(req, res) {
    const nutriId = req.session.user.id;
    const { appointmentId, status, rejectionType, rejectionMessage } = req.body;

    if (!['Confirmada', 'Rejeitada'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }

    let query = '';
    let values = [];

    if (status === 'Confirmada') {
        query = 'UPDATE appointments SET status = ?, confirmation_date = ?, rejection_type = NULL, rejection_message = NULL WHERE id = ? AND nutriID = ?';
        values = [status, new Date(), appointmentId, nutriId];
    } else if (status === 'Rejeitada') {
        if (rejectionType === 'cancelamento' && !rejectionMessage) {
            return res.status(400).json({ success: false, message: 'A mensagem de justificativa é obrigatória para cancelamento total.' });
        }
        const finalRejectionMessage = rejectionType === 'reagendar'
            ? 'Horário indisponível. Por favor, reagende a consulta para outro horário disponível.'
            : rejectionMessage;

        query = 'UPDATE appointments SET status = ?, confirmation_date = ?, rejection_type = ?, rejection_message = ? WHERE id = ? AND nutriID = ?';
        values = [status, new Date(), rejectionType, finalRejectionMessage, appointmentId, nutriId];
    }

    try {
        // Busca dados do paciente ANTES de atualizar para enviar no WhatsApp
        const [appRows] = await pool.query('SELECT patient_name, patient_phone, appointment_date, service_type FROM appointments WHERE id = ?', [appointmentId]);
        await pool.query(query, values);
        
        // Automação WhatsApp Real
        if (appRows.length > 0) {
            const app = appRows[0];
            const dateStr = new Date(app.appointment_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            if (status === 'Confirmada') {
                await sendWhatsAppMessage(app.patient_phone, `✅ Olá ${app.patient_name.split(' ')[0]}!\n\nSua consulta de *${app.service_type}* foi confirmada para o dia *${dateStr}*.\n\nAté breve!`);
            } else if (status === 'Rejeitada') {
                await sendWhatsAppMessage(app.patient_phone, `❌ Olá ${app.patient_name.split(' ')[0]},\n\nSua solicitação para *${dateStr}* precisou ser ajustada. Motivo:\n_${finalRejectionMessage}_`);
            }
        }
        res.json({ success: true, message: `Consulta ${status.toLowerCase()} com sucesso!` });
    } catch (error) {
        console.error('Erro ao atualizar status da consulta:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar status.' });
    }
}

export async function getPatientNotifications(req, res) {
    const patientId = req.session.user.id;

    try {
        const [rows] = await pool.query(
            `SELECT 
                id, 
                status, 
                service_type,
                rejection_type,     
                rejection_message,  
                DATE_FORMAT(appointment_date, "%d/%m/%Y") as date,
                DATE_FORMAT(appointment_date, "%H:%i") as time
             FROM appointments 
             WHERE patientID = ? AND status != 'Pendente' 
             ORDER BY confirmation_date DESC`,
            [patientId]
        );

        const notifications = rows.map(row => {
            let message = '';
            let type = '';
            let action = '';

            if (row.status === 'Confirmada') {
                message = `Sua consulta em ${row.date} às ${row.time} foi CONFIRMADA! `;
                type = 'success';
                action = 'agenda.html';
            } else if (row.status === 'Rejeitada') {
                type = 'canceled';
                if (row.rejection_type === 'reagendar') {
                    message = `Lamentamos, mas sua solicitação de ${row.service_type} em ${row.date} às ${row.time} foi REJEITADA. Motivo: ${row.rejection_message || 'Horário indisponível.'}`;
                    action = `/pages/paciente/preSchedule.html?nutriId=${req.session.user.nutriID}`;
                } else if (row.rejection_type === 'cancelamento') {
                    message = `Sua solicitação de ${row.service_type} em ${row.date} às ${row.time} foi REJEITADA. Justificativa da Nutri: ${row.rejection_message || 'Não especificada.'}`;
                    action = '#';
                } else {
                    message = `Lamentamos, mas sua solicitação de ${row.service_type} em ${row.date} às ${row.time} foi REJEITADA. Por favor, reagende abaixo.`;
                    action = `/pages/paciente/preSchedule.html?nutriId=${req.session.user.nutriID}`;
                }
            }

            return {
                id: row.id,
                message,
                type,
                status: row.status,
                nutriId: req.session.user.nutriID,
                rejectionType: row.rejection_type,
                action: action
            };
        });

        res.json({ success: true, notifications });

    } catch (error) {
        console.error('Erro ao buscar notificações do paciente:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar notificações.' });
    }
}

export async function getAppointmentsForDay(req, res) {
    const nutriId = req.session.user.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    try {
        const dateFilter = `${date}%`;
        const [rows] = await pool.query(
            `SELECT 
                patient_name, 
                service_type, 
                DATE_FORMAT(appointment_date, "%H:%i") as time, 
                duration,
                patient_phone,
                patient_email
             FROM appointments 
             WHERE nutriID = ? AND appointment_date LIKE ? AND status = 'Confirmada'
             ORDER BY appointment_date ASC`,
            [nutriId, dateFilter]
        );

        const appointments = rows.map(row => ({
            patientName: row.patient_name,
            title: row.service_type,
            time: row.time,
            duration: row.duration,
            phone: row.patient_phone,
            email: row.patient_email
        }));

        res.json({ success: true, appointments });

    } catch (error) {
        console.error('Erro ao buscar agendamentos do dia:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar agendamentos.' });
    }
}

export async function generateLink(req, res) {
    const nutriId = req.session.user.id;
    try {
        const link = `http://localhost:3000/pages/paciente/preSchedule.html?nutriId=${nutriId}`;
        res.json({ success: true, link });
    } catch (error) {
        console.error('Erro ao gerar o link:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar o link.' });
    }
}

export async function getPatientAppointments(req, res) {
    const patientID = req.session.user.id;
    const nutriID = req.session.user.nutriID;

    try {
        const now = new Date();
        await pool.query(
            `UPDATE appointments 
             SET status = 'Realizada' 
             WHERE patientID = ? AND status = 'Confirmada' AND appointment_date < ?`,
            [patientID, now]
        );

        const query = `
            SELECT 
                id,
                service_type, 
                appointment_date,
                duration,
                status,
                is_rated
             FROM appointments 
             WHERE patientID = ?
             ORDER BY appointment_date DESC
        `;
        const [rows] = await pool.query(query, [patientID]);

        const [nutriRows] = await pool.query(
            'SELECT name, phone FROM nutricionista WHERE id = ?',
            [nutriID]
        );
        const nutriData = nutriRows.length > 0 ? nutriRows[0] : {};

        res.json({ success: true, appointments: rows, nutriData });

    } catch (error) {
        console.log('Erro ao buscar agendamentos do paciente:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar agendamentos.' });
    }
}

export async function cancelAppointment(req, res) {
    const patientID = req.session.user.id;
    const { appointmentId } = req.body;

    if (!appointmentId) {
        return res.status(400).json({ success: false, message: 'ID do agendamento é obrigatório.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT appointment_date, service_type, nutriID 
             FROM appointments 
             WHERE id = ? AND patientID = ?`,
            [appointmentId, patientID]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado ou não autorizado.' });
        }

        const appointment = rows[0];
        await pool.query('DELETE FROM appointments WHERE id = ?', [appointmentId]);

        const date = new Date(appointment.appointment_date).toLocaleDateString('pt-BR');
        const time = new Date(appointment.appointment_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        res.json({
            success: true,
            message: `O agendamento de ${appointment.service_type} em ${date} às ${time} foi cancelado com sucesso.`,
            nutriId: appointment.nutriID
        });

    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao cancelar agendamento.' });
    }
}

export async function patientDetails(req, res) {
    const nutriId = req.session.user.id;
    var patientId = req.params.id;

    const [rows] = await pool.query('SELECT id, nome, email, status, phone FROM pacientes WHERE nutriID = ? AND id = ?', [nutriId, patientId]);
    if (rows.length > 0) {
        res.json({ success: true, patients: rows });
    } else {
        res.status(404).json({ success: false, message: 'Nenhum paciente encontrado.' });
    }
}

export async function anamneseDetails(req, res) {
    const nutriId = req.session.user.id;
    var patientId = req.params.id;

    const [rows] = await pool.query('SELECT * FROM anamnese WHERE nutriID = ? AND patientID = ?', [nutriId, patientId]);
    if (rows.length > 0) {
        res.json({ success: true, patients: rows });
    } else {
        res.status(404).json({ success: false, message: 'Nenhuma anamnese encontrada.' });
    }
}

export async function updateAnamnese(req, res) {
    const nutriId = req.session.user.id;
    const patientId = req.params.patientId;
    const { 
        health_issue, allergic, avoidment, medicine, 
        exercise, digestion, intestino, sleep 
    } = req.body;

    try {
        const [result] = await pool.query(
            `UPDATE anamnese 
             SET health_issue = ?, allergic = ?, avoidment = ?, medicine = ?, 
                 exercise = ?, digestion = ?, intestino = ?, wake_up_time = ?
             WHERE nutriID = ? AND patientID = ?`,
            [
                sanitizeInput(health_issue), sanitizeInput(allergic), 
                sanitizeInput(avoidment), sanitizeInput(medicine),
                sanitizeInput(exercise), sanitizeInput(digestion), 
                sanitizeInput(intestino), sanitizeInput(sleep),
                nutriId, patientId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Anamnese não encontrada ou você não tem permissão.' });
        }
        res.json({ success: true, message: 'Ficha base do paciente atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar anamnese:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar a ficha do paciente.' });
    }
}

// -------------------------------------------------------------
// LOGICA DE METRICAS E KPIS
// -------------------------------------------------------------
export async function getMetrics(req, res) {
    const period = parseInt(req.query.period) || 30;
    const nutriId = req.session.user.id;

    try {
        // Consultas Gerais de KPIs
        const [[revRow]] = await pool.query(`SELECT SUM(totalValue) as rev FROM invoices WHERE nutriID = ? AND issueDate >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status = 'Paid'`, [nutriId, period]);
        const [[patRow]] = await pool.query(`SELECT COUNT(*) as cnt FROM pacientes p JOIN users u ON p.id = u.id WHERE p.nutriID = ? AND u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [nutriId, period]);
        const [[retRow]] = await pool.query(`SELECT (SUM(CASE WHEN status = 'Ativo' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100 as retention FROM pacientes WHERE nutriID = ?`, [nutriId]);
        const [[avgAppRow]] = await pool.query(`SELECT COUNT(*) / NULLIF(COUNT(DISTINCT patientID), 0) as avgApp FROM appointments WHERE nutriID = ? AND status='Realizada'`, [nutriId]);

        // Dados para gráfico de Evolução Temporal (Faturamento vs Pacientes)
        const [evolRows] = await pool.query(`SELECT DATE(issueDate) as date, SUM(totalValue) as rev FROM invoices WHERE nutriID = ? AND issueDate >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status = 'Paid' GROUP BY DATE(issueDate) ORDER BY DATE(issueDate)`, [nutriId, period]);
        const [patEvolRows] = await pool.query(`SELECT DATE(u.created_at) as date, COUNT(*) as cnt FROM pacientes p JOIN users u ON p.id = u.id WHERE p.nutriID = ? AND u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY DATE(u.created_at) ORDER BY DATE(u.created_at)`, [nutriId, period]);

        // Agrupa as datas das duas consultas
        const dateMap = new Map();
        evolRows.forEach(r => {
            const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
            if (!dateMap.has(dateStr)) dateMap.set(dateStr, { rev: 0, cnt: 0 });
            dateMap.get(dateStr).rev = parseFloat(r.rev) || 0;
        });
        patEvolRows.forEach(r => {
            const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
            if (!dateMap.has(dateStr)) dateMap.set(dateStr, { rev: 0, cnt: 0 });
            dateMap.get(dateStr).cnt = r.cnt || 0;
        });

        const sortedDates = Array.from(dateMap.keys()).sort();
        const labels = sortedDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'));
        const revenue = sortedDates.map(d => dateMap.get(d).rev);
        const patients = sortedDates.map(d => dateMap.get(d).cnt);

        // Tipos de Consulta para o Doughnut
        const [appTypes] = await pool.query(`SELECT service_type as type, COUNT(*) as cnt FROM appointments WHERE nutriID = ? AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY service_type`, [nutriId, period]);

        // Agrupamento de Objetivos (da Anamnese)
        const [goals] = await pool.query(`SELECT objective as obj FROM anamnese WHERE nutriID = ?`, [nutriId]);
        const goalCounts = {};
        goals.forEach(g => {
            if (!g.obj) return;
            let objs = [];
            try { objs = JSON.parse(g.obj); } catch (e) { objs = [g.obj]; }
            if (!Array.isArray(objs)) objs = [objs];
            objs.forEach(o => {
                const clean = String(o).replace(/[\[\]"]/g, '').trim();
                if (clean) goalCounts[clean] = (goalCounts[clean] || 0) + 1;
            });
        });

        const data = {
            kpis: {
                revenue: revRow?.rev || 0,
                patients: patRow?.cnt || 0,
                retention: retRow?.retention ? parseFloat(retRow.retention).toFixed(1) : 0,
                avgAppointments: avgAppRow?.avgApp ? parseFloat(avgAppRow.avgApp).toFixed(1) : 0
            },
            evolution: { labels, revenue, patients },
            appointmentTypes: { labels: appTypes.map(t => t.type), data: appTypes.map(t => t.cnt) },
            patientGoals: { labels: Object.keys(goalCounts), data: Object.values(goalCounts) }
        };

        res.json({ success: true, data });
    } catch (err) {
        console.error("Erro em getMetrics:", err);
        res.status(500).json({ success: false, message: 'Erro ao buscar métricas reais.' });
    }
}

export async function getNutricionistaDetails(req, res) {
    try {
        const nutriId = req.session.user.id;
        const [rows] = await pool.query(
            'SELECT name, email, phone, crnCode, wppMessage FROM nutricionista WHERE id = ?',
            [nutriId]
        );
        if (rows.length > 0) {
            const [agendaRows] = await pool.query(
                'SELECT JSON_UNQUOTE(available_days) AS available_days FROM nutri_agenda WHERE nutriID = ?',
                [nutriId]
            );

            const availableDays = agendaRows.length > 0 && agendaRows[0].available_days
                ? JSON.parse(agendaRows[0].available_days)
                : [];

            res.json({ success: true, data: { ...rows[0], availableDays } });
        } else {
            res.status(404).json({ success: false, message: 'Nutricionista não encontrado.' });
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do nutricionista:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

export async function updateNutricionistaDetails(req, res) {
    const { name, email, phone, wppMessage } = req.body;
    const nutriId = req.session.user.id;

    if (!name || !email || !phone) {
        return res.status(400).json({ success: false, message: 'Nome, email e celular são obrigatórios.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query(
            'UPDATE users SET name = ?, email = ? WHERE id = ?',
            [name, email, nutriId]
        );

        await connection.query(
            'UPDATE nutricionista SET name = ?, email = ?, phone = ?, wppMessage = ? WHERE id = ?',
            [name, email, phone, wppMessage || null, nutriId]
        );

        await connection.commit();

        req.session.user.name = name;
        req.session.user.email = email;

        res.json({ success: true, message: 'Dados atualizados com sucesso!' });
    } catch (error) {
        await connection.rollback();
        console.error("Erro ao atualizar detalhes do nutricionista:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar os dados.' });
    } finally {
        connection.release();
    }
}

export async function updateNutricionistaPassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    const nutriId = req.session.user.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ success: false, message: 'A nova senha não atende aos requisitos mínimos de segurança.' });
    }

    try {
        const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [nutriId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(currentPassword, user.password);

        if (!match) {
            return res.status(401).json({ success: false, message: 'A senha atual está incorreta.' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, nutriId]);

        res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error("Erro ao alterar a senha:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao alterar a senha.' });
    }
}

export async function getInvoices(req, res) {
    const nutriId = req.session.user.id;
    try {
        const [invoices] = await pool.query(`
            SELECT i.id, i.patientId, p.nome as patientName, i.issueDate, i.dueDate, i.totalValue as amount, i.status, i.payment_link
            FROM invoices i 
            JOIN pacientes p ON i.patientId = p.id 
            WHERE i.nutriID = ? ORDER BY i.issueDate DESC
        `, [nutriId]);
        res.json({ success: true, data: { invoices } });
    } catch (err) {
        res.status(500).json({ success: false });
    }
}

export async function createInvoice(req, res) {
    const nutriId = req.session.user.id;
    const { patientId, issueDate, dueDate, items } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const total = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const [resInvoice] = await conn.query(
            `INSERT INTO invoices (nutriID, patientId, issueDate, dueDate, totalValue, status) VALUES (?, ?, ?, ?, ?, 'Pending')`,
            [nutriId, patientId, issueDate, dueDate, total]
        );
        const invoiceId = resInvoice.insertId;

        for (let item of items) {
            await conn.query(`INSERT INTO invoice_items (invoice_id, description, amount) VALUES (?, ?, ?)`, [invoiceId, item.description, item.amount]);
        }
        
        // INTEGRAÇÃO MERCADO PAGO + ENVIO DE COBRANÇA WHATSAPP
        let paymentLink = null;
        if (process.env.MP_ACCESS_TOKEN) {
            try {
                const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: items.map(i => ({ title: i.description, quantity: 1, unit_price: parseFloat(i.amount) })),
                        external_reference: invoiceId.toString(),
                        notification_url: `${process.env.PUBLIC_URL || 'https://sua-url-aqui.com'}/api/auth/invoices/webhook`
                    })
                });
                const mpData = await mpRes.json();
                if (mpData.init_point) {
                    paymentLink = mpData.init_point;
                    try { await conn.query('UPDATE invoices SET payment_link = ? WHERE id = ?', [paymentLink, invoiceId]); } catch (e) {}
                    const [patRows] = await conn.query('SELECT nome, phone FROM pacientes WHERE id = ?', [patientId]);
                    if (patRows.length > 0 && patRows[0].phone) {
                        await sendWhatsAppMessage(patRows[0].phone, `🧾 Olá ${patRows[0].nome.split(' ')[0]}!\n\nSua fatura de *R$ ${total.toFixed(2).replace('.',',')}* foi gerada.\nPara pagar com PIX ou Cartão via MercadoPago, acesse:\n${paymentLink}`);
                    }
                }
            } catch(e) { console.error("Aviso: Falha no Mercado Pago:", e.message); }
        }

        await conn.commit();
        res.json({ success: true, message: 'Fatura criada com sucesso!', paymentLink });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: 'Erro interno ao criar fatura.' });
    } finally {
        conn.release();
    }
}

// MARCAR FATURA COMO PAGA MANUALMENTE
export async function markInvoiceAsPaid(req, res) {
    const invoiceId = req.params.id;
    const nutriId = req.session.user.id;
    try {
        const [rows] = await pool.query('SELECT id FROM invoices WHERE id = ? AND nutriID = ?', [invoiceId, nutriId]);
        if(rows.length === 0) return res.status(403).json({success: false, message: 'Não autorizado'});
        
        await pool.query("UPDATE invoices SET status = 'Paid' WHERE id = ?", [invoiceId]);
        res.json({success: true, message: 'Fatura atualizada para Pago.'});
    } catch(e) {
        console.error("Erro ao atualizar fatura:", e);
        res.status(500).json({success: false, message: 'Erro interno ao atualizar.'});
    }
}

// WEBHOOK MERCADO PAGO
export async function mpWebhook(req, res) {
    const { type, data } = req.body;
    res.status(200).send('OK'); // Responde IMEDIATAMENTE ao MercadoPago
    if (type === 'payment' && data && data.id) {
        try {
            const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
                headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
            });
            const paymentData = await paymentRes.json();
            if (paymentData.status === 'approved') {
                const invoiceId = paymentData.external_reference;
                await pool.query("UPDATE invoices SET status = 'Paid' WHERE id = ?", [invoiceId]);
                const [invRows] = await pool.query("SELECT i.totalValue, p.nome, p.phone FROM invoices i JOIN pacientes p ON i.patientId = p.id WHERE i.id = ?", [invoiceId]);
                if (invRows.length > 0 && invRows[0].phone) {
                    await sendWhatsAppMessage(invRows[0].phone, `✅ Pagamento Confirmado!\n\n${invRows[0].nome.split(' ')[0]}, recebemos seu pagamento de *R$ ${parseFloat(invRows[0].totalValue).toFixed(2).replace('.',',')}*. Obrigado!`);
                }
            }
        } catch(e) { console.error("Erro no Webhook MP:", e); }
    }
}

// -------------------------------------------------------------
// DASHBOARDS
// -------------------------------------------------------------
export async function getDashboardOverview(req, res) {
    const nutriId = req.session.user.id;

    try {
        const today = new Date().toISOString().split('T')[0];

        // Processamento paralelo para melhor performance
        const [
            [appointmentsTodayResult],
            [activePatientsResult],
            [monthlyRevenueResult],
            [avgScoreResult],
            [todayAppointmentsListResult],
            [birthdays]
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) as count FROM appointments WHERE nutriID = ? AND status = 'Confirmada' AND DATE(appointment_date) = ?", [nutriId, today]),
            pool.query("SELECT COUNT(*) as count FROM pacientes WHERE nutriID = ? AND status = 'Ativo'", [nutriId]),
            pool.query("SELECT SUM(totalValue) as total FROM invoices WHERE nutriID = ? AND MONTH(issueDate) = MONTH(CURDATE()) AND YEAR(issueDate) = YEAR(CURDATE()) AND status = 'Paid'", [nutriId]),
            pool.query("SELECT AVG(rating) as avgRating FROM nutri_nps WHERE nutri_id = ?", [nutriId]),
            pool.query("SELECT patient_name, service_type, DATE_FORMAT(appointment_date, '%H:%i') as time FROM appointments WHERE nutriID = ? AND status = 'Confirmada' AND DATE(appointment_date) = ? ORDER BY appointment_date ASC", [nutriId, today]),
            // Aniversários da semana (cruzando pacientes ativos com a anamnese)
            pool.query(`
                SELECT p.id, p.nome, a.birthdate
                FROM pacientes p
                JOIN anamnese a ON p.id = a.patientID
                WHERE p.nutriID = ? AND p.status = 'Ativo'
                AND DATE_FORMAT(a.birthdate, '%m-%d') BETWEEN DATE_FORMAT(CURDATE(), '%m-%d') AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 7 DAY), '%m-%d')
            `, [nutriId])
        ]);

        const attentionList = (birthdays || []).map(b => ({
            type: 'birthday',
            text: `Aniversário de ${b.nome}`,
            subtext: new Date(b.birthdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        }));

        const overviewData = {
            kpis: {
                todayAppointments: appointmentsTodayResult[0]?.count || 0,
                activePatients: activePatientsResult[0]?.count || 0,
                monthlyRevenue: monthlyRevenueResult[0]?.total || 0,
                avgScore: avgScoreResult[0]?.avgRating ? parseFloat(avgScoreResult[0].avgRating).toFixed(1) : null
            },
            todayAppointments: todayAppointmentsListResult || [],
            attentionList: attentionList
        };

        res.json({ success: true, data: overviewData });

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

function calculateBMI(weight, heightCm) {
    if (!weight || !heightCm) return null;
    const heightM = heightCm / 100;
    const bmi = weight / (heightM * heightM);
    return parseFloat(bmi.toFixed(1));
}

// export async function getPatientDashboardOverview(req, res) {
//     const patientID = req.session.user.id;

//     try {
//         const [patientRows] = await pool.query('SELECT p.nome, p.nutriID, n.name as nutriName, n.phone as nutriPhone FROM pacientes p JOIN nutricionista n ON p.nutriID = n.id WHERE p.id = ?', [patientID]);

//         if (patientRows.length === 0) {
//             return res.status(404).json({ success: false, message: 'Dados do paciente não encontrados.' });
//         }

//         const { nome: patientName, nutriID, nutriName, nutriPhone } = patientRows[0];

//         const [anamneseRows] = await pool.query(
//             `SELECT weight, height, objective, created_at FROM anamnese WHERE patientID = ? ORDER BY created_at ASC LIMIT 1`,
//             [patientID]
//         );
//         const initialData = anamneseRows[0] || {};

//         const [consultationHistory] = await pool.query(
//             `SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date ASC`,
//             [patientID]
//         );

//         const nextAppointment = await getNextAppointment(patientID);

//         let currentWeight = initialData.weight || 0;
//         let height = initialData.height || 0;

//         if (consultationHistory.length > 0) {
//             const lastConsultation = consultationHistory[consultationHistory.length - 1];
//             currentWeight = lastConsultation.weight || currentWeight;
//             height = lastConsultation.height || height;
//         }

//         const bmi = calculateBMI(currentWeight, height);
//         const initialWeight = initialData.weight || 0;
//         const weightDifference = currentWeight - initialWeight;

//         let parsedObjective = [];
//         if (initialData && initialData.objective) {
//             const objectiveValue = initialData.objective;
//             if (Array.isArray(objectiveValue)) {
//                 parsedObjective = objectiveValue;
//             } else if (typeof objectiveValue === 'string') {
//                 const objStr = objectiveValue.trim();
//                 if (objStr.startsWith('[') && objStr.endsWith(']')) {
//                     try { parsedObjective = JSON.parse(objStr); }
//                     catch (e) { parsedObjective = [objStr.replace(/[\[\]"]/g, '')]; }
//                 } else if (objStr) {
//                     parsedObjective = [objStr];
//                 }
//             } else if (objectiveValue) {
//                 parsedObjective = [String(objectiveValue)];
//             }
//         }

//         const evolutionHistoryWithInitial = [
//             {
//                 consultation_date: initialData.created_at,
//                 weight: initialData.weight,
//                 body_fat_percentage: null,
//                 circum_waist: null,
//                 circum_abdomen: null,
//                 circum_hip: null
//             },
//             ...consultationHistory
//         ];

//         const overviewData = {
//             patientName,
//             nutriID,
//             nutriName,
//             nutriPhone,
//             kpis: {
//                 currentWeight,
//                 initialWeight,
//                 height,
//                 bmi,
//                 weightDifference,
//                 objective: parsedObjective.filter(o => o).join(', ') || 'Não definido',
//             },
//             nextAppointment,
//             evolutionHistory: evolutionHistoryWithInitial,
//         };

//         res.json({ success: true, data: overviewData });

//     } catch (error) {
//         console.error("Erro ao buscar dados do dashboard do paciente:", error);
//         res.status(500).json({ success: false, message: 'Erro interno ao servidor.' });
//     }
// }

async function getNextAppointment(patientID) {
    const [rows] = await pool.query(
        `SELECT 
            id,
            service_type, 
            appointment_date,
            duration
         FROM appointments 
         WHERE patientID = ? AND status = 'Confirmada'
         ORDER BY appointment_date ASC LIMIT 1`,
        [patientID]
    );

    if (rows.length === 0) return null;

    const appointment = rows[0];
    const date = new Date(appointment.appointment_date);

    return {
        id: appointment.id,
        service: appointment.service_type,
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
        time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        duration: appointment.duration,
    };
}

export async function submitSurvey(req, res) {
    const patientID = req.session.user.id;
    const { appointmentId, nutriRating, nutriComments, systemRating, systemComments, mealPlanRating, mealPlanComments } = req.body;

    if (!appointmentId || !nutriRating || !systemRating) {
        return res.status(400).json({ success: false, message: 'Dados da avaliação incompletos.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [appRows] = await connection.query(
            `SELECT id, nutriID FROM appointments 
             WHERE id = ? AND patientID = ? AND is_rated = FALSE AND appointment_date < NOW()`,
            [appointmentId, patientID]
        );

        if (appRows.length === 0) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: 'Consulta não encontrada, não pode ser avaliada ou já foi avaliada.' });
        }

        const nutriID = appRows[0].nutriID;

        await connection.query(
            'INSERT INTO nutri_nps (nutri_id, patient_id, appointment_id, rating, comments) VALUES (?, ?, ?, ?, ?)',
            [nutriID, patientID, appointmentId, nutriRating, nutriComments]
        );

        await connection.query(
            'INSERT INTO system_nps (user_id, user_role, appointment_id, rating, comments) VALUES (?, ?, ?, ?, ?)',
            [patientID, 'paciente', appointmentId, systemRating, systemComments]
        );

        if (mealPlanRating) {
            await connection.query(
                'INSERT INTO meal_plan_nps (nutri_id, patient_id, appointment_id, rating, comments) VALUES (?, ?, ?, ?, ?)',
                [nutriID, patientID, appointmentId, mealPlanRating, mealPlanComments]
            );
        }

        await connection.query(
            "UPDATE appointments SET is_rated = TRUE, status = 'Realizada' WHERE id = ?",
            [appointmentId]
        );

        await connection.commit();
        res.json({ success: true, message: 'Obrigado pelo seu feedback!' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao salvar avaliação:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar sua avaliação.' });
    } finally {
        connection.release();
    }
}

export async function patientList(req, res) {
    const nutriId = req.session.user.id;

    try {
        const query = `
            SELECT 
                p.id,
                p.nome,
                p.email,
                p.phone,
                p.status,
                (SELECT MIN(a.appointment_date) 
                 FROM appointments a 
                 WHERE a.patientID = p.id AND a.appointment_date > NOW() AND a.status = 'Confirmada'
                ) AS appointmentDate,
                (SELECT MAX(a.appointment_date) 
                 FROM appointments a 
                 WHERE a.patientID = p.id AND a.status = 'Realizada'
                ) AS lastUpdateDate
            FROM 
                pacientes p
            WHERE 
                p.nutriID = ?
        `;
        const [rows] = await pool.query(query, [nutriId]);

        const patients = rows.map(patient => {
            if (patient.appointmentDate) {
                patient.appointmentDate = new Date(patient.appointmentDate).toLocaleDateString('pt-BR');
            }
            return patient;
        });

        res.json({ success: true, patients: patients });
    } catch (error) {
        console.error("Erro ao buscar lista de pacientes:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar pacientes.' });
    }
}

export async function createConsultation(req, res) {
    const nutriId = req.session.user.id;
    const {
        appointmentId,
        patientId,
        weight, height,
        circum_waist, circum_abdomen, circum_hip, circum_arm,
        skinfold_triceps, skinfold_subscapular, skinfold_suprailiac, skinfold_abdominal,
        body_fat_percentage,
        subjective_notes, objective_notes, assessment_notes, plan_notes
    } = req.body;

    if (!appointmentId || !patientId || !weight || !height || !subjective_notes || !objective_notes || !assessment_notes || !plan_notes) {
        return res.status(400).json({ success: false, message: "Todos os campos de acompanhamento (peso, altura e anotações SOAP) são obrigatórios." });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const s_subjective = sanitizeInput(subjective_notes);
        const s_objective = sanitizeInput(objective_notes);
        const s_assessment = sanitizeInput(assessment_notes);
        const s_plan = sanitizeInput(plan_notes);

        const [appointmentRows] = await connection.query(
            'SELECT appointment_date FROM appointments WHERE id = ? AND nutriID = ?',
            [appointmentId, nutriId]
        );

        if (appointmentRows.length === 0) {
            throw new Error("Agendamento não encontrado ou não pertence a este nutricionista.");
        }
        const appointment = appointmentRows[0];
        const bmi = calculateBMI(weight, height);

        const query = `
            INSERT INTO consultations (
                appointment_id, patient_id, nutri_id, consultation_date, weight, height, bmi,
                circum_waist, circum_abdomen, circum_hip, circum_arm,
                skinfold_triceps, skinfold_subscapular, skinfold_suprailiac, skinfold_abdominal,
                body_fat_percentage,
                subjective_notes, objective_notes, assessment_notes, plan_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            appointmentId, patientId, nutriId, appointment.appointment_date, weight, height, bmi,
            circum_waist || null, circum_abdomen || null, circum_hip || null, circum_arm || null,
            skinfold_triceps || null, skinfold_subscapular || null, skinfold_suprailiac || null, skinfold_abdominal || null,
            body_fat_percentage || null,
            s_subjective, s_objective, s_assessment, s_plan
        ];

        await connection.query(query, values);

        await connection.query(
            "UPDATE appointments SET status = 'Realizada' WHERE id = ?",
            [appointmentId]
        );

        await connection.commit();
        res.status(201).json({ success: true, message: "Acompanhamento salvo com sucesso!" });

    } catch (error) {
        await connection.rollback();
        console.error("Erro ao criar acompanhamento:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar acompanhamento.' });
    } finally {
        connection.release();
    }
}

export async function scheduleReturnAppointment(req, res) {
    const nutriId = req.session.user.id;
    const { patientId, returnDate, returnTime } = req.body;

    if (!patientId || !returnDate || !returnTime) {
        return res.status(400).json({ success: false, message: 'Dados insuficientes para agendar o retorno.' });
    }

    const connection = await pool.getConnection();
    try {
        const [patientRows] = await connection.query(
            'SELECT nome, email, phone FROM pacientes WHERE id = ? AND nutriID = ?',
            [patientId, nutriId]
        );

        if (patientRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Paciente não encontrado.' });
        }
        const patient = patientRows[0];
        const returnDateTime = `${returnDate} ${returnTime}:00`;

        await connection.query(
            `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, service_type, duration, appointment_date, status, confirmation_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nutriId, patientId,
                patient.nome, patient.email, patient.phone,
                'Consulta de Retorno', 45,
                returnDateTime, 'Confirmada', new Date()
            ]
        );

        res.status(201).json({ success: true, message: 'Consulta de retorno agendada com sucesso!' });

    } catch (error) {
        console.error("Erro ao agendar retorno:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao agendar retorno.' });
    } finally {
        connection.release();
    }
}


export async function getConsultationHistory(req, res) {
    const { patientId } = req.params;
    const nutriId = req.session.user.id;

    try {
        const [historyRows] = await pool.query(
            `SELECT c.*, a.service_type 
             FROM consultations c
             JOIN appointments a ON c.appointment_id = a.id
             WHERE c.patient_id = ? AND c.nutri_id = ? 
             ORDER BY c.consultation_date DESC`,
            [patientId, nutriId]
        );

        const [pendingAppointmentsRows] = await pool.query(
            `SELECT * FROM appointments 
             WHERE patientID = ? AND nutriID = ? 
             AND id NOT IN (SELECT appointment_id FROM consultations WHERE patient_id = ?)
             ORDER BY appointment_date DESC`,
            [patientId, nutriId, patientId]
        );

        res.json({
            success: true,
            history: historyRows,
            pendingAppointments: pendingAppointmentsRows || []
        });

    } catch (error) {
        console.error("Erro ao buscar histórico do paciente:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar histórico.' });
    }
}

export const getTodayAppointment = async (req, res) => {
    try {
        const nutriId = req.session.user.id;
        const { patientId } = req.params;
        const today = new Date().toISOString().split('T')[0];

        const [rows] = await pool.query(`
            SELECT id, subjective_notes, objective_notes, assessment_notes, plan_notes 
            FROM appointments 
            WHERE nutritionist_id = ? AND patient_id = ? AND appointment_date = ? 
            LIMIT 1
        `, [nutriId, patientId, today]);

        if (rows.length > 0) {
            return res.status(200).json({ success: true, appointment: rows[0] });
        }
        res.status(200).json({ success: false, message: 'Nenhuma consulta hoje.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const saveAppointmentNotes = async (req, res) => {
    try {
        const { appointmentId, subjective, objective, assessment, plan } = req.body;

        await pool.query(`
            UPDATE appointments 
            SET subjective_notes = ?, objective_notes = ?, assessment_notes = ?, plan_notes = ?, status = 'Realizada'
            WHERE id = ?
        `, [sanitizeInput(subjective), sanitizeInput(objective), sanitizeInput(assessment), sanitizeInput(plan), appointmentId]);

        res.status(200).json({ success: true, message: 'Prontuário atualizado com sucesso!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getAssessmentHistory = async (req, res) => {
    try {
        const { patientId } = req.params;

        const query = `
            SELECT 
                *,
                created_at as date, calc_body_fat as body_fat, 
                calc_lean_mass as lean_mass
            FROM anthropometric_assessments 
            WHERE patient_id = ? 
            ORDER BY created_at ASC
        `;

        const [rows] = await pool.execute(query, [patientId]);

        res.status(200).json({
            success: true,
            history: rows
        });

    } catch (error) {
        console.error('Erro ao buscar histórico antropométrico:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar dados no servidor.' });
    }
};

let foodsCache = null;
let foodsCacheTime = 0;

export const getFoods = async (req, res) => {
    try {
        if (foodsCache && (Date.now() - foodsCacheTime < 3600000)) { // Cache de 1 hora
            return res.status(200).json({ success: true, library: foodsCache });
        }
        const [rows] = await pool.query('SELECT * FROM foods ORDER BY category, name');

        const library = rows.reduce((acc, food) => {
            const cat = food.category || 'Outros';
            if (!acc[cat]) acc[cat] = [];

            acc[cat].push({
                id: food.id,
                name: food.name,
                baseUnit: food.base_qty || 100,
                kcal: parseFloat(food.kcal) || 0,
                carbs: parseFloat(food.carbs) || 0,
                protein: parseFloat(food.protein) || 0,
                fat: parseFloat(food.fat) || 0,
                fiber: parseFloat(food.fiber) || 0,
                sodium: parseFloat(food.sodium) || 0,
                calcium: parseFloat(food.calcium) || 0,
                iron: parseFloat(food.iron) || 0,
                zinc: parseFloat(food.zinc) || 0,
                magnesium: parseFloat(food.magnesium) || 0,
                potassium: parseFloat(food.potassium) || 0,
                vitA: parseFloat(food.vitA) || 0,
                vitC: parseFloat(food.vitC) || 0,
                vitD: parseFloat(food.vitD) || 0,
                vitE: parseFloat(food.vitE) || 0,
                vitB12: parseFloat(food.vitB12) || 0
            });
            return acc;
        }, {});

        foodsCache = library;
        foodsCacheTime = Date.now();
        res.status(200).json({ success: true, library });
    } catch (error) {
        console.error('Erro ao buscar alimentos:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar base de dados.' });
    }
};

export async function saveMealPlan(req, res) {
    const nutriId = req.session.user.id;
    const { patientId, meals } = req.body;

    if (!patientId || !meals || meals.length === 0) {
        return res.status(400).json({ success: false, message: 'Dados do plano alimentar incompletos.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // CHECK DE SEGURANÇA (IDOR): Garante que a nutricionista não adultere o plano de um paciente que não é seu
        const [patientOwnerCheck] = await connection.query('SELECT id FROM pacientes WHERE id = ? AND nutriID = ?', [patientId, nutriId]);
        if (patientOwnerCheck.length === 0) {
            throw new Error('Acesso negado: Paciente não pertence a este nutricionista ou não existe.');
        }

        const [existingPlans] = await connection.query('SELECT id FROM meal_plans WHERE patient_id = ?', [patientId]);
        if (existingPlans.length > 0) {
            await connection.query('DELETE FROM meal_plans WHERE patient_id = ?', [patientId]);
        }

        const [planResult] = await connection.query(
            'INSERT INTO meal_plans (patient_id, nutri_id) VALUES (?, ?)',
            [patientId, nutriId]
        );
        const mealPlanId = planResult.insertId;

        for (const meal of meals) {
            const [mealResult] = await connection.query(
                'INSERT INTO meals (meal_plan_id, name, time, notes, recipes) VALUES (?, ?, ?, ?, ?)',
                [mealPlanId, meal.name, meal.time || null, meal.notes || null, meal.recipes || null]
            );
            const mealId = mealResult.insertId;

            if (meal.items && meal.items.length > 0) {
                // HIGH PERFORMANCE: Bulk insert para aniquilar o gargalo de N+1 Queries da concorrência
                const itemValues = meal.items.map(item => [mealId, item.foodId, item.quantity, item.optionGroup || 1]);
                await connection.query(
                    'INSERT INTO meal_items (meal_id, food_id, quantity, option_group) VALUES ?',
                    [itemValues]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Plano alimentar salvo com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error('Erro ao salvar plano alimentar:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar o plano.' });
    } finally {
        connection.release();
    }
}


export async function getMealPlan(req, res) {
    const { patientId } = req.params;
    
    // FIX DE SEGURANÇA: Impede que um paciente veja a dieta de outro (IDOR)
    if (req.session.user.role === 'paciente' && req.session.user.id !== parseInt(patientId)) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Você não tem permissão para visualizar esta dieta.' });
    }

    try {
        const query = `
            SELECT 
                mp.id as plan_id, mp.title,
                m.id as meal_id, m.name as meal_name, m.time, m.notes, m.recipes,
                mi.id as item_id, mi.quantity, mi.option_group,
                f.name as food_name, f.category
            FROM meal_plans mp
            JOIN meals m ON mp.id = m.meal_plan_id
            LEFT JOIN meal_items mi ON m.id = mi.meal_id
            LEFT JOIN foods f ON mi.food_id = f.id
            WHERE mp.patient_id = ?
            ORDER BY m.display_order, m.id, mi.id;
        `;
        const [rows] = await pool.query(query, [patientId]);

        if (rows.length === 0) {
            return res.json({ success: true, plan: null });
        }

        console.log("rows")
        console.log(rows)

        const plan = {
            id: rows[0].plan_id,
            title: rows[0].title,
            meals: []
        };

        const mealsMap = new Map();
        rows.forEach(row => {
            if (!mealsMap.has(row.meal_id)) {
                mealsMap.set(row.meal_id, {
                    id: row.meal_id,
                    name: row.meal_name,
                    time: row.time,
                    notes: row.notes,
                    recipes: row.recipes,
                    items: []
                });
            }
            if (row.item_id) {
                mealsMap.get(row.meal_id).items.push({
                    id: row.item_id,
                    foodName: row.food_name,
                    quantity: row.quantity,
                    optionGroup: row.option_group
                });
            }
        });

        plan.meals = Array.from(mealsMap.values());

        res.json({ success: true, plan });

    } catch (error) {
        console.error("Erro ao buscar plano alimentar:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

export async function notifyPatientMealPlan(req, res) {
    const patientId = req.params.patientId;
    const nutriId = req.session.user.id;

    try {
        const [patientRows] = await pool.query('SELECT nome, phone FROM pacientes WHERE id = ? AND nutriID = ?', [patientId, nutriId]);
        
        if (patientRows.length === 0) {
            return res.status(403).json({ success: false, message: 'Paciente não encontrado.' });
        }

        const patient = patientRows[0];
        
        if (!patient.phone) {
            return res.status(400).json({ success: false, message: 'O paciente não possui celular cadastrado.' });
        }

        const firstName = patient.nome.split(' ')[0];
        const message = `🍏 Olá ${firstName}!\n\nSeu novo *Plano Alimentar* acabou de ser prescrito e disponibilizado pela sua Nutricionista.\n\nAcesse o aplicativo NutriCare para visualizar sua dieta completa, suas novas metas e a lista de compras inteligente!\n\nFoco no objetivo! 💪`;

        await sendWhatsAppMessage(patient.phone, message);

        res.json({ success: true, message: 'Aviso enviado para o WhatsApp do paciente!' });

    } catch (error) {
        console.error('Erro ao notificar paciente sobre a dieta:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao notificar paciente.' });
    }
}

function isTimeInBreak(timeStr, breaks) {
    if (!breaks || !Array.isArray(breaks) || breaks.length === 0) return false;
    const time = parseInt(timeStr.replace(':', ''));

    for (const b of breaks) {
        const start = parseInt(b.start.replace(':', ''));
        const end = parseInt(b.end.replace(':', ''));

        if (time >= start && time < end) {
            return true;
        }
    }
    return false;
}

function overlapsWithBreak(slotStartStr, duration, breaks) {
    if (!breaks || breaks.length === 0) return false;

    const [h, m] = slotStartStr.split(':').map(Number);
    const slotStartMin = h * 60 + m;
    const slotEndMin = slotStartMin + duration;

    for (const b of breaks) {
        const [sh, sm] = b.start.split(':').map(Number);
        const [eh, em] = b.end.split(':').map(Number);
        const breakStartMin = sh * 60 + sm;
        const breakEndMin = eh * 60 + em;

        if (slotStartMin < breakEndMin && slotEndMin > breakStartMin) {
            return true;
        }
    }
    return false;
}

export async function getScheduleConfig(req, res) {
    const nutriId = req.session.user.id;
    try {
        const [rows] = await pool.query(
            'SELECT buffer_time, break_times FROM nutri_agenda WHERE nutriID = ?',
            [nutriId]
        );

        if (rows.length > 0) {
            const config = rows[0];
            if (config.break_times && typeof config.break_times === 'string') {
                config.breakTimes = JSON.parse(config.break_times);
            } else {
                config.breakTimes = config.break_times || [];
            }
            config.bufferTime = config.buffer_time;
            delete config.break_times;
            delete config.buffer_time;

            res.json({ success: true, config });
        } else {
            res.json({ success: true, config: { bufferTime: 0, breakTimes: [] } });
        }
    } catch (error) {
        console.error("Erro ao buscar config agenda:", error);
        res.status(500).json({ success: false, message: 'Erro ao buscar configurações.' });
    }
}

export async function updateScheduleConfig(req, res) {
    const nutriId = req.session.user.id;
    const { bufferTime, breakTimes } = req.body;

    if (typeof bufferTime !== 'number') {
        return res.status(400).json({ success: false, message: 'Dados inválidos.' });
    }

    try {
        const breaksJson = JSON.stringify(breakTimes || []);

        const [existing] = await pool.query('SELECT nutriID FROM nutri_agenda WHERE nutriID = ?', [nutriId]);

        if (existing.length > 0) {
            await pool.query(
                'UPDATE nutri_agenda SET buffer_time = ?, break_times = ? WHERE nutriID = ?',
                [bufferTime, breaksJson, nutriId]
            );
        } else {
            await pool.query(
                'INSERT INTO nutri_agenda (nutriID, startTime, endTime, duration, available_days, buffer_time, break_times) VALUES (?, "09:00", "18:00", 60, "[]", ?, ?)',
                [nutriId, bufferTime, breaksJson]
            );
        }

        res.json({ success: true, message: 'Configurações de agenda salvas com sucesso!' });
    } catch (error) {
        console.error("Erro ao salvar config agenda:", error);
        res.status(500).json({ success: false, message: 'Erro ao salvar configurações.' });
    }
}

export const getPatientDashboardOverview = async (req, res) => {
    try {
        // Pega o ID do paciente logado na sessão atual
        const patientId = req.session.user.id;

        // 1. BUSCAR A PRÓXIMA CONSULTA (Mais próxima a partir de hoje)
        const [appointments] = await pool.execute(`
            SELECT service_type, appointment_date, duration 
            FROM appointments 
            WHERE patientID = ? 
              AND appointment_date >= NOW() 
              AND status = 'Confirmada'
            ORDER BY appointment_date ASC 
            LIMIT 1
        `, [patientId]);

        let nextAppointment = null;
        if (appointments.length > 0) {
            const apt = appointments[0];
            const dateObj = new Date(apt.appointment_date);

            nextAppointment = {
                service: apt.service_type,
                date: dateObj.toLocaleDateString('pt-BR'),
                time: dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                duration: apt.duration
            };
        }

        // 2. BUSCAR HISTÓRICO ANTROPOMÉTRICO (Para popular os Gráficos e os KPIs)
        const [history] = await pool.execute(`
            SELECT 
                weight, 
                calc_bmi as bmi, 
                calc_body_fat as body_fat_percentage,
                circ_waist as circum_waist, 
                circ_chest as circum_abdomen, -- Mapeado para o gráfico
                circ_hip as circum_hip,
                created_at as consultation_date
            FROM anthropometric_assessments
            WHERE patient_id = ?
            ORDER BY created_at ASC
        `, [patientId]);

        // 3. CALCULAR OS KPIs (Resumo Rápido)
        let kpis = {
            currentWeight: null,
            bmi: null,
            bodyFat: null,
            weightDifference: null
        };

        if (history.length > 0) {
            const firstAssessment = history[0];
            const lastAssessment = history[history.length - 1]; // O registro mais recente

            kpis.currentWeight = lastAssessment.weight;
            kpis.bmi = lastAssessment.bmi;
            kpis.bodyFat = lastAssessment.body_fat_percentage;

            const diff = parseFloat(lastAssessment.weight) - parseFloat(firstAssessment.weight);
            kpis.weightDifference = diff.toFixed(1);
        }

        res.status(200).json({
            success: true,
            data: {
                kpis,
                nextAppointment,
                evolutionHistory: history
            }
        });

    } catch (error) {
        console.error("Erro ao buscar overview do paciente:", error);
        res.status(500).json({ success: false, error: "Erro interno do servidor ao carregar dashboard." });
    }
};

export async function forgotPassword(req, res) {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'E-mail obrigatório.' });

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            // Por segurança anti-enumeração, retornamos sucesso de forma genérica
            return res.json({ success: true, message: 'Se o e-mail existir, um link será enviado.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // Validade de 1 hora

        await connection.query('UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?', [token, expires, email]);

        // Configuração de envio de E-mail
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io",
            port: process.env.SMTP_PORT || 2525,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const resetLink = `http://localhost:3000/pages/reset-password.html?token=${token}`;

        await transporter.sendMail({
            from: '"Equipe NutriCare" <suporte@nutricare.com>',
            to: email,
            subject: 'Recuperação de Senha - NutriCare',
            html: `<p>Você solicitou a recuperação de senha.</p><p>Clique <a href="${resetLink}">aqui</a> para redefinir sua senha.</p><p>Este link expira em 1 hora.</p>`
        });

        res.json({ success: true, message: 'Se o e-mail existir, um link será enviado.' });
    } catch (error) {
        console.error('Erro no forgotPassword:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor ao tentar enviar o e-mail.' });
    } finally {
        connection.release();
    }
}

export async function resetPassword(req, res) {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Dados inválidos.' });

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()', [token]);
        if (rows.length === 0) return res.status(400).json({ success: false, message: 'Link inválido ou expirado. Tente novamente.' });

        const userId = rows[0].id;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.query('UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [hashedPassword, userId]);

        res.json({ success: true, message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        console.error('Erro no resetPassword:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor.' });
    } finally {
        connection.release();
    }
}

export async function getNutriNotifications(req, res) {
    const nutriId = req.session.user.id;
    try {
        const [pendingRows] = await pool.query(
            `SELECT id, patient_name, service_type, appointment_date
             FROM appointments 
             WHERE nutriID = ? AND status = 'Pendente' 
             ORDER BY appointment_date ASC LIMIT 5`,
            [nutriId]
        );
        
        const notifications = pendingRows.map(row => {
            const dateStr = new Date(row.appointment_date).toLocaleDateString('pt-BR');
            return {
                id: row.id, type: 'appointment', title: 'Nova Solicitação',
                message: `${row.patient_name} solicitou ${row.service_type} para ${dateStr}.`,
                icon: 'bi-calendar-plus', color: 'text-warning'
            };
        });

        res.json({ success: true, notifications });
    } catch (error) {
        console.error("Erro ao buscar notificações reais:", error);
        res.status(500).json({ success: false, message: 'Erro ao buscar notificações.' });
    }
}

export async function getExamInsight(req, res) {
    const { examSummary, patientHistory } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ success: false, message: 'A chave da API do Gemini não está configurada (GEMINI_API_KEY).' });
    }

    try {
        // BUSCA DINÂMICA DO MODELO (Mesma lógica do ai.controller.js)
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listResponse.json();

        if (!listData.models || listData.models.length === 0) {
            return res.status(500).json({ success: false, message: 'Sua chave de API não tem acesso a nenhum modelo do Gemini.' });
        }

        const validModels = listData.models.filter(m =>
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes('generateContent') &&
            m.name.includes('gemini') &&
            !m.name.includes('vision')
        );

        if (validModels.length === 0) {
            return res.status(500).json({ success: false, message: 'Nenhum modelo de texto liberado para sua chave.' });
        }

        const selectedModel = validModels[0].name; // ex: "models/gemini-pro" ou "models/gemini-1.5-flash"

        const prompt = `Você é um assistente de inteligência artificial avançado especializado em Nutrição Clínica e Endocrinologia.
Sua tarefa é analisar o seguinte resumo de exame laboratorial e cruzar os marcadores com o histórico do paciente para fornecer um insight clínico direto, prático e focado na conduta nutricional.

--- HISTÓRICO DO PACIENTE ---
Idade: ${patientHistory.age} anos
Objetivo: ${patientHistory.objective}
Problemas de Saúde: ${patientHistory.health_issues}

--- RESUMO DOS EXAMES ---
${examSummary}

Instruções de Conduta:
1. Identifique possíveis deficiências nutricionais ou desvios metabólicos baseado nos marcadores fornecidos.
2. Faça correlações com os Problemas de Saúde relatados pelo paciente no histórico.
3. Retorne um ou dois parágrafos diretos e estritamente profissionais. Sem saudações ou apresentações.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos de timeout
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (data.candidates && data.candidates.length > 0) res.json({ success: true, insight: data.candidates[0].content.parts[0].text });
        else throw new Error('A API retornou uma resposta vazia.');
    } catch (error) {
        if (error.name === 'AbortError') {
            return res.status(504).json({ success: false, message: 'A Inteligência Artificial demorou muito para responder (Timeout). Tente novamente.' });
        }
        console.error('Erro no AI Exam Insight:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao processar a IA. Verifique as configurações da API.' });
    }
}

export async function generateDietAI(req, res) {
    const { patientId } = req.body;
    const nutriId = req.session.user.id;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ success: false, message: 'A chave da API do Gemini não está configurada.' });
    }

    try {
        // Busca os dados clínicos do paciente para alimentar a IA
        const [anamnese] = await pool.query('SELECT * FROM anamnese WHERE patientID = ? ORDER BY created_at DESC LIMIT 1', [patientId]);
        const [anthro] = await pool.query('SELECT * FROM anthropometric_assessments WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1', [patientId]);

        if (anamnese.length === 0) {
            return res.status(400).json({ success: false, message: 'O paciente precisa ter uma anamnese preenchida para usar a IA.' });
        }

        const aData = anamnese[0];
        const pData = anthro.length > 0 ? anthro[0] : null;

        const prompt = `
        Você é um Nutricionista Clínico Esportivo auxiliando na criação de um plano alimentar brasileiro.
        Baseado nos dados do paciente abaixo, crie uma SUGESTÃO de esqueleto de plano alimentar (Café da Manhã, Almoço, Lanche, Jantar).
        
        DADOS DO PACIENTE:
        Objetivo: ${aData.objective || 'Manutenção'}
        Alergias/Intolerâncias: ${aData.allergic || 'Nenhuma'}
        Aversões: ${aData.avoidment || 'Nenhuma'}
        Patologias: ${aData.health_issue || 'Nenhuma'}
        ${pData ? `Peso: ${pData.weight}kg | Gordura: ${pData.calc_body_fat}% | Massa Magra: ${pData.calc_lean_mass}kg` : ''}
        
        REGRA: Use alimentos típicos da Tabela TACO brasileira. 
        Retorne APENAS um texto bem formatado em HTML (use <b>, <ul>, <li>, <br>) contendo as refeições e as justificativas fisiológicas das escolhas. Não use markdown como \`\`\`html.
        `;

        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listResponse.json();
        const selectedModel = listData.models.find(m => m.name.includes('gemini-1.5'))?.name || 'models/gemini-1.5-flash';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s de timeout (Geração de dieta é mais pesada)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);
        
        if (data.candidates && data.candidates.length > 0) {
            let aiText = data.candidates[0].content.parts[0].text;
            // Limpa formatação markdown se a IA colocar acidentalmente
            aiText = aiText.replace(/```html/g, '').replace(/```/g, '');
            
            res.json({ 
                success: true, 
                suggestion: aiText 
            });
        } else {
            throw new Error('Resposta vazia da IA.');
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            return res.status(504).json({ success: false, message: 'A geração da dieta demorou muito para responder (Timeout). Tente novamente.' });
        }
        console.error('Erro ao gerar dieta com IA:', error);
        res.status(500).json({ success: false, message: 'Falha ao conectar com o modelo de inteligência artificial.' });
    }
}

// -------------------------------------------------------------
// FEATURES PREMIUM DO PACIENTE (NUTRICHEF & SMART SHOPPING LIST)
// -------------------------------------------------------------

export async function generatePatientShoppingList(req, res) {
    const patientId = req.session.user.id;
    const daysMultiplier = parseInt(req.query.days) || 7; // Padrão: Lista para 7 dias

    try {
        const query = `
            SELECT f.name as food_name, f.category, SUM(mi.quantity) as daily_quantity
            FROM meal_plans mp
            JOIN meals m ON mp.id = m.meal_plan_id
            JOIN meal_items mi ON m.id = mi.meal_id
            JOIN foods f ON mi.food_id = f.id
            WHERE mp.patient_id = ?
            GROUP BY f.id, f.name, f.category
            ORDER BY f.category, f.name;
        `;
        const [rows] = await pool.query(query, [patientId]);

        if (rows.length === 0) {
            return res.json({ success: true, message: 'Nenhum plano alimentar ativo.', shoppingList: {} });
        }

        // Agrupa por categoria e multiplica pelos dias da semana
        const shoppingList = rows.reduce((acc, item) => {
            const category = item.category || 'Outros';
            if (!acc[category]) acc[category] = [];
            
            const totalQty = (parseFloat(item.daily_quantity) * daysMultiplier).toFixed(0);
            acc[category].push({ name: item.food_name, quantity: totalQty + 'g/ml' });
            return acc;
        }, {});

        res.json({ success: true, days: daysMultiplier, shoppingList });
    } catch (error) {
        console.error("Erro ao gerar lista de compras:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao gerar lista.' });
    }
}

export async function generatePatientRecipeAI(req, res) {
    const patientId = req.session.user.id;
    const apiKey = process.env.GEMINI_API_KEY;
    const { mealName } = req.body; // Ex: "Almoço" ou "Jantar"

    if (!apiKey) return res.status(500).json({ success: false, message: 'API Key não configurada.' });

    try {
        // Busca APENAS os alimentos daquela refeição específica do paciente
        const query = `
            SELECT f.name as food_name, mi.quantity 
            FROM meal_plans mp
            JOIN meals m ON mp.id = m.meal_plan_id
            JOIN meal_items mi ON m.id = mi.meal_id
            JOIN foods f ON mi.food_id = f.id
            WHERE mp.patient_id = ? AND m.name LIKE ?;
        `;
        const [foods] = await pool.query(query, [patientId, `%${mealName}%`]);

        if (foods.length === 0) {
            return res.status(400).json({ success: false, message: `Nenhum alimento encontrado para a refeição: ${mealName}.` });
        }

        const ingredientsList = foods.map(f => `${f.quantity}g de ${f.food_name}`).join(', ');

        const prompt = `
        Atue como um Chef de Cozinha Saudável. O paciente tem a seguinte lista estrita de ingredientes liberados para o ${mealName}:
        [${ingredientsList}]
        
        Crie uma receita inovadora, saborosa e prática usando APENAS os ingredientes listados (o uso de água, sal, pimenta e ervas naturais é livre). 
        Retorne em HTML formatado com <h3>Título da Receita</h3>, <p><b>Modo de Preparo:</b>...</p>. Seja criativo para tirar o paciente da rotina chata da dieta!
        `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        res.json({ success: true, recipe: data.candidates[0].content.parts[0].text.replace(/```html/g, '').replace(/```/g, '') });
    } catch (error) {
        if (error.name === 'AbortError') {
            return res.status(504).json({ success: false, message: 'A Inteligência Artificial demorou muito para responder (Timeout). Tente novamente.' });
        }
        console.error("Erro na IA do Paciente:", error);
        res.status(500).json({ success: false, message: 'Falha ao gerar receita.' });
    }
}