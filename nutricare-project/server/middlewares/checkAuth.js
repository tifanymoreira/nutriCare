// nutricare-project/server/middlewares/checkAuth.js
const checkAuth = (req, res, next) => {
    if (req.session.user) {
        next(); 
    } else {
        // Se a URL original começar com '/api/', trata como uma chamada de API e retorna JSON 401.
        // Isso garante que chamadas fetch (como a de '/api/auth/me') recebam JSON na falha de autenticação.
        const isApiCall = req.originalUrl.startsWith('/api/');

        if (isApiCall) {
            return res.status(401).json({ success: false, message: 'Não autorizado. Faça login novamente.' });
        }
        
        // Caso contrário, trata como tentativa de acesso direto à página HTML protegida e redireciona.
        res.redirect('/pages/login.html');
    }
};

export default checkAuth;