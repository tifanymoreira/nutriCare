import bcrypt from 'bcrypt';
import { pool } from '../config/dbConnect.js';
import { validarCRN } from '../middlewares/checkCrn.js';
const saltRounds = 10;

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
    const { registerData, anamneseData } = req.body;
    const { name, email, password, nutriID } = registerData;
    const role = 'paciente';

    if (!name || !email || !password || !nutriID) {
        return res.status(400).json({ success: false, message: 'Dados de registro do paciente incompletos.' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [userResult] = await connection.query(
            'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, new Date()]
        );
        const patientId = userResult.insertId;

        await connection.query(
            'INSERT INTO pacientes (id, nome, email, nutriID) VALUES (?, ?, ?, ?)',
            [patientId, name, email, nutriID]
        );

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

export async function getPatientCount(req, res) {
    try {
        const nutriId = req.user?.id || req.query.nutriId;
        if (!nutriId) {
            return res.status(400).json({ success: false, message: 'NutriId não informado.' });
        }
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
    console.log("start getScoreMedium function")
    try {
        const nutriId = req.user?.id || req.query.nutriId;
        if (!nutriId) {
            return res.status(400).json({ success: false, message: 'NutriId não informado.' });
        }
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
    console.log("start generateAgenda function")
    console.log("generateAgenda function | req.body")
    console.log(req.body)

    try {
        const nutriId = req.user?.id || req.body.formData.nutriID
        const startTime = req.body.startTime
        const endTime = req.body.endTime
        const duration = req.body.slotDuration
        const availableDays = req.body.dates

        await connection.query(
            'INSERT INTO nutri_agenda (nutriID, startTime, endTime, duration, available_days) VALUES (?, ?, ?, ?, ?)',
            [nutriId, startTime, endTime, duration, availableDays]
        );

        res.status(200).json({ success: true, message: 'Dados inseridos com sucesso' });

    } catch {
        res.status(500).json({ success: false, message: 'Erro ao gerar agenda.' });

    }
}

export async function updateNutriAndPatientAgenda(req, res) {
    console.log("start updateNutriAndPatientAgenda function")
    console.log("updateNutriAndPatientAgenda function | req.body")
    console.log(req.body)

    try {
        const nutriId = req.body.formData.nutriID
        const patientId = req.body.patientId
        const selectedDate = req.body.startTime
        const selectedTime = req.body.endTime
        const duration = req.body.slotDuration
        const availableDays = req.body.dates

        let nutriAgenda = await connection.query(
            'SELECT available_days FROM nutri_agenda WHERE nutriID = ?', [nutriId]
        )

        console.log("how's nutriAgenda?")
        console.log(nutriAgenda)

        let updatedNutriAgenda = updatedNutriAgenda(selectedDate, selectedTime, nutriAgenda)

        await connection.query(
            'UPDATE nutri_agenda SET available_days = ? WHERE nutriID = ?',
            [updatedNutriAgenda, nutriId]
        );

        await connection.query(
            'UPDATE patient_agenda SET available_days = ? WHERE patientID = ?',
            [selectedDate, selectedTime, patientId]
        );

        res.status(200).json({ success: true, message: 'Dados inseridos com sucesso' });

    } catch {
        res.status(500).json({ success: false, message: 'Erro ao gerar agenda.' });

    }
}

function updatedNutriAgenda(date, time, nutriAgenda) {
    console.log("start updatedNutriAgenda function")
    console.log("updatedNutriAgenda | date = ", date)
    console.log("updatedNutriAgenda | time = ", time)
    console.log("updatedNutriAgenda | nutriAgenda = ")
    console.log(nutriAgenda

        
    )
}

export async function generateLink(req, res) {
    console.log("start generateLink function")
    try {
        const link = `http://localhost:3000/pages/paciente/preSchedule.html?nutriId=${req.session.user.id}`;
        res.json({ success: true, link });
    } catch (error) {
        console.error('Erro ao gerar o link:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar o link.' });
        res.status(500).json({ success: false, message: 'Erro ao gerar o link.' });
    }
}

export async function patientList(req, res) {
    console.log("start patientList function")
    var nutriId = req.session.user?.id || req.query.nutriId;
    console.log("patientList | nutriId = ", nutriId)

    const [rows] = await pool.query('SELECT id, nome, email, status FROM pacientes WHERE nutriID = ?', [nutriId]);

    console.log("patientList | rows =")
    console.log(rows)

    if (rows.length > 0) {
        res.json({ success: true, patients: rows });
    } else {
        res.status(404).json({ success: false, message: 'Nenhum paciente encontrado.' });
    }
}


export async function patientDetails(req, res) {
    console.log("start patientDetails function")
    var nutriId = req.session.user?.id || req.query.nutriId;
    var patientId = req.params.id;
    console.log("patientDetails | nutriId = ", nutriId)
    console.log("patientDetails | patientId = ", patientId)

    const [rows] = await pool.query('SELECT id, nome, email, status FROM pacientes WHERE nutriID = ? AND id = ?', [nutriId, patientId]);

    console.log("patientDetails | rows =")
    console.log(rows)

    if (rows.length > 0) {
        res.json({ success: true, patients: rows });
    } else {
        res.status(404).json({ success: false, message: 'Nenhum paciente encontrado.' });
    }

}
export async function anamneseDetails(req, res) {
    console.log("start anamneseDetails function")
    var nutriId = req.session.user?.id || req.query.nutriId;
    var patientId = req.params.id;
    console.log("anamneseDetails | nutriId = ", nutriId)
    console.log("anamneseDetails | patientId = ", patientId)

    const [rows] = await pool.query('SELECT * FROM anamnese WHERE nutriID = ? AND patientID = ?', [nutriId, patientId]);

    console.log("anamneseDetails | rows =")
    console.log(rows)

    if (rows.length > 0) {
        res.json({ success: true, patients: rows });
    } else {
        res.status(404).json({ success: false, message: 'Nenhuma anamnese encontrada.' });
    }

}

export async function mealPlan(req, res) {
    try {
        const patientId = req.params.id;
        const rows = [];

        if (rows.length > 0) {
            res.json({ success: true, plan: rows });
        } else {
            res.json({ success: true, plan: [] });
        }
    } catch (error) {
        console.error("Erro ao buscar plano alimentar:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

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

export async function getNutricionistaDetails(req, res) {
    try {
        const nutriId = req.session.user.id;
        const [rows] = await pool.query(
            'SELECT name, email, phone FROM nutricionista WHERE id = ?',
            [nutriId]
        );
        if (rows.length > 0) {
            res.json({ success: true, data: rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Nutricionista não encontrado.' });
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do nutricionista:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}

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
    res.json({ success: true, data: { invoices: [], kpis: {} } });
}

export async function createInvoice(req, res) {
    const nutriId = req.session.user.id;
    const { patientId, issueDate, dueDate, items } = req.body;
    res.json({ success: true, message: 'Fatura criada com sucesso!' });
}

export async function getDashboardOverview(req, res) {
    const nutriId = req.session.user.id;

    try {
        //query

        const overviewData = {
            kpis: {
                todayAppointments: 0,
                activePatients: 0,
                monthlyRevenue: 0,
                avgScore: null
            },
            todayAppointments: [],
            attentionList: []
        };

        res.json({ success: true, data: overviewData });

    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
}