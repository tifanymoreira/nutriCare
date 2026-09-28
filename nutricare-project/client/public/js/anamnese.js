// nutricare-project/client/public/js/anamnese.js
document.addEventListener("DOMContentLoaded", function () {
    // --- ANIQUILADOR DE CACHE FANTASMA ---
    if ('caches' in window) {
        caches.keys().then(names => {
            for (let name of names) caches.delete(name);
        }).catch(e => console.error(e));
    }

    // --- REMOÇÃO FORÇADA DO SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
        });
    }

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

    // RENDERIZAÇÃO DE CAMPOS DINÂMICOS
    let dynamicConfig = [];
    if (nutriId) {
        fetch(`/api/auth/public/anamnese-config/${nutriId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.config && data.config.length > 0) {
                    dynamicConfig = data.config;
                    renderDynamicQuestions(data.config);
                }
            })
            .catch(err => console.error("Erro ao carregar perguntas dinâmicas", err));
    }

    function renderDynamicQuestions(questions) {
        let container = document.getElementById('dynamic-questions-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'dynamic-questions-container';
            container.className = 'mt-5 mb-4';
            container.innerHTML = '<h5 class="fw-bold mb-3" style="color: var(--primary-green);">Perguntas Adicionais da Nutricionista</h5><hr>';
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.parentNode.insertBefore(container, submitBtn);
        }
        
        let hasCustom = false;

        questions.forEach(q => {
            if (q.type === 'default') {
                // Encontra e atualiza/oculta campos do formulário original
                let el = document.getElementById(q.id);
                if (!el) el = document.querySelector(`input[name="${q.id}"]`);
                
                if (el) {
                    let wrapper = el.closest('.form-question') || el.closest('.col-md-6') || el.closest('.mb-3') || el.closest('.mb-4');
                    if (wrapper) {
                        if (q.visible === false) {
                            wrapper.style.display = 'none';
                            // Remove required para não bloquear a submissão
                            wrapper.querySelectorAll('input, textarea, select').forEach(inp => {
                                inp.removeAttribute('required');
                                inp.value = '';
                            });
                        } else if (q.label) {
                            let labelEl = wrapper.querySelector('label.form-label') || wrapper.querySelector('h5');
                            if (labelEl) {
                                let reqHtml = labelEl.innerHTML.includes('*') ? ' <span class="text-danger">*</span>' : '';
                                labelEl.innerHTML = `${q.label}${reqHtml}`;
                            }
                        }
                    }
                }
            } else {
                hasCustom = true;
                const wrapper = document.createElement('div');
                wrapper.className = 'form-question mb-4 p-4 bg-white rounded border shadow-sm accent-warning';
                let html = `<label class="form-label fw-bold">${q.label}${q.required ? ' <span class="text-danger">*</span>' : ''}</label>`;
                if (q.type === 'text') html += `<input type="text" id="dyn_${q.id}" class="form-control" ${q.required ? 'required' : ''} placeholder="Sua resposta...">`;
                else if (q.type === 'textarea') html += `<textarea id="dyn_${q.id}" class="form-control" rows="3" ${q.required ? 'required' : ''} placeholder="Sua resposta..."></textarea>`;
                else if (q.type === 'radio' || q.type === 'checkbox') {
                    const optionsArr = (q.options || '').split(',').map(o => o.trim()).filter(o => o);
                    optionsArr.forEach((opt, idx) => { html += `<div class="form-check"><input class="form-check-input" type="${q.type}" name="dyn_${q.id}" id="dyn_${q.id}_${idx}" value="${opt}"><label class="form-check-label" for="dyn_${q.id}_${idx}">${opt}</label></div>`; });
                }
                wrapper.innerHTML = html;
                container.appendChild(wrapper);
            }
        });
        
        if (!hasCustom) container.style.display = 'none';
    }

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

            // COLETA AS RESPOSTAS DINÂMICAS
            const dynamic_answers = {};
            dynamicConfig.forEach(q => {
                if (q.type === 'default') return; // Padrões tratados separadamente
                if (q.type === 'checkbox') {
                    const checked = Array.from(document.querySelectorAll(`input[name="dyn_${q.id}"]:checked`)).map(el => el.value);
                    dynamic_answers[q.label] = checked;
                } else if (q.type === 'radio') {
                    const checked = document.querySelector(`input[name="dyn_${q.id}"]:checked`);
                    dynamic_answers[q.label] = checked ? checked.value : '';
                } else {
                    const el = document.getElementById(`dyn_${q.id}`);
                    dynamic_answers[q.label] = el ? el.value : '';
                }
            });

            const anamneseData = {
                peso: document.getElementById('peso')?.value || null,
                altura: document.getElementById('altura')?.value || null,
                data_nascimento: document.getElementById('data_nascimento')?.value || null,
                objetivos: Array.from(document.querySelectorAll('input[name="objetivo"]:checked') || [])
                    .map(cb => cb.value === 'outro' ? document.getElementById('outro_objetivo_input')?.value || '' : cb.value),
                problema_saude: document.getElementById('problema_saude')?.value || null,
                cirurgia: document.getElementById('cirurgia')?.value || null,
                digestao: document.getElementById('digestao')?.value || null,
                intestino: document.querySelector('input[name="intestino"]:checked')?.value === 'outro'
                    ? document.getElementById('outro_intestino_input')?.value || null
                    : document.querySelector('input[name="intestino"]:checked')?.value || null,
                consistencia_fezes: document.querySelector('input[name="consistencia_fezes"]:checked')?.value || null,
                ingestao_agua: document.querySelector('input[name="ingestao_agua"]:checked')?.value || null,
                ciclo_menstrual: document.querySelector('input[name="ciclo_menstrual"]:checked')?.value === 'outro'
                    ? document.getElementById('outro_ciclo_input')?.value || null
                    : document.querySelector('input[name="ciclo_menstrual"]:checked')?.value || null,
                tratamento_anterior: document.querySelector('input[name="tratamento_anterior"]:checked')?.value || null,
                mastigacao: document.querySelector('input[name="mastigacao"]:checked')?.value === 'outro'
                    ? document.getElementById('outro_mastigacao_input')?.value || null
                    : document.querySelector('input[name="mastigacao"]:checked')?.value || null,
                alergias: document.getElementById('alergias')?.value || null,
                aversao: document.getElementById('aversao')?.value || null,
                gostos: document.getElementById('gostos')?.value || null,
                alcool: document.querySelector('input[name="alcool"]:checked')?.value || null,
                medicacao: document.getElementById('medicacao')?.value || null,
                atividade_fisica: document.getElementById('atividade_fisica')?.value || null,
                sono: document.getElementById('sono')?.value || null,
                exames_sangue: document.getElementById('exames_sangue')?.value || null,
                expectativas: document.getElementById('expectativas')?.value || null,
                dynamic_answers: dynamic_answers
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