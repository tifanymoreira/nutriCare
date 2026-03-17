import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
// import { checkDbConnection } from './config/dbConnect.js';

import authRoutes from './routes/auth.routes.js';
import anthropometryRoutes from './routes/anthropometry.routes.js';
import aiRoutes from './routes/ai.routes.js'; // Rota de Inteligência Artificial importada

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'chave_super_secreta_nutricare_123',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// checkDbConnection();

// ROTAS DA API
app.use('/api/auth', authRoutes);
app.use('/api/anthropometry', anthropometryRoutes);
app.use('/api/ai', aiRoutes); // Rota de Inteligência Artificial implementada

// SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND
const clientPublicPath = path.join(__dirname, '../client/public');
app.use(express.static(clientPublicPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(clientPublicPath, 'pages/index.html'));
});

// REDIRECIONAMENTOS DE SEGURANÇA SE NÃO LOGADO
app.get('/pages/nutricionista/*', (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'nutricionista') {
        return res.redirect('/pages/login.html');
    }
    next();
});

app.get('/pages/paciente/*', (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'paciente') {
        return res.redirect('/pages/login.html');
    }
    next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});