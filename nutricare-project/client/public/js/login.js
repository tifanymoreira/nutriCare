// nutricare-project/client/public/js/login.js
document.addEventListener("DOMContentLoaded", async function () {
    await checkIfAlreadyLoggedIn();

    // Elementos principais
    const flipper = document.querySelector('.auth-flipper');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    
    // Views intra-card
    const loginView = document.getElementById('loginView');
    const recoveryView = document.getElementById('recoveryView');
    const recoverySuccessView = document.getElementById('recoverySuccessView');
    
    // Botões de navegação intra-card
    const showRecoveryBtn = document.getElementById('showRecovery');
    const backToLoginFromRecovery = document.getElementById('backToLoginFromRecovery');
    const backToLoginFromSuccess = document.getElementById('backToLoginFromSuccess');
    
    // Formulários
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const recoveryForm = document.getElementById('recoveryForm');
    
    // Mensagens
    const loginMessageContainer = document.getElementById('login-message');
    const registerMessageContainer = document.getElementById('register-message');
    const recoveryMessageContainer = document.getElementById('recovery-message');
    
    // Inputs
    const passwordInput = document.getElementById('registerPassword');
    const passwordConfirmationInput = document.getElementById('registerPasswordConfirmation');
    
    const requirements = {
        length: document.getElementById('length'),
        lowercase: document.getElementById('lowercase'),
        uppercase: document.getElementById('uppercase'),
        special: document.getElementById('special'),
        match: document.getElementById('match')
    };

    // --- UX: MÁSCARAS DE INPUT ---
    const phoneInput = document.getElementById('registerPhone');
    const crnInput = document.getElementById('registerCRN');

    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }

    if (crnInput) {
        crnInput.addEventListener('input', function (e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    // --- UX: TOGGLE DE SENHA (OLHINHO) ---
    document.querySelectorAll('.form-icon-toggle').forEach(icon => {
        icon.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.replace('bi-eye', 'bi-eye-slash');
            } else {
                input.type = 'password';
                this.classList.replace('bi-eye-slash', 'bi-eye');
            }
        });
    });

    // --- HELPERS UX ---
    const showMessage = (container, message, isSuccess = true) => {
        container.textContent = message;
        container.className = `form-message-container ${isSuccess ? 'success' : 'error'} visible`;
        
        setTimeout(() => {
            container.classList.remove('visible');
        }, 5000);
    };

    const toggleLoadingState = (btnId, isLoading) => {
        const btn = document.getElementById(btnId);
        const textSpan = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-border');

        if (isLoading) {
            btn.disabled = true;
            textSpan.classList.add('invisible');
            spinner.classList.remove('d-none');
        } else {
            btn.disabled = false;
            textSpan.classList.remove('invisible');
            spinner.classList.add('d-none');
        }
    };

    // --- LÓGICA DE NAVEGAÇÃO INTRA-CARD (VIEWS) ---
    const switchView = (hideView, showView) => {
        hideView.classList.remove('active');
        hideView.classList.add('hidden');
        
        // Pequeno delay para a nova view entrar fluidamente
        setTimeout(() => {
            showView.classList.remove('hidden');
            showView.classList.add('active');
        }, 150);
    };

    showRecoveryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Se o usuário já tiver digitado o email no login, puxa para a recuperação
        const loginEmailVal = document.getElementById('loginEmail').value;
        if(loginEmailVal) document.getElementById('recoveryEmail').value = loginEmailVal;
        
        switchView(loginView, recoveryView);
    });

    backToLoginFromRecovery.addEventListener('click', () => {
        switchView(recoveryView, loginView);
        recoveryForm.reset();
        recoveryMessageContainer.classList.remove('visible');
    });

    backToLoginFromSuccess.addEventListener('click', () => {
        switchView(recoverySuccessView, loginView);
        recoveryForm.reset();
    });

    // --- LÓGICA DA ANIMAÇÃO 'CARD FLIP' ---
    if (flipper && showRegisterLink && showLoginLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            flipper.classList.add('is-flipped');
            registerForm.reset();
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            flipper.classList.remove('is-flipped');
        });
    }
   
    // --- AUTENTICAÇÃO E REQUISIÇÕES ---
    async function checkIfAlreadyLoggedIn() {
        try {
            const response = await fetch('/api/auth/me');
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

    // Validadores de Senha
    const updateRequirementUI = (element, isValid) => {
        const icon = element.querySelector('i');
        if (isValid) {
            element.classList.add('valid');
            icon.classList.replace('bi-x-circle', 'bi-check-circle-fill');
        } else {
            element.classList.remove('valid');
            icon.classList.replace('bi-check-circle-fill', 'bi-x-circle');
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

        updateRequirementUI(requirements.length, isLengthValid);
        updateRequirementUI(requirements.lowercase, hasLowercase);
        updateRequirementUI(requirements.uppercase, hasUppercase);
        updateRequirementUI(requirements.special, hasSpecial);
        updateRequirementUI(requirements.match, doPasswordsMatch);

        return isLengthValid && hasLowercase && hasUppercase && hasSpecial && doPasswordsMatch;
    };

    if(passwordInput && passwordConfirmationInput) {
        passwordInput.addEventListener('input', validatePassword);
        passwordConfirmationInput.addEventListener('input', validatePassword);
    }

    // --- SUBMITS DE FORMULÁRIOS ---

    // 1. Submit de Recuperação de Senha
    recoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recoveryEmail').value;
        
        toggleLoadingState('recoveryBtn', true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const result = await response.json();
            
            // Por segurança (Anti-enumeração), a boa prática é mostrar sucesso mesmo se o email não existir.
            // O texto da View 3 já cobre isso de forma sutil: "Se encontrarmos uma conta..."
            
            toggleLoadingState('recoveryBtn', false);
            
            // Define o email digitado na tela de sucesso e troca a View
            document.getElementById('sentEmailSpan').textContent = email;
            switchView(recoveryView, recoverySuccessView);

        } catch (error) {
            showMessage(recoveryMessageContainer, 'Erro de conexão. Tente novamente.', false);
            toggleLoadingState('recoveryBtn', false);
        }
    });

    // 2. Submit de Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        toggleLoadingState('loginBtn', true);

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
                showMessage(loginMessageContainer, result.message || 'Credenciais inválidas.', false);
                toggleLoadingState('loginBtn', false);
            }
        } catch (error) {
            showMessage(loginMessageContainer, 'Falha na comunicação com o servidor.', false);
            toggleLoadingState('loginBtn', false);
        }
    });

    // 3. Submit de Registro
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validatePassword()) {
            showMessage(registerMessageContainer, 'Por favor, cumpra todos os requisitos da senha.', false);
            return;
        }

        toggleLoadingState('registerBtn', true);

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = passwordInput.value;
        const passwordConfirmation = passwordConfirmationInput.value;
        const phone = document.getElementById('registerPhone').value.replace(/\D/g, ''); 
        const crn = document.getElementById('registerCRN').value;
        const role = 'nutricionista';

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
                    Object.values(requirements).forEach(req => updateRequirementUI(req, false));
                    toggleLoadingState('registerBtn', false);
                }, 2000);
            } else {
                showMessage(registerMessageContainer, result.message, false);
                toggleLoadingState('registerBtn', false);
            }
        } catch (error) {
            showMessage(registerMessageContainer, 'Falha na comunicação com o servidor.', false);
            toggleLoadingState('registerBtn', false);
        }
    });
});