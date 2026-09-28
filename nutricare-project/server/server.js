import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
// import { checkDbConnection } from './config/dbConnect.js';

import authRoutes from './routes/auth.routes.js';
import { sendAppointmentReminders } from './controllers/auth.controller.js';
import anthropometryRoutes from './routes/anthropometry.routes.js';
import aiRoutes from './routes/ai.routes.js'; // Rota de Inteligência Artificial importada

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o .env a partir da pasta /server, independente de onde o `node` foi iniciado.
dotenv.config({ path: path.join(__dirname, '.env') });

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

// Migrações de coluna
import { pool } from './config/dbConnect.js';
pool.query('ALTER TABLE appointments ADD COLUMN video_link VARCHAR(500) DEFAULT NULL').catch(() => {});
pool.query('ALTER TABLE users ADD COLUMN reset_token VARCHAR(64) DEFAULT NULL').catch(() => {});
pool.query('ALTER TABLE users ADD COLUMN reset_expires DATETIME DEFAULT NULL').catch(() => {});
pool.query('ALTER TABLE appointments ADD COLUMN reminder_sent TINYINT(1) DEFAULT 0').catch(() => {});
pool.query('ALTER TABLE nutricionista ADD COLUMN photo_url VARCHAR(500) DEFAULT NULL').catch(() => {});
pool.query('ALTER TABLE nutricionista ADD COLUMN service_prices JSON DEFAULT NULL').catch(() => {});
pool.query('ALTER TABLE invoices ADD COLUMN payment_link VARCHAR(500) DEFAULT NULL').catch(() => {});
// O app usa os status 'Realizada' e 'Cancelada', mas o ENUM original não os tinha (gravava vazio). Inclui-os.
pool.query("ALTER TABLE appointments MODIFY COLUMN status ENUM('Pendente','Confirmada','Rejeitada','Realizada','Cancelada') NOT NULL DEFAULT 'Pendente'").catch(() => {});

// Lembretes automáticos de consulta (verifica a cada hora)
sendAppointmentReminders();
setInterval(sendAppointmentReminders, 60 * 60 * 1000);

// ROTAS DA API
app.use('/api/auth', authRoutes);
app.use('/api/anthropometry', anthropometryRoutes);
app.use('/api/ai', aiRoutes); // Rota de Inteligência Artificial implementada

// REDIRECIONAMENTOS DE SEGURANÇA SE NÃO LOGADO
app.get('/pages/nutricionista/*', (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'nutricionista') {
        return res.redirect('/pages/login.html');
    }
    next();
});

app.get('/pages/paciente/*', (req, res, next) => {
    const url = req.originalUrl.toLowerCase();
    
    // Lista de páginas do paciente que DEVEM ser públicas (sem exigir login)
    const publicPages = ['preschedule.html', 'anamnese.html'];
    const isPublic = publicPages.some(page => url.includes(page));

    // Se a página requisitada estiver na lista pública, permite o acesso sem login
    if (isPublic) {
        return next();
    }

    // Caso contrário, exige o login padrão para as demais páginas do paciente
    if (!req.session.user || req.session.user.role !== 'paciente') {
        return res.redirect('/pages/login.html');
    }
    next();
});

// SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND (DEVE FICAR ABAIXO DA SEGURANÇA)
// Assets (css/js/imagens/fontes) ficam em cache no navegador → navegação sem
// rebaixar os mesmos arquivos a cada página. HTML revalida sempre (sem stale).
const clientPublicPath = path.join(__dirname, '../client/public');
app.use(express.static(clientPublicPath, {
    etag: true,
    setHeaders: (res, filePath) => {
        if (/\.(css|js|mjs|png|jpe?g|svg|gif|webp|ico|woff2?|ttf)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(clientPublicPath, 'pages/index.html'));
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});