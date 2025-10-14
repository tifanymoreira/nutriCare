// nutricare-project/client/public/js/planeEditor.js
document.addEventListener("DOMContentLoaded", async () => {
    let urlParams = new URLSearchParams(window.location.search);
    let currentPatientId = urlParams.get('patientId');

    // Elementos da UI
    const mealPlanCanvas = document.getElementById("mealPlanCanvas");
    const addMealBtn = document.getElementById("addMealBtn");
    const foodGroupsAccordion = document.getElementById("foodGroupsAccordion");
    const patientNameEl = document.getElementById("patientName");
    const savePlanBtn = document.getElementById("savePlanBtn");
    const clearPlanBtn = document.getElementById("clearPlanBtn");
    const patientsListContainer = document.getElementById("patientsListContainer");
    const patientSearchInput = document.getElementById("patientSearchInput");
    const foodSearchInput = document.querySelector("#foods-pane input"); // <-- CORREÇÃO: Pega o input de busca de alimentos

    let draggedItem = null;
    let allPatients = [];
    let allFoods = [];
    let foodLibraryData = {}; // <-- NOVO: Armazena a estrutura original da biblioteca

    // --- FUNÇÕES DE UI ---

    const setButtonLoading = (btn, isLoading) => {
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-container');
        btn.disabled = isLoading;
        if (isLoading) {
            btnText.style.display = 'none';
            if(spinner) spinner.style.display = 'block';
        } else {
            btnText.style.display = 'block';
            if(spinner) spinner.style.display = 'none';
        }
    };

    const showToast = (message, isSuccess = true) => {
        let toast = document.getElementById('customToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'customToast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<div class="toast-icon"><i class="bi ${isSuccess ? 'bi-check-circle-fill' : 'bi-x-octagon-fill'}"></i></div><div class="toast-message">${message}</div>`;
        toast.className = `custom-toast ${isSuccess ? 'success' : 'error'} show`;
        setTimeout(() => toast.classList.remove('show'), 4000);
    };

    // --- LÓGICA DE DADOS (FETCH) ---

    const fetchData = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.message || 'Falha na resposta da rede');
            }
            return await response.json();
        } catch (error) {
            console.error(`Erro ao processar ${url}:`, error);
            showToast(`Erro de comunicação: ${error.message}`, false);
            return null;
        }
    };

    // --- LÓGICA DE RENDERIZAÇÃO E EVENTOS ---

    const renderFoodLibrary = (library) => {
        foodGroupsAccordion.innerHTML = '';
        
        Object.keys(library).forEach((category, index) => {
            if (library[category].length === 0) return; // Não renderiza categorias vazias

            const categoryId = `group-${index}`;
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';

            const foodsHtml = library[category].map(food => 
                `<div class="food-item" draggable="true" data-food-id="${food.id}" data-food-name="${food.name}">${food.name}</div>`
            ).join('');

            accordionItem.innerHTML = `
                <h2 class="accordion-header">
                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#${categoryId}">
                        ${category}
                    </button>
                </h2>
                <div id="${categoryId}" class="accordion-collapse collapse show" data-bs-parent="#foodGroupsAccordion">
                    <div class="accordion-body">${foodsHtml}</div>
                </div>
            `;
            foodGroupsAccordion.appendChild(accordionItem);
        });
        setupDragEvents();
    };
    
    const renderPatientsList = (patients) => {
        patientsListContainer.innerHTML = '';
        if (patients.length === 0) {
            patientsListContainer.innerHTML = '<p class="text-center text-muted p-3">Nenhum paciente encontrado.</p>';
            return;
        }
        patients.forEach(patient => {
            const patientItem = document.createElement('a');
            patientItem.href = '#';
            patientItem.className = `list-group-item list-group-item-action ${patient.id == currentPatientId ? 'active' : ''}`;
            patientItem.dataset.patientId = patient.id;
            patientItem.innerHTML = `<div class="fw-bold">${patient.nome}</div><small class="text-muted">${patient.email}</small>`;
            patientItem.addEventListener('click', (e) => {
                e.preventDefault();
                switchPatient(patient.id);
            });
            patientsListContainer.appendChild(patientItem);
        });
    };

    const setupDragEvents = () => {
        document.querySelectorAll(".food-item").forEach(item => {
            item.addEventListener("dragstart", (e) => {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add("dragging"), 0);
            });
            item.addEventListener("dragend", () => {
                if (draggedItem) draggedItem.classList.remove("dragging");
                draggedItem = null;
            });
        });
    };

    const createMealCard = (mealName = "Nova Refeição", items = []) => {
        const card = document.createElement("div");
        card.className = "meal-card";
        card.innerHTML = `
            <div class="meal-card-header">
                <h5 class="meal-title" contenteditable="true">${mealName}</h5>
                <div class="meal-actions">
                    <button class="btn btn-sm btn-icon text-danger btn-delete-meal"><i class="bi bi-trash-fill"></i></button>
                </div>
            </div>
            <div class="meal-card-body"></div>`;
        
        const mealBody = card.querySelector(".meal-card-body");
        if (items.length === 0) {
            mealBody.innerHTML = '<div class="text-muted text-center small">Arraste alimentos aqui</div>';
        } else {
            items.forEach(item => {
                const food = allFoods.find(f => f.name === item.foodName);
                if (food) {
                    addFoodToMeal(food.id, item.foodName, mealBody, item.quantity);
                }
            });
        }
        
        setupDropzone(mealBody);
        card.querySelector('.btn-delete-meal').addEventListener('click', () => card.remove());
        mealPlanCanvas.appendChild(card);
    };

    const setupDropzone = (zone) => {
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.closest('.meal-card').classList.add("drag-over");
        });
        zone.addEventListener("dragleave", () => zone.closest('.meal-card').classList.remove("drag-over"));
        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.closest('.meal-card').classList.remove("drag-over");
            if (draggedItem) {
                if (zone.querySelector('.text-muted')) zone.innerHTML = '';
                addFoodToMeal(draggedItem.dataset.foodId, draggedItem.dataset.foodName, zone);
            }
        });
    };

    const addFoodToMeal = (foodId, foodName, mealBody, quantity = "") => {
        const foodElement = document.createElement("div");
        foodElement.className = "meal-food-item";
        foodElement.dataset.foodId = foodId;
        foodElement.innerHTML = `
            <span class="food-name">${foodName}</span>
            <div class="d-flex align-items-center gap-2">
                <div class="food-quantity">
                    <input type="text" class="form-control form-control-sm" placeholder="Ex: 100g" value="${quantity}">
                </div>
                <button class="btn btn-sm btn-icon text-secondary btn-delete-food"><i class="bi bi-x-circle"></i></button>
            </div>`;
        foodElement.querySelector('.btn-delete-food').addEventListener('click', () => {
            foodElement.remove();
            if (!mealBody.hasChildNodes()) {
                 mealBody.innerHTML = '<div class="text-muted text-center small">Arraste alimentos aqui</div>';
            }
        });
        mealBody.appendChild(foodElement);
    };
    
    // --- LÓGICA PRINCIPAL ---

    const switchPatient = async (patientId) => {
        if (!patientId) return;
        currentPatientId = patientId;
        
        const newUrl = `${window.location.pathname}?patientId=${patientId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
        
        document.querySelectorAll('#patientsListContainer .list-group-item-action').forEach(item => {
            item.classList.toggle('active', item.dataset.patientId == patientId);
        });
        
        await loadPlanForPatient(patientId);
    };

    const loadPlanForPatient = async (patientId) => {
        patientNameEl.textContent = "Carregando...";
        mealPlanCanvas.innerHTML = '<div class="text-center p-5"><span class="spinner-border"></span></div>';

        const patient = allPatients.find(p => p.id == patientId);
        if (patient) {
            patientNameEl.textContent = patient.nome;
        }

        const result = await fetchData(`/api/auth/mealplan/${patientId}`);
        mealPlanCanvas.innerHTML = '';

        if (result && result.plan && result.plan.meals.length > 0) {
            result.plan.meals.forEach(meal => {
                createMealCard(meal.name, meal.items);
            });
        } else {
            createMealCard("Café da Manhã");
            createMealCard("Almoço");
            createMealCard("Jantar");
        }
    };
    
    const handleSavePlan = async () => {
        setButtonLoading(savePlanBtn, true);

        const mealsData = [];
        document.querySelectorAll('.meal-card').forEach(card => {
            const meal = {
                name: card.querySelector('.meal-title').textContent.trim(),
                items: []
            };
            card.querySelectorAll('.meal-food-item').forEach(item => {
                meal.items.push({
                    foodId: item.dataset.foodId,
                    quantity: item.querySelector('input').value.trim() || 'A gosto'
                });
            });
            mealsData.push(meal);
        });
        
        const payload = { patientId: currentPatientId, meals: mealsData };

        const result = await fetchData('/api/auth/mealplan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (result) {
            showToast(result.message, result.success);
            if(result.success) {
                setTimeout(() => {
                    // Opcional: redirecionar ou apenas mostrar a mensagem de sucesso
                }, 1500);
            }
        }
        setButtonLoading(savePlanBtn, false);
    };
    
    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    
    const initializeEditor = async () => {
        const [foodsResult, patientsResult] = await Promise.all([
            fetchData('/api/auth/foods'),
            fetchData('/api/auth/patientList')
        ]);

        if (foodsResult && foodsResult.success) {
            foodLibraryData = foodsResult.library; // Armazena a estrutura original
            allFoods = Object.values(foodsResult.library).flat(); // Armazena a lista completa de alimentos
            renderFoodLibrary(foodLibraryData);
        }
        if (patientsResult && patientsResult.success) {
            allPatients = patientsResult.patients;
            renderPatientsList(allPatients);
        }
        
        if (currentPatientId) {
            await switchPatient(currentPatientId);
        } else if (allPatients.length > 0) {
            await switchPatient(allPatients[0].id);
        } else {
            patientNameEl.textContent = "Nenhum paciente selecionado";
            mealPlanCanvas.innerHTML = '<div class="text-center p-5 text-muted">Cadastre um paciente para começar.</div>';
            savePlanBtn.disabled = true;
        }
    };
    
    // --- CORREÇÃO: LÓGICA DO FILTRO DE ALIMENTOS ---
    foodSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!searchTerm) {
            renderFoodLibrary(foodLibraryData); // Se a busca estiver vazia, restaura a lista original
            return;
        }

        const filteredLibrary = {};
        for (const category in foodLibraryData) {
            const filteredFoods = foodLibraryData[category].filter(food => 
                food.name.toLowerCase().includes(searchTerm)
            );
            if (filteredFoods.length > 0) {
                filteredLibrary[category] = filteredFoods;
            }
        }
        renderFoodLibrary(filteredLibrary);
    });

    addMealBtn.addEventListener("click", () => createMealCard());
    savePlanBtn.addEventListener("click", handleSavePlan);
    clearPlanBtn.addEventListener("click", () => {
        if (confirm("Tem certeza que deseja limpar todo o plano da tela? Esta ação não pode ser desfeita.")) {
            mealPlanCanvas.innerHTML = '';
            createMealCard("Café da Manhã");
            createMealCard("Almoço");
            createMealCard("Jantar");
        }
    });
    patientSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allPatients.filter(p => p.nome.toLowerCase().includes(searchTerm) || p.email.toLowerCase().includes(searchTerm));
        renderPatientsList(filtered);
    });

    await initializeEditor();
});