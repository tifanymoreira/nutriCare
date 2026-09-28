// nutricare-project/server/controllers/auth.controller.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../config/dbConnect.js';
import { validarCRN } from '../middlewares/checkCrn.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
// INTEGRAÇÃO DE E-MAIL (NODEMAILER)
// -------------------------------------------------------------
async function sendNutriEmail(nutriName, nutriEmail, toEmail, subject, htmlContent) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: `"${nutriName}" <${process.env.SMTP_USER || 'suporte@nutricare.com'}>`,
            replyTo: nutriEmail,
            to: toEmail,
            subject: subject,
            html: `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e9ecef; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="background-color: #2a9d8f; padding: 25px; text-align: center;">
                        <h2 style="color: #fff; margin: 0; font-size: 24px; font-weight: bold;">NutriCare</h2>
                    </div>
                    <div style="padding: 35px 30px; background-color: #fff;">
                        ${htmlContent}
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #adb5bd; border-top: 1px solid #e9ecef;">
                        <p style="margin: 0;">Este é um e-mail automático enviado pela plataforma NutriCare.</p>
                        <p style="margin: 5px 0 0 0;">Em caso de dúvidas, responda este e-mail para falar diretamente com a Dra. ${nutriName}.</p>
                    </div>
                </div>
            `
        });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
    }
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
            alergias, aversao, gostos, alcool, medicacao, atividade_fisica, sono, exames_sangue, expectativas,
            dynamic_answers
        } = anamneseData;

        // Sanitização básica contra inserção de scripts em campos sensíveis
        const safeProblemaSaude = sanitizeInput(problema_saude);
        const safeExpectativas = sanitizeInput(expectativas);
        const safeDynamicAnswers = dynamic_answers ? JSON.stringify(dynamic_answers) : null;

        await connection.query(
            `INSERT INTO anamnese (
            nutriID, patientID, name, weight, height, birthdate, objective, 
            health_issue, surgerie, digestion, intestino, fezes, water_ingestion, 
            period_cicle, previous_diet, mastigacao, allergic, avoidment, fav_food,
            alcohol, medicine, exercise, wake_up_time, blood_exam, final_question, created_at, dynamic_answers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nutriID, patientId, name, peso, altura, data_nascimento, JSON.stringify(objetivos),
                safeProblemaSaude, cirurgia, digestao, intestino, consistencia_fezes, ingestao_agua,
                ciclo_menstrual, tratamento_anterior, mastigacao, alergias, aversao, gostos, alcool,
                medicacao, atividade_fisica, sono, exames_sangue, safeExpectativas, new Date(), safeDynamicAnswers
            ]
        );

        await connection.commit();

        // E-mail de boas-vindas (fire-and-forget — não bloqueia o cadastro)
        pool.query('SELECT name, email FROM nutricionista WHERE id = ?', [nutriID])
            .then(([nutriRows]) => {
                if (nutriRows.length > 0) {
                    const nutri = nutriRows[0];
                    const loginUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
                    const htmlContent = `
                        <h3 style="color:#264653;margin-top:0;font-size:22px;">Bem-vinda(o) ao NutriCare! 🎉</h3>
                        <p style="font-size:16px;line-height:1.5;">Olá <strong>${name.split(' ')[0]}</strong>,</p>
                        <p style="font-size:16px;line-height:1.5;">Sua conta foi criada com sucesso e você já está vinculada(o) à <strong>Dra. ${nutri.name}</strong>.</p>
                        <p style="font-size:16px;line-height:1.5;">Acesse a plataforma para acompanhar seu plano alimentar, consultas e evolução:</p>
                        <div style="text-align:center;margin:30px 0;">
                            <a href="${loginUrl}/pages/login.html" style="background:#2a9d8f;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">Acessar o NutriCare</a>
                        </div>
                        <p style="font-size:14px;color:#6c757d;">Em caso de dúvidas, responda este e-mail para falar com a Dra. ${nutri.name}.</p>
                    `;
                    return sendNutriEmail(nutri.name, nutri.email, email, 'Bem-vinda(o) ao NutriCare! 🎉', htmlContent);
                }
            })
            .catch(e => console.warn('Aviso: erro ao enviar e-mail de boas-vindas:', e.message));

        req.session.user = { id: patientId, name, email, role, nutriID, patient_type: 'particular' };

        // SOLUÇÃO: Grava a sessão ativamente e aguarda antes de enviar o retorno de sucesso ao client
        req.session.save((err) => {
            if (err) {
                console.error("Erro ao salvar sessão do paciente:", err);
                return res.status(500).json({ 
                    success: false, 
                    message: "Cadastro realizado, mas houve um erro ao iniciar sua sessão. Tente fazer login." 
                });
            }
            
            return res.status(201).json({ 
                success: true, 
                message: 'Cadastro e anamnese realizados com sucesso!' 
            });
        });

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
                const [pacienteRows] = await pool.query('SELECT nutriID, patient_type FROM pacientes WHERE id = ?', [user.id]);
                if (pacienteRows.length > 0) {
                    nutriID = pacienteRows[0].nutriID;
                    user.patient_type = pacienteRows[0].patient_type || 'particular';
                }
                redirectUrl = '/pages/paciente/dashboard.html';
            } else {
                return res.status(500).json({ success: false, message: 'Tipo de usuário desconhecido.' });
            }

            req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, nutriID, patient_type: user.patient_type || null };
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

export async function getMe(req, res) {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Usuário não logado.' });
    }
    // Para pacientes: sincroniza patient_type com o banco a cada chamada
    if (req.session.user.role === 'paciente') {
        try {
            const [rows] = await pool.query('SELECT patient_type FROM pacientes WHERE id = ?', [req.session.user.id]);
            if (rows.length > 0) {
                req.session.user.patient_type = rows[0].patient_type || 'particular';
            }
        } catch(e) {}
    }
    res.json({ success: true, user: req.session.user });
}

// Verifica no Mercado Pago se uma fatura ainda pendente já foi paga e atualiza o
// status — funciona como rede de segurança caso o webhook não tenha chegado
// (ex.: túnel ngrok fora do ar). Retorna true se a fatura passou a "Paid".
async function reconcileInvoiceWithMP(invoiceId) {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token || token === 'seu-token-mercadopago-aqui') return false;
    try {
        const r = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(invoiceId)}&sort=date_created&criteria=desc`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await r.json();
        const approved = Array.isArray(data.results) && data.results.some(p => p.status === 'approved');
        if (approved) {
            await pool.query("UPDATE invoices SET status = 'Paid' WHERE id = ? AND status <> 'Paid'", [invoiceId]);
            return true;
        }
    } catch (e) {
        console.error('Falha ao reconciliar fatura com Mercado Pago:', e.message);
    }
    return false;
}

// Reconciliação em lote: confere todas as faturas pendentes que possuem link de
// pagamento e ajusta o status localmente para a resposta.
async function reconcilePendingInvoices(invoices) {
    const pendentes = invoices.filter(inv => inv.payment_link && inv.status !== 'Paid' && inv.status !== 'Pago');
    if (!pendentes.length) return;
    await Promise.all(pendentes.map(async inv => {
        if (await reconcileInvoiceWithMP(inv.id)) inv.status = 'Paid';
    }));
}

// Dispara a reconciliação com o Mercado Pago em SEGUNDO PLANO (sem bloquear a
// resposta), com throttle por usuário para não chamar a API a cada filtro.
// A interface pega o status atualizado no próximo carregamento/refresh.
const _reconcileThrottle = new Map();
function scheduleReconcile(key, invoices) {
    const hasPending = invoices.some(inv => inv.payment_link && inv.status !== 'Paid' && inv.status !== 'Pago');
    if (!hasPending) return;
    const now = Date.now();
    if (now - (_reconcileThrottle.get(key) || 0) < 15000) return;
    _reconcileThrottle.set(key, now);
    reconcilePendingInvoices(invoices).catch(() => {});
}

