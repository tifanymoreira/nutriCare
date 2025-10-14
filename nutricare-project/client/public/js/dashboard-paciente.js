// nutricare-project/client/public/js/dashboard-paciente.js
document.addEventListener('DOMContentLoaded', async () => {
    const user = await verifySession();
    if (!user) return;
    checkRole();

    window.user = user;

    const whatsappWidget = document.getElementById("whatsapp-widget");
    const contactNutriModal = document.getElementById("contactNutriModal");
    const closeContactModalBtn = document.getElementById("closeContactModal");
    const sendTextBtn = document.getElementById("sendText");
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
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

    // --- LÓGICA DO SININHO (FEATURE) ---
    if (notificationBell && notificationDropdown) {
        notificationBell.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que o clique feche o dropdown imediatamente
            notificationDropdown.classList.toggle('is-visible');
        });

        // Fechar o dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (notificationDropdown.classList.contains('is-visible') && !notificationDropdown.contains(e.target)) {
                notificationDropdown.classList.remove('is-visible');
            }
        });

        // CRON JOB PARA ATUALIZAÇÃO DE NOTIFICAÇÕES (A CADA 5 SEGUNDOS)
        setInterval(() => fetchAndRenderNotifications(user), 5000);
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
            userNameSpan.textContent = user.name.split(' ')[0];
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
            const response = await fetch(`/api/auth/sendMsg/${user.nutriID}`, {
                method: 'GET'
            });
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
            const response = await fetch('/api/auth/logout', {
                method: 'POST'
            });
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

    // LÓGICA DE NOTIFICAÇÃO 
    async function fetchAndRenderNotifications(user) {
        const listContainer = document.getElementById('notificationList');
        const countBadge = document.getElementById('notificationCount');
        const emptyMessage = document.getElementById('noNotificationsMessage');

        if (!listContainer) return;

        let notificationCount = 0;

        try {
            const response = await fetch('/api/auth/patient/notifications');
            const result = await response.json();

            let newHtml = '';

            if (result.success && result.notifications.length > 0) {
                console.log("result")
                console.log(result)

                console.log("patient id = ", user)
                result.notifications.forEach(notif => {
                    if (notif.status !== 'Pendente') {
                        notificationCount++;
                    }

                    let iconClass = '',
                        statusClass = '',
                        messageText = '',
                        actionText = '';

                    if (notif.status === 'Confirmada') {
                        statusClass = 'status-approved';
                        iconClass = 'bi-calendar-check-fill';
                        messageText = `🎉 Aí sim! ${notif.message}`;
                        actionText = `Ver Agenda`;
                    } else if (notif.status === 'Rejeitada') {
                        statusClass = 'status-rejected';
                        iconClass = 'bi-calendar-x-fill';
                        messageText = `😔 Poxa! ${notif.message}.`;
                        actionText = `Reagendar`;
                    } else {
                        return;
                    }

                    newHtml += `
                        <div class="notification-item">
                            <div class="notification-icon-status ${statusClass}"><i class="bi ${iconClass}"></i></div>
                            <div class="notification-content">
                                <p class="mb-1">${messageText}</p>
                                <a href="${notif.status === 'Confirmada' ? 'agenda.html' : `/pages/paciente/preSchedule.html?nutriId=${user.nutriID}`}" class="text-decoration-none small fw-bold ${statusClass}">
                                    <i class="bi bi-arrow-right-circle me-1"></i> ${actionText}
                                </a>
                            </div>
                        </div>
                    `;
                });
            }

            if (notificationCount > 0) {
                if (countBadge) {
                    countBadge.textContent = notificationCount;
                    countBadge.style.display = 'inline-block';
                }
                if (emptyMessage) emptyMessage.style.display = 'none';
                listContainer.innerHTML = newHtml;
            } else {
                if (countBadge) countBadge.style.display = 'none';
                listContainer.innerHTML = ''; // Limpa antes de adicionar a msg
                if (emptyMessage) {
                    listContainer.appendChild(emptyMessage);
                    emptyMessage.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Erro ao carregar notificações:', error);
            if (emptyMessage) emptyMessage.textContent = 'Erro ao carregar. 😵';
        }
    }

    // FUNÇÃO DE CONSOLIDAÇÃO DE DADOS PARA DASHBOARD
    async function getPatientDashboardOverview(user) {
        await fetchAndRenderNotifications(user);

        try {
            const response = await fetch('/api/auth/patient/dashboard-overview');
            const result = await response.json();

            if (result.success) {
                renderDashboardUI(result.data);
                renderDetailedCharts(result.data.evolutionHistory, result.data.kpis);

                if (result.data.nextAppointment) {
                    const viewDetailsBtn = document.getElementById('viewDetailsBtn');
                    if (viewDetailsBtn) {
                        viewDetailsBtn.addEventListener('click', () => {
                            showAppointmentDetailsModal(result.data.nextAppointment, result.data, 'dashboard');
                        });
                    }
                }
            } else {
                console.error('Erro ao carregar overview:', result.message);
            }
        } catch (error) {
            console.error('Falha na comunicação com o servidor ao carregar dashboard:', error);
        }
    }

    // FUNÇÃO PARA RENDERIZAR OS KPIs E NEXT APPOINTMENT
    function renderDashboardUI(data) {
        const { kpis, nextAppointment } = data;

        const nextAppointmentCard = document.getElementById('nextAppointmentCard');
        if (nextAppointmentCard) {
            const emptyNextAppointmentCard = document.getElementById('emptyNextAppointmentCard');

            if (nextAppointment) {
                document.getElementById('nextAppointmentService').textContent = nextAppointment.service;
                document.getElementById('nextAppointmentDate').textContent = nextAppointment.date;
                document.getElementById('nextAppointmentTime').textContent = nextAppointment.time;
                nextAppointmentCard.style.display = 'flex';
                if (emptyNextAppointmentCard) emptyNextAppointmentCard.style.display = 'none';
            } else {
                nextAppointmentCard.style.display = 'none';
                if (emptyNextAppointmentCard) emptyNextAppointmentCard.style.display = 'block';
            }

            if (document.getElementById('currentWeight')) document.getElementById('currentWeight').textContent = `${kpis.currentWeight || '--'} kg`;

            if (document.getElementById('currentBmi')) {
                document.getElementById('currentBmi').textContent = kpis.bmi ? kpis.bmi : '--';
            }

            const weightDifferenceElement = document.getElementById('weightDifference');
            if (weightDifferenceElement) {
                if (kpis.weightDifference !== null && kpis.weightDifference !== undefined) {
                    const diff = parseFloat(kpis.weightDifference);
                    const sign = diff > 0 ? '+' : '';
                    const icon = diff > 0 ? 'bi-arrow-up-right' : (diff < 0 ? 'bi-arrow-down-right' : 'bi-arrow-right');
                    const colorClass = diff > 0 ? 'text-danger-red' : (diff < 0 ? 'text-primary-green' : 'text-muted');

                    weightDifferenceElement.innerHTML = `<i class="bi ${icon} me-1 ${colorClass}"></i> ${sign}${diff.toFixed(1)} kg`;
                } else {
                    weightDifferenceElement.textContent = '-- kg';
                }
            }
        }
    }

    // FUNÇÃO PARA RENDERIZAR OS GRÁFICOS DETALHADOS
    function renderDetailedCharts(evolutionHistory, kpis) {
        const emptyChartState = document.getElementById('emptyChartState');
        const tabsContent = document.getElementById('evolutionTabsContent');

        const fullHistory = [];
        if (kpis.initialWeight) {
            fullHistory.push({ consultation_date: new Date().toISOString(), weight: kpis.initialWeight });
        }
        fullHistory.push(...evolutionHistory);

        const uniqueHistory = Array.from(new Set(fullHistory.map(a => a.consultation_date)))
            .map(date => {
                return fullHistory.find(a => a.consultation_date === date)
            })
            .sort((a, b) => new Date(a.consultation_date) - new Date(b.consultation_date));


        if (uniqueHistory.length < 2) {
            emptyChartState.style.display = 'block';
            tabsContent.style.display = 'none';
            return;
        }

        emptyChartState.style.display = 'none';
        tabsContent.style.display = 'block';

        const labels = uniqueHistory.map(item => new Date(item.consultation_date).toLocaleDateString('pt-BR'));

        const weightData = uniqueHistory.map(item => item.weight);
        const weightCtx = document.getElementById('weightChart').getContext('2d');
        if (window.myWeightChart) window.myWeightChart.destroy();
        window.myWeightChart = new Chart(weightCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Peso (kg)',
                    data: weightData,
                    borderColor: '#2a9d8f',
                    backgroundColor: 'rgba(42, 157, 143, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const fatData = uniqueHistory.map(item => item.body_fat_percentage);
        const fatCtx = document.getElementById('fatChart').getContext('2d');
        if (window.myFatChart) window.myFatChart.destroy();
        window.myFatChart = new Chart(fatCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '% de Gordura',
                    data: fatData,
                    borderColor: '#f4a261',
                    backgroundColor: 'rgba(244, 162, 97, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const measuresData = {
            waist: uniqueHistory.map(item => item.circum_waist),
            abdomen: uniqueHistory.map(item => item.circum_abdomen),
            hip: uniqueHistory.map(item => item.circum_hip),
        };
        const measuresCtx = document.getElementById('measuresChart').getContext('2d');
        if (window.myMeasuresChart) window.myMeasuresChart.destroy();
        window.myMeasuresChart = new Chart(measuresCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cintura (cm)',
                        data: measuresData.waist,
                        borderColor: '#e76f51',
                        tension: 0.3
                    },
                    {
                        label: 'Abdômen (cm)',
                        data: measuresData.abdomen,
                        borderColor: '#264653',
                        tension: 0.3
                    },
                    {
                        label: 'Quadril (cm)',
                        data: measuresData.hip,
                        borderColor: '#e9c46a',
                        tension: 0.3
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    async function getMealPlanData(userId) {
        const container = document.getElementById('mealPlanContainer');
        const emptyState = document.getElementById('emptyPlanState');
        if (!container || !emptyState) return;

        container.innerHTML = '<div class="text-center p-5"><span class="spinner-border"></span></div>';

        try {
            const response = await fetch(`/api/auth/mealplan/${userId}`);
            const result = await response.json();

            if (!result.success || !result.plan) {
                container.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }

            container.style.display = 'block';
            emptyState.style.display = 'none';
            renderMealPlan(result.plan);

        } catch (error) {
            console.error("Erro ao carregar o plano alimentar:", error);
            container.style.display = 'none';
            emptyState.style.display = 'block';
        }
    }

    function renderMealPlan(plan) {
        const container = document.getElementById('mealPlanContainer');
        container.innerHTML = '';

        if (!plan.meals || plan.meals.length === 0) {
            container.style.display = 'none';
            document.getElementById('emptyPlanState').style.display = 'block';
            return;
        }

        const tabsNav = document.createElement('ul');
        tabsNav.className = 'nav nav-pills mb-4 meal-plan-tabs';
        tabsNav.id = 'mealPlanTab';
        tabsNav.role = 'tablist';

        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        tabContent.id = 'mealPlanTabContent';

        plan.meals.forEach((meal, index) => {
            const tabId = `meal-tab-${meal.id}`;
            const paneId = `meal-pane-${meal.id}`;

            const navItem = document.createElement('li');
            navItem.className = 'nav-item';
            navItem.innerHTML = `<button class="nav-link ${index === 0 ? 'active' : ''}" id="${tabId}" data-bs-toggle="pill" data-bs-target="#${paneId}" type="button">${meal.name}</button>`;
            tabsNav.appendChild(navItem);

            let itemsHtml = '<p class="text-muted">Nenhum item cadastrado para esta refeição.</p>';
            if (meal.items && meal.items.length > 0) {
                itemsHtml = meal.items.map(item => `
                    <div class="meal-item">
                        <div class="meal-item-details">
                            <div class="food-name">${item.foodName}</div>
                            <div class="food-quantity">${item.quantity}</div>
                        </div>
                    </div>
                `).join('');
            }

            const pane = document.createElement('div');
            pane.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`;
            pane.id = paneId;
            pane.innerHTML = itemsHtml;
            tabContent.appendChild(pane);
        });

        container.appendChild(tabsNav);
        container.appendChild(tabContent);
    }

    async function getAppointmentsData(user) {
        const listContainer = document.getElementById('appointmentsListContainer');
        const emptyState = document.getElementById('emptyAgendaState');
        const highlightContainer = document.getElementById('nextAppointmentHighlight');

        if (!listContainer || !emptyState || !highlightContainer) {
            console.error("Elementos essenciais da página de agenda não foram encontrados.");
            return;
        }

        listContainer.innerHTML = '';
        highlightContainer.innerHTML = '';

        try {
            const response = await fetch('/api/auth/patient/appointments');
            const result = await response.json();

            if (!result.success) throw new Error(result.message);

            const appointments = result.appointments || [];
            const nutriData = result.nutriData || {};

            const now = new Date();

            const upcomingAppointments = appointments
                .filter(app => {
                    const appDate = new Date(app.appointment_date);
                    const isFuture = new Date(appDate.getUTCFullYear(), appDate.getUTCMonth(), appDate.getUTCDate(), appDate.getUTCHours(), appDate.getUTCMinutes()) >= now;
                    const isFinalStatus = ['Cancelada', 'Realizada', 'Rejeitada'].includes(app.status);
                    return isFuture && !isFinalStatus;
                })
                .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));

            const pastAppointments = appointments
                .filter(app => !upcomingAppointments.some(up => up.id === app.id))
                .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));


            if (appointments.length === 0) {
                emptyState.style.display = 'block';
                highlightContainer.style.display = 'none';
                listContainer.parentElement.style.display = 'none';
                return;
            }

            emptyState.style.display = 'none';
            listContainer.parentElement.style.display = 'block';

            if (upcomingAppointments.length > 0) {
                renderHighlight(upcomingAppointments[0], nutriData);
                highlightContainer.style.display = 'block';
            } else {
                highlightContainer.style.display = 'none';
            }

            [...upcomingAppointments, ...pastAppointments].forEach(app => {
                renderAppointmentCard(app, nutriData, listContainer);
            });


        } catch (error) {
            console.error("Erro ao carregar agendamentos:", error);
            if (emptyState) {
                emptyState.style.display = 'block';
            }
        }
    }

    function renderHighlight(app, nutriData) {
        const highlightContainer = document.getElementById('nextAppointmentHighlight');
        const date = new Date(app.appointment_date);
        const formattedDate = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long'
        });
        const formattedTime = date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        highlightContainer.innerHTML = `
            <div class="card data-card highlight-appointment-card">
                <div class="highlight-details">
                    <i class="bi bi-calendar-check-fill me-4 display-6 text-primary-green"></i>
                    <div>
                        <h5 class="highlight-title">Próxima Consulta: ${app.service_type}</h5>
                        <p class="highlight-info mb-0">
                            Em <strong class="text-secondary-orange">${formattedDate}</strong> às 
                            <strong class="text-secondary-orange">${formattedTime}</strong> (${app.duration} min)
                        </p>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary btn-cancel-appointment" data-id="${app.id}"><i class="bi bi-x-circle me-1"></i> Cancelar</button>
                    <button class="btn btn-sm btn-primary-custom btn-reschedule-appointment" data-id="${app.id}">Remarcar</button>
                </div>
            </div>`;

        highlightContainer.querySelector('.btn-cancel-appointment').addEventListener('click', (e) => {
            e.stopPropagation();
            showActionConfirmModal(app.id, 'cancelar', {
                type: app.service_type,
                date: formattedDate,
                time: formattedTime
            });
        });
        highlightContainer.querySelector('.btn-reschedule-appointment').addEventListener('click', (e) => {
            e.stopPropagation();
            showActionConfirmModal(app.id, 'reagendar', {});
        });
    }
    function renderAppointmentCard(app, nutriData, container) {
        const card = document.createElement('div');
        card.className = 'list-group-item appointment-card';
        card.dataset.appointmentId = app.id;

        const date = new Date(app.appointment_date);
        const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let statusHtml = '', actionsHtml = '', statusClass = '', iconClass = 'bi-person-check-fill';
        const typeLower = app.service_type.toLowerCase();

        if (typeLower.includes('retorno')) {
            statusClass = 'type-retorno';
            iconClass = 'bi-arrow-repeat';
        } else if (typeLower.includes('online')) {
            statusClass = 'type-online';
            iconClass = 'bi-camera-video-fill';
        } else {
            statusClass = 'type-primeira';
        }

        switch (app.status) {
            case 'Confirmada':
                statusHtml = `<span class="appointment-status text-primary-green fw-bold me-3">Confirmada</span>`;
                actionsHtml = `<button class="btn btn-sm btn-outline-secondary btn-cancel-appointment" data-id="${app.id}"><i class="bi bi-x-circle me-1"></i> Cancelar</button>
                               <button class="btn btn-sm btn-outline-primary btn-reschedule-appointment" data-id="${app.id}"><i class="bi bi-arrow-repeat me-1"></i> Remarcar</button>`;
                break;
            case 'Realizada':
                statusHtml = `<span class="appointment-status text-muted fw-bold me-3">Realizada</span>`;
                actionsHtml = app.is_rated ?
                    `<button class="btn btn-sm btn-success" disabled><i class="bi bi-check-circle-fill me-1"></i> Avaliada</button>` :
                    `<button class="btn btn-sm btn-primary-custom btn-survey" data-id="${app.id}" data-type="${app.service_type}"><i class="bi bi-star-fill me-1"></i> Avaliar</button>`;
                break;
            case 'Cancelada':
            case 'Rejeitada':
                statusHtml = `<span class="appointment-status text-danger-red fw-bold me-3">${app.status}</span>`;
                actionsHtml = '';
                break;
            case 'Pendente':
            default:
                statusHtml = `<span class="appointment-status text-warning fw-bold me-3">Pendente</span>`;
                actionsHtml = `<button class="btn btn-sm btn-outline-secondary btn-cancel-appointment" data-id="${app.id}"><i class="bi bi-x-circle me-1"></i> Cancelar</button>`;
                break;
        }


        card.innerHTML = `
        <div class="appointment-icon ${statusClass}"><i class="bi ${iconClass}"></i></div>
        <div class="appointment-details">
            <h5 class="appointment-title">${app.service_type}</h5>
            <p class="appointment-info mb-1"><i class="bi bi-calendar-event"></i> ${formattedDate} às ${formattedTime} (${app.duration} min)</p>
            <p class="appointment-info mb-0"><i class="bi bi-person-fill"></i> Nutri: ${nutriData.name}</p>
        </div>
        <div class="d-flex gap-2 align-items-center">
            ${statusHtml}
            ${actionsHtml}
        </div>`;

        container.appendChild(card);

        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            showAppointmentDetailsModal(
                { id: app.id, service: app.service_type, date: formattedDate, time: formattedTime, duration: app.duration },
                { nutriName: nutriData.name, nutriPhone: nutriData.phone },
                'agenda'
            );
        });

        card.querySelector('.btn-cancel-appointment')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showActionConfirmModal(app.id, 'cancelar', { type: app.service_type, date: formattedDate, time: formattedTime });
        });
        card.querySelector('.btn-reschedule-appointment')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showActionConfirmModal(app.id, 'reagendar', {});
        });
        card.querySelector('.btn-survey')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showSurveyModal(app.id, app.service_type, nutriData.name);
        });
    }

    function showActionConfirmModal(appointmentId, action, details) {
        const modal = document.getElementById('actionConfirmModal');
        if (!modal) return;

        const isCancel = action === 'cancelar';
        document.getElementById('modalActionTitle').textContent = isCancel ? 'Confirmar Cancelamento' : 'Confirmar Reagendamento';
        document.getElementById('modalActionMessage').textContent = isCancel ?
            `Você tem certeza que deseja cancelar a consulta de ${details.type} em ${details.date} às ${details.time}?` :
            'Para reagendar, sua consulta atual será cancelada e você poderá escolher um novo horário. Confirma?';

        const btnConfirm = document.getElementById('btnConfirmAction');
        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);

        newBtnConfirm.textContent = isCancel ? 'Sim, Cancelar' : 'Sim, Reagendar';
        newBtnConfirm.classList.toggle('btn-danger', isCancel);
        newBtnConfirm.classList.toggle('btn-primary-custom', !isCancel);

        newBtnConfirm.onclick = async () => {
            modal.classList.remove('is-visible');
            if (isCancel) {
                await handleCancelAppointment(appointmentId);
            } else {
                const appointmentData = await getAppointmentDetailsForReschedule(appointmentId);
                if (appointmentData && window.user && window.user.nutriID) {
                    initializeRescheduleModal(window.user.nutriID, appointmentData);
                } else {
                    showCustomToast("Não foi possível carregar os detalhes. Tente novamente.", false);
                }
            }
        };

        document.getElementById('btnCancelAction').onclick = () => modal.classList.remove('is-visible');
        document.getElementById('closeActionConfirmModal').onclick = () => modal.classList.remove('is-visible');
        modal.classList.add('is-visible');
    }

    async function handleCancelAppointment(appointmentId) {
        try {
            const response = await fetch('/api/auth/patient/appointments', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    appointmentId
                })
            });
            const result = await response.json();
            showCustomToast(result.message, result.success);
            if (result.success) {
                const path = window.location.pathname;
                if (path.endsWith('/paciente/dashboard.html')) {
                    await getPatientDashboardOverview(await verifySession());
                } else if (path.endsWith('/paciente/agenda.html')) {
                    await getAppointmentsData(await verifySession());
                }
            }
        } catch (error) {
            showCustomToast('Falha na comunicação com o servidor.', false);
        }
    }

    // --- LÓGICA DO MODAL DE AVALIAÇÃO (SURVEY) ---

    function showSurveyModal(appointmentId, serviceType, nutriName) {
        const modal = document.getElementById('surveyModal');
        const form = document.getElementById('surveyForm');
        if (!modal || !form) return;

        form.reset();
        document.querySelectorAll('.rating-stars .bi-star-fill').forEach(s => {
            s.classList.remove('bi-star-fill');
            s.classList.add('bi-star');
        });
        document.querySelectorAll('.nps-score.selected').forEach(b => b.classList.remove('selected'));
        const messageContainer = document.getElementById('survey-message');
        if (messageContainer) messageContainer.classList.remove('visible');


        document.getElementById('surveyAppointmentId').value = appointmentId;
        document.getElementById('surveyNutriName').textContent = nutriName;

        const mealPlanSection = document.getElementById('mealPlanSurveySection');
        const mealPlanRatingInput = document.getElementById('mealPlanRating');

        const isRetorno = serviceType.toLowerCase().includes('retorno');
        mealPlanSection.style.display = isRetorno ? 'block' : 'none';
        mealPlanRatingInput.required = isRetorno;

        modal.classList.add('is-visible');
    }

    function initializeSurveyModal() {
        const modal = document.getElementById('surveyModal');
        if (!modal) return;

        modal.querySelector('#closeSurveyModal').addEventListener('click', () => modal.classList.remove('is-visible'));

        document.querySelectorAll('.rating-stars').forEach(container => {
            container.addEventListener('click', (e) => {
                if (e.target.matches('.bi-star, .bi-star-fill')) {
                    const value = e.target.dataset.value;
                    const input = document.getElementById(`${container.dataset.for}Rating`);
                    input.value = value;
                    container.querySelectorAll('i').forEach(star => {
                        star.classList.toggle('bi-star-fill', star.dataset.value <= value);
                        star.classList.toggle('bi-star', star.dataset.value > value);
                    });
                }
            });
        });

        document.querySelectorAll('.rating-nps').forEach(container => {
            container.addEventListener('click', (e) => {
                if (e.target.matches('.nps-score')) {
                    const value = e.target.dataset.value;
                    document.getElementById('systemRating').value = value;
                    container.querySelectorAll('.nps-score').forEach(btn => btn.classList.remove('selected'));
                    e.target.classList.add('selected');
                }
            });
        });

        document.getElementById('surveyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitSurveyBtn');
            const btnText = btn.querySelector('.btn-text');
            const spinner = btn.querySelector('.spinner-container');
            const messageContainer = document.getElementById('survey-message');

            btn.disabled = true;
            btnText.style.display = 'none';
            spinner.style.display = 'block';

            const payload = {
                appointmentId: document.getElementById('surveyAppointmentId').value,
                nutriRating: document.getElementById('nutriRating').value,
                nutriComments: document.getElementById('nutriComments').value,
                systemRating: document.getElementById('systemRating').value,
                systemComments: document.getElementById('systemComments').value,
            };

            if (document.getElementById('mealPlanRating').required) {
                payload.mealPlanRating = document.getElementById('mealPlanRating').value;
                payload.mealPlanComments = document.getElementById('mealPlanComments').value;
            }

            try {
                const response = await fetch('/api/auth/patient/submit-survey', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                messageContainer.textContent = result.message;
                messageContainer.className = `form-message-container ${result.success ? 'success' : 'error'} visible`;

                if (result.success) {
                    setTimeout(async () => {
                        modal.classList.remove('is-visible');
                        await getAppointmentsData(await verifySession());
                    }, 2000);
                }

            } catch (error) {
                messageContainer.textContent = 'Erro de comunicação ao enviar avaliação.';
                messageContainer.className = 'form-message-container error visible';
            } finally {
                btn.disabled = false;
                btnText.style.display = 'block';
                spinner.style.display = 'none';
            }
        });
    }

    // --- LÓGICA DE REAGENDAMENTO ---

    let rescheduleState = {
        nutriID: null,
        originalAppointmentID: null,
        service: null,
        newDate: null,
        newTime: null,
    };

    const getDateString = (date) => date.toISOString().split('T')[0];

    const datesValidation = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date.getDay() === 0 || date.getTime() < today.getTime();
    };

    async function fetchAndRenderAvailableTimes(dateStr, nutriId, slotsContainer, loader, alertMessage, duration) {
        slotsContainer.innerHTML = '';
        loader.style.display = 'block';
        alertMessage.style.display = 'none';

        try {
            const response = await fetch(`/api/auth/schedule/available?nutriId=${nutriId}&date=${dateStr}`);
            const result = await response.json();

            loader.style.display = 'none';
            const availableTimes = result.availableSlots || [];

            if (availableTimes.length === 0) {
                slotsContainer.innerHTML = '<p class="text-muted text-center small mt-3">Nenhum horário disponível.</p>';
                alertMessage.textContent = result.message || 'Esta data não está configurada para atendimento.';
                alertMessage.style.display = 'block';
                return;
            }

            slotsContainer.style.display = 'grid';
            document.getElementById('goToRescheduleConfirm').disabled = true;

            availableTimes.forEach(time => {
                const slot = document.createElement('div');
                slot.className = 'time-slot';
                slot.textContent = time;
                slot.addEventListener('click', () => {
                    rescheduleState.newTime = time;
                    document.querySelectorAll('#rescheduleTimeSlots .time-slot').forEach(s => s.classList.remove('selected'));
                    slot.classList.add('selected');
                    document.getElementById('goToRescheduleConfirm').disabled = false;
                });
                slotsContainer.appendChild(slot);
            });

        } catch (error) {
            loader.style.display = 'none';
            alertMessage.textContent = 'Erro de comunicação ao carregar horários.';
            alertMessage.style.display = 'block';
        }
    }

    function initializeRescheduleModal(nutriID, appointment) {
        const modal = document.getElementById('rescheduleModal');
        const datepickerEl = document.getElementById('rescheduleDatepicker');

        if (window.reschedulePicker) {
            window.reschedulePicker.destroy();
        }

        rescheduleState = {
            nutriID: nutriID,
            originalAppointmentID: appointment.id,
            service: {
                name: appointment.service_type,
                duration: appointment.duration
            },
            newDate: null,
            newTime: null,
        };

        document.getElementById('rescheduleServiceType').textContent = appointment.service_type;

        const goToStep = (step) => {
            modal.querySelectorAll('.booking-step').forEach(s => s.classList.remove('active'));
            document.getElementById(`rescheduleStep${step}`).classList.add('active');
        };

        window.reschedulePicker = new Datepicker(datepickerEl, {
            format: 'yyyy-mm-dd',
            language: 'pt-BR',
            autohide: true,
            todayHighlight: true,
            datesDisabled: datesValidation
        });

        datepickerEl.addEventListener('changeDate', (e) => {
            const dateStr = getDateString(e.detail.date);
            rescheduleState.newDate = dateStr;
            document.getElementById('rescheduleSelectedDate').textContent = `Horários para ${e.detail.date.toLocaleDateString('pt-BR')}`;
            fetchAndRenderAvailableTimes(
                dateStr,
                nutriID,
                document.getElementById('rescheduleTimeSlots'),
                document.getElementById('reschedule-slots-loader'),
                document.getElementById('reschedule-alert-message'),
                appointment.duration
            );
        });

        document.getElementById('goToRescheduleConfirm').onclick = () => {
            if (rescheduleState.newDate && rescheduleState.newTime) {
                document.getElementById('confirmRescheduleService').textContent = rescheduleState.service.name;
                document.getElementById('confirmRescheduleDateTime').textContent = `${new Date(rescheduleState.newDate + 'T00:00:00').toLocaleDateString('pt-BR')} às ${rescheduleState.newTime}`;
                document.getElementById('confirmRescheduleNutri').textContent = document.getElementById('nutriName').textContent;
                goToStep(2);
            }
        };

        document.getElementById('backToRescheduleDate').onclick = () => goToStep(1);
        document.getElementById('submitRescheduleBtn').onclick = submitRescheduleRequest;

        document.getElementById('rescheduleTimeSlots').innerHTML = '';
        document.getElementById('rescheduleSelectedDate').textContent = 'Escolha uma data no calendário';
        goToStep(1);
        modal.classList.add('is-visible');
        document.getElementById('closeRescheduleModal').onclick = () => modal.classList.remove('is-visible');
    }

    async function submitRescheduleRequest() {
        const modal = document.getElementById('rescheduleModal');
        const btn = document.getElementById('submitRescheduleBtn');

        const payload = {
            nutriId: rescheduleState.nutriID,
            service: rescheduleState.service,
            date: rescheduleState.newDate,
            time: rescheduleState.newTime,
            patientData: {
                name: user.name,
                email: user.email,
                phone: user.phone || 'N/A'
            }
        };

        try {
            btn.disabled = true;

            const cancelResponse = await fetch('/api/auth/patient/appointments', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    appointmentId: rescheduleState.originalAppointmentID
                })
            });
            const cancelResult = await cancelResponse.json();
            if (!cancelResult.success) throw new Error('Não foi possível cancelar a consulta original.');

            const bookResponse = await fetch('/api/auth/schedule/book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const bookResult = await bookResponse.json();

            if (bookResult.success) {
                showCustomToast("Solicitação de reagendamento enviada!", true);
                modal.classList.remove('is-visible');
                await getAppointmentsData(await verifySession());
            } else {
                showCustomToast(bookResult.message, false);
            }
        } catch (error) {
            showCustomToast(error.message || 'Falha na comunicação ao reagendar.', false);
        } finally {
            btn.disabled = false;
        }
    }

    async function getAppointmentDetailsForReschedule(appointmentId) {
        try {
            const response = await fetch('/api/auth/patient/appointments');
            const result = await response.json();
            if (result.success && result.appointments) {
                const app = result.appointments.find(a => a.id === parseInt(appointmentId));
                if (app) {
                    return {
                        id: app.id,
                        service_type: app.service_type,
                        duration: app.duration
                    };
                }
            }
        } catch (error) {
            console.error("Erro ao buscar detalhes da consulta:", error);
        }
        return null;
    }

    // --- LÓGICA DO MODAL DE DETALHES (DASHBOARD E AGENDA) ---
    function showAppointmentDetailsModal(appointment, data, origin) {
        const modal = document.getElementById('appointmentDetailsModal');
        if (!modal) return;

        const appointmentDateStr = origin === 'agenda'
            ? appointment.date.split('/').reverse().join('-') + 'T' + appointment.time
            : appointment.date.split('/').reverse().join('-') + 'T' + appointment.time;

        const appointmentDate = new Date(appointmentDateStr);
        const isFuture = appointmentDate > new Date();

        document.getElementById('modalServiceType').textContent = appointment.service;
        document.getElementById('modalDateTime').textContent = `${appointment.date} às ${appointment.time}`;
        document.getElementById('modalDuration').textContent = `${appointment.duration} min`;
        document.getElementById('modalNutriName').textContent = `Dra. ${data.nutriName}`;
        document.getElementById('modalNutriPhone').textContent = data.nutriPhone;

        const wppLink = document.getElementById('modalWppLink');
        if (data.nutriPhone) {
            const phone = data.nutriPhone.replace(/\D/g, '');
            wppLink.href = `https://wa.me/55${phone}`;
            wppLink.style.display = 'inline-flex';
        } else {
            wppLink.style.display = 'none';
        }

        const cancelBtn = document.getElementById('modalCancelBtn');
        const rescheduleBtn = document.getElementById('modalRescheduleBtn');

        cancelBtn.style.display = isFuture ? 'inline-flex' : 'none';
        rescheduleBtn.style.display = isFuture ? 'inline-flex' : 'none';

        if (isFuture) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                modal.classList.remove('is-visible');
                showActionConfirmModal(appointment.id, 'cancelar', { type: appointment.service, date: appointment.date, time: appointment.time });
            });

            const newRescheduleBtn = rescheduleBtn.cloneNode(true);
            rescheduleBtn.parentNode.replaceChild(newRescheduleBtn, rescheduleBtn);
            newRescheduleBtn.addEventListener('click', () => {
                modal.classList.remove('is-visible');
                showActionConfirmModal(appointment.id, 'reagendar', {});
            });
        }

        document.getElementById('closeDetailsModal').onclick = () => modal.classList.remove('is-visible');
        modal.classList.add('is-visible');
    }


    // --- INICIALIZAÇÃO E ROUTING ---
    await fetchUserData(user);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    function checkRole() {
        if (user.role !== "paciente") {
            window.location.href = '/pages/login.html';
        }
    }

    const path = window.location.pathname;
    if (path.endsWith('/paciente/dashboard.html')) {
        await getPatientDashboardOverview(user);
    } else if (path.endsWith('/paciente/planoAlimentar.html')) {
        await getMealPlanData(user.id);
    } else if (path.endsWith('/paciente/agenda.html')) {
        await getAppointmentsData(user);
        initializeSurveyModal();
    }
});

function showCustomToast(message, isSuccess = true) {
    let toast = document.getElementById('customToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.className = 'custom-toast';
        toast.innerHTML = `
            <div class="toast-icon"><i class="bi"></i></div>
            <div class="toast-message"></div>
        `;
        document.body.appendChild(toast);
    }

    const messageEl = toast.querySelector('.toast-message');
    const iconEl = toast.querySelector('.toast-icon i');
    messageEl.textContent = message;
    toast.classList.remove('success', 'error', 'show');
    toast.classList.add(isSuccess ? 'success' : 'error');
    iconEl.className = isSuccess ? 'bi bi-check-circle-fill' : 'bi bi-x-octagon-fill';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}