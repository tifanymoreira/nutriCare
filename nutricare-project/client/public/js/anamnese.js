// nutricare-project/client/public/js/anamnese.js
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById('anamneseForm');
    const urlParams = new URLSearchParams(window.location.search);
    
    // CAMPOS DE REGISTRO, ID DA NUTRI E ID DO AGENDAMENTO
    const nutriId = urlParams.get('nutriId');
    const appointmentId = urlParams.get('appointmentId'); // Captura o ID do agendamento
    const patientName = decodeURIComponent(urlParams.get('patientName') || '');
    const patientEmail = decodeURIComponent(urlParams.get('patientEmail') || '');
    const patientPhone = decodeURIComponent(urlParams.get('patientPhone') || '');

    // Preenche os campos de registro com os dados do pré-agendamento
    if (document.getElementById('nutriId')) document.getElementById('nutriId').value = nutriId;
    if (document.getElementById('appointmentId')) document.getElementById('appointmentId').value = appointmentId; // Preenche o campo oculto
    if (document.getElementById('nome')) document.getElementById('nome').value = patientName;
    if (document.getElementById('email')) document.getElementById('email').value = patientEmail;
    if (document.getElementById('phone')) document.getElementById('phone').value = patientPhone;

    if (!nutriId) {
        console.log("!nutriId")
    }


    const outroObjetivoCheckbox = document.getElementById('outro_objetivo');
    const outroObjetivoInput = document.getElementById('outro_objetivo_input');

    const outroIntestinoRadio = document.getElementById('outro_intestino');
    const outroIntestinoInput = document.getElementById('outro_intestino_input');

    const outroCicloRadio = document.getElementById('outro_ciclo');
    const outroCicloInput = document.getElementById('outro_ciclo_input');

    const outroMastigacaoRadio = document.getElementById('outro_mastigacao');
    const outroMastigacaoInput = document.getElementById('outro_mastigacao_input');


    function setupInputToggle(radioOrCheckbox, inputElement) {
        if (radioOrCheckbox && inputElement) {
            radioOrCheckbox.addEventListener('change', () => {
                if (radioOrCheckbox.checked) {
                    inputElement.style.display = 'block';
                    inputElement.setAttribute('required', 'true');
                }
            });
            document.querySelectorAll(`[name=${radioOrCheckbox.name}]`).forEach(option => {
                option.addEventListener('change', () => {
                    if (option !== radioOrCheckbox) {
                        inputElement.style.display = 'none';
                        inputElement.removeAttribute('required');
                        inputElement.value = '';
                    }
                });
            });
        }
    }

    setupInputToggle(outroObjetivoCheckbox, outroObjetivoInput);
    setupInputToggle(outroIntestinoRadio, outroIntestinoInput);
    setupInputToggle(outroCicloRadio, outroCicloInput);
    setupInputToggle(outroMastigacaoRadio, outroMastigacaoInput);


    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('password_confirmation').value;
            if (password !== confirmPassword) {
                console.log("senhas erradas.")
                return;
            }

            const registerData = {
                nutriID: nutriId,
                name: document.getElementById('nome').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                password: password,
            };


            const anamneseData = {
                peso: document.getElementById('peso').value,
                altura: document.getElementById('altura').value,
                data_nascimento: document.getElementById('data_nascimento').value,
                objetivos: Array.from(document.querySelectorAll('input[name="objetivo"]:checked'))
                    .map(cb => cb.value === 'outro' ? document.getElementById('outro_objetivo_input').value : cb.value),
                problema_saude: document.getElementById('problema_saude').value,
                cirurgia: document.getElementById('cirurgia').value,
                digestao: document.getElementById('digestao').value,
                intestino: document.querySelector('input[name="intestino"]:checked').value === 'outro'
                    ? document.getElementById('outro_intestino_input').value
                    : document.querySelector('input[name="intestino"]:checked').value,
                consistencia_fezes: document.querySelector('input[name="consistencia_fezes"]:checked').value,
                ingestao_agua: document.querySelector('input[name="ingestao_agua"]:checked').value,
                ciclo_menstrual: document.querySelector('input[name="ciclo_menstrual"]:checked').value === 'outro'
                    ? document.getElementById('outro_ciclo_input').value
                    : document.querySelector('input[name="ciclo_menstrual"]:checked').value,
                tratamento_anterior: document.querySelector('input[name="tratamento_anterior"]:checked').value,
                mastigacao: document.querySelector('input[name="mastigacao"]:checked').value === 'outro'
                    ? document.getElementById('outro_mastigacao_input').value
                    : document.querySelector('input[name="mastigacao"]:checked').value,
                alergias: document.getElementById('alergias').value,
                aversao: document.getElementById('aversao').value,
                gostos: document.getElementById('gostos').value,
                alcool: document.querySelector('input[name="alcool"]:checked').value,
                medicacao: document.getElementById('medicacao').value,
                atividade_fisica: document.getElementById('atividade_fisica').value,
                sono: document.getElementById('sono').value,
                exames_sangue: document.getElementById('exames_sangue').value,
                expectativas: document.getElementById('expectativas').value
            };

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: 'paciente',
                        registerData: registerData,
                        anamneseData: anamneseData,
                        appointmentId: document.getElementById('appointmentId').value // Envia o ID do agendamento
                    })
                });

                const result = await response.json();

                if (result.success) {
                    window.location.href = '/pages/paciente/dashboard.html';
                } else {
                    console.log('Erro no cadastro: ' + result.message);
                }
            } catch (error) {
                console.error('Falha na comunicação com o servidor.', error);
            }
        });
    }
});