document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const form = document.getElementById('resetPasswordForm');
    const messageContainer = document.getElementById('reset-message');
    const btn = document.getElementById('resetBtn');
    const passwordInput = document.getElementById('newPassword');
    const passwordConfirmationInput = document.getElementById('confirmNewPassword');
    
    const requirements = {
        length: document.getElementById('length'),
        lowercase: document.getElementById('lowercase'),
        uppercase: document.getElementById('uppercase'),
        special: document.getElementById('special'),
        match: document.getElementById('match')
    };

    if (!token) {
        showMessage(messageContainer, 'Acesso negado: Token de recuperação inválido ou ausente.', false);
        btn.disabled = true;
    }

    // Toggle de visualização da Senha
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

    function showMessage(container, message, isSuccess = true) {
        container.textContent = message;
        container.className = `form-message-container ${isSuccess ? 'success' : 'error'} visible`;
        setTimeout(() => { container.classList.remove('visible'); }, 5000);
    }

    function updateRequirementUI(element, isValid) {
        const icon = element.querySelector('i');
        if (isValid) {
            element.classList.add('valid');
            icon.classList.replace('bi-x-circle', 'bi-check-circle-fill');
        } else {
            element.classList.remove('valid');
            icon.classList.replace('bi-check-circle-fill', 'bi-x-circle');
        }
    }

    function validatePassword() {
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
    }

    passwordInput.addEventListener('input', validatePassword);
    passwordConfirmationInput.addEventListener('input', validatePassword);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validatePassword()) {
            showMessage(messageContainer, 'Cumpra todos os requisitos da senha.', false);
            return;
        }

        const newPassword = passwordInput.value;

        const textSpan = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-border');
        btn.disabled = true;
        textSpan.classList.add('d-none');
        spinner.classList.remove('d-none');

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showMessage(messageContainer, result.message, true);
                setTimeout(() => { window.location.href = '/pages/login.html'; }, 2000);
            } else {
                showMessage(messageContainer, result.message, false);
                btn.disabled = false;
                textSpan.classList.remove('d-none');
                spinner.classList.add('d-none');
            }
        } catch (error) {
            showMessage(messageContainer, 'Erro de conexão com o servidor.', false);
            btn.disabled = false;
            textSpan.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    });
});