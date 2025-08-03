const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/paciente/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'paciente', 'dashboard.html'));
});

app.get('/nutricionista/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'nutricionista', 'dashboard.html'));
});

app.post('/api/login', (req, res) => {
    const { email } = req.body;
    if (email.startsWith('nutri')) {
        res.json({ success: true, redirectUrl: '/nutricionista/dashboard' });
    } else {
        res.json({ success: true, redirectUrl: '/paciente/dashboard' });
    }
});


app.listen(PORT, () => {
    console.log(`Servidor NutriCare rodando em http://localhost:${PORT}`);
});