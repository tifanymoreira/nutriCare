document.addEventListener("DOMContentLoaded", async function () {
    await checkIfAlreadyLoggedIn();

    // --- Seleção dos Elementos ---
    const flipper = document.querySelector('.auth-flipper');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    const loginMessageContainer = document.getElementById('login-message');
    const registerMessageContainer = document.getElementById('register-message');

    const showMessage = (container, message, isSuccess = true) => {
        container.textContent = message;
        container.className = `form-message-container ${isSuccess ? 'success' : 'error'} visible`;
        
        setTimeout(() => {
            container.classList.remove('visible');
        }, 5000);
    };

    // --- LÓGICA DA ANIMAÇÃO 'CARD FLIP' ---
    if (flipper && showRegisterLink && showLoginLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            flipper.classList.add('is-flipped');
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            flipper.classList.remove('is-flipped');
        });
    }

   
    async function checkIfAlreadyLoggedIn() {
        console.log("checkIfAlreadyLoggedIn function")
        try {
            const response = await fetch('/api/auth/me');
            console.log("how's response = ", response)
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) {
                    const redirectUrl = result.user.role === 'nutricionista'
                        ? '/pages/nutricionista/dashboard.html'
                        : '/pages/paciente/dashboard.html';
                    window.location.href = redirectUrl;
                }
            }
        } catch (error) {
            console.error('Não foi possível verificar o status de autenticação.', error);
        }
    };

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO DE LOGIN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();
            if (result.success) {
                // Redireciona para o dashboard correto em caso de sucesso
                window.location.href = result.redirectUrl;
            } else {
                showMessage(loginMessageContainer, result.message, false);
            }
        } catch (error) {
            showMessage(loginMessageContainer, 'Falha na comunicação com o servidor.', false);
        }
    });

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO DE CADASTRO ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const crn = document.getElementById('registerCRN').value;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, crn })
            });
            const result = await response.json();
            if (result.success) {
                showMessage(registerMessageContainer, result.message, true);
                // Após 2 segundos, vira o cartão de volta para o login
                setTimeout(() => {
                    flipper.classList.remove('is-flipped');
                    registerForm.reset(); // Limpa o formulário de cadastro
                }, 2000);
            } else {
                showMessage(registerMessageContainer, result.message, false);
            }
        } catch (error) {
            showMessage(registerMessageContainer, 'Falha na comunicação com o servidor.', false);
        }
    });
});