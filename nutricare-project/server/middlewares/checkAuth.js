const checkAuth = (req, res, next) => {
    if (req.session.user) {
        next(); // Se o usuário está na sessão, continue
    } else {
        // Para requisições de API, retorne um erro. Para páginas, redirecione.
        if (req.headers.accept && req.headers.accept.includes('json')) {
            return res.status(401).json({ success: false, message: 'Não autorizado. Faça login novamente.' });
        }
        res.redirect('/pages/login.html');
    }
};

export default checkAuth;