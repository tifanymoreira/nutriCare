document.addEventListener("DOMContentLoaded", async () => {
    const stdContainer = document.getElementById('standardQuestionsContainer');
    const cstContainer = document.getElementById('customQuestionsContainer');
    const addBtn = document.getElementById('addQuestionBtn');
    const saveBtn = document.getElementById('saveConfigBtn');
    
    const standardFieldsMap = [
        { id: 'peso', label: 'Peso Atual (kg)', type: 'default' },
        { id: 'altura', label: 'Altura (cm)', type: 'default' },
        { id: 'data_nascimento', label: 'Data de Nascimento', type: 'default' },
        { id: 'objetivo', label: 'Objetivos Principais', type: 'default' },
        { id: 'problema_saude', label: 'Problemas de Saúde', type: 'default' },
        { id: 'cirurgia', label: 'Cirurgias Anteriores', type: 'default' },
        { id: 'digestao', label: 'Como é sua digestão?', type: 'default' },
        { id: 'intestino', label: 'Funcionamento Intestinal', type: 'default' },
        { id: 'consistencia_fezes', label: 'Consistência das Fezes', type: 'default' },
        { id: 'ingestao_agua', label: 'Ingestão de Água', type: 'default' },
        { id: 'ciclo_menstrual', label: 'Ciclo Menstrual', type: 'default' },
        { id: 'tratamento_anterior', label: 'Tratamentos Anteriores', type: 'default' },
        { id: 'mastigacao', label: 'Mastigação', type: 'default' },
        { id: 'alergias', label: 'Alergias / Intolerâncias', type: 'default' },
        { id: 'aversao', label: 'Aversões Alimentares', type: 'default' },
        { id: 'gostos', label: 'Preferências Alimentares', type: 'default' },
        { id: 'alcool', label: 'Consumo de Álcool', type: 'default' },
        { id: 'medicacao', label: 'Uso de Medicamentos', type: 'default' },
        { id: 'atividade_fisica', label: 'Atividade Física', type: 'default' },
        { id: 'sono', label: 'Qualidade do Sono', type: 'default' },
        { id: 'exames_sangue', label: 'Exames de Sangue Recentes', type: 'default' },
        { id: 'expectativas', label: 'Expectativas com a Consulta', type: 'default' }
    ];

    let questions = [];

    try {
        const res = await fetch('/api/auth/nutricionista/anamnese-config');
        const data = await res.json();
        const savedConfig = (data.success && data.config) ? data.config : [];
        
        // Mescla as perguntas padrões do sistema com as salvações (caso a Nutri tenha escondido ou renomeado)
        standardFieldsMap.forEach(sf => {
            const existing = savedConfig.find(q => q.id === sf.id);
            if (existing) questions.push(existing);
            else questions.push({ ...sf, visible: true });
        });

        // Adiciona as personalizadas que já existem
        savedConfig.filter(q => q.type !== 'default').forEach(q => questions.push(q));

        renderQuestions();
    } catch(e) { console.error("Erro ao carregar configurações", e); }

    function renderQuestions() {
        stdContainer.innerHTML = '';
        cstContainer.innerHTML = '';

        const customQuestions = questions.filter(q => q.type !== 'default');
        if (customQuestions.length === 0) cstContainer.innerHTML = '<div class="text-center text-muted p-4 bg-light rounded-4 border border-dashed"><i class="bi bi-inboxes display-6 opacity-50 d-block mb-2"></i> Você ainda não criou nenhuma pergunta adicional.</div>';

        questions.forEach((q, index) => {
            if (q.type === 'default') {
                const col = document.createElement('div');
                col.className = 'col-md-6 col-lg-4 mb-3';
                col.innerHTML = `
                    <div class="question-card h-100 p-3 rounded-4 border bg-white shadow-sm d-flex flex-column ${!q.visible ? 'opacity-50 bg-light' : ''}">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-secondary bg-opacity-10 text-secondary border px-2 py-1"><i class="bi bi-lock-fill me-1"></i>Fixo</span>
                            <div class="form-check form-switch m-0 p-0 d-flex align-items-center">
                                <label class="form-check-label small fw-bold me-2 text-muted" for="toggle_${q.id}">${q.visible ? 'Visível' : 'Oculto'}</label>
                                <input class="form-check-input ms-0" type="checkbox" role="switch" id="toggle_${q.id}" ${q.visible ? 'checked' : ''} onchange="toggleVisibility('${q.id}')" style="cursor:pointer; margin-top:0;">
                            </div>
                        </div>
                        <div class="flex-grow-1 mt-2">
                            <label class="form-label small fw-bold text-primary mb-1">Título da Pergunta (Editável)</label>
                            <input type="text" class="form-control border bg-light fw-bold fs-6 text-dark mb-2 shadow-sm" value="${q.label}" onchange="updateQuestion('${q.id}', 'label', this.value)" placeholder="Título da pergunta padrão">
                        </div>
                    </div>
                `;
                stdContainer.appendChild(col);
            } else {
                const card = document.createElement('div');
                card.className = 'question-card p-4 rounded-4 position-relative border bg-white shadow-sm accent-warning';
                card.innerHTML = `
                    <div class="d-flex justify-content-between mb-3 border-bottom pb-2 align-items-center">
                        <span class="fw-bold text-muted small text-uppercase tracking-wider"><i class="bi bi-stars text-warning me-1"></i> Adicional</span>
                        <button type="button" class="btn btn-sm btn-outline-danger border-0 rounded-circle" onclick="removeQuestion(${q.id})" title="Excluir Pergunta"><i class="bi bi-trash"></i></button>
                    </div>
                    <div class="row g-3">
                        <div class="col-md-8"><label class="form-label small fw-bold text-dark">Título da Pergunta para o Paciente</label><input type="text" class="form-control bg-light border-0 shadow-sm fw-medium" value="${q.label}" onchange="updateQuestion(${q.id}, 'label', this.value)" placeholder="Ex: Há quanto tempo treina musculação?"></div>
                        <div class="col-md-4"><label class="form-label small fw-bold text-dark">Tipo de Resposta</label><select class="form-select bg-light border-0 shadow-sm fw-medium" onchange="updateQuestion(${q.id}, 'type', this.value)">
                                <option value="text" ${q.type==='text'?'selected':''}>Texto Curto</option><option value="textarea" ${q.type==='textarea'?'selected':''}>Parágrafo</option>
                                <option value="radio" ${q.type==='radio'?'selected':''}>Múltipla Escolha (1 Opção)</option><option value="checkbox" ${q.type==='checkbox'?'selected':''}>Caixas (Várias Opções)</option>
                            </select></div>
                        ${(q.type === 'radio' || q.type === 'checkbox') ? `<div class="col-12 mt-3 p-3 bg-warning bg-opacity-10 rounded-3 border border-warning border-opacity-25"><label class="form-label small fw-bold text-dark mb-1"><i class="bi bi-list-ul me-1"></i> Opções disponíveis</label><p class="small text-muted mb-2" style="font-size: 0.75rem;">Separe cada opção por vírgula (,)</p><input type="text" class="form-control bg-white shadow-sm" value="${q.options || ''}" onchange="updateQuestion(${q.id}, 'options', this.value)" placeholder="Ex: Nunca treinei, Até 6 meses, Mais de 1 ano"></div>` : ''}
                        <div class="col-12 mt-2"><div class="form-check form-switch d-inline-block"><input class="form-check-input" type="checkbox" id="req_${q.id}" ${q.required ? 'checked' : ''} onchange="updateQuestion(${q.id}, 'required', this.checked)"><label class="form-check-label small fw-bold text-muted ms-1" for="req_${q.id}">Resposta Obrigatória</label></div></div>
                    </div>
                `;
                cstContainer.appendChild(card);
            }
        });
    }

    window.toggleVisibility = (id) => { const q = questions.find(q => q.id === id); if (q) { q.visible = !q.visible; renderQuestions(); } };
    window.removeQuestion = (id) => { questions = questions.filter(q => q.id !== id); renderQuestions(); };
    window.updateQuestion = (id, field, value) => { const q = questions.find(q => q.id === id); if (q) { q[field] = value; if (field === 'type') renderQuestions(); } };

    addBtn.addEventListener('click', () => { questions.push({ id: Date.now(), label: '', type: 'text', options: '', required: false }); renderQuestions(); });

    saveBtn.addEventListener('click', async () => {
        const btnOriginal = saveBtn.innerHTML; saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Publicando...'; saveBtn.disabled = true;
        try {
            const res = await fetch('/api/auth/nutricionista/anamnese-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: questions }) });
            const data = await res.json();
            if(window.showToast) window.showToast(data.message, 'success');
            else alert(data.message);
        } catch (err) { alert('Falha na comunicação com o servidor.'); } finally { saveBtn.innerHTML = btnOriginal; saveBtn.disabled = false; }
    });
});