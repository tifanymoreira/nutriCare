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
        'anamnese', 
        'login', 
        'register', 
        'reset-password',
        '/css/',
        '/js/',
        '/images/',
        'manifest.json',
        'sw.js',
        '/api/auth/schedule',     // Libera APIs de listar horários e agendar
        '/api/auth/nutricionista' // Libera API para puxar o nome do nutri na tela pública
    ];

    const isPublicPage = publicPaths.some(path => url.includes(path));

    if (isPublicPage || (req.session && req.session.user)) {
        return next(); 
    } else {
        const isApiCall = url.startsWith('/api/');

        if (isApiCall) {
            return res.status(401).json({ success: false, message: 'Não autorizado. Faça login novamente.' });
        }
        
        res.redirect('/pages/login.html');
    }
};

export default checkAuth;