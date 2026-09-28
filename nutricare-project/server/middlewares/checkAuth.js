// nutricare-project/server/middlewares/checkAuth.js
const checkAuth = (req, res, next) => {
    if (!req || !req.originalUrl) return next();

    // Permite requisições de preflight CORS passarem livremente
    if (req.method === 'OPTIONS') return next();

    const url = req.originalUrl.toLowerCase();

    // Whitelist hiper abrangente para garantir que o fluxo do paciente (e recursos) passem livremente
    const publicPaths = [
        'preschedule', 
        'pre-schedule',
        'pre_schedule',
        'preagendamento',
        'pre-agendamento',
        'preanamnese',
        'pre-anamnese',
        'pre_anamnese',
        'anamnese', 
        'login', 
        'register', 
        'reset-password',
        '.html',
        '/css/',
        '/js/',
        '/images/',
        'manifest.json',
        'sw.js',
        '/api/auth/schedule',     // Libera APIs de listar horários e agendar
        '/api/auth/public'        // Libera APIs de recursos abertos como o form dinâmico
    ];

    const isPublicPage = publicPaths.some(path => url.includes(path));
    
    // BALA DE PRATA: Se a URL contiver nutriId, é uma página pública (impede bypass em APIs por segurança)
    const isPublicQuery = (!url.startsWith('/api/')) && (url.includes('nutriid=') || url.includes('appointmentid='));

    if (isPublicPage || isPublicQuery || (req.session && req.session.user)) {
        return next(); 
    } else {
        const isApiCall = url.startsWith('/api/');

        if (isApiCall) {
            return res.status(401).json({ success: false, message: 'Não autorizado. Faça login novamente.' });
        }
        
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.redirect('/pages/login.html');
    }
};

export default checkAuth;