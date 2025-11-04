// nutricare-project/server/controllers/auth.controller.js
import bcrypt from 'bcrypt';
import { pool } from '../config/dbConnect.js';
import { validarCRN } from '../middlewares/checkCrn.js';
const saltRounds = 10;

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

// Função principal de registro, que direciona para o tipo de usuário.
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

// Registra um novo nutricionista no sistema.
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

// Registra um novo paciente juntamente com sua anamnese.
async function registerPacienteWithAnamnese(req, res) {
    const { registerData, anamneseData, appointmentId } = req.body;
    const { name, email, password, phone, nutriID } = registerData;
    const role = 'paciente';

    if (!name || !email || !password || !nutriID || !phone) {
        return res.status(400).json({ success: false, message: 'Dados de registro do paciente incompletos.' });
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

        await connection.query(
            `INSERT INTO anamnese (
            nutriID, patientID, name, weight, height, birthdate, objective, 
            health_issue, surgerie, digestion, intestino, fezes, water_ingestion, 
            period_cicle, previous_diet, mastigacao, allergic, avoidment, fav_food, 
            alcohol, medicine, exercise, wake_up_time, blood_exam, final_question, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nutriID, patientId, name, peso, altura, data_nascimento, JSON.stringify(objetivos),
                problema_saude, cirurgia, digestao, intestino, consistencia_fezes, ingestao_agua,
                ciclo_menstrual, tratamento_anterior, mastigacao, alergias, aversao, gostos, alcool,
                medicacao, atividade_fisica, sono, exames_sangue, expectativas, new Date()
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

// Busca o número de telefone do nutricionista para contato via WhatsApp.
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

// Autentica o usuário e cria uma sessão.
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

// Finaliza a sessão do usuário.
export function logout(req, res) {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Não foi possível fazer logout.' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, redirectUrl: '/pages/login.html' });
    });
}

// Retorna os dados do usuário logado.
export function getMe(req, res) {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Usuário não logado.' });
    }
}

// Busca a contagem total de pacientes de um nutricionista.
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

// Busca a média de notas de um nutricionista.
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

// Gera e salva a configuração da agenda de um nutricionista.
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

// Retorna os horários disponíveis de um nutricionista para uma data específica.
export async function getNutriSchedule(req, res) {
    const { nutriId, date } = req.query;

    if (!nutriId || !date) {
        return res.status(400).json({ success: false, message: 'ID do nutricionista e data são obrigatórios.' });
    }

    try {
        const [agendaRows] = await pool.query(
            'SELECT startTime, endTime, duration, JSON_UNQUOTE(available_days) as available_days FROM nutri_agenda WHERE nutriID = ?',
            [nutriId]
        );

        if (agendaRows.length === 0) {
            return res.json({ success: true, availableSlots: [], message: 'A agenda desta nutricionista ainda não foi configurada.' });
        }

        const { startTime, endTime, duration: slotDuration, available_days } = agendaRows[0];
        const scheduledDates = available_days ? JSON.parse(available_days) : [];

        if (!scheduledDates.includes(date)) {
            return res.json({ success: true, availableSlots: [], message: 'Esta data não está disponível para agendamento.' });
        }

        const allPossibleSlots = generateTimeSlots(startTime, endTime, slotDuration);

        const [appointmentRows] = await pool.query(
            'SELECT TIME(appointment_date) as bookedTime FROM appointments WHERE nutriID = ? AND DATE(appointment_date) = ? AND status != "Rejeitada"',
            [nutriId, date]
        );
        const bookedTimes = new Set(appointmentRows.map(row => row.bookedTime.substring(0, 5)));

        let availableSlots = allPossibleSlots.filter(slot => !bookedTimes.has(slot));

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (date === todayStr) {
            const now = new Date();
            const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            availableSlots = availableSlots.filter(slot => slot > currentTimeStr);
        }

        if (availableSlots.length === 0) {
            return res.json({ success: true, availableSlots: [], message: 'Não há mais horários disponíveis para este dia.' });
        }

        res.json({ success: true, availableSlots, slotDuration });

    } catch (error) {
        console.error('Erro ao buscar agenda do nutricionista:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar agenda.' });
    }
}

// Cria um novo pré-agendamento (solicitação de consulta).
export async function bookAppointment(req, res) {
    const { nutriId, service, date, time, patientData } = req.body;

    const patientID = req.session.user?.id;

    if (!nutriId || !service || !date || !time || !patientData || !patientData.name || !patientData.email || !patientData.phone) {
        return res.status(400).json({ success: false, message: 'Dados de agendamento incompletos.' });
    }

    const appointmentDateStr = `${date} ${time}:00`;

    try {
        const appointmentDateTime = new Date(appointmentDateStr);
        if (appointmentDateTime < new Date()) {
            return res.status(409).json({ success: false, message: 'Não é possível agendar uma consulta para um horário que já passou.', appointment: "not_allowed"});
        }

        const [checkRows] = await pool.query(
            'SELECT COUNT(*) as count FROM appointments WHERE nutriID = ? AND appointment_date = ? AND status != "Rejeitada"',
            [nutriId, appointmentDateStr]
        );

        if (checkRows[0].count > 0) {
            return res.status(409).json({ success: false, message: 'Este horário não está mais disponível. Por favor, escolha outro.' });
        }

        const [result] = await pool.query(
            `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, service_type, duration, appointment_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nutriId,
                patientID,
                patientData.name,
                patientData.email,
                patientData.phone,
                service.name,
                service.duration,
                appointmentDateStr,
                'Pendente'
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

// Retorna a lista de agendamentos pendentes para o nutricionista.
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
                DATE_FORMAT(appointment_date, "%H:%i") as time
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

// Atualiza o status de um agendamento (Confirmada ou Rejeitada).
export async function updateAppointmentStatus(req, res) {
    const nutriId = req.session.user.id;
    // ADICIONADO: rejectionType e rejectionMessage
    const { appointmentId, status, rejectionType, rejectionMessage } = req.body; 

    if (!['Confirmada', 'Rejeitada'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }
    
    let query = '';
    let values = [];

    if (status === 'Confirmada') {
        // Se APROVADA, remove quaisquer dados de rejeição antigos
        query = 'UPDATE appointments SET status = ?, confirmation_date = ?, rejection_type = NULL, rejection_message = NULL WHERE id = ? AND nutriID = ?';
        values = [status, new Date(), appointmentId, nutriId];
    } else if (status === 'Rejeitada') {
        // Validação obrigatória da justificativa para 'cancelamento'
        if (rejectionType === 'cancelamento' && !rejectionMessage) {
            return res.status(400).json({ success: false, message: 'A mensagem de justificativa é obrigatória para cancelamento total.' });
        }
        
        // Define a mensagem: padronizada para reagendamento, ou a customizada para cancelamento
        const finalRejectionMessage = rejectionType === 'reagendar' 
            ? 'Horário indisponível. Por favor, reagende a consulta para outro horário disponível.' // Mensagem padrão para reagendamento
            : rejectionMessage; // Mensagem customizada para cancelamento

        query = 'UPDATE appointments SET status = ?, confirmation_date = ?, rejection_type = ?, rejection_message = ? WHERE id = ? AND nutriID = ?';
        values = [status, new Date(), rejectionType, finalRejectionMessage, appointmentId, nutriId];
    }
    
    try {
        await pool.query(query, values);
        res.json({ success: true, message: `Consulta ${status.toLowerCase()} com sucesso!` });
    } catch (error) {
        console.error('Erro ao atualizar status da consulta:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar status.' });
    }
}

// Busca as notificações de um paciente (consultas confirmadas/rejeitadas).
export async function getPatientNotifications(req, res) {
    const patientId = req.session.user.id;

    try {
        
        const [rows] = await pool.query(
            `SELECT 
                id, 
                status, 
                service_type,
                rejection_type,     /* NOVO */
                rejection_message,  /* NOVO */
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
                    // Cenário 1: Reagendamento - Usa a mensagem padrão do backend
                    message = `Lamentamos, mas sua solicitação de ${row.service_type} em ${row.date} às ${row.time} foi REJEITADA. Motivo: ${row.rejection_message || 'Horário indisponível.'}`;
                    action = `/pages/paciente/preSchedule.html?nutriId=${req.session.user.nutriID}`; 
                } else if (row.rejection_type === 'cancelamento') {
                    // Cenário 2: Cancelamento Total - Usa a mensagem customizada da nutricionista
                    message = `Sua solicitação de ${row.service_type} em ${row.date} às ${row.time} foi REJEITADA. Justificativa da Nutri: ${row.rejection_message || 'Não especificada.'}`;
                    action = '#'; // Ação de Contato (via WhatsApp)
                } else {
                    // Fallback
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
                rejectionType: row.rejection_type, // NOVO
                action: action // NOVO
            };
        });

        res.json({ success: true, notifications });

    } catch (error) {
        console.error('Erro ao buscar notificações do paciente:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar notificações.' });
    }
}

// Busca os agendamentos confirmados para um nutricionista em um dia específico.
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

// Gera o link de pré-agendamento para um nutricionista.
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

// Busca o histórico de agendamentos de um paciente.
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

// Cancela um agendamento a pedido do paciente.
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

// Busca os detalhes de um paciente específico.
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

// Busca os detalhes da anamnese de um paciente específico.
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

// Busca as métricas de desempenho do nutricionista.
export async function getMetrics(req, res) {
    const period = req.query.period || '30';
    const nutriId = req.session.user.id;

    const emptyData = {
        kpis: { revenue: 0, patients: 0, retention: 0, avgAppointments: 0 },
        evolution: { labels: [], revenue: [], patients: [] },
        appointmentTypes: { labels: [], data: [] },
        patientGoals: { labels: [], data: [] }
    };

    res.json({ success: true, data: emptyData });
}

// Busca os detalhes do perfil do nutricionista.
export async function getNutricionistaDetails(req, res) {
    try {
        const nutriId = req.session.user.id;
        const [rows] = await pool.query(
            'SELECT name, email, phone FROM nutricionista WHERE id = ?',
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

// Atualiza os detalhes do perfil do nutricionista.
export async function updateNutricionistaDetails(req, res) {
    const { name, email, phone } = req.body;
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
            'UPDATE nutricionista SET name = ?, email = ?, phone = ? WHERE id = ?',
            [name, email, phone, nutriId]
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

// Atualiza a senha do nutricionista.
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

// Busca as faturas (mock).
export async function getInvoices(req, res) {
    const nutriId = req.session.user.id;
    res.json({ success: true, data: { invoices: [], kpis: {} } });
}

// Cria uma nova fatura (mock).
export async function createInvoice(req, res) {
    const nutriId = req.session.user.id;
    const { patientId, issueDate, dueDate, items } = req.body;
    res.json({ success: true, message: 'Fatura criada com sucesso!' });
}

/**
 * LÓGICA CORRIGIDA E IMPLEMENTADA
 * Busca os dados de visão geral para o dashboard do nutricionista.
 * Realiza consultas ao banco de dados para obter KPIs dinâmicos.
 */
export async function getDashboardOverview(req, res) {
    const nutriId = req.session.user.id;

    try {
        const today = new Date().toISOString().split('T')[0];

        // Executa todas as consultas de forma paralela para otimizar o tempo de resposta.
        const [
            [appointmentsTodayResult],
            [activePatientsResult],
            [monthlyRevenueResult],
            [avgScoreResult],
            todayAppointmentsListResult
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) as count FROM appointments WHERE nutriID = ? AND status = 'Confirmada' AND DATE(appointment_date) = ?", [nutriId, today]),
            pool.query("SELECT COUNT(*) as count FROM pacientes WHERE nutriID = ? AND status = 'Ativo'", [nutriId]),
            // CORREÇÃO: Usa 'totalValue' e 'issueDate' que são os nomes corretos das colunas na tabela 'invoices'.
            pool.query("SELECT SUM(totalValue) as total FROM invoices WHERE nutriID = ? AND MONTH(issueDate) = MONTH(CURDATE()) AND YEAR(issueDate) = YEAR(CURDATE()) AND status = 'Paid'", [nutriId]),
            pool.query("SELECT AVG(rating) as avgRating FROM nutri_nps WHERE nutri_id = ?", [nutriId]),
            pool.query("SELECT patient_name, service_type, DATE_FORMAT(appointment_date, '%H:%i') as time FROM appointments WHERE nutriID = ? AND status = 'Confirmada' AND DATE(appointment_date) = ? ORDER BY appointment_date ASC", [nutriId, today])
        ]);

        // Monta o objeto de resposta com os dados obtidos.
        const overviewData = {
            kpis: {
                todayAppointments: appointmentsTodayResult.count || 0,
                activePatients: activePatientsResult.count || 0,
                monthlyRevenue: monthlyRevenueResult.total || 0,
                avgScore: avgScoreResult.avgRating || null
            },
            todayAppointments: todayAppointmentsListResult,
            attentionList: [] // Mock: funcionalidade de "Requer Atenção" ainda não implementada.
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

export async function getPatientDashboardOverview(req, res) {
    const patientID = req.session.user.id;

    try {
        const [patientRows] = await pool.query('SELECT p.nome, p.nutriID, n.name as nutriName, n.phone as nutriPhone FROM pacientes p JOIN nutricionista n ON p.nutriID = n.id WHERE p.id = ?', [patientID]);

        if (patientRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Dados do paciente não encontrados.' });
        }

        const { nome: patientName, nutriID, nutriName, nutriPhone } = patientRows[0];

        const [anamneseRows] = await pool.query(
            `SELECT weight, height, objective, created_at FROM anamnese WHERE patientID = ? ORDER BY created_at ASC LIMIT 1`,
            [patientID]
        );
        const initialData = anamneseRows[0] || {};
        
        const [consultationHistory] = await pool.query(
            `SELECT * FROM consultations WHERE patient_id = ? ORDER BY consultation_date ASC`,
            [patientID]
        );
        
        const nextAppointment = await getNextAppointment(patientID);

        let currentWeight = initialData.weight || 0;
        let height = initialData.height || 0;
        
        if (consultationHistory.length > 0) {
            const lastConsultation = consultationHistory[consultationHistory.length - 1];
            currentWeight = lastConsultation.weight || currentWeight;
            height = lastConsultation.height || height;
        }

        const bmi = calculateBMI(currentWeight, height);
        const initialWeight = initialData.weight || 0;
        const weightDifference = currentWeight - initialWeight;

        let parsedObjective = [];
        if (initialData && initialData.objective) {
            const objectiveValue = initialData.objective;
            if (Array.isArray(objectiveValue)) {
                parsedObjective = objectiveValue;
            } else if (typeof objectiveValue === 'string') {
                const objStr = objectiveValue.trim();
                if (objStr.startsWith('[') && objStr.endsWith(']')) {
                    try {
                        parsedObjective = JSON.parse(objStr);
                    } catch (e) {
                        parsedObjective = [objStr.replace(/[\[\]"]/g, '')];
                    }
                } else if (objStr) {
                    parsedObjective = [objStr];
                }
            } else if (objectiveValue) {
                parsedObjective = [String(objectiveValue)];
            }
        }

        const evolutionHistoryWithInitial = [
            { 
              consultation_date: initialData.created_at, 
              weight: initialData.weight, 
              body_fat_percentage: null, 
              circum_waist: null,
              circum_abdomen: null,
              circum_hip: null
            },
            ...consultationHistory
        ];


        const overviewData = {
            patientName,
            nutriID,
            nutriName, 
            nutriPhone,
            kpis: {
                currentWeight,
                initialWeight,
                height,
                bmi,
                weightDifference,
                objective: parsedObjective.filter(o => o).join(', ') || 'Não definido',
            },
            nextAppointment,
            evolutionHistory: evolutionHistoryWithInitial,
        };

        res.json({ success: true, data: overviewData });

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard do paciente:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao servidor.' });
    }
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

// Salva a avaliação (survey) de uma consulta.
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

// Busca a lista de pacientes de um nutricionista.
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
                ) AS appointmentDate
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

/**
 * Registra os dados de acompanhamento de uma consulta.
 * Esta função foi simplificada para ter uma única responsabilidade: salvar os dados da consulta.
 * A lógica de agendamento de retorno foi movida para sua própria função e rota.
 */
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

    // Validação dos campos essenciais para o registro do acompanhamento.
    if (!appointmentId || !patientId || !weight || !height || !subjective_notes || !objective_notes || !assessment_notes || !plan_notes) {
        return res.status(400).json({ success: false, message: "Todos os campos de acompanhamento (peso, altura e anotações SOAP) são obrigatórios." });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Busca os dados do agendamento original para garantir a consistência.
        const [appointmentRows] = await connection.query(
            'SELECT appointment_date FROM appointments WHERE id = ? AND nutriID = ?', 
            [appointmentId, nutriId]
        );

        if (appointmentRows.length === 0) {
            throw new Error("Agendamento não encontrado ou não pertence a este nutricionista.");
        }
        const appointment = appointmentRows[0];
        const bmi = calculateBMI(weight, height);
        
        // Insere os dados da consulta na tabela de 'consultations'.
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
            subjective_notes, objective_notes, assessment_notes, plan_notes
        ];
        
        await connection.query(query, values);
        
        // Atualiza o status do agendamento original para 'Realizada'.
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

/**
 * NOVA FUNÇÃO
 * Lida com a criação de um agendamento de retorno de forma independente.
 * Recebe os dados do paciente, a data e a hora escolhidas.
 */
export async function scheduleReturnAppointment(req, res) {
    const nutriId = req.session.user.id;
    const { patientId, returnDate, returnTime } = req.body;

    if (!patientId || !returnDate || !returnTime) {
        return res.status(400).json({ success: false, message: 'Dados insuficientes para agendar o retorno.' });
    }

    const connection = await pool.getConnection();
    try {
        // Busca os dados mais recentes do paciente para preencher o agendamento.
        const [patientRows] = await connection.query(
            'SELECT nome, email, phone FROM pacientes WHERE id = ? AND nutriID = ?',
            [patientId, nutriId]
        );

        if (patientRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Paciente não encontrado.' });
        }
        const patient = patientRows[0];
        const returnDateTime = `${returnDate} ${returnTime}:00`;

        // Insere o novo agendamento de retorno com status 'Confirmada'.
        await connection.query(
            `INSERT INTO appointments (nutriID, patientID, patient_name, patient_email, patient_phone, service_type, duration, appointment_date, status, confirmation_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nutriId, patientId,
                patient.nome, patient.email, patient.phone,
                'Consulta de Retorno', 45, // Duração padrão para retorno
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

export async function getFoods(req, res) {
    try {
        const [rows] = await pool.query('SELECT id, name, category FROM foods ORDER BY category, name');
        
        const foodLibrary = rows.reduce((acc, food) => {
            if (!acc[food.category]) {
                acc[food.category] = [];
            }
            acc[food.category].push({ id: food.id, name: food.name });
            return acc;
        }, {});

        res.json({ success: true, library: foodLibrary });
    } catch (error) {
        console.error("Erro ao buscar biblioteca de alimentos:", error);
        res.status(500).json({ success: false, message: 'Erro interno ao buscar alimentos.' });
    }
}

export async function saveMealPlan(req, res) {
    const nutriId = req.session.user.id;
    const { patientId, meals } = req.body;

    if (!patientId || !meals || meals.length === 0) {
        return res.status(400).json({ success: false, message: 'Dados do plano alimentar incompletos.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

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
                'INSERT INTO meals (meal_plan_id, name) VALUES (?, ?)',
                [mealPlanId, meal.name]
            );
            const mealId = mealResult.insertId;

            if (meal.items && meal.items.length > 0) {
                for (const item of meal.items) {
                    await connection.query(
                        'INSERT INTO meal_items (meal_id, food_id, quantity) VALUES (?, ?, ?)',
                        [mealId, item.foodId, item.quantity]
                    );
                }
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

    try {
        const query = `
            SELECT 
                mp.id as plan_id, mp.title,
                m.id as meal_id, m.name as meal_name,
                mi.id as item_id, mi.quantity,
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
                    items: []
                });
            }
            if (row.item_id) {
                mealsMap.get(row.meal_id).items.push({
                    id: row.item_id,
                    foodName: row.food_name,
                    quantity: row.quantity
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