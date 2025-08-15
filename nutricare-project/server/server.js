import dotenv from 'dotenv';
dotenv.config(); // ESSA DEVE SER A PRIMEIRA LINHA

import express from 'express';
import path from 'path';
import session from 'express-session';
import { testConnection } from './config/dbConnect.js';
import authRoutes from './routes/auth.routes.js';
import checkAuth from './middlewares/checkAuth.js';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// Corrige __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

testConnection();

// --- Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Em produção, use true com HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Servir arquivos estáticos
const publicPath = path.join(__dirname, '..', 'client', 'public');
app.use(express.static(publicPath));

// --- Rotas da API ---
app.use('/api/auth', authRoutes);

// --- Rota Principal ---
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'pages', 'index.html'));
});

// --- Rotas de Páginas Protegidas ---
app.get('/pages/paciente/dashboard.html', checkAuth, (req, res) => {
    if (req.session.user.role !== 'paciente') {
        return res.status(403).send("Acesso Negado.");
    }
    res.sendFile(path.join(publicPath, 'pages', 'paciente', 'dashboard.html'));
});

app.get('/pages/nutricionista/dashboard.html', checkAuth, (req, res) => {
    if (req.session.user.role !== 'nutricionista') {
        return res.status(403).send("Acesso Negado.");
    }
    res.sendFile(path.join(publicPath, 'pages', 'nutricionista', 'dashboard.html'));
});

// --- Iniciar o Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor NutriCare rodando em http://localhost:${PORT}`);
});