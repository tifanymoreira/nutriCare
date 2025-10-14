// nutricare-project/client/public/js/login.js
document.addEventListener("DOMContentLoaded", async function () {
    await checkIfAlreadyLoggedIn();

    const flipper = document.querySelector('.auth-flipper');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    const loginMessageContainer = document.getElementById('login-message');
    const registerMessageContainer = document.getElementById('register-message');
    
    const passwordInput = document.getElementById('registerPassword');
    const passwordConfirmationInput = document.getElementById('registerPasswordConfirmation');
    const requirements = {
        length: document.getElementById('length'),
        lowercase: document.getElementById('lowercase'),
        uppercase: document.getElementById('uppercase'),
        special: document.getElementById('special'),
        match: document.getElementById('match')
    };

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
        try {
            const response = await fetch('/api/auth/me');
            
            // VERIFICA SE O STATUS É SUCESSO (200-299)
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) {
                    const redirectUrl = result.user.role === 'nutricionista'
                        ? '/pages/nutricionista/dashboard.html'
                        : '/pages/paciente/dashboard.html';
                    window.location.href = redirectUrl;
                }
            }
            // SE O STATUS FOR 401, response.ok é false, e a função continua.
        } catch (error) {
            console.error('Não foi possível verificar o status de autenticação.', error);
        }
    };

    const validatePassword = () => {
        const value = passwordInput.value;
        const confirmationValue = passwordConfirmationInput.value;

        const isLengthValid = value.length >= 6;
        const hasLowercase = /[a-z]/.test(value);
        const hasUppercase = /[A-Z]/.test(value);
        const hasSpecial = /[\d\W]/.test(value);
        const doPasswordsMatch = value === confirmationValue && value.length > 0;

        requirements.length.classList.toggle('valid', isLengthValid);
        requirements.lowercase.classList.toggle('valid', hasLowercase);
        requirements.uppercase.classList.toggle('valid', hasUppercase);
        requirements.special.classList.toggle('valid', hasSpecial);
        requirements.match.classList.toggle('valid', doPasswordsMatch);

        return isLengthValid && hasLowercase && hasUppercase && hasSpecial && doPasswordsMatch;
    };

    passwordInput.addEventListener('input', validatePassword);
    passwordConfirmationInput.addEventListener('input', validatePassword);

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
                window.location.href = result.redirectUrl;
            } else {
                showMessage(loginMessageContainer, result.message, false);
            }
        } catch (error) {
            showMessage(loginMessageContainer, 'Falha na comunicação com o servidor.', false);
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validatePassword()) {
            showMessage(registerMessageContainer, 'Por favor, cumpra todos os requisitos da senha.', false);
            return;
        }

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = passwordInput.value;
        const passwordConfirmation = passwordConfirmationInput.value;
        const phone = document.getElementById('registerPhone').value;
        const crn = document.getElementById('registerCRN').value;
        const role = 'nutricionista'

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, passwordConfirmation, phone, crn, role })
            });
            const result = await response.json();
            if (result.success) {
                showMessage(registerMessageContainer, result.message, true);
                setTimeout(() => {
                    flipper.classList.remove('is-flipped');
                    registerForm.reset(); 
                    Object.values(requirements).forEach(req => req.classList.remove('valid'));
                }, 2000);
            } else {
                showMessage(registerMessageContainer, result.message, false);
            }
        } catch (error) {
            showMessage(registerMessageContainer, 'Falha na comunicação com o servidor.', false);
        }
    });
});