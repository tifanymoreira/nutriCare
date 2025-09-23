document.addEventListener('DOMContentLoaded', async () => {
    const user = await verifySession();
    if (!user) return;
    checkRole();

    const whatsappWidget = document.getElementById("whatsapp-widget");
    const contactNutriModal = document.getElementById("contactNutriModal");
    const closeContactModalBtn = document.getElementById("closeContactModal");
    const sendTextBtn = document.getElementById("sendText");

    const scheduleModal = document.getElementById('scheduleModal');
    const openModalBtnHeader = document.getElementById('openScheduleModalBtnHeader');
    const openModalBtnEmpty = document.getElementById('openScheduleModalBtnEmpty');
    const closeModalBtn = document.getElementById('closeScheduleModalBtn');
    const logoutButton = document.getElementById('logoutBtn');

    // --- LÓGICA DO WIDGET DE WHATSAPP ---
    if (whatsappWidget && contactNutriModal) {
        whatsappWidget.addEventListener('click', () => {
            contactNutriModal.classList.add('is-visible');
        });
    }
    if (closeContactModalBtn && contactNutriModal) {
        closeContactModalBtn.addEventListener('click', () => {
            contactNutriModal.classList.remove('is-visible');
        });
        contactNutriModal.addEventListener('click', (event) => {
            if (event.target === contactNutriModal) {
                contactNutriModal.classList.remove('is-visible');
            }
        });
    }
    if (sendTextBtn) {
        sendTextBtn.addEventListener('click', () => sendWhatsAppMsg(user));
    }

    // --- LÓGICA DO MODAL DE AGENDAMENTO ---
    if (scheduleModal) {
        openModalBtnHeader.addEventListener('click', () => scheduleModal.classList.add('is-visible'));
        openModalBtnEmpty.addEventListener('click', () => scheduleModal.classList.add('is-visible'));
        closeModalBtn.addEventListener('click', () => scheduleModal.classList.remove('is-visible'));
    }

    // --- FUNÇÕES PRINCIPAIS ---

    async function verifySession() {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) {
                    return result.user;
                }
            }
            window.location.href = '/pages/login.html';
            return null;
        } catch (error) {
            console.log('Não foi possível verificar o status de autenticação. [ERROR] = ', error);
            window.location.href = '/pages/login.html';
            return null;
        }
    }

    async function fetchUserData(user) {
        const userNameSpan = document.getElementById('userName');
        if (userNameSpan) {
            userNameSpan.textContent = user.name;
        }
        
        const nutriNameSpan = document.getElementById('nutriName');
        if (user.nutriID && nutriNameSpan) {
            try {
                const response = await fetch(`/api/auth/nutricionista/${user.nutriID}`);
                const result = await response.json();
                if (result.success) {
                    nutriNameSpan.textContent = result.nutricionista.name;
                }
            } catch (error) {
                console.error('Erro ao buscar dados do nutricionista:', error);
            }
        }
    }

    async function sendWhatsAppMsg(user) {
        try {
            const response = await fetch(`/api/auth/sendMsg/${user.nutriID}`, { method: 'GET' });
            const result = await response.json();
            if (result.success) {
                window.open(`https://wa.me/${result.number}`, '_blank');
            } else {
                console.log('Erro ao tentar enviar mensagem.');
            }
        } catch (error) {
            console.log('Erro ao tentar enviar mensagem: ', error);
        }
    }

    async function handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                window.location.href = result.redirectUrl;
            } else {
                console.log('Erro ao tentar fazer logout.');
            }
        } catch (error) {
            console.log('Erro no processo de logout:', error);
        }
    }
    
    async function getOverviewData(userId) {
        console.log("start getOverviewData function with userId = ", userId);
    }

    async function getMealPlanData(userId) {
        const container = document.getElementById('mealPlanContainer');
        const emptyState = document.getElementById('emptyPlanState');
        container.innerHTML = ''; 

        try {
            const response = await fetch(`/api/auth/mealplan/${userId}`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message);
            }

            const mealPlan = result.data;

            if (!mealPlan || Object.keys(mealPlan).length === 0) {
                emptyState.style.display = 'block';
                container.style.display = 'none';
                return;
            }

            const ul = document.createElement('ul');
            ul.className = 'nav nav-pills meal-plan-tabs p-3';
            ul.id = 'mealPlanTab';
            ul.setAttribute('role', 'tablist');

            const tabContent = document.createElement('div');
            tabContent.className = 'tab-content p-3';
            tabContent.id = 'mealPlanTabContent';

            let isFirstTab = true;

            for (const mealName in mealPlan) {
                const mealItems = mealPlan[mealName];
                const tabId = `tab-${mealName.replace(/ /g, '-')}`;
                const paneId = `pane-${mealName.replace(/ /g, '-')}`;

                const li = document.createElement('li');
                li.className = 'nav-item';
                li.innerHTML = `<button class="nav-link ${isFirstTab ? 'active' : ''}" id="${tabId}" data-bs-toggle="pill" data-bs-target="#${paneId}" type="button" role="tab">${mealName}</button>`;
                ul.appendChild(li);

                const pane = document.createElement('div');
                pane.className = `tab-pane fade ${isFirstTab ? 'show active' : ''}`;
                pane.id = paneId;
                pane.setAttribute('role', 'tabpanel');

                mealItems.forEach((item, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'meal-item';
                    itemDiv.style.animationDelay = `${index * 100}ms`;
                    itemDiv.innerHTML = `
                        <div class="meal-item-icon"><i class="bi ${item.icon}"></i></div>
                        <div class="meal-item-details">
                            <div class="food-name">${item.name}</div>
                            <div class="food-quantity">${item.quantity}</div>
                        </div>`;
                    pane.appendChild(itemDiv);
                });

                tabContent.appendChild(pane);
                isFirstTab = false;
            }

            container.appendChild(ul);
            container.appendChild(tabContent);

        } catch (error) {
            console.error("Erro ao carregar o plano alimentar:", error);
            emptyState.style.display = 'block';
            container.style.display = 'none';
        }
    }

    async function getAppointmentsData(userId) {
        const container = document.getElementById('appointmentsContainer');
        const emptyState = document.getElementById('emptyAgendaState');
        const headerButton = document.getElementById('openScheduleModalBtnHeader');

        container.innerHTML = '';

        try {
            // const response = await fetch(`/api/auth/appointments/${userId}`);
            // const result = await response.json();
            // const appointments = result.data;
            // const appointments = 

            if (!appointments || appointments.length === 0) {
                emptyState.style.display = 'block';
                headerButton.style.display = 'none';
            } else {
                emptyState.style.display = 'none';
                headerButton.style.display = 'inline-flex';

                appointments.forEach((app, index) => {
                    const card = document.createElement('div');
                    card.className = 'appointment-card';
                    card.style.animationDelay = `${index * 100}ms`;

                    const date = new Date(app.date);
                    const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                    const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const statusClass = app.status === 'Confirmada' ? 'text-success' : 'text-warning';

                    card.innerHTML = `
                        <div class="appointment-icon"><i class="bi bi-calendar-check"></i></div>
                        <div class="appointment-details">
                            <h5 class="appointment-title">${app.type}</h5>
                            <p class="appointment-info mb-1"><i class="bi bi-calendar-event"></i> ${formattedDate} às ${formattedTime}</p>
                            <p class="appointment-info mb-0"><i class="bi bi-geo-alt-fill"></i> ${app.address}</p>
                        </div>
                        <div class="appointment-status ${statusClass}">${app.status}</div>`;
                    container.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Erro ao carregar agendamentos:", error);
            emptyState.style.display = 'block';
        }
    }
    
    // --- INICIALIZAÇÃO E ROUTING ---

    await fetchUserData(user);

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    function checkRole() {
        if (user.role !== "paciente") {
            window.location.href = '/pages/login.html';
            return;
        }
    }

    const path = window.location.pathname;
    if (path.endsWith('/paciente/dashboard.html')) {
        await getOverviewData(user.id);
    } else if (path.endsWith('/paciente/planoAlimentar.html')) {
        await getMealPlanData(user.id);
    } else if (path.endsWith('/paciente/agenda.html')) {
        await getAppointmentsData(user.id);
    }
});