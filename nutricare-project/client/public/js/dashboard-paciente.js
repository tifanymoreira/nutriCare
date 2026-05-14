document.addEventListener('DOMContentLoaded', async () => {
    const user = await verifySession();
    if (!user || user.role !== 'paciente') {
        window.location.href = '/pages/login.html';
        return;
    }

    // Preenche dados do Header
    document.getElementById('patName').textContent = user.name.split(' ')[0] + '!';
    document.getElementById('patAvatar').src = `https://api.dicebear.com/8.x/bottts/svg?seed=${user.id}`;

    loadPatientOverview();
    setupWaterTracker(user.id);
    setupNutriChef();
    setupShoppingList();

    document.getElementById('btnLogout').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/pages/login.html';
    });
});

async function verifySession() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const result = await response.json();
            return result.success ? result.user : null;
        }
        return null;
    } catch (e) { return null; }
}

async function loadPatientOverview() {
    try {
        const res = await fetch('/api/auth/patient/dashboard-overview');
        const data = await res.json();
        
        if (data.success && data.data.nextAppointment) {
            const appt = data.data.nextAppointment;
            document.getElementById('nextApptDate').textContent = `${appt.date} às ${appt.time}`;
            document.getElementById('nextApptService').textContent = appt.service;
        }
    } catch (error) {
        console.error('Erro ao carregar visão geral:', error);
    }
}

// ================= GAMIFICAÇÃO: ÁGUA =================
function setupWaterTracker(patientId) {
    const container = document.getElementById('waterTracker');
    const status = document.getElementById('waterStatus');
    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `water_${patientId}_${todayStr}`;
    
    let currentGlasses = parseInt(localStorage.getItem(storageKey)) || 0;
    const maxGlasses = 8; // 8 copos de 250ml = 2000ml

    function renderGlasses() {
        container.innerHTML = '';
        for (let i = 1; i <= maxGlasses; i++) {
            const glass = document.createElement('div');
            glass.className = `water-glass shadow-sm ${i <= currentGlasses ? 'filled' : ''}`;
            glass.innerHTML = '<i class="bi bi-cup-fill"></i>';
            glass.onclick = () => {
                currentGlasses = (currentGlasses === i && currentGlasses > 0) ? i - 1 : i;
                localStorage.setItem(storageKey, currentGlasses);
                renderGlasses();
            };
            container.appendChild(glass);
        }
        status.textContent = `${currentGlasses * 250} / 2000 ml`;
        if (currentGlasses === maxGlasses) {
            status.className = 'badge bg-success text-white fw-bold px-3 py-2 rounded-pill shadow-sm';
        } else {
            status.className = 'badge bg-info bg-opacity-10 text-info fw-bold px-3 py-2 rounded-pill';
        }
    }
    renderGlasses();
}

// ================= NUTRICHEF IA =================
function setupNutriChef() {
    const btn = document.getElementById('btnGenerateRecipe');
    const select = document.getElementById('aiMealSelect');
    const resultDiv = document.getElementById('aiRecipeResult');

    btn.addEventListener('click', async () => {
        const mealName = select.value;
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-grow spinner-grow-sm me-2"></span> IA Pensando...';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div class="text-center text-muted py-4"><div class="spinner-border text-primary mb-3"></div><br>Cruzando seus alimentos permitidos com o banco de receitas do Chef...</div>';

        try {
            const res = await fetch('/api/auth/patient/ai-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mealName })
            });
            const data = await res.json();
            
            if (data.success) {
                resultDiv.innerHTML = data.recipe;
            } else {
                resultDiv.innerHTML = `<div class="alert alert-warning border-0"><i class="bi bi-exclamation-triangle me-2"></i> ${data.message}</div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div class="alert alert-danger border-0">Falha ao conectar com a IA. Tente novamente mais tarde.</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

// ================= LISTA DE MERCADO =================
function setupShoppingList() {
    const btn = document.getElementById('btnGenerateList');
    const daysInput = document.getElementById('shoppingDays');
    const resultDiv = document.getElementById('shoppingListResult');

    btn.addEventListener('click', async () => {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Calculando...';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div class="text-center text-muted">Aguarde, calculando porções...</div>';

        try {
            const res = await fetch(`/api/auth/patient/shopping-list?days=${daysInput.value}`);
            const data = await res.json();
            
            if (data.success && Object.keys(data.shoppingList).length > 0) {
                let html = '';
                for (const [category, items] of Object.entries(data.shoppingList)) {
                    html += `<h5 class="shopping-category-title"><i class="bi bi-basket text-success me-2"></i> ${category}</h5>`;
                    items.forEach((item, index) => {
                        html += `<label class="shopping-item"><input type="checkbox" class="me-3"> <div class="flex-grow-1"><span class="fw-bold text-dark d-block">${item.name}</span><span class="small text-muted">Comprar: ${item.quantity}</span></div></label>`;
                    });
                }
                resultDiv.innerHTML = html;
            } else {
                resultDiv.innerHTML = `<div class="alert alert-secondary border-0">Você ainda não possui um plano alimentar ativo ou preenchido pelo seu Nutricionista.</div>`;
            }
        } catch (e) {
            resultDiv.innerHTML = `<div class="alert alert-danger border-0">Erro ao gerar lista.</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}