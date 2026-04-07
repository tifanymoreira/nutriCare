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
            let mKcal = 0, mCarbs = 0, mProt = 0;

            card.querySelectorAll('.meal-food-row').forEach(row => {
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

                    mKcal += kcalVal; mCarbs += carbVal; mProt += protVal;
                    gKcal += kcalVal; gCarbs += carbVal; gProt += protVal; gFat += fatVal;

                    const macroSpan = row.querySelector('.food-macros');
                    if (macroSpan) {
                        macroSpan.textContent = `${kcalVal.toFixed(0)} kcal | C: ${carbVal.toFixed(1)}g | P: ${protVal.toFixed(1)}g`;
                    }

                    Object.keys(gMicros).forEach(key => {
                        gMicros[key] += (parseFloat(food[key]) || 0) * mult;
                    });
                }
            });

            const badges = card.querySelectorAll('.meal-card-header .badge');
            if (badges.length >= 3) {
                badges[0].innerHTML = `<i class="bi bi-fire text-warning"></i> ${mKcal.toFixed(0)} kcal`;
                badges[1].textContent = `C: ${mCarbs.toFixed(1)}g`;
                badges[2].textContent = `P: ${mProt.toFixed(1)}g`;
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
        row.className = "meal-food-row";
        row.dataset.foodId = foodId;
        const cleanQty = quantity.toString().replace(/\D/g, '') || "100";

        row.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <i class="bi bi-circle-fill text-success" style="font-size: 0.4rem;"></i>
                <div>
                    <span class="food-name d-block">${foodName}</span>
                    <span class="food-macros">Calculando...</span>
                </div>
            </div>
            <div class="d-flex align-items-center gap-3">
                <div class="quantity-input-group shadow-sm">
                    <input type="number" value="${cleanQty}">
                    <span class="unit">g</span>
                </div>
                <button class="btn btn-sm btn-light text-muted btn-delete-food rounded-circle"><i class="bi bi-x-lg"></i></button>
            </div>`;

        row.querySelector('.btn-delete-food').onclick = () => {
            row.remove();
            if (mealBody.children.length === 0) {
                mealBody.innerHTML = `<div class="dropzone-empty-msg"><i class="bi bi-basket2"></i><span class="small">Arraste alimentos aqui</span></div>`;
            }
            calculateTotals();
        };

        mealBody.appendChild(row);
        calculateTotals();
    };

    const createMealCard = (name = "Nova Refeição", items = []) => {
        const card = document.createElement("div");
        card.className = "meal-card-pro";
        card.innerHTML = `
            <div class="meal-card-header">
                <div class="d-flex align-items-center gap-3 w-50">
                    <div class="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 35px; height: 35px;"><i class="bi bi-clock"></i></div>
                    <input type="text" class="meal-title-input" value="${name}">
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-light text-secondary border">0 kcal</span>
                    <span class="badge bg-light text-secondary border">C: 0g</span>
                    <span class="badge bg-light text-secondary border">P: 0g</span>
                    <button class="btn btn-sm btn-light text-danger rounded-circle ms-2 btn-delete-meal"><i class="bi bi-trash3"></i></button>
                </div>
            </div>
            <div class="meal-card-body"><div class="dropzone-pro"></div></div>`;

        const body = card.querySelector(".dropzone-pro");
        if (items.length === 0) {
            body.innerHTML = `<div class="dropzone-empty-msg"><i class="bi bi-basket2"></i><span class="small">Arraste alimentos aqui</span></div>`;
        } else {
            items.forEach(item => {
                const f = allFoods.find(food => food.id == item.foodId || food.name == item.foodName);
                if (f) addFoodToMeal(f.id, f.name, body, item.quantity);
            });
        }

        body.ondragover = (e) => { e.preventDefault(); body.classList.add("drag-over"); };
        body.ondragleave = () => body.classList.remove("drag-over");
        body.ondrop = (e) => {
            e.preventDefault(); body.classList.remove("drag-over");
            if (draggedItem) addFoodToMeal(draggedItem.dataset.foodId, draggedItem.dataset.foodName, body);
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
            accordionItem.className = 'accordion-item';
            const foodsHtml = library[cat].map(f => {
                const p = parseFloat(f.protein) || 0;
                let tags = p > 15 ? `<span class="food-tag tag-prot">Alta Prot.</span>` : '';
                return `<div class="food-item-pro" draggable="true" data-food-id="${f.id}" data-food-name="${f.name}">
                    <div class="food-item-main"><div class="grip-icon"><i class="bi bi-grip-vertical"></i></div><span class="food-name">${f.name}</span></div>
                    ${tags ? `<div class="food-tags">${tags}</div>` : ''}
                </div>`;
            }).join('');

            accordionItem.innerHTML = `
                <h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${id}">${cat}</button></h2>
                <div id="${id}" class="accordion-collapse collapse" data-bs-parent="#foodGroupsAccordion"><div class="accordion-body">${foodsHtml}</div></div>`;
            foodGroupsAccordion.appendChild(accordionItem);
        });

        document.querySelectorAll(".food-item-pro").forEach(item => {
            item.ondragstart = (e) => {
                draggedItem = e.target.closest('.food-item-pro');
                e.dataTransfer.effectAllowed = 'move';
                item.style.opacity = '0.5';
            };
            item.ondragend = () => { item.style.opacity = '1'; draggedItem = null; };
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
            res.plan.meals.forEach(m => createMealCard(m.name, m.items));
        } else {
            ["Café da Manhã", "Almoço", "Jantar"].forEach(n => createMealCard(n));
        }
        calculateTotals();
    };

    if (clearPlanBtn) {
        clearPlanBtn.onclick = () => {
            mealPlanCanvas.innerHTML = '';
            ["Café da Manhã", "Almoço", "Jantar"].forEach(n => createMealCard(n));
            calculateTotals();
        };
    }

    addMealBtn.onclick = () => createMealCard();

    // --- NOVA LÓGICA DE SALVAR COM FEEDBACK VISUAL E NOTIFICAÇÃO ---
    savePlanBtn.onclick = async () => {
        // Altera o estado do botão para loading
        const originalHtml = savePlanBtn.innerHTML;
        savePlanBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Salvando...';
        savePlanBtn.disabled = true;

        try {
            const meals = Array.from(document.querySelectorAll('.meal-card-pro')).map(c => ({
                name: c.querySelector('.meal-title-input').value,
                items: Array.from(c.querySelectorAll('.meal-food-row')).map(r => ({
                    foodId: r.dataset.foodId,
                    quantity: `${r.querySelector('input').value}g`
                }))
            }));
            
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