export const getPatientInvoices = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (req.session.user.id !== parseInt(userId) && req.session.user.role !== 'nutricionista') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const [invoices] = await pool.query(
            `SELECT id, totalValue as amount, status, dueDate as due_date, issueDate as issue_date, payment_link
             FROM invoices
             WHERE patientId = ?
             ORDER BY issueDate DESC`,
            [userId]
        );

        res.status(200).json({ success: true, invoices });
        scheduleReconcile(`pat:${userId}`, invoices); // confere pagamentos em 2º plano
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
    const { dates, startTime, endTime, slotDuration, bufferTime, breakTimes } = req.body;
    const nutriId = req.session.user.id;

    if (!nutriId || !dates || dates.length === 0 || !startTime || !endTime || !slotDuration) {
        return res.status(400).json({ success: false, message: 'Dados de agenda incompletos ou inválidos.' });
    }

    try {
        const available_days_json = JSON.stringify(dates);
        const buffer = parseInt(bufferTime) || 0;
        const breaks_json = JSON.stringify(Array.isArray(breakTimes) ? breakTimes : []);

        const [existing] = await pool.query('SELECT nutriID FROM nutri_agenda WHERE nutriID = ?', [nutriId]);

        if (existing.length > 0) {
            await pool.query(
                'UPDATE nutri_agenda SET startTime = ?, endTime = ?, duration = ?, available_days = ?, buffer_time = ?, break_times = ? WHERE nutriID = ?',
                [startTime, endTime, slotDuration, available_days_json, buffer, breaks_json, nutriId]
            );
        } else {
            await pool.query(
                'INSERT INTO nutri_agenda (nutriID, startTime, endTime, duration, available_days, buffer_time, break_times) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [nutriId, startTime, endTime, slotDuration, available_days_json, buffer, breaks_json]
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
    let { nutriId, service, date, time, patientData, birthDate, objective } = req.body;

    const patientID = req.session?.user?.id || null;

    if (patientID) {
        if (!nutriId || !service || !date || !time) {
            return res.status(400).json({ success: false, message: 'Dados de agendamento incompletos.' });
        }
        try {
            const [pRows] = await pool.query('SELECT nome, email, phone FROM pacientes WHERE id = ?', [patientID]);
            if (pRows.length > 0) {
                patientData = {
                    name: pRows[0].nome,
                    email: pRows[0].email,
                    phone: pRows[0].phone
                };
            }
            const [aRows] = await pool.query('SELECT birthdate FROM anamnese WHERE patientID = ? ORDER BY id DESC LIMIT 1', [patientID]);
            if (aRows.length > 0) {
                birthDate = aRows[0].birthdate;
            } else {
                birthDate = null;
            }
        } catch(e) {}
    } else {
        if (!nutriId || !service || !date || !time || !patientData || !patientData.name || !patientData.email || !patientData.phone || !birthDate || !objective) {
            return res.status(400).json({ success: false, message: 'Dados de agendamento incompletos.' });
        }
    }

    const appointmentDateStr = `${date} ${time}:00`;

    const appointmentDateTime = new Date(appointmentDateStr);
    if (appointmentDateTime < new Date()) {
        return res.status(409).json({ success: false, message: 'Não é possível agendar para um horário que já passou.', appointment: 'not_allowed' });
    }

    // Lock exclusivo por slot: impede race condition entre requisições simultâneas
    const lockKey = `slot_${nutriId}_${appointmentDateStr.replace(/[^0-9]/g, '')}`;
    const conn = await pool.getConnection();

    try {
        const [[lockRow]] = await conn.query('SELECT GET_LOCK(?, 5) AS ok', [lockKey]);
        if (!lockRow.ok) {
            return res.status(409).json({ success: false, message: 'Este horário está sendo processado. Tente novamente em instantes.' });
        }

        try {
            const [[checkRow]] = await conn.query(
                'SELECT COUNT(*) AS cnt FROM appointments WHERE nutriID = ? AND appointment_date = ? AND status != "Rejeitada" AND status != "Cancelada"',
                [nutriId, appointmentDateStr]
            );

            if (checkRow.cnt > 0) {
                return res.status(409).json({ success: false, message: 'Este horário não está mais disponível. Por favor, escolha outro.' });
            }

            const [result] = await conn.query(
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

        } finally {
            await conn.query('SELECT RELEASE_LOCK(?)', [lockKey]);
        }

    } catch (error) {
        console.error('Erro ao registrar pré-agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao realizar o pré-agendamento.' });
    } finally {
        conn.release();
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
    const { appointmentId, status, rejectionType, rejectionMessage, videoLink } = req.body;

    if (!['Confirmada', 'Rejeitada'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }

    let query = '';
    let values = [];

    if (status === 'Confirmada') {
        if (videoLink) {
            query = 'UPDATE appointments SET status = ?, confirmation_date = ?, rejection_type = NULL, rejection_message = NULL, video_link = ? WHERE id = ? AND nutriID = ?';
            values = [status, new Date(), videoLink, appointmentId, nutriId];
        } else {
            query = 'UPDATE appointments SET status = ?, confirmation_date = ?, rejection_type = NULL, rejection_message = NULL WHERE id = ? AND nutriID = ?';
            values = [status, new Date(), appointmentId, nutriId];
        }
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
        // Busca dados do paciente e do Nutri ANTES de atualizar para enviar no E-mail
        const [appRows] = await pool.query('SELECT patient_name, patient_email, appointment_date, service_type FROM appointments WHERE id = ?', [appointmentId]);
        const [nutriRows] = await pool.query('SELECT name, email, address FROM nutricionista WHERE id = ?', [nutriId]);
        await pool.query(query, values);
        
        // Automação E-mail Real
        if (appRows.length > 0 && nutriRows.length > 0) {
            const app = appRows[0];
            const nutri = nutriRows[0];
            const dateStr = new Date(app.appointment_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            
            if (status === 'Confirmada') {
                let addressHtml;
                if (videoLink) {
                    addressHtml = `<div style="background: #f0fdfa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0dcaf0;"><strong>💻 Link da Videochamada:</strong><br><a href="${videoLink}" style="color:#0d6efd;word-break:break-all;">${videoLink}</a></div>`;
                } else if (nutri.address) {
                    addressHtml = `<div style="background: #f1f3f5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2a9d8f;"><strong>📍 Local de Atendimento:</strong><br>${nutri.address}</div>`;
                } else {
                    addressHtml = `<div style="background: #f1f3f5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0dcaf0;"><strong>💻 Atendimento Online</strong><br>O link da chamada será enviado ou combinado próximo ao horário.</div>`;
                }
                
                const htmlContent = `
                    <h3 style="color: #264653; margin-top: 0; font-size: 22px;">Sua consulta foi confirmada! ✅</h3>
                    <p style="font-size: 16px; line-height: 1.5;">Olá <strong>${app.patient_name.split(' ')[0]}</strong>,</p>
                    <p style="font-size: 16px; line-height: 1.5;">Sua consulta de <strong>${app.service_type}</strong> com a Dra. ${nutri.name} está confirmada para o dia <strong>${dateStr}</strong>.</p>
                    ${addressHtml}
                    <p style="font-size: 16px; line-height: 1.5; color: #2a9d8f; font-weight: bold;">Mal podemos esperar para iniciar essa jornada incrível com você!</p>
                `;
                await sendNutriEmail(nutri.name, nutri.email, app.patient_email, 'Consulta Confirmada! - NutriCare', htmlContent);
            } else if (status === 'Rejeitada') {
                const htmlContent = `
                    <h3 style="color: #dc3545; margin-top: 0; font-size: 22px;">Ajuste no seu agendamento ❌</h3>
                    <p style="font-size: 16px; line-height: 1.5;">Olá <strong>${app.patient_name.split(' ')[0]}</strong>,</p>
                    <p style="font-size: 16px; line-height: 1.5;">Sua solicitação de consulta para <strong>${dateStr}</strong> precisou ser ajustada pela nutricionista.</p>
                    <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; color: #842029; border-left: 4px solid #dc3545;">
                        <strong>Justificativa da Clínica:</strong><br>
                        ${finalRejectionMessage}
                    </div>
                    <p style="font-size: 16px; line-height: 1.5;">Por favor, acesse o link de agendamento novamente para escolher um novo horário disponível.</p>
                `;
                await sendNutriEmail(nutri.name, nutri.email, app.patient_email, 'Atualização no seu Agendamento - NutriCare', htmlContent);
            }
        }
        res.json({ success: true, message: `Consulta ${status.toLowerCase()} com sucesso!` });
    } catch (error) {
        console.error('Erro ao atualizar status da consulta:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar status.' });
    }
}

// ------------------------------------------------------------------
// UPLOAD E LISTAGEM DE EXAMES
// ------------------------------------------------------------------
export async function uploadNutriPhoto(req, res) {
    if (req.session.user.role !== 'nutricionista') return res.status(403).json({ success: false });
    const nutriId = req.session.user.id;
    const { fileData, fileType } = req.body;
    if (!fileData) return res.status(400).json({ success: false, message: 'Arquivo obrigatório.' });

    try {
        const uploadsDir = path.join(__dirname, '../../client/public/uploads/photos');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const ext = fileType?.includes('png') ? 'png' : 'jpg';
        const fileName = `nutri_${nutriId}.${ext}`;
        const filePath = path.join(uploadsDir, fileName);
        const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const photoUrl = `/uploads/photos/${fileName}?t=${Date.now()}`;
        await pool.query('UPDATE nutricionista SET photo_url = ? WHERE id = ?', [
            `/uploads/photos/${fileName}`, nutriId
        ]);
        res.json({ success: true, photoUrl });
    } catch(err) {
        console.error('Erro ao salvar foto:', err);
        res.status(500).json({ success: false, message: 'Erro ao salvar foto.' });
    }
}

export async function uploadExam(req, res) {
    if (req.session.user.role !== 'nutricionista') return res.status(403).json({ success: false });
    const nutriId = req.session.user.id;
    const { patientId, fileName, fileData, fileType } = req.body;

    if (!patientId || !fileName || !fileData) {
        return res.status(400).json({ success: false, message: 'Dados incompletos.' });
    }

    try {
        // Verifica propriedade do paciente
        const [check] = await pool.query('SELECT id FROM pacientes WHERE id = ? AND nutriID = ?', [patientId, nutriId]);
        if (check.length === 0) return res.status(403).json({ success: false, message: 'Acesso negado.' });

        // Garante tabela
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exam_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                nutri_id INT NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_url VARCHAR(500) NOT NULL,
                file_type VARCHAR(50),
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_patient (patient_id)
            ) CHARACTER SET utf8mb4
        `);

        // Cria diretório e salva arquivo
        const uploadsDir = path.join(__dirname, '../../client/public/uploads/exams');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const safeFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = path.join(uploadsDir, safeFileName);
        const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const fileUrl = `/uploads/exams/${safeFileName}`;
        await pool.query(
            'INSERT INTO exam_documents (patient_id, nutri_id, file_name, file_url, file_type) VALUES (?, ?, ?, ?, ?)',
            [patientId, nutriId, sanitizeInput(fileName), fileUrl, sanitizeInput(fileType || '')]
        );

        res.json({ success: true, fileUrl, id: null, fileName, uploaded_at: new Date().toISOString() });
    } catch(err) {
        console.error('Erro ao salvar exame:', err);
        res.status(500).json({ success: false, message: 'Erro ao salvar o arquivo.' });
    }
}

export async function listExams(req, res) {
    if (req.session.user.role !== 'nutricionista') return res.status(403).json({ success: false });
    const nutriId = req.session.user.id;
    const { patientId } = req.params;
    try {
        const [check] = await pool.query('SELECT id FROM pacientes WHERE id = ? AND nutriID = ?', [patientId, nutriId]);
        if (check.length === 0) return res.status(403).json({ success: false });
        const [rows] = await pool.query(
            'SELECT id, file_name, file_url, file_type, uploaded_at FROM exam_documents WHERE patient_id = ? AND nutri_id = ? ORDER BY uploaded_at DESC',
            [patientId, nutriId]
        );
        res.json({ success: true, exams: rows });
    } catch(err) {
        res.json({ success: true, exams: [] });
    }
}

export async function deleteExam(req, res) {
    if (req.session.user.role !== 'nutricionista') return res.status(403).json({ success: false });
    const nutriId = req.session.user.id;
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT file_url FROM exam_documents WHERE id = ? AND nutri_id = ?', [id, nutriId]);
        if (rows.length === 0) return res.status(403).json({ success: false });
        // Tenta remover o arquivo do disco
        try {
            const filePath = path.join(__dirname, '../../client/public', rows[0].file_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch(e) {}
        await pool.query('DELETE FROM exam_documents WHERE id = ?', [id]);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ success: false });
    }
}

export async function sendAppointmentReminders() {
    try {
        const [appointments] = await pool.query(`
            SELECT a.id, a.patient_name, a.patient_email, a.service_type, a.appointment_date,
                   n.name as nutri_name, n.email as nutri_email, n.address as nutri_address,
                   a.video_link
            FROM appointments a
            JOIN nutricionista n ON a.nutriID = n.id
            WHERE a.status = 'Confirmada'
              AND a.appointment_date BETWEEN DATE_ADD(NOW(), INTERVAL 23 HOUR)
                                        AND DATE_ADD(NOW(), INTERVAL 25 HOUR)
              AND (a.reminder_sent IS NULL OR a.reminder_sent = 0)
        `);

        for (const apt of appointments) {
            const dateStr = new Date(apt.appointment_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            let locationHtml = '';
            if (apt.video_link) {
                locationHtml = `<div style="background:#f0fdfa;padding:15px;border-radius:8px;margin:20px 0;border-left:4px solid #0dcaf0;"><strong>💻 Link da Videochamada:</strong><br><a href="${apt.video_link}" style="color:#0d6efd;">${apt.video_link}</a></div>`;
            } else if (apt.nutri_address) {
                locationHtml = `<div style="background:#f1f3f5;padding:15px;border-radius:8px;margin:20px 0;border-left:4px solid #2a9d8f;"><strong>📍 Local:</strong><br>${apt.nutri_address}</div>`;
            }
            const htmlContent = `
                <h3 style="color:#264653;margin-top:0;font-size:22px;">Lembrete de Consulta ⏰</h3>
                <p style="font-size:16px;line-height:1.5;">Olá <strong>${apt.patient_name.split(' ')[0]}</strong>,</p>
                <p style="font-size:16px;line-height:1.5;">Este é um lembrete da sua consulta de <strong>${apt.service_type}</strong> marcada para <strong>amanhã, ${dateStr}</strong>.</p>
                ${locationHtml}
                <p style="font-size:16px;line-height:1.5;color:#2a9d8f;font-weight:bold;">Até lá! 💚</p>
            `;
            await sendNutriEmail(apt.nutri_name, apt.nutri_email, apt.patient_email, `Lembrete: Sua consulta é amanhã! - NutriCare`, htmlContent);
            await pool.query('UPDATE appointments SET reminder_sent = 1 WHERE id = ?', [apt.id]);
        }
    } catch(err) {
        console.error('Erro ao enviar lembretes de consulta:', err);
    }
}

export async function cancelConfirmedAppointment(req, res) {
    const nutriId = req.session.user.id;
    const { appointmentId, reason } = req.body;
    if (!appointmentId) return res.status(400).json({ success: false, message: 'ID obrigatório.' });
    try {
        const [rows] = await pool.query(
            `SELECT a.patient_name, a.patient_email, a.service_type, a.appointment_date,
                    n.name as nutri_name, n.email as nutri_email
             FROM appointments a JOIN nutricionista n ON a.nutriID = n.id
             WHERE a.id = ? AND a.nutriID = ? AND a.status = 'Confirmada'`,
            [appointmentId, nutriId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Consulta não encontrada ou não pode ser cancelada.' });
        await pool.query(`UPDATE appointments SET status = 'Cancelada' WHERE id = ?`, [appointmentId]);
        const apt = rows[0];
        const dateStr = new Date(apt.appointment_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const htmlContent = `
            <h3 style="color:#dc3545;margin-top:0;font-size:22px;">Consulta Cancelada ❌</h3>
            <p style="font-size:16px;line-height:1.5;">Olá <strong>${apt.patient_name.split(' ')[0]}</strong>,</p>
            <p style="font-size:16px;line-height:1.5;">Sua consulta de <strong>${apt.service_type}</strong> marcada para <strong>${dateStr}</strong> foi cancelada pela clínica.</p>
            ${reason ? `<div style="background:#f8d7da;padding:15px;border-radius:8px;margin:20px 0;color:#842029;border-left:4px solid #dc3545;"><strong>Motivo:</strong><br>${reason}</div>` : ''}
            <p style="font-size:16px;line-height:1.5;">Entre em contato para reagendar.</p>
        `;
        await sendNutriEmail(apt.nutri_name, apt.nutri_email, apt.patient_email, 'Consulta Cancelada - NutriCare', htmlContent);
        res.json({ success: true, message: 'Consulta cancelada e paciente notificado.' });
    } catch(err) {
        console.error('Erro ao cancelar consulta:', err);
        res.status(500).json({ success: false, message: 'Erro interno.' });
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
             WHERE patientID = ? AND status IN ('Confirmada', 'Rejeitada')
             ORDER BY confirmation_date DESC`,
            [patientId]
        );

        const notifications = rows.map(row => {
            let title = '';
            let message = '';
            let type = '';
            let action = '';

            if (row.status === 'Confirmada') {
                title = 'Consulta confirmada';
                message = `Sua consulta de ${row.service_type} em ${row.date} às ${row.time} foi confirmada.`;
                type = 'success';
                action = 'agenda.html';
            } else if (row.status === 'Rejeitada') {
                type = 'canceled';
                if (row.rejection_type === 'cancelamento') {
                    title = 'Consulta cancelada';
                    message = `Sua solicitação de ${row.service_type} em ${row.date} às ${row.time} foi cancelada. Justificativa: ${row.rejection_message || 'não especificada.'}`;
                    action = '#';
                } else {
                    title = 'Solicitação recusada';
                    message = `Sua solicitação de ${row.service_type} em ${row.date} às ${row.time} foi recusada. Motivo: ${row.rejection_message || 'horário indisponível.'} Você pode reagendar.`;
                    action = `/pages/paciente/preSchedule.html?nutriId=${req.session.user.nutriID}`;
                }
            }

            return {
                id: row.id,
                title,
                message,
                type,
                status: row.status,
                nutriId: req.session.user.nutriID,
                rejectionType: row.rejection_type,
                action: action
            };
        }).filter(n => n.message);

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
        // Auto-marca como Realizada qualquer consulta confirmada que já passou
        await pool.query(
            `UPDATE appointments SET status = 'Realizada'
             WHERE nutriID = ? AND status = 'Confirmada' AND appointment_date < NOW()`,
            [nutriId]
        );

        const dateFilter = `${date}%`;
        const [rows] = await pool.query(
            `SELECT
                id,
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
            id: row.id,
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
        const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
        const timestamp = new Date().getTime();
        const link = `${baseUrl}/pages/paciente/preSchedule.html?nutriId=${nutriId}&t=${timestamp}`;
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
                is_rated,
                video_link
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

export async function updatePatient(req, res) {
    const nutriId = req.session.user.id;
    const patientId = req.params.id;
    const { name, email, phone, patient_type } = req.body;

    if (!name || !email) return res.status(400).json({ success: false, message: 'Nome e email são obrigatórios.' });
    const validType = ['particular', 'convenio'].includes(patient_type) ? patient_type : 'particular';

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('UPDATE pacientes SET nome = ?, email = ?, phone = ?, patient_type = ? WHERE id = ? AND nutriID = ?', [sanitizeInput(name), sanitizeInput(email), sanitizeInput(phone), validType, patientId, nutriId]);
        await connection.query('UPDATE users SET name = ?, email = ? WHERE id = ? AND role = "paciente"', [sanitizeInput(name), sanitizeInput(email), patientId]);
        await connection.commit();
        res.json({ success: true, message: 'Cadastro do paciente atualizado com sucesso.' });
    } catch (error) {
        await connection.rollback();
        console.error("Erro ao editar paciente:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar os dados.' });
    } finally { connection.release(); }
}

export async function updatePatientStatus(req, res) {
    const nutriId = req.session.user.id;
    const patientId = req.params.id;
    const { status } = req.body;

    if (!['Ativo', 'Inativo', 'Cancelado'].includes(status)) return res.status(400).json({ success: false, message: 'Status inválido.' });

    try {
        const [result] = await pool.query('UPDATE pacientes SET status = ? WHERE id = ? AND nutriID = ?', [status, patientId, nutriId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Paciente não encontrado ou não autorizado.' });
        res.json({ success: true, message: `O status do paciente foi alterado para ${status}.` });
    } catch (error) {
        console.error("Erro ao alterar status do paciente:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao alterar o status.' });
    }
}

// -------------------------------------------------------------
// LOGICA DE METRICAS E KPIS
// -------------------------------------------------------------
export async function getMetrics(req, res) {
    const period = parseInt(req.query.period) || 30;
    const nutriId = req.session.user.id;

    const calcTrend = (curr, prev) => {
        const c = parseFloat(curr) || 0;
        const p = parseFloat(prev) || 0;
        if (p === 0) return c === 0 ? null : { pct: null, direction: 'up' };
        const pct = ((c - p) / p) * 100;
        if (Math.abs(pct) < 0.1) return { pct: '0.0', direction: 'neutral' };
        return { pct: Math.abs(pct).toFixed(1), direction: pct > 0 ? 'up' : 'down' };
    };

    try {
        // KPIs do período atual + período anterior em paralelo
        const [
            [[revRow]], [[patRow]], [[retRow]], [[avgAppRow]],
            [[prevRevRow]], [[prevPatRow]], [[currAppRow]], [[prevAppRow]]
        ] = await Promise.all([
            pool.query(`SELECT SUM(totalValue) as rev FROM invoices WHERE nutriID = ? AND issueDate >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status = 'Paid'`, [nutriId, period]),
            pool.query(`SELECT COUNT(*) as cnt FROM pacientes p JOIN users u ON p.id = u.id WHERE p.nutriID = ? AND u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [nutriId, period]),
            pool.query(`SELECT (SUM(CASE WHEN status = 'Ativo' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100 as retention FROM pacientes WHERE nutriID = ?`, [nutriId]),
            pool.query(`SELECT COUNT(*) / NULLIF(COUNT(DISTINCT patientID), 0) as avgApp FROM appointments WHERE nutriID = ? AND status='Realizada'`, [nutriId]),
            // Período anterior (mesma duração, janela anterior)
            pool.query(`SELECT SUM(totalValue) as rev FROM invoices WHERE nutriID = ? AND issueDate >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND issueDate < DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status = 'Paid'`, [nutriId, period * 2, period]),
            pool.query(`SELECT COUNT(*) as cnt FROM pacientes p JOIN users u ON p.id = u.id WHERE p.nutriID = ? AND u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND u.created_at < DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [nutriId, period * 2, period]),
            pool.query(`SELECT COUNT(*) as cnt FROM appointments WHERE nutriID = ? AND status='Realizada' AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [nutriId, period]),
            pool.query(`SELECT COUNT(*) as cnt FROM appointments WHERE nutriID = ? AND status='Realizada' AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND appointment_date < DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [nutriId, period * 2, period])
        ]);

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

        // Nota média (avaliações dos pacientes, acumulado — igual ao painel)
        const [[avgScoreRow]] = await pool.query("SELECT AVG(rating) as avgRating FROM nutri_nps WHERE nutri_id = ?", [nutriId]);

        // Agrupamento de Objetivos (da Anamnese)
        const [goals] = await pool.query(`SELECT objective as obj FROM anamnese WHERE nutriID = ?`, [nutriId]);
        const goalCounts = {};
        goals.forEach(g => {
            if (!g.obj) return;
            // objective é coluna JSON: o mysql2 já devolve array/objeto. Só faz parse se vier string.
            let objs = typeof g.obj === 'string'
                ? (() => { try { return JSON.parse(g.obj); } catch (e) { return [g.obj]; } })()
                : g.obj;
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
                avgAppointments: avgAppRow?.avgApp ? parseInt(avgAppRow.avgApp) : 0,
                avgScore: avgScoreRow?.avgRating ? parseFloat(avgScoreRow.avgRating).toFixed(1) : null
            },
            trends: {
                revenue:      calcTrend(revRow?.rev,       prevRevRow?.rev),
                patients:     calcTrend(patRow?.cnt,       prevPatRow?.cnt),
                appointments: calcTrend(currAppRow?.cnt,   prevAppRow?.cnt)
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
            'SELECT name, email, phone, crnCode, wppMessage, address, photo_url, service_prices FROM nutricionista WHERE id = ?',
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
            res.json({ success: true, data: { name: req.session.user.name, email: req.session.user.email, phone: '', wppMessage: '', address: '', availableDays: [] } });
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do nutricionista:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

export async function updateNutricionistaDetails(req, res) {
    const { name, email, phone, wppMessage, address, crnCode, service_prices } = req.body;
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

        const [existing] = await connection.query('SELECT id FROM nutricionista WHERE id = ?', [nutriId]);
        if (existing.length > 0) {
            await connection.query(
                'UPDATE nutricionista SET name = ?, email = ?, phone = ?, wppMessage = ?, address = ?, crnCode = ?, service_prices = ? WHERE id = ?',
                [name, email, phone, wppMessage || null, address || null, crnCode || null, service_prices ? JSON.stringify(service_prices) : null, nutriId]
            );
        } else {
            await connection.query(
                'INSERT INTO nutricionista (id, name, email, phone, wppMessage, address, crnCode, service_prices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [nutriId, name, email, phone, wppMessage || null, address || null, crnCode || null, service_prices ? JSON.stringify(service_prices) : null]
            );
        }

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
        scheduleReconcile(`nut:${nutriId}`, invoices); // confere pagamentos em 2º plano
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
            await conn.query(`INSERT INTO invoice_items (invoiceID, description, amount) VALUES (?, ?, ?)`, [invoiceId, item.description, item.amount]);
        }
        
        // INTEGRAÇÃO MERCADO PAGO + ENVIO DE COBRANÇA E-MAIL
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
                    const [patRows] = await conn.query('SELECT nome, email FROM pacientes WHERE id = ?', [patientId]);
                    const [nutriRows] = await conn.query('SELECT name, email FROM nutricionista WHERE id = ?', [nutriId]);
                    if (patRows.length > 0 && patRows[0].email && nutriRows.length > 0) {
                        const htmlContent = `
                            <h3 style="color: #264653; margin-top: 0; font-size: 22px;">Sua fatura está disponível 🧾</h3>
                            <p style="font-size: 16px; line-height: 1.5;">Olá <strong>${patRows[0].nome.split(' ')[0]}</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.5;">Uma nova fatura no valor de <strong>R$ ${parseFloat(total).toFixed(2).replace('.',',')}</strong> foi gerada.</p>
                            <div style="text-align: center; margin: 35px 0;">
                                <a href="${paymentLink}" style="background-color: #2a9d8f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Pagar Fatura de R$ ${parseFloat(total).toFixed(2).replace('.',',')}</a>
                            </div>
                            <p style="font-size: 14px; color: #6c757d; line-height: 1.5;">Você pode pagar via PIX, Cartão de Crédito ou Boleto através do link seguro do MercadoPago acima.</p>
                        `;
                        await sendNutriEmail(nutriRows[0].name, nutriRows[0].email, patRows[0].email, 'Nova Fatura Gerada - NutriCare', htmlContent);
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

// GERA (ou reaproveita) O LINK DE PAGAMENTO DE UMA FATURA, SOB DEMANDA — usado pelo botão "Pagar" do paciente.
export async function getInvoicePaymentLink(req, res) {
    const patientId = req.session.user.id;
    const invoiceId = req.params.id;
    try {
        const [rows] = await pool.query(
            'SELECT id, totalValue, status, payment_link FROM invoices WHERE id = ? AND patientID = ?',
            [invoiceId, patientId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Fatura não encontrada.' });

        const inv = rows[0];
        if (inv.status === 'Paid' || inv.status === 'Pago') {
            return res.status(400).json({ success: false, message: 'Esta fatura já está paga.' });
        }
        // Já tem link salvo? Reaproveita.
        if (inv.payment_link) return res.json({ success: true, paymentLink: inv.payment_link });

        const token = process.env.MP_ACCESS_TOKEN;
        if (!token || token === 'seu-token-mercadopago-aqui') {
            return res.status(503).json({ success: false, message: 'Pagamento online ainda não está configurado. Fale com sua nutricionista.' });
        }

        const [items] = await pool.query('SELECT description, amount FROM invoice_items WHERE invoiceID = ?', [invoiceId]);
        const lineItems = items.length
            ? items.map(i => ({ title: i.description, quantity: 1, unit_price: parseFloat(i.amount) }))
            : [{ title: 'Consulta nutricional', quantity: 1, unit_price: parseFloat(inv.totalValue) }];

        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: lineItems,
                external_reference: String(invoiceId),
                notification_url: `${process.env.PUBLIC_URL || ''}/api/auth/invoices/webhook`
            })
        });
        const mpData = await mpRes.json();
        if (!mpData.init_point) {
            console.error('Mercado Pago não retornou init_point:', mpData);
            return res.status(502).json({ success: false, message: mpData.message || 'Falha ao gerar o link no Mercado Pago. Verifique o token.' });
        }

        await pool.query('UPDATE invoices SET payment_link = ? WHERE id = ?', [mpData.init_point, invoiceId]);
        res.json({ success: true, paymentLink: mpData.init_point });
    } catch (e) {
        console.error('Erro ao gerar link de pagamento da fatura:', e);
        res.status(500).json({ success: false, message: 'Erro interno ao gerar o link de pagamento.' });
    }
}

// WEBHOOK MERCADO PAGO
export async function mpWebhook(req, res) {
    const signature = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    const dataId = req.query['data.id'] || (req.body && req.body.data && req.body.data.id);

    if (!signature || !requestId || !dataId) {
        return res.status(403).json({ success: false, message: 'Faltam cabeçalhos de segurança ou ID de dados (x-signature).' });
    }

    try {
        const parts = signature.split(',');
        let ts = '';
        let v1 = '';
        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (key === 'ts') ts = value;
            if (key === 'v1') v1 = value;
        });

        const secret = process.env.MP_WEBHOOK_SECRET; 
        if (secret && ts && v1) {
            const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(manifest);
            const sha = hmac.digest('hex');
            
            if (sha !== v1) {
                console.warn("MercadoPago Webhook: Assinatura inválida. Possível ataque.");
                return res.status(403).send('Invalid signature');
            }
        }
    } catch (err) {
        console.error("Erro ao validar assinatura do Webhook MP:", err);
    }

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
                const [invRows] = await pool.query("SELECT i.totalValue, p.nome, p.email, n.name as nutri_name, n.email as nutri_email FROM invoices i JOIN pacientes p ON i.patientId = p.id JOIN nutricionista n ON i.nutriID = n.id WHERE i.id = ?", [invoiceId]);
                if (invRows.length > 0 && invRows[0].email) {
                    const htmlContent = `
                        <h3 style="color: #20c997; margin-top: 0; font-size: 22px;">Pagamento Confirmado! ✅</h3>
                        <p style="font-size: 16px; line-height: 1.5;">Olá <strong>${invRows[0].nome.split(' ')[0]}</strong>,</p>
                        <p style="font-size: 16px; line-height: 1.5;">Seu pagamento no valor de <strong>R$ ${parseFloat(invRows[0].totalValue).toFixed(2).replace('.',',')}</strong> foi recebido e confirmado com sucesso.</p>
                        <p style="font-size: 16px; line-height: 1.5;">Agradecemos pela confiança!</p>
                    `;
                    await sendNutriEmail(invRows[0].nutri_name, invRows[0].nutri_email, invRows[0].email, 'Comprovante de Pagamento - NutriCare', htmlContent);
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const typeFilter = req.query.type && ['particular', 'convenio'].includes(req.query.type) ? req.query.type : null;

    try {
        const query = `
            SELECT
                p.id,
                p.nome,
                p.email,
                p.phone,
                p.status,
                p.patient_type,
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
                p.nutriID = ? AND (p.nome LIKE ? OR p.email LIKE ?)
                ${typeFilter ? 'AND p.patient_type = ?' : ''}
            ORDER BY
                CASE WHEN p.status NOT IN ('Inativo', 'Cancelado') THEN 0 ELSE 1 END ASC,
                CASE WHEN (SELECT MIN(a.appointment_date) FROM appointments a WHERE a.patientID = p.id AND a.appointment_date > NOW() AND a.status = 'Confirmada') IS NOT NULL THEN 0 ELSE 1 END ASC,
                appointmentDate ASC,
                lastUpdateDate DESC
            LIMIT ${limit} OFFSET ${offset}
        `;
        const queryParams = typeFilter ? [nutriId, search, search, typeFilter] : [nutriId, search, search];
        const [rows] = await pool.query(query, queryParams);

        const countQuery = `SELECT COUNT(*) as total FROM pacientes WHERE nutriID = ? AND (nome LIKE ? OR email LIKE ?)${typeFilter ? ' AND patient_type = ?' : ''}`;
        const countParams = typeFilter ? [nutriId, search, search, typeFilter] : [nutriId, search, search];
        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

        const patients = rows.map(patient => {
            if (patient.appointmentDate) {
                patient.appointmentDate = new Date(patient.appointmentDate).toLocaleDateString('pt-BR');
            }
            return patient;
        });

        res.json({ success: true, patients: patients, total: total, page: page, totalPages: Math.ceil(total / limit) });
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

        // Retorna o prontuário mais recente registrado para este paciente (se existir),
        // permitindo pré-preencher o formulário SOAP.
        const [rows] = await pool.query(`
            SELECT appointment_id AS id, subjective_notes, objective_notes, assessment_notes, plan_notes,
                   weight, height, body_fat_percentage
            FROM consultations
            WHERE nutri_id = ? AND patient_id = ?
            ORDER BY consultation_date DESC
            LIMIT 1
        `, [nutriId, patientId]);

        if (rows.length > 0) {
            return res.status(200).json({ success: true, appointment: rows[0] });
        }
        res.status(200).json({ success: false, message: 'Nenhum prontuário encontrado.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const saveAppointmentNotes = async (req, res) => {
    if (req.session.user.role !== 'nutricionista') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const nutriId = req.session.user.id;
    const {
        appointmentId, patientId,
        subjectiveNotes, objectiveNotes, assessmentNotes, planNotes,
        weight, height, bodyFat
    } = req.body;

    if (!appointmentId) {
        return res.status(400).json({ success: false, message: 'ID da consulta é obrigatório.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Confirma que a consulta pertence a este nutricionista (evita IDOR)
        const [appRows] = await connection.query(
            'SELECT appointment_date, patientID FROM appointments WHERE id = ? AND nutriID = ?',
            [appointmentId, nutriId]
        );
        if (appRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Consulta não encontrada ou não pertence a você.' });
        }

        const consultationDate = appRows[0].appointment_date;
        const finalPatientId = patientId || appRows[0].patientID;

        const w = weight !== undefined && weight !== '' ? parseFloat(weight) : null;
        const h = height !== undefined && height !== '' ? parseFloat(height) : null;
        const bmi = (w && h) ? calculateBMI(w, h) : null;
        const bf = bodyFat !== undefined && bodyFat !== '' ? parseFloat(bodyFat) : null;

        const sj = sanitizeInput(subjectiveNotes || '');
        const ob = sanitizeInput(objectiveNotes || '');
        const as = sanitizeInput(assessmentNotes || '');
        const pl = sanitizeInput(planNotes || '');

        // Upsert: 1 prontuário por consulta. Atualiza se já existir, senão cria.
        const [existing] = await connection.query(
            'SELECT id FROM consultations WHERE appointment_id = ?',
            [appointmentId]
        );

        if (existing.length > 0) {
            await connection.query(
                `UPDATE consultations SET
                    patient_id = ?, nutri_id = ?, consultation_date = ?,
                    weight = ?, height = ?, bmi = ?, body_fat_percentage = ?,
                    subjective_notes = ?, objective_notes = ?, assessment_notes = ?, plan_notes = ?
                 WHERE appointment_id = ?`,
                [finalPatientId, nutriId, consultationDate, w, h, bmi, bf, sj, ob, as, pl, appointmentId]
            );
        } else {
            await connection.query(
                `INSERT INTO consultations
                    (appointment_id, patient_id, nutri_id, consultation_date,
                     weight, height, bmi, body_fat_percentage,
                     subjective_notes, objective_notes, assessment_notes, plan_notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [appointmentId, finalPatientId, nutriId, consultationDate, w, h, bmi, bf, sj, ob, as, pl]
            );
        }

        await connection.query("UPDATE appointments SET status = 'Realizada' WHERE id = ?", [appointmentId]);

        await connection.commit();
        res.status(200).json({ success: true, message: 'Prontuário atualizado com sucesso!' });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao salvar prontuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar o prontuário.' });
    } finally {
        connection.release();
    }
};

export const saveAnthropometry = async (req, res) => {
    try {
        const {
            patient_id, age, gender, activity_level, weight, height,
            fold_chest, fold_midaxillary, fold_triceps, fold_subscapular,
            fold_abdominal, fold_suprailiac, fold_thigh
        } = req.body;

        const w = parseFloat(weight);
        const h = parseFloat(height); // in cm
        const a = parseInt(age);
        const act = parseFloat(activity_level);

        const fc = parseFloat(fold_chest) || 0;
        const fm = parseFloat(fold_midaxillary) || 0;
        const ft = parseFloat(fold_triceps) || 0;
        const fsb = parseFloat(fold_subscapular) || 0;
        const fa = parseFloat(fold_abdominal) || 0;
        const fsi = parseFloat(fold_suprailiac) || 0;
        const fth = parseFloat(fold_thigh) || 0;

        const sum7 = fc + fm + ft + fsb + fa + fsi + fth;

        let db = 0; let bodyFat = 0; let bmr = 0;
        
        if (gender === 'M') {
            db = 1.112 - (0.00043499 * sum7) + (0.00000055 * sum7 * sum7) - (0.00028826 * a);
            bodyFat = (4.95 / db - 4.50) * 100;
            bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
        } else {
            db = 1.097 - (0.00046971 * sum7) + (0.00000056 * sum7 * sum7) - (0.00012828 * a);
            bodyFat = (4.95 / db - 4.50) * 100;
            bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
        }

        if (bodyFat < 2) bodyFat = 2; // Limites seguros de estimativa
        if (bodyFat > 60) bodyFat = 60;

        const bmi = w / Math.pow(h / 100, 2);
        const leanMass = w - (w * bodyFat / 100);
        const tdee = bmr * act;

        const results = {
            bmi: bmi.toFixed(1),
            bodyFat: bodyFat.toFixed(1),
            leanMass: leanMass.toFixed(1),
            bmr: bmr.toFixed(0),
            tdee: tdee.toFixed(0)
        };

        await pool.query(
            `INSERT INTO anthropometric_assessments 
            (patient_id, weight, height, calc_bmi, calc_body_fat, calc_lean_mass, bmr, tdee, created_at,
             fold_chest, fold_midaxillary, fold_triceps, fold_subscapular, fold_abdominal, fold_suprailiac, fold_thigh) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
            [patient_id, w, h, results.bmi, results.bodyFat, results.leanMass, results.bmr, results.tdee,
             fc, fm, ft, fsb, fa, fsi, fth]
        );

        res.status(200).json({ success: true, results });
    } catch (error) {
        console.error('Erro em saveAnthropometry:', error);
        res.status(500).json({ success: false, error: 'Erro ao calcular antropometria.' });
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
        const term = (req.query.q || '').toLowerCase();

        if (!term && foodsCache && (Date.now() - foodsCacheTime < 3600000)) { // Cache de 1 hora para full db
            return res.status(200).json({ success: true, library: foodsCache });
        }
        
        const tacoPath = path.join(__dirname, '../taco.json');
        const fileData = fs.readFileSync(tacoPath, 'utf8');
        let foods = JSON.parse(fileData);

        if (term) {
            foods = foods.filter(f => 
                (f.description && f.description.toLowerCase().includes(term)) || 
                (f.category && f.category.toLowerCase().includes(term))
            );
        }

        const library = foods.reduce((acc, food) => {
            const cat = food.category || 'Outros';
            if (!acc[cat]) acc[cat] = [];

            acc[cat].push({
                id: food.id,
                name: food.description,
                baseUnit: 100,
                kcal: parseFloat(food.energy_kcal) || 0,
                carbs: parseFloat(food.carbohydrate_g) || 0,
                protein: parseFloat(food.protein_g) || 0,
                fat: parseFloat(food.lipid_g) || 0,
                fiber: parseFloat(food.fiber_g) || 0,
                sodium: parseFloat(food.sodium_mg) || 0,
                calcium: parseFloat(food.calcium_mg) || 0,
                iron: parseFloat(food.iron_mg) || 0,
                zinc: parseFloat(food.zinc_mg) || 0,
                magnesium: parseFloat(food.magnesium_mg) || 0,
                potassium: parseFloat(food.potassium_mg) || 0,
                vitA: parseFloat(food.retinol_mcg) || 0,
                vitC: parseFloat(food.vitaminC_mg) || 0,
                vitD: parseFloat(food.vitD) || 0,
                vitE: parseFloat(food.vitE) || 0,
                vitB12: parseFloat(food.vitB12) || 0
            });
            return acc;
        }, {});

        if (!term) {
            foodsCache = library;
            foodsCacheTime = Date.now();
        }

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
                mi.id as item_id, mi.food_id, mi.quantity, mi.option_group,
                f.name as food_name, f.category
            FROM meal_plans mp
            JOIN meals m ON mp.id = m.meal_plan_id
            LEFT JOIN meal_items mi ON m.id = mi.meal_id
            LEFT JOIN foods f ON mi.food_id = f.id
            WHERE mp.patient_id = ?
            ORDER BY m.id, mi.id;
        `;
        const [rows] = await pool.query(query, [patientId]);

        if (rows.length === 0) {
            return res.json({ success: true, plan: null });
        }

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
                    foodId: row.food_id,
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
        const [patientRows] = await pool.query('SELECT nome, email FROM pacientes WHERE id = ? AND nutriID = ?', [patientId, nutriId]);
        const [nutriRows] = await pool.query('SELECT name, email FROM nutricionista WHERE id = ?', [nutriId]);
        
        if (patientRows.length === 0 || nutriRows.length === 0) {
            return res.status(403).json({ success: false, message: 'Paciente ou Nutricionista não encontrado.' });
        }

        const patient = patientRows[0];
        const nutri = nutriRows[0];
        
        if (!patient.email) {
            return res.status(400).json({ success: false, message: 'O paciente não possui e-mail cadastrado.' });
        }

        const firstName = patient.nome.split(' ')[0];
        const htmlContent = `
            <h3 style="color: #264653; margin-top: 0; font-size: 22px;">Sua Nova Dieta Chegou! 🍏</h3>
            <p style="font-size: 16px; line-height: 1.5;">Olá <strong>${firstName}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.5;">O seu novo <strong>Plano Alimentar</strong> acabou de ser prescrito e já está disponível na plataforma.</p>
            <div style="background: #e9ecef; padding: 25px; border-radius: 8px; margin: 30px 0; text-align: center; border-left: 4px solid #f4a261;">
                <p style="margin: 0 0 15px 0; font-size: 16px; color: #495057;">Acesse agora para visualizar sua dieta completa, metas diárias e lista de compras inteligente!</p>
                <a href="${process.env.PUBLIC_URL || 'http://localhost:3000'}/pages/login.html" style="background-color: #f4a261; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Acessar o NutriCare</a>
            </div>
            <p style="font-size: 16px; text-align: center; color: #2a9d8f; font-weight: bold;">Foco no objetivo! 💪</p>
        `;

        await sendNutriEmail(nutri.name, nutri.email, patient.email, 'Seu Plano Alimentar está pronto! - NutriCare', htmlContent);

        res.json({ success: true, message: 'Aviso enviado para o e-mail do paciente!' });

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
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
        const resetLink = `${baseUrl}/pages/reset-password.html?token=${token}`;

        await transporter.sendMail({
            from: `"NutriCare" <${process.env.SMTP_USER || 'suporte@nutricare.com'}>`,
            to: email,
            subject: 'Recuperação de Senha - NutriCare',
            html: `
                <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;">
                    <div style="background:#2a9d8f;padding:25px;text-align:center;">
                        <h2 style="color:#fff;margin:0;font-size:24px;font-weight:bold;">NutriCare</h2>
                    </div>
                    <div style="padding:35px 30px;background:#fff;">
                        <h3 style="color:#264653;margin-top:0;">Recuperação de Senha 🔑</h3>
                        <p style="font-size:16px;line-height:1.5;color:#495057;">Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova:</p>
                        <div style="text-align:center;margin:30px 0;">
                            <a href="${resetLink}" style="background:#2a9d8f;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">Redefinir Minha Senha</a>
                        </div>
                        <p style="font-size:13px;color:#6c757d;">Este link é válido por <strong>1 hora</strong>. Se você não solicitou isso, ignore este e-mail com segurança.</p>
                    </div>
                    <div style="background:#f8f9fa;padding:15px;text-align:center;font-size:12px;color:#adb5bd;">
                        <p style="margin:0;">E-mail automático da plataforma NutriCare. Não responda.</p>
                    </div>
                </div>`
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
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const nutriId = req.session.user.id;
    
    const sendNotifications = async () => {
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

            res.write(`data: ${JSON.stringify({ success: true, notifications })}\n\n`);
        } catch (error) {
            console.error("Erro ao buscar notificações reais:", error);
            res.write(`data: ${JSON.stringify({ success: false, message: 'Erro ao buscar notificações.' })}\n\n`);
        }
    };

    await sendNotifications();
    const intervalId = setInterval(sendNotifications, 30000); // Polling interno otimizado no servidor a cada 30 segundos
    
    req.on('close', () => {
        clearInterval(intervalId);
    });
}

export async function getExamInsight(req, res) {
    const { examSummary, patientHistory } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ success: false, message: 'A chave da API do Gemini não está configurada (GEMINI_API_KEY).' });
    }

    try {
        // Modelo fixo do Gemini para todas as chamadas.
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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
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


        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s de timeout (Geração de dieta é mais pesada)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
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
    const { mealName } = req.body;

    if (!apiKey) return res.status(500).json({ success: false, message: 'API Key não configurada.' });

    try {
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
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
            throw new Error('A IA retornou uma resposta vazia.');
        }
        const recipe = data.candidates[0].content.parts[0].text.replace(/```html/g, '').replace(/```/g, '');
        res.json({ success: true, recipe });
    } catch (error) {
        if (error.name === 'AbortError') {
            return res.status(504).json({ success: false, message: 'A Inteligência Artificial demorou muito para responder (Timeout). Tente novamente.' });
        }
        console.error("Erro na IA do Paciente:", error);
        res.status(500).json({ success: false, message: 'Falha ao gerar receita.' });
    }
}

// -------------------------------------------------------------
// CONFIGURAÇÃO DA PRÉ-ANAMNESE DINÂMICA
// -------------------------------------------------------------
export async function getAnamneseConfig(req, res) {
    const nutriId = req.session.user.id;
    try {
        const [rows] = await pool.query('SELECT config FROM nutri_anamnese_config WHERE nutri_id = ?', [nutriId]);
        if (rows.length > 0) {
            res.json({ success: true, config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config });
        } else {
            res.json({ success: true, config: [] });
        }
    } catch (error) {
        console.error("Erro ao buscar configuração da anamnese:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar dados.' });
    }
}

export async function saveAnamneseConfig(req, res) {
    const nutriId = req.session.user.id;
    const { config } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM nutri_anamnese_config WHERE nutri_id = ?', [nutriId]);
        if (existing.length > 0) {
            await pool.query('UPDATE nutri_anamnese_config SET config = ? WHERE nutri_id = ?', [JSON.stringify(config), nutriId]);
        } else {
            await pool.query('INSERT INTO nutri_anamnese_config (nutri_id, config) VALUES (?, ?)', [nutriId, JSON.stringify(config)]);
        }
        res.json({ success: true, message: 'Formulário atualizado com sucesso!' });
    } catch (error) {
        console.error("Erro ao salvar configuração da anamnese:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao salvar os dados.' });
    }
}

export async function getPublicAnamneseConfig(req, res) {
    const nutriId = req.params.nutriId;
    try {
        const [rows] = await pool.query('SELECT config FROM nutri_anamnese_config WHERE nutri_id = ?', [nutriId]);
        if (rows.length > 0) {
            res.json({ success: true, config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config });
        } else {
            res.json({ success: true, config: [] });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

// ------------------------------------------------------------------
// RECEITUÁRIO & ENCAMINHAMENTOS (NOTAS CLÍNICAS)
// ------------------------------------------------------------------
const ensureClinicalNotesTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS clinical_notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            nutri_id INT NOT NULL,
            type ENUM('prescription','referral') NOT NULL,
            title VARCHAR(200),
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_patient (patient_id),
            INDEX idx_nutri (nutri_id)
        ) CHARACTER SET utf8mb4
    `);
};

export async function saveClinicalNote(req, res) {
    if (req.session.user.role !== 'nutricionista') return res.status(403).json({ success: false });
    const nutriId = req.session.user.id;
    const { patientId, type, title, content } = req.body;
    if (!patientId || !type || !content) return res.status(400).json({ success: false, message: 'Dados incompletos.' });
    if (!['prescription', 'referral'].includes(type)) return res.status(400).json({ success: false, message: 'Tipo inválido.' });
    try {
        await ensureClinicalNotesTable();
        const [check] = await pool.query('SELECT id FROM pacientes WHERE id = ? AND nutriID = ?', [patientId, nutriId]);
        if (check.length === 0) return res.status(403).json({ success: false, message: 'Acesso negado.' });
        const [result] = await pool.query(
            'INSERT INTO clinical_notes (patient_id, nutri_id, type, title, content) VALUES (?, ?, ?, ?, ?)',
            [patientId, nutriId, type, sanitizeInput(title || ''), sanitizeInput(content)]
        );
        res.json({ success: true, message: 'Nota salva!', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
}

export async function getClinicalNotesForPatient(req, res) {
    const nutriId = req.session.user.id;
    const { patientId } = req.params;
    try {
        const [check] = await pool.query('SELECT id FROM pacientes WHERE id = ? AND nutriID = ?', [patientId, nutriId]);
        if (check.length === 0) return res.status(403).json({ success: false });
        const [notes] = await pool.query(
            'SELECT id, type, title, content, created_at FROM clinical_notes WHERE patient_id = ? AND nutri_id = ? ORDER BY created_at DESC',
            [patientId, nutriId]
        );
        res.json({ success: true, notes });
    } catch (err) {
        res.json({ success: true, notes: [] });
    }
}

export async function deleteClinicalNote(req, res) {
    const nutriId = req.session.user.id;
    const { id } = req.params;
    try {
        const [check] = await pool.query('SELECT id FROM clinical_notes WHERE id = ? AND nutri_id = ?', [id, nutriId]);
        if (check.length === 0) return res.status(403).json({ success: false, message: 'Não autorizado.' });
        await pool.query('DELETE FROM clinical_notes WHERE id = ?', [id]);
        res.json({ success: true, message: 'Nota removida.' });
    } catch (err) {
        res.status(500).json({ success: false });
    }
}

export async function getPatientClinicalNotes(req, res) {
    if (req.session.user.role !== 'paciente') return res.status(403).json({ success: false });
    const patientId = req.session.user.id;
    const { type } = req.query;
    try {
        await ensureClinicalNotesTable();
        let q = 'SELECT id, type, title, content, created_at FROM clinical_notes WHERE patient_id = ?';
        const params = [patientId];
        if (type) { q += ' AND type = ?'; params.push(type); }
        q += ' ORDER BY created_at DESC';
        const [notes] = await pool.query(q, params);
        res.json({ success: true, notes });
    } catch (err) {
        res.json({ success: true, notes: [] });
    }
}

// ------------------------------------------------------------------
// RASTREADOR DE ÁGUA
// ------------------------------------------------------------------
export async function getWaterTracker(req, res) {
    const patientId = req.session.user.id;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS water_tracker (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                track_date DATE NOT NULL,
                glasses_count INT DEFAULT 0,
                UNIQUE KEY uk_water (patient_id, track_date)
            ) CHARACTER SET utf8mb4
        `);
        const today = new Date().toISOString().split('T')[0];
        const [rows] = await pool.query(
            'SELECT glasses_count FROM water_tracker WHERE patient_id = ? AND track_date = ?',
            [patientId, today]
        );
        res.json({ success: true, count: rows.length > 0 ? rows[0].glasses_count : 0 });
    } catch (err) {
        res.json({ success: true, count: 0 });
    }
}

export async function saveWaterTracker(req, res) {
    if (req.session.user.role !== 'paciente') {
        return res.status(403).json({ success: false });
    }
    const patientId = req.session.user.id;
    const count = parseInt(req.body.count);
    if (isNaN(count) || count < 0 || count > 8) {
        return res.status(400).json({ success: false, message: 'Contagem inválida.' });
    }
    try {
        const today = new Date().toISOString().split('T')[0];
        await pool.query(`
            INSERT INTO water_tracker (patient_id, track_date, glasses_count)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE glasses_count = VALUES(glasses_count)
        `, [patientId, today, count]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar água:', err);
        res.status(500).json({ success: false });
    }
}

// ------------------------------------------------------------------
// FEEDBACK DE REFEIÇÕES
// ------------------------------------------------------------------
export async function getMealFeedback(req, res) {
    const patientId = req.session.user.id;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS meal_feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                feedback_date DATE NOT NULL,
                meal_name VARCHAR(200) NOT NULL,
                consumed TINYINT(1) DEFAULT 0,
                notes TEXT,
                UNIQUE KEY uk_feedback (patient_id, feedback_date, meal_name)
            ) CHARACTER SET utf8mb4
        `);
        const today = new Date().toISOString().split('T')[0];
        const [rows] = await pool.query(
            'SELECT meal_name, consumed, notes FROM meal_feedback WHERE patient_id = ? AND feedback_date = ?',
            [patientId, today]
        );
        const feedback = {};
        rows.forEach(r => {
            feedback[r.meal_name] = { consumed: r.consumed === 1, notes: r.notes };
        });
        res.json({ success: true, feedback });
    } catch (err) {
        res.json({ success: true, feedback: {} });
    }
}

export async function saveMealFeedback(req, res) {
    if (req.session.user.role !== 'paciente') {
        return res.status(403).json({ success: false });
    }
    const patientId = req.session.user.id;
    const { mealName, consumed } = req.body;
    if (!mealName) {
        return res.status(400).json({ success: false, message: 'Nome da refeição obrigatório.' });
    }
    try {
        const today = new Date().toISOString().split('T')[0];
        const consumedVal = consumed ? 1 : 0;
        await pool.query(`
            INSERT INTO meal_feedback (patient_id, feedback_date, meal_name, consumed)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE consumed = VALUES(consumed)
        `, [patientId, today, sanitizeInput(mealName), consumedVal]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar feedback:', err);
        res.status(500).json({ success: false });
    }
}