import bcrypt from 'bcrypt';
import { pool } from '../config/dbConnect.js';
import { validarCRN } from '../middlewares/checkCrn.js'; // Função para validar CRN
const saltRounds = 10;

export async function register(req, res) {
    const { name, email, password, crn } = req.body;

    const valid = await validarCRN(crn);
    if (!valid) {
        return res.status(400).json({ success: false, message: 'CRN inválido.' });
    } else {
        console.log("CRN válido");
    }

    if (!name || !email || !password || !crn) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios para o cadastro.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        var role = 'nutricionista';
        var created_at = new Date();

        await pool.query(
            'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, created_at]
        );

        await pool.query(
            'INSERT INTO nutricionista (name, email, crnCode) VALUES (?, ?, ?)',
            [name, email, hashedPassword, crn]
        );

        res.status(201).json({ success: true, message: 'Conta de nutricionista criada com sucesso!' });
    } catch (error) {
        console.log("error code");
        console.log(error);
        // if (error.code === 'ER_DUP_ENTRY') {
        //     return res.status(409).json({ success: false, message: 'Este e-mail já está em uso.' });
        // }
        console.error('Erro no registro de nutricionista:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao realizar o cadastro.' });
    }
}

export async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.' });
    }

    try {
        let user, role, redirectUrl;

        const [nutriRows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (nutriRows.length > 0) {
            user = nutriRows[0];
            role = 'nutricionista';
            redirectUrl = '/pages/nutricionista/dashboard.html';
        } else {
            const [patientRows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
            if (patientRows.length > 0) {
                user = patientRows[0];
                role = 'paciente';
                redirectUrl = '/pages/paciente/dashboard.html';
            }
        }
        if (!user) {
            return res.status(401).json({ success: false, message: 'E-mail ou senha inválidos.' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (match) {
            req.session.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: role,
                ...(role === 'paciente' && { nutriID: user.nutriID })
            };
            res.json({ success: true, redirectUrl });
        } else {
            return res.status(401).json({ success: false, message: 'E-mail ou senha inválidos.' });
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

export async function generateLink(req, res) {
    try {
        const link = `https://nutricare.com/paciente/register?nutriId=${req.session.user.id}`;
        res.json({ success: true, link });
    } catch (error) {
        console.error('Erro ao gerar o link:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar o link.' });
    }
}