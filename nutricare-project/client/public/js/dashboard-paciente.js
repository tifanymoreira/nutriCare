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

    // ==========================================
    // SAUDAÇÃO DINÂMICA (PREMIUM UI)
    // ==========================================
    const setGreeting = (name) => {
        const titleEl = document.getElementById('greetingTitle');
        if (!titleEl) return;
        const hour = new Date().getHours();
        let greeting = 'Bom dia';
        let emoji = '☀️';
        
        if (hour >= 12 && hour < 18) { greeting = 'Boa tarde'; emoji = '☕'; } 
        else if (hour >= 18) { greeting = 'Boa noite'; emoji = '🌙'; }

        titleEl.innerHTML = `${greeting}, <span class="text-primary">${name.split(' ')[0]}</span>! ${emoji}`;
    };
    setGreeting(user.name);

    // ==========================================
    // WIDGET DE WHATSAPP
    // ==========================================
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

    // ==========================================
    // NOTIFICAÇÕES (SININHO)
    // ==========================================
    if (notificationBell && notificationDropdown) {
        notificationBell.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('is-visible');
        });

        document.addEventListener('click', (e) => {
            if (notificationDropdown.classList.contains('is-visible') && !notificationDropdown.contains(e.target)) {
                notificationDropdown.classList.remove('is-visible');
            }
        });
        setInterval(() => fetchAndRenderNotifications(user), 5000);
    }

    // ==========================================
    // AUTENTICAÇÃO E DADOS GERAIS
    // ==========================================
    async function verifySession() {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) return result.user;
            }
            window.location.href = '/pages/login.html';
            return null;
        } catch (error) {
            console.log('Não foi possível verificar o status de autenticação.', error);
            window.location.href = '/pages/login.html';
            return null;
        }
    }

    function checkRole() {
        if (user.role !== "paciente") window.location.href = '/pages/login.html';
    }

    async function fetchUserData(user) {
        const nutriNameSpan = document.getElementById('nutriName');
        const nutriNameFormSpan = document.getElementById('nutriNameForm');
        const nutriApptNameSpan = document.getElementById('nutriApptName'); // Premium Ticket

        if (user.nutriID) {
            try {
                const response = await fetch(`/api/auth/nutricionista/${user.nutriID}`);
                const result = await response.json();
                if (result.success) {
                    if(nutriNameSpan) nutriNameSpan.textContent = result.nutricionista.name;
                    if(nutriNameFormSpan) nutriNameFormSpan.textContent = result.nutricionista.name;
                    if(nutriApptNameSpan) nutriApptNameSpan.textContent = result.nutricionista.name.split(' ')[0];
                    window.nutriCRN = result.nutricionista.crn || 'Não informado';
                    window.nutriNameFull = result.nutricionista.name;
                }
            } catch (error) {
                console.error('Erro ao buscar dados da nutricionista:', error);
            }
        }
    }

    async function fetchNutriData(user) {
        if (user.nutriID) {
            try {
                const response = await fetch(`/api/auth/nutricionista/${user.nutriID}`);
                const result = await response.json();
                if (result.success) {
                    window.nutriCRN = result.nutricionista.crnCode || result.nutricionista.crn;
                    window.nutriNameFull = result.nutricionista.name;
                }
            } catch (error) {
                console.error('Erro ao buscar dados da nutricionista:', error);
            }
        }
    }

    async function sendWhatsAppMsg(user) {
        try {
            const response = await fetch(`/api/auth/sendMsg/${user.nutriID}`, { method: 'GET' });
            const result = await response.json();
            if (result.success) window.open(`https://wa.me/${result.number}`, '_blank');
        } catch (error) {
            console.log('Erro ao enviar mensagem: ', error);
        }
    }

    async function handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            const result = await response.json();
            if (result.success) window.location.href = result.redirectUrl;
        } catch (error) {
            console.log('Erro no processo de logout:', error);
        }
    }

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
                result.notifications.forEach(notif => {
                    if (notif.status !== 'Pendente') notificationCount++;

                    let iconClass = '', statusClass = '', messageText = '', actionText = '';
                    if (notif.status === 'Confirmada') {
                        statusClass = 'text-success'; iconClass = 'bi-check-circle-fill';
                        messageText = `🎉 Aí sim! ${notif.message}`; actionText = `Ver Agenda`;
                    } else if (notif.status === 'Rejeitada') {
                        statusClass = 'text-danger'; iconClass = 'bi-x-circle-fill';
                        messageText = `😔 Poxa! ${notif.message}.`; actionText = `Reagendar`;
                    } else { return; }

                    newHtml += `
                        <div class="d-flex align-items-start gap-3 p-3 border-bottom">
                            <div class="${statusClass} fs-4"><i class="bi ${iconClass}"></i></div>
                            <div>
                                <p class="mb-1 small text-dark">${messageText}</p>
                                <a href="${notif.status === 'Confirmada' ? 'agenda.html' : `/pages/paciente/preSchedule.html?nutriId=${user.nutriID}`}" class="text-decoration-none small fw-bold ${statusClass}">
                                    ${actionText} <i class="bi bi-arrow-right"></i>
                                </a>
                            </div>
                        </div>
                    `;
                });
            }

            if (notificationCount > 0) {
                if (countBadge) { countBadge.textContent = notificationCount; countBadge.style.display = 'flex'; }
                if (emptyMessage) emptyMessage.style.display = 'none';
                listContainer.innerHTML = newHtml;
            } else {
                if (countBadge) countBadge.style.display = 'none';
                listContainer.innerHTML = '';
                if (emptyMessage) { listContainer.appendChild(emptyMessage); emptyMessage.style.display = 'block'; }
            }
        } catch (error) {
            if (emptyMessage) emptyMessage.textContent = 'Erro ao carregar notificações.';
        }
    }

    // ==========================================
    // HOME DASHBOARD (RESUMO PREMIUM)
    // ==========================================
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
                        const newViewDetailsBtn = viewDetailsBtn.cloneNode(true);
                        viewDetailsBtn.parentNode.replaceChild(newViewDetailsBtn, viewDetailsBtn);
                        newViewDetailsBtn.addEventListener('click', () => {
                            showAppointmentDetailsModal(result.data.nextAppointment, result.data, 'dashboard');
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Falha na comunicação com o servidor ao carregar dashboard:', error);
        }
    }

    function renderDashboardUI(data) {
        const { kpis, nextAppointment } = data;
        const nextAppointmentCard = document.getElementById('nextAppointmentCard');
        const emptyNextAppointmentCard = document.getElementById('emptyNextAppointmentCard');

        if (nextAppointmentCard) {
            if (nextAppointment) {
                console.log("nextAppointment Value = ", nextAppointment)
                const dateObj = new Date(nextAppointment.date.split[0][2])
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = dateObj.toLocaleString('pt-BR', { month: 'short' });

                document.getElementById('apptDay').textContent = day;
                document.getElementById('apptMonth').textContent = month;
                document.getElementById('nextAppointmentService').textContent = nextAppointment.service;
                document.getElementById('nextAppointmentTime').textContent = nextAppointment.time;
                
                nextAppointmentCard.style.display = 'block';
                if (emptyNextAppointmentCard) emptyNextAppointmentCard.style.display = 'none';
            } else {
                nextAppointmentCard.style.display = 'none';
                if (emptyNextAppointmentCard) emptyNextAppointmentCard.style.display = 'block';
            }

            // Render KPIs
            if (document.getElementById('currentWeight')) document.getElementById('currentWeight').textContent = kpis.currentWeight ? `${kpis.currentWeight} kg` : '-- kg';
            if (document.getElementById('currentBmi')) {
                const fatOrBmi = kpis.bodyFat ? `${kpis.bodyFat}% Gord.` : (kpis.bmi ? `IMC ${kpis.bmi}` : '--');
                document.getElementById('currentBmi').textContent = fatOrBmi;
            }

            const diffEl = document.getElementById('weightDifference');
            if (diffEl) {
                if (kpis.weightDifference !== null && kpis.weightDifference !== undefined) {
                    const diff = parseFloat(kpis.weightDifference);
                    const sign = diff > 0 ? '+' : '';
                    const colorClass = diff > 0 ? 'text-danger' : (diff < 0 ? 'text-success' : 'text-muted');
                    diffEl.innerHTML = `<span class="${colorClass}">${sign}${diff.toFixed(1)} kg</span>`;
                } else {
                    diffEl.textContent = '-- kg';
                }
            }
        }
    }

    function renderDetailedCharts(evolutionHistory, kpis) {
        const emptyChartState = document.getElementById('emptyChartState');
        const tabsContent = document.getElementById('evolutionTabsContent');

        if (!evolutionHistory || evolutionHistory.length < 2) {
            if (emptyChartState) emptyChartState.style.display = 'block';
            if (tabsContent) tabsContent.style.display = 'none';
            return;
        }

        if (emptyChartState) emptyChartState.style.display = 'none';
        if (tabsContent) tabsContent.style.display = 'block';

        const uniqueHistory = evolutionHistory.sort((a, b) => new Date(a.consultation_date) - new Date(b.consultation_date));
        const labels = uniqueHistory.map(item => new Date(item.consultation_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));

        // Configuração Comum Premium
        const commonOptions = {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(38, 70, 83, 0.9)', titleFont: { size: 14, family: 'Poppins' }, bodyFont: { size: 14, fontColor: '#fff' }, padding: 12, cornerRadius: 8, displayColors: false }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 12 }, color: '#adb5bd' } },
                y: { grid: { color: '#f1f3f5', borderDash: [5, 5] }, ticks: { font: { family: 'Poppins', size: 12 }, color: '#adb5bd' }, border: { display: false } }
            }
        };

        const createGradient = (ctx, colorHex) => {
            let gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, `${colorHex}80`); // 50% opacity
            gradient.addColorStop(1, `${colorHex}00`); // 0% opacity
            return gradient;
        };

        // Gráfico de Peso
        const weightCtx = document.getElementById('weightChart').getContext('2d');
        if (window.myWeightChart) window.myWeightChart.destroy();
        window.myWeightChart = new Chart(weightCtx, {
            type: 'line',
            data: { labels: labels, datasets: [{ 
                label: 'Peso (kg)', data: uniqueHistory.map(item => item.weight), 
                borderColor: '#2a9d8f', backgroundColor: createGradient(weightCtx, '#2a9d8f'), 
                borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#2a9d8f', pointBorderWidth: 2 
            }]},
            options: commonOptions
        });

        // Gráfico de Gordura
        const fatCtx = document.getElementById('fatChart').getContext('2d');
        if (window.myFatChart) window.myFatChart.destroy();
        window.myFatChart = new Chart(fatCtx, {
            type: 'line',
            data: { labels: labels, datasets: [{ 
                label: '% Gordura', data: uniqueHistory.map(item => item.body_fat_percentage || null), 
                borderColor: '#e76f51', backgroundColor: createGradient(fatCtx, '#e76f51'), 
                borderWidth: 3, fill: true, tension: 0.4, spanGaps: true, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#e76f51', pointBorderWidth: 2 
            }]},
            options: commonOptions
        });

        // Gráfico de Medidas
        const measuresCtx = document.getElementById('measuresChart').getContext('2d');
        if (window.myMeasuresChart) window.myMeasuresChart.destroy();
        window.myMeasuresChart = new Chart(measuresCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Cintura (cm)', data: uniqueHistory.map(item => item.circum_waist || null), borderColor: '#f4a261', borderWidth: 2, tension: 0.4, spanGaps: true },
                    { label: 'Abdómen (cm)', data: uniqueHistory.map(item => item.circum_abdomen || null), borderColor: '#264653', borderWidth: 2, tension: 0.4, spanGaps: true },
                    { label: 'Quadril (cm)', data: uniqueHistory.map(item => item.circum_hip || null), borderColor: '#2a9d8f', borderWidth: 2, tension: 0.4, spanGaps: true }
                ]
            },
            options: { ...commonOptions, plugins: { ...commonOptions.plugins, legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }
        });
    }

    // ==========================================
    // PLANO ALIMENTAR (ABAS + MOTOR DE PDF)
    // ==========================================
    async function getMealPlanData(userId, userAll) {
        const screenContainer = document.getElementById('mealPlanScreenContainer');
        const emptyState = document.getElementById('emptyPlanState');
        const btnPdf = document.getElementById('btnExportPDF');

        if (!screenContainer || !emptyState) return;

        screenContainer.innerHTML = `
            <div class="d-flex flex-column justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <h6 class="text-muted">Processando seu cardápio...</h6>
            </div>`;

        try {
            const response = await fetch(`/api/auth/mealplan/${userId}`);
            const result = await response.json();

            if (!result.success || !result.plan || !result.plan.meals || result.plan.meals.length === 0) {
                screenContainer.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }

            screenContainer.style.display = 'block';
            emptyState.style.display = 'none';
            if (btnPdf) btnPdf.style.display = 'inline-flex';

            if (document.getElementById('headerCalories') && result.plan.totalCalories) {
                document.getElementById('headerCalories').innerHTML = `Sua meta calórica: <strong class="text-dark-charcoal">${result.plan.totalCalories} kcal</strong> diárias.`;
            }

            renderMealPlanTabs(result.plan);
            renderA4DocumentForPDF(result.plan, userAll);

        } catch (error) {
            console.error("Erro ao carregar o plano alimentar:", error);
            screenContainer.style.display = 'none';
            emptyState.style.display = 'block';
        }
    }

    function renderMealPlanTabs(plan) {
        const container = document.getElementById('mealPlanScreenContainer');
        container.innerHTML = '';
        
        const tabsNav = document.createElement('ul');
        tabsNav.className = 'nav nav-pills custom-pills';
        tabsNav.id = 'mealPlanTab';
        tabsNav.role = 'tablist';

        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content mt-4';
        tabContent.id = 'mealPlanTabContent';

        plan.meals.forEach((meal, index) => {
            const tabId = `meal-tab-${meal.id || index}`;
            const paneId = `meal-pane-${meal.id || index}`;

            const navItem = document.createElement('li');
            navItem.className = 'nav-item';
            navItem.innerHTML = `<button class="nav-link ${index === 0 ? 'active' : ''}" id="${tabId}" data-bs-toggle="pill" data-bs-target="#${paneId}" type="button" role="tab"><i class="bi bi-clock me-2"></i>${meal.name}</button>`;
            tabsNav.appendChild(navItem);

            let itemsHtml = '<div class="text-center p-5 text-muted"><i class="bi bi-emoji-smile fs-1 d-block mb-3"></i>Refeição livre ou sem itens cadastrados.</div>';

            if (meal.items && meal.items.length > 0) {
                itemsHtml = meal.items.map(item => `
                    <div class="food-item-card">
                        <div>
                            <p class="food-name">${item.foodName}</p>
                            <p class="food-measure"><i class="bi bi-info-circle me-1"></i> ${item.quantity || 'Medida Padrão'}</p>
                        </div>
                        <div class="food-quantity-badge">${item.quantity}</div>
                    </div>
                `).join('');
            }

            const pane = document.createElement('div');
            pane.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`;
            pane.id = paneId;
            pane.role = 'tabpanel';
            pane.innerHTML = itemsHtml;
            tabContent.appendChild(pane);
        });

        container.appendChild(tabsNav);
        container.appendChild(tabContent);

        const btnPdf = document.getElementById('btnExportPDF');
        if (btnPdf) {
            const newBtn = btnPdf.cloneNode(true);
            btnPdf.parentNode.replaceChild(newBtn, btnPdf);
            newBtn.addEventListener('click', generatePDF);
        }
    }

    async function renderA4DocumentForPDF(plan, user) {
        await fetchNutriData(user);
        const pdfContainer = document.getElementById('pdf-export-container');
        if(!pdfContainer) return;
        
        const pacienteNome = window.user ? window.user.name : 'Paciente';
        const nutriNome = window.nutriNameFull;
        const nutriCRN = window.nutriCRN;
        const dataHoje = new Date().toLocaleDateString('pt-BR');

        let a4Html = `
            <div style="background-color: #ffffff; padding: 0 10px;">
                <div style="border-bottom: 2px solid #2a9d8f; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; font-family: Poppins, Arial, sans-serif;">
                    <div>
                        <h1 style="color: #2a9d8f; font-size: 24px; margin: 0 0 12px 0; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Plano Alimentar Individualizado</h1>
                        <p style="margin: 4px 0; font-size: 14px; color: #333;">Paciente: <strong>${pacienteNome}</strong></p>
                        <p style="margin: 4px 0; font-size: 14px; color: #333;"><strong>Dra. ${nutriNome}</strong></p>
                        <p style="margin: 4px 0; font-size: 14px; color: #333;">CRN: <strong>${nutriCRN}</strong></p>
                        <p style="margin: 4px 0; font-size: 14px; color: #333;">Prescrição elaborada em: <strong>${dataHoje}</strong></p>
                    </div>
                </div>
                `;

        plan.meals.forEach((meal) => {
            a4Html += `
            <div style="margin-bottom: 25px; page-break-inside: avoid; font-family: Poppins, Arial, sans-serif;">
                <div style="background-color: #2a9d8f; color: #ffffff; padding: 10px 15px; border-radius: 8px 8px 0 0;">
                    <h3 style="margin: 0; font-size: 15px; font-weight: bold; letter-spacing: 1px;">${meal.name.toUpperCase()}</h3>
                </div>
                <div style="border: 1px solid #e0e6ed; border-top: none; border-radius: 0 0 8px 8px; padding: 10px 15px; background-color: #ffffff;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tbody>
            `;

            if (meal.items && meal.items.length > 0) {
                meal.items.forEach((item, idx) => {
                    const isLast = idx === meal.items.length - 1;
                    const borderStyle = isLast ? 'none' : '1px solid #f0f4f8';

                    a4Html += `
                        <tr>
                            <td style="padding: 12px 5px; border-bottom: ${borderStyle}; width: 75%;">
                                <div style="color: #2b2d42; font-size: 14px; font-weight: bold; margin-bottom: 3px;">${item.foodName}</div>
                                <div style="color: #8d99ae; font-size: 12px;">Medida: ${item.measure || 'Padrão'}</div>
                            </td>
                            <td style="padding: 12px 5px; border-bottom: ${borderStyle}; text-align: right; width: 25%;">
                                <span style="background-color: #f4f7f6; border: 1px solid #e9ecef; color: #e76f51; font-weight: bold; font-size: 13px; padding: 6px 12px; border-radius: 6px; display: inline-block;">
                                    ${item.quantity}
                                </span>
                            </td>
                        </tr>
                    `;
                });
            } else {
                a4Html += `<tr><td colspan="2" style="padding: 15px; font-size: 13px; color: #8d99ae; text-align: center; font-style: italic;">Nenhum item específico prescrito.</td></tr>`;
            }

            a4Html += `</tbody></table></div></div>`;
        });

        a4Html += `
                <div style="margin-top: 50px; text-align: center; page-break-inside: avoid; font-family: Poppins, Arial, sans-serif;">
                    <div style="width: 300px; border-bottom: 1px solid #333; margin: 0 auto 10px auto;"></div>
                    <p style="margin: 0; font-size: 14px; color: #2b2d42; font-weight: bold;">Dra. ${nutriNome}</p>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: #555;">CRN: ${nutriCRN}</p>
                    <p style="margin: 25px 0 0 0; font-size: 11px; color: #999;">Este documento é de uso pessoal e intransferível. Gerado por <strong>NutriCare Software</strong>.</p>
                </div>
            </div>
        `;
        pdfContainer.innerHTML = a4Html;
    }

    function generatePDF() {
        const btn = document.getElementById('btnExportPDF');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processando...';
        btn.disabled = true;

        const element = document.getElementById('pdf-export-container');
        const pacienteNome = window.user ? window.user.name : 'Paciente';

        element.style.display = 'block';

        const opt = {
            margin: 15,
            filename: `Cardapio_${pacienteNome.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 3, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if(typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save().then(() => {
                element.style.display = 'none';
                btn.innerHTML = originalText;
                btn.disabled = false;
                showCustomToast("PDF gerado com sucesso!", true);
            }).catch(err => {
                console.error("Erro ao gerar PDF:", err);
                element.style.display = 'none';
                btn.innerHTML = originalText;
                btn.disabled = false;
                showCustomToast("Erro ao gerar PDF.", false);
            });
        }
    }

    // ==========================================
    // AGENDA E CONSULTAS
    // ==========================================
    async function getAppointmentsData(user) {
        const listContainer = document.getElementById('appointmentsListContainer');
        const emptyState = document.getElementById('emptyAgendaState');
        const highlightContainer = document.getElementById('nextAppointmentHighlight');

        if (!listContainer || !emptyState || !highlightContainer) return;

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
            if (emptyState) emptyState.style.display = 'block';
        }
    }

    function renderHighlight(app, nutriData) {
        const highlightContainer = document.getElementById('nextAppointmentHighlight');
        const date = new Date(app.appointment_date);
        const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        highlightContainer.innerHTML = `
            <div class="card data-card highlight-appointment-card border-0 shadow-sm p-3">
                <div class="highlight-details d-flex align-items-center mb-3">
                    <i class="bi bi-calendar-check-fill me-4 display-6 text-primary-green"></i>
                    <div>
                        <h5 class="highlight-title fw-bold text-dark-charcoal">${app.service_type}</h5>
                        <p class="highlight-info mb-0">
                            Em <strong class="text-secondary-orange">${formattedDate}</strong> às 
                            <strong class="text-secondary-orange">${formattedTime}</strong> (${app.duration} min)
                        </p>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary btn-cancel-appointment" data-id="${app.id}"><i class="bi bi-x-circle me-1"></i> Cancelar</button>
                    <button class="btn btn-sm btn-primary-custom btn-reschedule-appointment" data-id="${app.id}"><i class="bi bi-arrow-repeat me-1"></i> Remarcar</button>
                </div>
            </div>`;

        highlightContainer.querySelector('.btn-cancel-appointment').addEventListener('click', (e) => {
            e.stopPropagation();
            showActionConfirmModal(app.id, 'cancelar', { type: app.service_type, date: formattedDate, time: formattedTime });
        });
        highlightContainer.querySelector('.btn-reschedule-appointment').addEventListener('click', (e) => {
            e.stopPropagation();
            showActionConfirmModal(app.id, 'reagendar', {});
        });
    }

    function renderAppointmentCard(app, nutriData, container) {
        const card = document.createElement('div');
        card.className = 'list-group-item appointment-card d-flex justify-content-between align-items-center p-3 mb-2 border rounded shadow-sm';
        card.dataset.appointmentId = app.id;
        card.style.cursor = 'pointer';

        const date = new Date(app.appointment_date);
        const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let statusHtml = '', actionsHtml = '', statusClass = '', iconClass = 'bi-person-check-fill';
        const typeLower = app.service_type.toLowerCase();

        if (typeLower.includes('retorno')) {
            statusClass = 'text-info'; iconClass = 'bi-arrow-repeat';
        } else if (typeLower.includes('online')) {
            statusClass = 'text-primary'; iconClass = 'bi-camera-video-fill';
        } else {
            statusClass = 'text-success';
        }

        switch (app.status) {
            case 'Confirmada':
                statusHtml = `<span class="badge bg-success me-3">Confirmada</span>`;
                actionsHtml = `<button class="btn btn-sm btn-outline-secondary btn-cancel-appointment me-1" data-id="${app.id}">Cancelar</button>
                               <button class="btn btn-sm btn-outline-primary btn-reschedule-appointment" data-id="${app.id}">Remarcar</button>`;
                break;
            case 'Realizada':
                statusHtml = `<span class="badge bg-secondary me-3">Realizada</span>`;
                actionsHtml = app.is_rated ?
                    `<button class="btn btn-sm btn-light" disabled><i class="bi bi-check-circle-fill text-success me-1"></i> Avaliada</button>` :
                    `<button class="btn btn-sm btn-warning text-dark fw-bold btn-survey" data-id="${app.id}" data-type="${app.service_type}"><i class="bi bi-star-fill me-1"></i> Avaliar</button>`;
                break;
            case 'Cancelada':
            case 'Rejeitada':
                statusHtml = `<span class="badge bg-danger me-3">${app.status}</span>`;
                actionsHtml = '';
                break;
            case 'Pendente':
            default:
                statusHtml = `<span class="badge bg-warning text-dark me-3">Pendente</span>`;
                actionsHtml = `<button class="btn btn-sm btn-outline-secondary btn-cancel-appointment" data-id="${app.id}">Cancelar</button>`;
                break;
        }

        card.innerHTML = `
        <div class="d-flex align-items-center gap-3">
            <div class="p-2 bg-light rounded-circle ${statusClass}"><i class="bi ${iconClass} fs-4"></i></div>
            <div>
                <h6 class="mb-1 fw-bold">${app.service_type}</h6>
                <p class="mb-0 text-muted small"><i class="bi bi-calendar-event me-1"></i> ${formattedDate} às ${formattedTime} (${app.duration} min)</p>
            </div>
        </div>
        <div class="d-flex align-items-center">
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
                    if(typeof initializeRescheduleModal === 'function') {
                        initializeRescheduleModal(window.user.nutriID, appointmentData);
                    }
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointmentId })
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

    async function getAppointmentDetailsForReschedule(appointmentId) {
        try {
            const response = await fetch('/api/auth/patient/appointments');
            const result = await response.json();
            if (result.success && result.appointments) {
                const app = result.appointments.find(a => a.id === parseInt(appointmentId));
                if (app) {
                    return { id: app.id, service_type: app.service_type, duration: app.duration };
                }
            }
        } catch (error) {
            console.error("Erro ao buscar detalhes da consulta:", error);
        }
        return null;
    }

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

    function initializeSurveyModal() {}

    // ==========================================
    // PÁGINA DE CONFIGURAÇÕES
    // ==========================================
    function populateConfigPage(user) {
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');

        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (phoneInput) phoneInput.value = user.phone || 'Não cadastrado';

        const contactBtn = document.getElementById('contactNutriPasswordBtn');
        if (contactBtn) contactBtn.addEventListener('click', () => sendWhatsAppMsg(user));
    }

    // ==========================================
    // PÁGINA DE PAGAMENTOS
    // ==========================================
    async function getPagamentosData(userId) {
        const container = document.querySelector('.card-body');
        const emptyState = document.querySelector('.empty-state-card');
        if (!container || !emptyState) return;

        try {
            const response = await fetch(`/api/auth/patient/${userId}/invoices`);
            const result = await response.json();

            if (result.success && result.invoices.length > 0) {
                emptyState.style.display = 'none';

                let invoicesHtml = '<div class="list-group shadow-sm border-0">';
                result.invoices.forEach(inv => {
                    let statusBadge = inv.status === 'Paid'
                        ? '<span class="badge bg-success bg-opacity-10 text-success border border-success">Pago</span>'
                        : '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning">Pendente</span>';

                    invoicesHtml += `
                        <div class="list-group-item d-flex justify-content-between align-items-center p-4 border-0 border-bottom">
                            <div>
                                <h6 class="mb-1 fw-bold text-dark"><i class="bi bi-receipt me-2 text-primary"></i>Consulta Nutricional</h6>
                                <small class="text-muted">Vencimento: ${new Date(inv.due_date).toLocaleDateString('pt-BR')}</small>
                            </div>
                            <div class="text-end">
                                <h5 class="mb-1 fw-bold">R$ ${parseFloat(inv.amount).toFixed(2).replace('.', ',')}</h5>
                                ${statusBadge}
                            </div>
                        </div>
                    `;
                });
                invoicesHtml += '</div>';
                container.innerHTML += invoicesHtml;
            }
        } catch (error) {
            console.error("Erro ao carregar pagamentos:", error);
        }
    }

    // ==========================================
    // DOCUMENTOS (RECEITUÁRIOS E ENCAMINHAMENTOS)
    // ==========================================
    async function getDocumentosData(userId, docType) {
        const container = document.querySelector('.card-body');
        const emptyState = document.querySelector('.empty-state-card');
        if (!container || !emptyState) return;

        try {
            const response = await fetch(`/api/auth/patient/${userId}/documents?type=${docType}`);
            const result = await response.json();

            if (result.success && result.documents.length > 0) {
                emptyState.style.display = 'none';

                let docsHtml = '<div class="row g-4 mt-2">';
                result.documents.forEach(doc => {
                    docsHtml += `
                        <div class="col-md-4">
                            <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px;">
                                <div class="card-body text-center p-4">
                                    <div class="mb-3">
                                        <i class="bi bi-file-earmark-pdf-fill text-danger display-3"></i>
                                    </div>
                                    <h6 class="fw-bold mb-1 text-dark-charcoal">${doc.title}</h6>
                                    <p class="text-muted small mb-4">Gerado em: ${new Date(doc.created_at).toLocaleDateString('pt-BR')}</p>
                                    <a href="${doc.file_url}" target="_blank" class="btn btn-outline-primary w-100" style="border-radius: 10px;">
                                        <i class="bi bi-cloud-download me-1"></i> Baixar Arquivo
                                    </a>
                                </div>
                            </div>
                        </div>
                    `;
                });
                docsHtml += '</div>';
                container.innerHTML += docsHtml;
            }
        } catch (error) {
            console.error(`Erro ao carregar ${docType}:`, error);
        }
    }

    // ==========================================
    // ROTEAMENTO (ROUTER) DO PACIENTE
    // ==========================================
    await fetchUserData(user);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    const path = window.location.pathname;
    if (path.endsWith('/paciente/dashboard.html')) {
        await getPatientDashboardOverview(user);
    } else if (path.endsWith('/paciente/planoAlimentar.html')) {
        await getMealPlanData(user.id, user);
    } else if (path.endsWith('/paciente/agenda.html')) {
        await getAppointmentsData(user);
        initializeSurveyModal();
    } else if (path.endsWith('/paciente/configuracoes.html')) {
        populateConfigPage(user);
    } else if (path.endsWith('/paciente/pagamentos.html')) {
        await getPagamentosData(user.id);
    } else if (path.endsWith('/paciente/receituario.html')) {
        await getDocumentosData(user.id, 'receituario');
    } else if (path.endsWith('/paciente/encaminhamentos.html')) {
        await getDocumentosData(user.id, 'encaminhamento');
    }
});

function showCustomToast(message, isSuccess = true) {
    let toast = document.getElementById('customToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.className = 'custom-toast';
        toast.innerHTML = `<div class="toast-icon"><i class="bi"></i></div><div class="toast-message"></div>`;
        document.body.appendChild(toast);
    }
    const messageEl = toast.querySelector('.toast-message');
    const iconEl = toast.querySelector('.toast-icon i');
    messageEl.textContent = message;
    
    // Premium Toast Styles Inject
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.backgroundColor = isSuccess ? '#2a9d8f' : '#e76f51';
    toast.style.color = '#fff';
    toast.style.padding = '16px 24px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    toast.style.zIndex = '9999';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.fontWeight = '600';
    toast.style.transition = 'all 0.4s ease';

    if (toast.classList.contains('show')) return;

    iconEl.className = isSuccess ? 'bi bi-check-circle-fill fs-5' : 'bi bi-x-octagon-fill fs-5';
    toast.classList.add('show');

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => {
            toast.classList.remove('show');
            toast.style.opacity = '1';
            toast.style.transform = 'none';
        }, 400);
    }, 3000);
}