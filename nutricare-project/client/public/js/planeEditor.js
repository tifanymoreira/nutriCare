document.addEventListener("DOMContentLoaded", async () => {
    let urlParams = new URLSearchParams(window.location.search);
    let currentPatientId = urlParams.get('patientId');

    const mealPlanCanvas = document.getElementById("mealPlanCanvas");
    const addMealBtn = document.getElementById("addMealBtn");
    const foodGroupsAccordion = document.getElementById("foodGroupsAccordion");
    const patientNameEl = document.getElementById("patientName");
    const headerPatientAvatar = document.getElementById("headerPatientAvatar");
    const savePlanBtn = document.getElementById("savePlanBtn");
    const clearPlanBtn = document.getElementById("clearPlanBtn");
    const patientsListContainer = document.getElementById("patientsListContainer");

    let allPatients = [];
    let allFoods = [];
    let foodLibraryData = {};
    let draggedItem = null;

    // --- NOVA FUNÇÃO DE NOTIFICAÇÃO (Substitui o Alert) ---
    const showNotification = (message, isSuccess = true) => {
        const notif = document.createElement('div');
        notif.style.position = 'fixed';
        notif.style.bottom = '30px';
        notif.style.right = '30px';
        notif.style.backgroundColor = isSuccess ? '#2a9d8f' : '#e76f51';
        notif.style.color = '#fff';
        notif.style.padding = '16px 24px';
        notif.style.borderRadius = '12px';
        notif.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        notif.style.zIndex = '9999';
        notif.style.transform = 'translateY(100px)';
        notif.style.opacity = '0';
        notif.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        notif.style.display = 'flex';
        notif.style.alignItems = 'center';
        notif.style.gap = '12px';
        notif.style.fontWeight = '600';
        notif.style.fontSize = '15px';

        notif.innerHTML = `
            <i class="bi ${isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-octagon-fill'} fs-4"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notif);

        // Animação de entrada
        requestAnimationFrame(() => {
            notif.style.transform = 'translateY(0)';
            notif.style.opacity = '1';
        });

        // Animação de saída
        setTimeout(() => {
            notif.style.transform = 'translateY(100px)';
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 400); // Remove do DOM após a animação
        }, 3500);
    };

    const calculateTotals = () => {
        let gKcal = 0, gCarbs = 0, gProt = 0, gFat = 0;
        let gMicros = {
            fiber: 0, sodium: 0, calcium: 0, iron: 0, zinc: 0,
            magnesium: 0, potassium: 0, vitA: 0, vitC: 0, vitD: 0, vitE: 0, vitB12: 0
        };

        document.querySelectorAll('.meal-card-pro').forEach(card => {
            let mKcal = 0, mCarbs = 0, mProt = 0, mFat = 0;

            card.querySelectorAll('.meal-food-row-pro').forEach(row => {
                const foodId = row.dataset.foodId;
                const food = allFoods.find(f => f.id == foodId);
                const qtyInput = row.querySelector('input');
                const qty = parseFloat(qtyInput.value) || 0;

                if (food) {
                    const base = parseFloat(food.baseUnit) || 100;
                    const mult = qty / base;

                    const kcalVal = (parseFloat(food.kcal) || 0) * mult;
                    const carbVal = (parseFloat(food.carbs) || 0) * mult;
                    const protVal = (parseFloat(food.protein) || 0) * mult;
                    const fatVal = (parseFloat(food.fat) || 0) * mult;

                    mKcal += kcalVal; mCarbs += carbVal; mProt += protVal; mFat += fatVal;
                    gKcal += kcalVal; gCarbs += carbVal; gProt += protVal; gFat += fatVal;

                    const macroSpan = row.querySelector('.food-macros');
                    if (macroSpan) {
                        macroSpan.textContent = `${kcalVal.toFixed(0)} kcal | C: ${carbVal.toFixed(1)}g | P: ${protVal.toFixed(1)}g | G: ${fatVal.toFixed(1)}g`;
                    }

                    Object.keys(gMicros).forEach(key => {
                        gMicros[key] += (parseFloat(food[key]) || 0) * mult;
                    });
                }
            });

            const badgeKcal = card.querySelector('.meal-macros-pro .badge');
            const spansMacro = card.querySelectorAll('.meal-macros-pro span strong');
            if (badgeKcal && spansMacro.length >= 3) {
                badgeKcal.innerHTML = `<i class="bi bi-fire me-1"></i>${mKcal.toFixed(0)} kcal`;
                spansMacro[0].textContent = `${mCarbs.toFixed(1)}g`;
                spansMacro[1].textContent = `${mProt.toFixed(1)}g`;
                spansMacro[2].textContent = `${mFat.toFixed(1)}g`;
            }
        });

        const updateProg = (id, current, targetId, suffix) => {
            const bar = document.getElementById(`barProg${id}`);
            const text = document.getElementById(`textProg${id}`);
            const targetInput = document.getElementById(`target${targetId}`);
            if (!bar || !text || !targetInput) return;

            const tVal = parseFloat(targetInput.value) || 1;
            const pct = (current / tVal) * 100;

            text.textContent = `${current.toFixed(1)} / ${tVal} ${suffix} (${pct.toFixed(0)}%)`;
            bar.style.width = `${Math.min(pct, 100)}%`;

            // Cores dinâmicas de alerta
            bar.className = 'progress-bar';
            if (pct < 85) bar.classList.add('bg-info-custom');
            else if (pct <= 100) bar.classList.add('bg-success-custom');
            else if (pct <= 115) bar.classList.add('bg-warning-custom');
            else bar.classList.add('bg-danger-custom');
        };

        updateProg('Kcal', gKcal, 'Kcal', 'kcal');
        updateProg('Carbs', gCarbs, 'Carbs', 'g');
        updateProg('Prot', gProt, 'Prot', 'g');
        updateProg('Fat', gFat, 'Fat', 'g');

        const updateMicroLabel = (id, val, unit) => {
            const el = document.getElementById(id);
            if (el) el.textContent = `${val.toFixed(1)} ${unit}`;
        };

        updateMicroLabel('totFiber', gMicros.fiber, 'g');
        updateMicroLabel('totSodium', gMicros.sodium, 'mg');
        updateMicroLabel('totCalcium', gMicros.calcium, 'mg');
        updateMicroLabel('totIron', gMicros.iron, 'mg');
        updateMicroLabel('totZinc', gMicros.zinc, 'mg');
        updateMicroLabel('totMag', gMicros.magnesium, 'mg');
        updateMicroLabel('totPot', gMicros.potassium, 'mg');
        updateMicroLabel('totVitA', gMicros.vitA, 'mcg');
        updateMicroLabel('totVitC', gMicros.vitC, 'mg');
        updateMicroLabel('totVitD', gMicros.vitD, 'mcg');
        updateMicroLabel('totVitE', gMicros.vitE, 'mg');
        updateMicroLabel('totVitB12', gMicros.vitB12, 'mcg');
    };

    mealPlanCanvas.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT') calculateTotals();
    });

    document.querySelectorAll('.target-inputs-grid input').forEach(inp => {
        inp.addEventListener('input', calculateTotals);
    });

    const addFoodToMeal = (foodId, foodName, mealBody, quantity = "100") => {
        const empty = mealBody.querySelector('.dropzone-empty-msg');
        if (empty) empty.remove();

        const row = document.createElement("div");
        row.className = "meal-food-row-pro d-flex align-items-center justify-content-between p-3 mb-2 bg-white rounded-3 shadow-sm transition-all";
        row.dataset.foodId = foodId;
        const cleanQty = quantity.toString().replace(/\D/g, '') || "100";

        row.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <i class="bi bi-grip-vertical text-muted cursor-grab"></i>
                <div class="food-icon bg-success bg-opacity-10 text-success rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;"><i class="bi bi-apple small"></i></div>
                <div class="text-start">
                    <span class="food-name d-block fw-bold text-dark text-start" style="font-size: 0.95rem;">${foodName}</span>
                    <span class="food-macros text-muted small text-start">Calculando...</span>
                </div>
            </div>
            <div class="d-flex align-items-center gap-3">
                <div class="input-group input-group-sm shadow-sm" style="width: 110px;">
                    <input type="number" class="form-control fw-bold text-center border-end-0" value="${cleanQty}" min="0">
                    <span class="input-group-text bg-white text-muted fw-medium border-start-0">g</span>
                </div>
                <button class="btn btn-sm text-muted hover-text-danger btn-delete-food" title="Remover Alimento"><i class="bi bi-x-lg"></i></button>
            </div>`;

        row.querySelector('.btn-delete-food').onclick = () => {
            row.remove();
            if (mealBody.children.length === 0) {
                mealBody.innerHTML = `<div class="dropzone-empty-msg text-center text-muted py-3 d-flex flex-column align-items-center justify-content-center h-100">
                    <i class="bi bi-cloud-arrow-down fs-3 text-primary opacity-50 mb-2"></i>
                    <span class="fw-medium small">Arraste os alimentos da biblioteca para esta opção</span>
                </div>`;
            }
            calculateTotals();
        };

        mealBody.appendChild(row);
        calculateTotals();
    };

    const createMealCard = (mealData = null) => {
        const name = mealData ? mealData.name : "Nova Refeição";
        const time = mealData ? mealData.time : "";
        const notes = mealData ? mealData.notes : "";
        const recipes = mealData ? mealData.recipes : "";
        const items = mealData && mealData.items ? mealData.items : [];

        const card = document.createElement("div");
        card.className = "meal-card-pro";
        card.innerHTML = `
            <div class="meal-card-header-pro d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div class="d-flex align-items-center gap-3">
                    <div class="drag-handle text-muted" style="cursor: grab;"><i class="bi bi-grid-3x2-gap-fill fs-5"></i></div>
                    <div class="d-flex flex-column">
                        <div class="d-flex align-items-center gap-2">
                            <input type="text" class="meal-title-input" value="${name}" placeholder="Nome da Refeição">
                            <div class="time-wrapper d-flex align-items-center bg-white border rounded px-2 py-1 shadow-sm">
                                <i class="bi bi-clock text-primary me-2 small"></i>
                                <input type="time" class="meal-time-input border-0 p-0 text-secondary fw-bold small" value="${time || ''}">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="meal-macros-pro d-flex align-items-center gap-3 text-secondary small fw-medium">
                    <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i class="bi bi-fire me-1"></i>0 kcal</span>
                    <span>C: <strong class="text-dark">0g</strong></span>
                    <span>P: <strong class="text-dark">0g</strong></span>
                    <span>G: <strong class="text-dark">0g</strong></span>
                    <button class="btn btn-sm text-danger btn-delete-meal ms-2 p-1 px-2 hover-bg-danger-light rounded" title="Remover Refeição"><i class="bi bi-trash3"></i></button>
                </div>
            </div>
            <div class="meal-card-body-pro p-4">
                <div class="meal-options-wrapper"></div>
                <button type="button" class="btn btn-sm btn-light text-primary fw-bold mt-2 btn-add-option"><i class="bi bi-plus-circle-fill me-1"></i> Adicionar Variação (Ou)</button>
                
                <div class="row g-3 mt-3 pt-3 border-top border-dashed">
                    <div class="col-md-6">
                        <label class="small text-muted fw-bold mb-2"><i class="bi bi-card-text text-primary me-1"></i> Observações da Refeição</label>
                        <textarea class="form-control meal-notes-input bg-light border-0 focus-ring" style="min-height: 80px; resize: none;" placeholder="Ex: Substituições, modo de consumo...">${notes || ''}</textarea>
                    </div>
                    <div class="col-md-6">
                        <label class="small text-muted fw-bold mb-2"><i class="bi bi-cup-hot text-warning me-1"></i> Receita Sugerida</label>
                        <textarea class="form-control meal-recipes-input bg-light border-0 focus-ring" style="min-height: 80px; resize: none;" placeholder="Descreva o modo de preparo...">${recipes || ''}</textarea>
                    </div>
                </div>
            </div>`;

        const optionsWrapper = card.querySelector(".meal-options-wrapper");

        const addOptionUI = (optionIndex, optionItems = []) => {
            const optDiv = document.createElement("div");
            optDiv.className = "meal-option-container-pro mb-3";
            optDiv.dataset.optionIndex = optionIndex;

            let headerHtml = '';
            if (optionIndex > 1) {
                headerHtml = `
                    <div class="d-flex align-items-center justify-content-center mb-3 position-relative">
                        <hr class="w-100 border-dashed m-0 position-absolute" style="z-index: 0; opacity: 0.2;">
                        <span class="badge bg-white text-secondary border px-3 py-1 position-relative z-1 fw-bold rounded-pill text-uppercase" style="letter-spacing: 1px;">Ou (Opção ${optionIndex})</span>
                        <button class="btn btn-sm text-danger btn-remove-option position-absolute end-0 z-1 bg-white border rounded-circle shadow-sm" style="top: -10px; right: 0;" title="Remover Opção"><i class="bi bi-x"></i></button>
                    </div>
                `;
            }

            optDiv.innerHTML = `
                ${headerHtml}
                <div class="dropzone-pro rounded-4 p-3 bg-light bg-opacity-50" style="min-height: 80px;"></div>
            `;
            
            const dropzone = optDiv.querySelector(".dropzone-pro");
            if (optionItems.length === 0) {
                dropzone.innerHTML = `<div class="dropzone-empty-msg text-center text-muted py-3 d-flex flex-column align-items-center justify-content-center h-100">
                    <i class="bi bi-cloud-arrow-down fs-3 text-primary opacity-50 mb-2"></i>
                    <span class="fw-medium small">Arraste os alimentos da biblioteca para esta opção</span>
                </div>`;
            } else {
                optionItems.forEach(item => {
                    const f = allFoods.find(food => food.id == item.foodId || food.name == item.foodName);
                    if (f) addFoodToMeal(f.id, f.name, dropzone, item.quantity);
                });
            }

            dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); };
            dropzone.ondragleave = () => dropzone.classList.remove("drag-over");
            dropzone.ondrop = (e) => {
                e.preventDefault(); dropzone.classList.remove("drag-over");
                if (draggedItem) addFoodToMeal(draggedItem.dataset.foodId, draggedItem.dataset.foodName, dropzone);
            };

            const removeBtn = optDiv.querySelector('.btn-remove-option');
            if (removeBtn) removeBtn.onclick = () => { optDiv.remove(); calculateTotals(); };
            optionsWrapper.appendChild(optDiv);
        };

        const optionsMap = {};
        items.forEach(item => {
            const opt = item.optionGroup || 1;
            if(!optionsMap[opt]) optionsMap[opt] = [];
            optionsMap[opt].push(item);
        });

        const optionKeys = Object.keys(optionsMap).sort((a,b)=>a-b);
        if (optionKeys.length === 0) {
            addOptionUI(1);
        } else {
            optionKeys.forEach(opt => addOptionUI(opt, optionsMap[opt]));
        }

        card.querySelector('.btn-add-option').onclick = () => {
            const currentOptions = optionsWrapper.querySelectorAll('.meal-option-container-pro');
            const nextIdx = currentOptions.length > 0 ? Math.max(...Array.from(currentOptions).map(o => parseInt(o.dataset.optionIndex))) + 1 : 1;
            addOptionUI(nextIdx);
        };

        card.querySelector('.btn-delete-meal').onclick = () => { card.remove(); calculateTotals(); };
        mealPlanCanvas.appendChild(card);
    };

    const renderFoodLibrary = (library) => {
        if (!foodGroupsAccordion) return;
        foodGroupsAccordion.innerHTML = '';
        Object.keys(library).forEach((cat, idx) => {
            const id = `group-${idx}`;
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item border-0 mb-2 rounded shadow-sm overflow-hidden';
            const foodsHtml = library[cat].map(f => {
                const p = parseFloat(f.protein) || 0;
                let tags = p > 15 ? `<span class="badge bg-primary bg-opacity-10 text-primary ms-2 border border-primary border-opacity-25 rounded-pill" style="font-size:0.65rem;">Alto em proteína</span>` : '';
                return `<div class="food-item-pro d-flex align-items-center justify-content-between p-2 mb-1 bg-white border rounded hover-primary" draggable="true" data-food-id="${f.id}" data-food-name="${f.name}">
                <div class="d-flex align-items-center gap-2 text-start">
                        <i class="bi bi-grip-vertical text-muted opacity-50"></i>
                    <span class="food-name fw-medium text-dark small text-start">${f.name}</span>
                    </div>
                    ${tags}
                </div>`;
            }).join('');

            accordionItem.innerHTML = `
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed fw-bold bg-light text-dark shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#${id}">
                        ${cat}
                    </button>
                </h2>
                <div id="${id}" class="accordion-collapse collapse" data-bs-parent="#foodGroupsAccordion">
                    <div class="accordion-body bg-light bg-opacity-50 p-2">
                        ${foodsHtml}
                    </div>
                </div>`;
            foodGroupsAccordion.appendChild(accordionItem);
        });

        document.querySelectorAll(".food-item-pro").forEach(item => {
            item.ondragstart = (e) => {
                draggedItem = e.target.closest('.food-item-pro');
                e.dataTransfer.effectAllowed = 'move';
                item.style.opacity = '0.5';
                item.classList.add('shadow-lg');
            };
            item.ondragend = () => { 
                item.style.opacity = '1'; 
                item.classList.remove('shadow-lg');
                draggedItem = null; 
            };
        });
    };

    const init = async () => {
        const [foodsRes, patientsRes] = await Promise.all([
            fetch('/api/auth/foods').then(r => r.json()),
            fetch('/api/auth/patientList').then(r => r.json())
        ]);

        if (foodsRes?.success) {
            foodLibraryData = foodsRes.library;
            allFoods = Object.values(foodsRes.library).flat();
            renderFoodLibrary(foodLibraryData);
        }

        if (patientsRes?.success) {
            allPatients = patientsRes.patients;
            const list = document.getElementById("patientsListContainer");
            if (list) {
                list.innerHTML = '';
                allPatients.forEach(p => {
                    const a = document.createElement('a');
                    a.className = `list-group-item list-group-item-action border-0 rounded-3 mb-1 ${p.id == currentPatientId ? 'active' : ''}`;
                    a.innerHTML = `<div class="d-flex align-items-center gap-2"><img src="https://api.dicebear.com/8.x/bottts/svg?seed=${p.id}" width="25"> <span>${p.nome}</span></div>`;
                    a.onclick = () => {
                        // Remove a classe 'active' de todos os itens e adiciona apenas no atual
                        list.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
                        a.classList.add('active');
                        
                        currentPatientId = p.id;
                        window.history.pushState({}, '', `?patientId=${p.id}`);
                        loadPlanForPatient(p.id);
                    };
                    list.appendChild(a);
                });
            }
        }

        if (currentPatientId) loadPlanForPatient(currentPatientId);
    };

    const loadPlanForPatient = async (id) => {
        const p = allPatients.find(x => x.id == id);
        if (p) {
            patientNameEl.textContent = p.nome;
            headerPatientAvatar.src = `https://api.dicebear.com/8.x/bottts/svg?seed=${p.id}`;
        }
        mealPlanCanvas.innerHTML = '';
        const res = await fetch(`/api/auth/mealplan/${id}`).then(r => r.json());
        if (res?.success && res.plan?.meals.length > 0) {
            res.plan.meals.forEach(m => createMealCard(m));
        } else {
            ["Café da Manhã", "Almoço", "Jantar"].forEach(n => createMealCard({ name: n }));
        }
        calculateTotals();
    };

    if (clearPlanBtn) {
        clearPlanBtn.onclick = () => {
            mealPlanCanvas.innerHTML = '';
            ["Café da Manhã", "Almoço", "Jantar"].forEach(n => createMealCard({ name: n }));
            calculateTotals();
        };
    }

    addMealBtn.onclick = () => createMealCard();

    // --- EXPORTAÇÃO PDF COM BIOIMPEDÂNCIA ---
    const exportPlanToPDF = async () => {
        if(typeof html2pdf === 'undefined') {
            showNotification("A biblioteca html2pdf não está carregada. Avise o suporte.", false);
            return;
        }
        const btn = document.getElementById('exportPlanBtn');
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Gerando...';
        btn.disabled = true;

        let patientData = allPatients.find(p => p.id == currentPatientId) || { nome: 'Paciente' };
        
        // --- BUSCA DADOS DA NUTRICIONISTA ---
        let nutriData = { name: 'Nutricionista', email: '', phone: '', crnCode: '' };
        try {
            const nutriRes = await fetch('/api/auth/nutricionista/details');
            const nData = await nutriRes.json();
            if (nData.success && nData.data) {
                nutriData = nData.data;
            }
        } catch(e) { console.warn("Erro ao buscar dados da nutricionista", e); }

        // --- BUSCA BIOIMPEDÂNCIA ---
        let anthroHistory = [];
        try {
            const anthroRes = await fetch(`/api/anthropometry/history/${currentPatientId}`);
            const aData = await anthroRes.json();
            if (aData.success && aData.history) {
                anthroHistory = aData.history.sort((a,b) => new Date(a.date) - new Date(b.date));
            }
        } catch(e) { console.warn("Erro ao buscar bioimpedância", e); }

        const latestAnthro = anthroHistory.length > 0 ? anthroHistory[anthroHistory.length - 1] : null;
        
        // --- MONTAGEM DO HTML (Design Clean/Documento Premium) ---
        const element = document.createElement('div');
        let html = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2c3e50; padding: 20px 40px; background: #fff;">`;
        
        // CABEÇALHO (Folha Timbrada)
        html += `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2a9d8f; padding-bottom: 20px; margin-bottom: 30px;">
                <div>
                    <h1 style="margin: 0; font-size: 24px; color: #2a9d8f;">Dra. ${nutriData.name}</h1>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #7f8c8d;">Nutricionista Clínica${nutriData.crnCode ? ` - CRN: ${nutriData.crnCode}` : ''}</p>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #7f8c8d;">${nutriData.email} ${nutriData.phone ? `| ${nutriData.phone}` : ''}</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 20px; color: #34495e;">Plano Alimentar</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Paciente:</strong> ${patientData.nome}</p>
                    <p style="margin: 2px 0 0 0; font-size: 14px;"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
        `;


        // REFEIÇÕES
        const mealCards = document.querySelectorAll('.meal-card-pro');
        mealCards.forEach(card => {
            const name = card.querySelector('.meal-title-input').value;
            const time = card.querySelector('.meal-time-input').value;
            const notes = card.querySelector('.meal-notes-input').value;
            const recipes = card.querySelector('.meal-recipes-input').value;

            html += `<div style="margin-bottom: 20px; page-break-inside: avoid;">`;
            
            // Título da Refeição
            html += `
                <div style="border-bottom: 1px solid #bdc3c7; padding-bottom: 5px; margin-bottom: 15px; display: flex; align-items: baseline; gap: 10px;">
                    <h3 style="margin: 0; font-size: 16px; color: #2c3e50; text-transform: uppercase; letter-spacing: 0.5px;">${name}</h3>
                    ${time ? `<span style="font-size: 14px; color: #2a9d8f; font-weight: bold;">🕒 ${time}</span>` : ''}
                </div>
            `;
            
            const options = card.querySelectorAll('.meal-option-container-pro');
            options.forEach((opt, idx) => {
                const badgeOpt = opt.querySelector('.badge');
                const optName = badgeOpt ? badgeOpt.textContent.trim() : `Opção ${idx + 1}`;
                const rows = opt.querySelectorAll('.meal-food-row-pro');
                if (rows.length > 0) {
                    html += `<div style="margin-bottom: 15px; padding-left: 12px; border-left: 3px solid #e8e8e8;">`;
                    html += `<h4 style="margin: 0 0 8px 0; font-size: 13px; color: #7f8c8d; text-transform: uppercase;">${optName}</h4>`;
                    html += `<ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.7; color: #34495e;">`;
                    rows.forEach(r => {
                        const fname = r.querySelector('.food-name').textContent;
                        const qty = r.querySelector('input').value;
                        html += `<li><strong>${qty}g</strong> - ${fname}</li>`;
                    });
                    html += `</ul></div>`;
                }
            });

            // Observações e Receitas
            if (notes || recipes) {
                html += `<div style="margin-top: 15px; background: #fcfcfc; border-left: 3px solid #f4a261; padding: 12px; font-size: 12px; color: #555; border-radius: 0 4px 4px 0;">`;
                if (notes) html += `<div style="margin-bottom: ${recipes ? '10px' : '0'};"><strong><span style="color:#e76f51;">✎</span> Observações:</strong><br>${notes.replace(/\n/g, '<br>')}</div>`;
                if (recipes) html += `<div><strong><span style="color:#e76f51;">♨</span> Receita Sugerida:</strong><br>${recipes.replace(/\n/g, '<br>')}</div>`;
                html += `</div>`;
            }

            html += `</div>`;
        });

        // BIOIMPEDÂNCIA (Sessão Separada Abaixo do Cardápio)
        if (latestAnthro) {
            html += `
            <div style="margin-top: 40px; margin-bottom: 25px; page-break-inside: avoid;">
                <h3 style="margin: 0 0 15px 0; color: #2a9d8f; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">Composição Corporal (Bioimpedância)</h3>
                <div style="display: flex; gap: 15px; background: #fcfcfc; border: 1px solid #eee; padding: 15px; border-radius: 6px;">
                    <ul style="flex: 1; margin: 0; padding: 0; list-style: none; font-size: 12px; color: #34495e; line-height: 1.8;">
                        <li><strong>Peso Total:</strong> ${latestAnthro.weight ? latestAnthro.weight + ' kg' : '--'}</li>
                        <li><strong>IMC:</strong> ${latestAnthro.bmi || latestAnthro.calc_bmi || '--'} kg/m²</li>
                        <li><strong>Gordura Corporal:</strong> ${latestAnthro.body_fat ? latestAnthro.body_fat + ' %' : '--'}</li>
                        <li><strong>Gordura Visceral:</strong> ${latestAnthro.visceral_fat || '--'}</li>
                    </ul>
                    <ul style="flex: 1; margin: 0; padding: 0; list-style: none; font-size: 12px; color: #34495e; line-height: 1.8;">
                        <li><strong>Massa Magra:</strong> ${latestAnthro.lean_mass ? latestAnthro.lean_mass + ' kg' : '--'}</li>
                        <li><strong>M. Muscular Esquelética:</strong> ${latestAnthro.muscle_mass ? latestAnthro.muscle_mass + ' kg' : '--'}</li>
                        <li><strong>Massa Óssea:</strong> ${latestAnthro.bone_mass ? latestAnthro.bone_mass + ' kg' : '--'}</li>
                        <li><strong>Água Corporal Total:</strong> ${latestAnthro.total_water ? latestAnthro.total_water + ' %' : '--'}</li>
                    </ul>
                    <ul style="flex: 1; margin: 0; padding: 0; list-style: none; font-size: 12px; color: #34495e; line-height: 1.8;">
                        <li><strong>Taxa Metab. Basal (TMB):</strong> ${latestAnthro.bmr || '--'} kcal</li>
                        <li><strong>Idade Metabólica:</strong> ${latestAnthro.metabolic_age ? latestAnthro.metabolic_age + ' anos' : '--'}</li>
                        <li><strong>Controle de Gordura:</strong> ${latestAnthro.fat_control || '--'}</li>
                    </ul>
                </div>
                ${latestAnthro.segmental_analysis ? `
                <div style="margin-top: 15px; font-size: 12px; color: #34495e; background: #fcfcfc; border: 1px solid #eee; padding: 12px 15px; border-radius: 6px;">
                    <strong style="color: #264653;">Análise Segmentada:</strong><br>
                    <span style="line-height: 1.6;">${latestAnthro.segmental_analysis}</span>
                </div>` : ''}
            </div>`;
        }

        // Rodapé do documento
        html += `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #bdc3c7; text-align: center; color: #95a5a6; font-size: 10px;">
                <p style="margin: 0;">Plano Alimentar gerado digitalmente via <strong>NutriCare</strong>.</p>
            </div>
        `;

        html += `</div>`;
        element.innerHTML = html;

        const opt = {
            margin:       [15, 10, 15, 10], 
            filename:     `Plano_Alimentar_${patientData.nome.replace(/\s+/g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };
        await html2pdf().set(opt).from(element).save();
        showNotification("Plano Exportado com Sucesso!", true);
        
        btn.innerHTML = '<i class="bi bi-file-pdf-fill me-1"></i> PDF';
        btn.disabled = false;
    };

    // --- BOTÕES DE AÇÃO: EXPORTAR E NOTIFICAR ---
    const notifyBtn = document.getElementById('notifyPatientBtn');
    if (notifyBtn) {
        notifyBtn.onclick = async () => {
            if (!currentPatientId) {
                showNotification("Selecione um paciente primeiro.", false);
                return;
            }
            const originalHtml = notifyBtn.innerHTML;
            notifyBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enviando...';
            notifyBtn.disabled = true;

            try {
                const res = await fetch(`/api/auth/mealplan/${currentPatientId}/notify`, { method: 'POST' });
                const data = await res.json();
                showNotification(data.message, data.success);
            } catch(e) {
                console.error(e);
                showNotification("Erro na comunicação com o servidor.", false);
            } finally {
                notifyBtn.innerHTML = originalHtml;
                notifyBtn.disabled = false;
            }
        };
    }

    const exportBtn = document.getElementById('exportPlanBtn');
    if (exportBtn) {
        exportBtn.onclick = exportPlanToPDF;
    }

    // --- NOVA LÓGICA DE SALVAR COM FEEDBACK VISUAL E NOTIFICAÇÃO ---
    savePlanBtn.onclick = async () => {
        // Altera o estado do botão para loading
        const originalHtml = savePlanBtn.innerHTML;
        savePlanBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Salvando...';
        savePlanBtn.disabled = true;

        try {
            const meals = Array.from(document.querySelectorAll('.meal-card-pro')).map(c => {
                let items = [];
                c.querySelectorAll('.meal-option-container-pro').forEach(optContainer => {
                    const optionGroup = parseInt(optContainer.dataset.optionIndex) || 1;
                    optContainer.querySelectorAll('.meal-food-row-pro').forEach(r => {
                        items.push({ foodId: r.dataset.foodId, quantity: `${r.querySelector('input').value}g`, optionGroup });
                    });
                });
                return {
                    name: c.querySelector('.meal-title-input').value,
                    time: c.querySelector('.meal-time-input').value,
                    notes: c.querySelector('.meal-notes-input').value,
                    recipes: c.querySelector('.meal-recipes-input').value,
                    items: items
                };
            });
            
            const res = await fetch('/api/auth/mealplan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: currentPatientId, meals })
            }).then(r => r.json());

            if (res.success) {
                showNotification(res.message || "Plano alimentar atualizado com sucesso!", true);
            } else {
                showNotification(res.message || "Ocorreu um erro ao salvar o plano.", false);
            }
        } catch (error) {
            console.error(error);
            showNotification("Falha na comunicação com o servidor.", false);
        } finally {
            // Restaura o botão original
            savePlanBtn.innerHTML = originalHtml;
            savePlanBtn.disabled = false;
        }
    };

    init();
});