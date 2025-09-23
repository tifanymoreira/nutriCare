document.addEventListener('DOMContentLoaded', async () => {

    const nutriID = await verifySession();
    if (!nutriID) {
        window.location.href = '/pages/login.html';
        return;
    }

    if (!sessionStorage.getItem('hasAnimated')) {
        const sr = ScrollReveal({ distance: '40px', duration: 2200, delay: 200, reset: false });
        sr.reveal('.stat-card, .data-card, .dashboard-content-header h1, .calendar-card-pro, .kpi-card', { origin: 'bottom', interval: 150 });
        sessionStorage.setItem('hasAnimated', 'true');
    }

    const path = window.location.pathname;
    if (path.endsWith('/nutricionista/dashboard.html')) {
        initializeDashboardPage(nutriID);
        initializeGenerateLinkModal(nutriID);
    } else if (path.endsWith('/nutricionista/patientsList.html')) {
        await initializePatientList(nutriID);
    } else if (path.endsWith('/nutricionista/nutriAgenda.html')) {
        initializeProfessionalAgenda(nutriID);
        initializeAgendaModals(nutriID);
    } else if (path.endsWith('/nutricionista/nutriMetrics.html')) {
        initializeMetricsPage(nutriID);
    } else if (path.endsWith('/nutricionista/nutriConfig.html')) {
        initializeNutriConfigPage(nutriID);
    } else if (path.endsWith('/nutricionista/nutriInvoicing.html')) {
        initializeInvoicingPage(nutriID);
    } else if (path.endsWith('/nutricionista/planeEditor.html')) {
        // Nada a inicializar aqui no momento, mas a estrutura garante que não haja erros.
    }


    const logoutButton = document.getElementById('logoutBtn');
    const modal = document.getElementById('logoutModal');
    const buttonYes = document.getElementById('btnYes');
    const buttonNo = document.getElementById('btnNo');
    const closeLogoutModalBtn = document.getElementById('closeLogoutModal');

    if (logoutButton && modal && buttonYes && buttonNo && closeLogoutModalBtn) {
        logoutButton.addEventListener('click', () => {
            modal.classList.add('is-visible');
        });
        
        buttonYes.addEventListener('click', async () => {
             await handleLogout();
        });
        
        buttonNo.addEventListener('click', () => {
            modal.classList.remove('is-visible');
        });
        
        closeLogoutModalBtn.addEventListener('click', () => {
            modal.classList.remove('is-visible');
        });
    }
});



async function verifySession() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.user) {
                return result.user.id;
            }
        }
        return null;
    } catch (error) {
        console.error('Não foi possível verificar o status de autenticação.', error);
        return null;
    }
}

async function handleLogout() {
    console.log("start handleLogout function")

    sessionStorage.removeItem('hasAnimated');
    window.location.href = '/pages/login.html';
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            sessionStorage.removeItem('hasAnimated');
            window.location.href = result.redirectUrl;
        } else {
            alert('Erro ao tentar fazer logout.');
        }
    } catch (error) {
        console.error('Erro no processo de logout:', error);
    }


}

function initializeGenerateLinkModal(nutriId) {
    const modal = document.getElementById('generateLinkModal');
    const openBtn = document.getElementById('openGenerateLinkModal');
    if (!openBtn) return;

    const closeBtn = document.getElementById('closeGenerateLinkModal');
    const copyBtn = document.getElementById('copyLinkBtn');
    const linkSpan = document.getElementById('generatedLink');

    openBtn.addEventListener('click', () => {
        modal.classList.add('is-visible');
        linkSpan.textContent = "Gerando seu link...";
        setTimeout(() => {
            linkSpan.textContent = `http://localhost:3000/pages/paciente/preSchedule.html?nutriId=${nutriId}`;
        }, 500);
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('is-visible'));

    copyBtn.addEventListener('click', () => {
        const linkText = linkSpan.textContent;
        if (linkText.startsWith("http")) {
            navigator.clipboard.writeText(linkText).then(() => {
                copyBtn.innerHTML = '<i class="bi bi-check-lg"></i> Copiado!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar Link';
                }, 2000);
            }).catch(err => console.error('Erro ao copiar o link:', err));
        }
    });
}


function initializeProfessionalAgenda(nutriId) {
    const header = document.getElementById('currentDayHeader');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const todayBtn = document.getElementById('todayBtn');
    const datePicker = document.getElementById('datePicker');
    const timelineContainer = document.getElementById('timelineContainer');
    const emptyState = document.getElementById('emptyAgendaState');

    let currentDate = new Date();

    const renderDayView = async () => {
        timelineContainer.innerHTML = '';
        updateHeader();

        const workHours = null;
        const appointments = [];

        if (!workHours) {
            timelineContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        timelineContainer.style.display = 'block';
        emptyState.style.display = 'none';

        for (let hour = workHours.start; hour <= workHours.end; hour++) {
            const slot = document.createElement('div');
            slot.className = 'timeline-slot';
            slot.innerHTML = `
                <div class="timeline-time">${String(hour).padStart(2, '0')}:00</div>
                <div class="timeline-line"></div>
            `;
            timelineContainer.appendChild(slot);
        }

        appointments.forEach(apt => {
            const aptBlock = document.createElement('div');
            aptBlock.className = `appointment-block-pro type-${apt.type || 'primeira'}`;

            const [aptHour, aptMinute] = apt.time.split(':').map(Number);
            const topPosition = ((aptHour - workHours.start) * 60) + aptMinute;
            const duration = apt.duration || 60;

            aptBlock.style.top = `${topPosition}px`;
            aptBlock.style.height = `${duration}px`;

            aptBlock.innerHTML = `
                <div class="appointment-patient-name">${apt.patientName}</div>
                <div class="appointment-details-pro">${apt.title} - ${apt.time}</div>
            `;
            timelineContainer.appendChild(aptBlock);
        });

    };

    const updateHeader = () => {
        const today = new Date();
        const isToday = currentDate.toDateString() === today.toDateString();

        if (isToday) {
            header.textContent = 'Hoje';
        } else {
            header.textContent = currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        }

        datePicker.value = currentDate.toISOString().split('T')[0];
    };

    prevDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        renderDayView();
    });

    nextDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        renderDayView();
    });

    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        renderDayView();
    });

    datePicker.addEventListener('change', (e) => {
        const selectedDate = new Date(e.target.value);
        currentDate = new Date(selectedDate.getTime() + selectedDate.getTimezoneOffset() * 60000);
        renderDayView();
    });

    renderDayView();
}


function initializeAgendaModals(nutriId) {
    const modal = document.getElementById('scheduleSettingsModal');
    const openModalBtn = document.getElementById('openScheduleSettingsModalBtn');
    if (!openModalBtn) return;
    if (!modal) return;

    const closeModalBtn = document.getElementById('closeScheduleSettingsModal');
    const form = document.getElementById('scheduleSettingsForm');
    const generateBtn = document.getElementById('generateScheduleBtn');
    const messageContainer = document.getElementById('schedule-settings-message');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const monthDisplay = document.getElementById('monthDisplay');
    const calendarGrid = document.getElementById('calendarProGrid');

    let calendarDate = new Date();
    let selectedDates = new Set();

    const renderCalendar = () => {
        calendarGrid.innerHTML = '';
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDayOfMonth.getDay();

        const monthName = calendarDate.toLocaleString('pt-BR', { month: 'long' });
        monthDisplay.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

        for (let i = 0; i < startDayOfWeek; i++) {
            calendarGrid.insertAdjacentHTML('beforeend', '<div class="calendar-pro-day other-month"></div>');
        }

        for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-pro-day';
            dayDiv.textContent = day;
            dayDiv.dataset.date = dateStr;

            const today = new Date();
            if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                dayDiv.classList.add('is-today');
            }

            if (selectedDates.has(dateStr)) {
                dayDiv.classList.add('selected');
            }

            calendarGrid.appendChild(dayDiv);
        }
    };

    calendarGrid.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('calendar-pro-day') && !target.classList.contains('other-month')) {
            const date = target.dataset.date;
            if (selectedDates.has(date)) {
                selectedDates.delete(date);
                target.classList.remove('selected');
            } else {
                selectedDates.add(date);
                target.classList.add('selected');
            }
        }
    });

    const navigateMonth = (direction) => {
        calendarDate.setMonth(calendarDate.getMonth() + direction);
        renderCalendar();
    };

    const setButtonLoading = (btn, isLoading) => {
        btn.classList.toggle('is-loading', isLoading);
        btn.disabled = isLoading;
    };

    const showMessage = (containerId, message, isSuccess = true) => {
        const container = document.getElementById(containerId);
        container.textContent = message;
        container.className = `form-message-container ${isSuccess ? 'success' : 'error'} visible`;
        setTimeout(() => container.classList.remove('visible'), 5000);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setButtonLoading(generateBtn, true);

        const formData = {
            nutriId: nutriId,
            dates: Array.from(selectedDates),
            startTime: form.querySelector('#startTime').value,
            endTime: form.querySelector('#endTime').value,
            slotDuration: form.querySelector('input[name="slotDuration"]:checked').value
        };

        if (formData.dates.length === 0) {
            showMessage('schedule-settings-message', 'Selecione pelo menos um dia no calendário.', false);
            setButtonLoading(generateBtn, false);
            return;
        }

        console.log("Enviando para o backend:", formData);
        await new Promise(resolve => setTimeout(resolve, 1500));

        const success = true;
        if (success) {
            showMessage('schedule-settings-message', 'Agenda gerada com sucesso!', true);
            setTimeout(() => {
                modal.classList.remove('is-visible');
                initializeProfessionalAgenda(nutriId);
            }, 1500);
        } else {
            showMessage('schedule-settings-message', 'Erro ao gerar a agenda. Tente novamente.', false);
        }
        setButtonLoading(generateBtn, false);
    };

    openModalBtn.addEventListener('click', () => {
        calendarDate = new Date();
        selectedDates.clear();
        renderCalendar();
        modal.classList.add('is-visible');
    });

    closeModalBtn.addEventListener('click', () => modal.classList.remove('is-visible'));
    prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
    nextMonthBtn.addEventListener('click', () => navigateMonth(1));
    form.addEventListener('submit', handleFormSubmit);
}


async function initializePatientList(id) {
    const tableBody = document.getElementById('patientTableBody');
    const searchInput = document.getElementById('patientSearchInput');
    const modal = document.getElementById('patientDetailsModal');
    const closeModalBtn = document.getElementById('closePatientModal');
    const emptyState = document.getElementById('emptyState');

    let allPatients = [];

    const renderTable = (patientsToRender) => {
        tableBody.innerHTML = '';
        emptyState.style.display = patientsToRender.length === 0 ? 'block' : 'none';

        patientsToRender.forEach(patient => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                     <img src="https://api.dicebear.com/8.x/bottts/svg?seed=${patient.id}" class="avatar me-3" alt="Avatar">
                    <div>
                        <div class="fw-bold">${patient.nome}</div>
                        <div class="text-muted small">${patient.email}</div>
                    </div>
                </div>
            </td>
            <td>${patient.phone || 'N/A'}</td>
            <td><span class="status-badge status-active">${patient.status || 'Ativo'}</span></td>
            <td>${patient.appointmentDate || 'N/A'}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-light me-1 btn-ver-detalhes" data-patient-id="${patient.id}"><i class="bi bi-eye"></i></button>
                <a href="planeEditor.html?patientId=${patient.id}" class="btn btn-sm btn-light"><i class="bi bi-file-earmark-text"></i></a>
            </td>
        `;
            tableBody.appendChild(tr);
        });
    };

    var getPatientData = async () => {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando pacientes...</td></tr>';
        try {
            const response = await fetch(`/api/auth/patientList`);
            const data = await response.json();
            if (data.success && Array.isArray(data.patients)) {
                allPatients = data.patients;
                renderTable(allPatients);
            } else {
                allPatients = [];
                renderTable([]);
            }
        } catch (error) {
            console.error('Erro ao buscar dados do paciente:', error);
            emptyState.innerHTML = '<p>Erro ao carregar pacientes. Tente novamente mais tarde.</p>';
            emptyState.style.display = 'block';
        }
    };

    var initPatientDetails = async (id) => {
        const loadingState = document.getElementById('modalLoadingState');
        const detailsContent = document.getElementById('modalDetailsContent');
        const planPane = document.getElementById('plan-pane');

        loadingState.style.display = 'block';
        detailsContent.style.display = 'none';
        planPane.innerHTML = '';

        try {
            const [patientResponse, anamneseResponse, mealPlanResponse] = await Promise.all([
                fetch(`/api/auth/patientDetails/${id}`),
                fetch(`/api/auth/anamneseDetails/${id}`),
                fetch(`/api/auth/mealplan/${id}`)
            ]);

            const patientResult = await patientResponse.json();
            const anamneseResult = await anamneseResponse.json();
            const mealPlanResult = await mealPlanResponse.json();

            if (patientResult.success && anamneseResult.success) {
                const patient = patientResult.patients[0];
                const anamnese = anamneseResult.patients[0];

                document.getElementById('modalPatientName').textContent = patient.nome;
                document.getElementById('modalPatientEmail').textContent = patient.email;
                document.getElementById('patientAvatar').src = `https://api.dicebear.com/8.x/bottts/svg?seed=${patient.id}`;
                document.getElementById('patientPhone').textContent = patient.phone || 'Não informado';
                document.getElementById('patientBirthdate').textContent = new Date(anamnese.birthdate).toLocaleDateString('pt-BR');
                document.getElementById('patientAppointmentDate').textContent = patient.appointmentDate || 'Nenhuma';
                document.getElementById('patientStatus').innerHTML = `<span class="status-badge status-active">${patient.status || 'Ativo'}</span>`;
                document.getElementById('anamneseObjetivos').textContent = anamnese.objective;
                document.getElementById('anamneseSaude').textContent = anamnese.health_issue;
                document.getElementById('anamneseCirurgia').textContent = anamnese.surgerie;
                document.getElementById('anamneseAlergias').textContent = anamnese.allergic;
                document.getElementById('anamneseMedicacao').textContent = anamnese.medicine;
                document.getElementById('anamneseAtividade').textContent = anamnese.exercise;
                document.getElementById('anamneseAlcool').textContent = anamnese.alcohol;
                document.getElementById('anamneseDigestao').textContent = anamnese.digestion;
                document.getElementById('anamneseIntestino').textContent = anamnese.intestino;
                document.getElementById('anamneseSono').textContent = anamnese.wake_up_time;
                document.getElementById('anamneseExpectativas').textContent = anamnese.final_question;

                if (mealPlanResult.success && mealPlanResult.plan.length > 0) {
                    planPane.innerHTML = `<div class="p-3"><h6>Plano Atual</h6><p>Aqui seriam exibidos os detalhes do plano alimentar do paciente.</p><a href="planeEditor.html?patientId=${id}" class="btn btn-primary-custom"><i class="bi bi-pencil-square"></i> Editar Plano</a></div>`;
                } else {
                    planPane.innerHTML = `
                    <div class="text-center p-5">
                        <div class="empty-state-icon mx-auto mb-3" style="width: 60px; height: 60px; font-size: 2rem;">
                            <i class="bi bi-file-earmark-plus"></i>
                        </div>
                        <h5 class="empty-state-title">Nenhum plano alimentar por aqui!</h5>
                        <p class="empty-state-text">
                            Parece que ${patient.nome.split(' ')[0]} ainda não tem um plano. Que tal criar um agora para ajudar no seu progresso?
                        </p>
                        <a href="planeEditor.html?patientId=${id}" class="btn btn-primary-custom mt-3">
                            <i class="bi bi-plus-circle-fill me-2"></i>Adicionar Plano Alimentar
                        </a>
                    </div>`;
                }

                loadingState.style.display = 'none';
                detailsContent.style.display = 'block';
            } else {
                loadingState.innerHTML = '<p class="text-danger">Erro ao carregar detalhes.</p>';
            }
        } catch (error) {
            console.error('Erro ao buscar detalhes do paciente:', error);
            loadingState.innerHTML = '<p class="text-danger">Erro de comunicação com o servidor.</p>';
        }
    };


    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPatients = allPatients.filter(p =>
            p.nome.toLowerCase().includes(searchTerm) ||
            p.email.toLowerCase().includes(searchTerm)
        );
        renderTable(filteredPatients);
    });

    tableBody.addEventListener('click', (event) => {
        const btn = event.target.closest('.btn-ver-detalhes');
        if (btn) {
            const patientId = btn.getAttribute('data-patient-id');
            modal.classList.add('is-visible');
            initPatientDetails(patientId);
        }
    });

    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('is-visible');
    });

    getPatientData();
}


function initializeMetricsPage(nutriId) {
    const filterButtons = document.getElementById('time-filter-buttons');
    let chartInstances = {};

    const fetchDataForPeriod = async (days) => {
        try {
            const response = await fetch(`/api/auth/metrics?period=${days}`);
            if (!response.ok) {
                throw new Error('Falha ao buscar dados de métricas');
            }
            return await response.json();
        } catch (error) {
            console.error("Erro ao buscar métricas:", error);
            return {
                data: {
                    kpis: { revenue: 0, patients: 0, retention: 0, avgAppointments: 0 },
                    evolution: { labels: [], revenue: [], patients: [] },
                    appointmentTypes: { labels: [], data: [] },
                    patientGoals: { labels: [], data: [] }
                }
            };
        }
    };

    const updateUI = (data) => {
        document.getElementById('kpi-revenue').textContent = (data.kpis.revenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpi-patients').textContent = data.kpis.patients || 0;
        document.getElementById('kpi-retention').textContent = `${data.kpis.retention || 0}%`;
        document.getElementById('kpi-avg-appointments').textContent = data.kpis.avgAppointments || 0;

        Object.values(chartInstances).forEach(chart => chart.destroy());

        const ctxRevenue = document.getElementById('revenuePatientsChart').getContext('2d');
        chartInstances.revenue = new Chart(ctxRevenue, {
            type: 'bar',
            data: {
                labels: data.evolution.labels,
                datasets: [
                    {
                        label: 'Faturamento',
                        data: data.evolution.revenue,
                        backgroundColor: 'rgba(42, 157, 143, 0.2)',
                        borderColor: 'rgba(42, 157, 143, 1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Novos Pacientes',
                        data: data.evolution.patients,
                        backgroundColor: 'rgba(244, 162, 97, 0.8)',
                        type: 'line',
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Faturamento (R$)' } },
                    y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Pacientes' }, grid: { drawOnChartArea: false } }
                }
            }
        });

        const ctxAppointments = document.getElementById('appointmentsTypeChart').getContext('2d');
        chartInstances.appointments = new Chart(ctxAppointments, {
            type: 'doughnut',
            data: {
                labels: data.appointmentTypes.labels,
                datasets: [{
                    data: data.appointmentTypes.data,
                    backgroundColor: ['#2a9d8f', '#e9c46a', '#f4a261']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const ctxGoals = document.getElementById('patientGoalsChart').getContext('2d');
        chartInstances.goals = new Chart(ctxGoals, {
            type: 'bar',
            data: {
                labels: data.patientGoals.labels,
                datasets: [{
                    label: 'Número de Pacientes',
                    data: data.patientGoals.data,
                    backgroundColor: '#264653',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    };

    const handleFilterClick = async (e) => {
        const button = e.target;
        if (button.tagName !== 'BUTTON' || button.classList.contains('active')) return;

        filterButtons.querySelector('.active').classList.remove('active');
        button.classList.add('active');

        const period = button.dataset.period;
        const response = await fetchDataForPeriod(period);
        updateUI(response.data);
    };

    filterButtons.addEventListener('click', handleFilterClick);

    filterButtons.querySelector('[data-period="30"]').click();
}


function initializeNutriConfigPage(nutriId) {
    const detailsForm = document.getElementById('detailsForm');
    const passwordForm = document.getElementById('passwordForm');
    const saveDetailsBtn = document.getElementById('saveDetailsBtn');
    const savePasswordBtn = document.getElementById('savePasswordBtn');

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    const requirements = {
        length: document.getElementById('length-update'),
        lowercase: document.getElementById('lowercase-update'),
        uppercase: document.getElementById('uppercase-update'),
        special: document.getElementById('special-update'),
        match: document.getElementById('match-update')
    };

    const setButtonLoading = (btn, isLoading) => {
        btn.classList.toggle('is-loading', isLoading);
        btn.disabled = isLoading;
    };

    const showMessage = (containerId, message, isSuccess = true) => {
        const container = document.getElementById(containerId);
        container.textContent = message;
        container.className = `form-message-container ${isSuccess ? 'success' : 'error'} visible`;
        setTimeout(() => container.classList.remove('visible'), 5000);
    };

    const loadNutriData = async () => {
        try {
            const response = await fetch('/api/auth/nutricionista/details');
            const result = await response.json();
            if (result.success) {
                nameInput.value = result.data.name;
                emailInput.value = result.data.email;
                phoneInput.value = result.data.phone;
            } else {
                showMessage('details-message', 'Erro ao carregar seus dados.', false);
            }
        } catch (error) {
            showMessage('details-message', 'Erro de comunicação com o servidor.', false);
        }
    };

    detailsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setButtonLoading(saveDetailsBtn, true);

        const payload = {
            name: nameInput.value,
            email: emailInput.value,
            phone: phoneInput.value
        };

        try {
            const response = await fetch('/api/auth/nutricionista/details', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            showMessage('details-message', result.message, result.success);
        } catch (error) {
            showMessage('details-message', 'Erro de comunicação ao salvar.', false);
        } finally {
            setButtonLoading(saveDetailsBtn, false);
        }
    });

    const validatePassword = () => {
        const value = newPasswordInput.value;
        const confirmationValue = confirmPasswordInput.value;

        const isLengthValid = value.length >= 6;
        const hasLowercase = /[a-z]/.test(value);
        const hasUppercase = /[A-Z]/.test(value);
        const hasSpecial = /[\d\W]/.test(value);
        const doPasswordsMatch = value === confirmationValue && value.length > 0;

        requirements.length.classList.toggle('valid', isLengthValid);
        requirements.lowercase.classList.toggle('valid', hasLowercase);
        requirements.uppercase.classList.toggle('valid', hasUppercase);
        requirements.special.classList.toggle('valid', hasSpecial);
        requirements.match.classList.toggle('valid', doPasswordsMatch);

        return isLengthValid && hasLowercase && hasUppercase && hasSpecial && doPasswordsMatch;
    };

    newPasswordInput.addEventListener('input', validatePassword);
    confirmPasswordInput.addEventListener('input', validatePassword);

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validatePassword()) {
            showMessage('password-message', 'Por favor, cumpra todos os requisitos da nova senha.', false);
            return;
        }

        setButtonLoading(savePasswordBtn, true);

        const payload = {
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: newPasswordInput.value
        };

        try {
            const response = await fetch('/api/auth/nutricionista/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            showMessage('password-message', result.message, result.success);

            if (result.success) {
                passwordForm.reset();
                Object.values(requirements).forEach(req => req.classList.remove('valid'));
            }
        } catch (error) {
            showMessage('password-message', 'Erro de comunicação ao alterar senha.', false);
        } finally {
            setButtonLoading(savePasswordBtn, false);
        }
    });

    loadNutriData();
}


function initializeInvoicingPage(nutriId) {
    const tableBody = document.getElementById('invoicesTableBody');
    const emptyState = document.getElementById('invoicesEmptyState');
    const monthFilter = document.getElementById('monthFilter');
    const statusFilter = document.getElementById('statusFilter');

    const modal = document.getElementById('newInvoiceModal');
    const openModalBtn = document.getElementById('openNewInvoiceModalBtn');
    const closeModalBtn = document.getElementById('closeNewInvoiceModal');
    const newInvoiceForm = document.getElementById('newInvoiceForm');
    const saveInvoiceBtn = document.getElementById('saveInvoiceBtn');
    const addInvoiceItemBtn = document.getElementById('addInvoiceItemBtn');
    const invoiceItemsContainer = document.getElementById('invoiceItemsContainer');
    const invoiceTotalSpan = document.getElementById('invoiceTotal');

    const setButtonLoading = (btn, isLoading) => {
        btn.classList.toggle('is-loading', isLoading);
        btn.disabled = isLoading;
    };

    const showMessage = (containerId, message, isSuccess = true) => {
        const container = document.getElementById(containerId);
        container.textContent = message;
        container.className = `form-message-container ${isSuccess ? 'success' : 'error'} visible`;
        setTimeout(() => container.classList.remove('visible'), 5000);
    };

    const loadInvoices = async () => {
        const month = monthFilter.value;
        const status = statusFilter.value;

        const invoices = [];

        tableBody.innerHTML = '';
        if (invoices.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            invoices.forEach(invoice => {
                const tr = document.createElement('tr');
                tableBody.appendChild(tr);
            });
        }
    };

    const addInvoiceItem = () => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'invoice-item';
        itemDiv.innerHTML = `
            <div class="flex-grow-1">
                <input type="text" class="form-control" placeholder="Descrição do serviço (ex: Consulta de Retorno)" required>
            </div>
            <div style="width: 120px;">
                <input type="number" class="form-control text-end" placeholder="Valor" min="0" step="0.01" required>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger btn-remove-item"><i class="bi bi-trash"></i></button>
        `;
        invoiceItemsContainer.appendChild(itemDiv);
    };

    invoiceItemsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-item')) {
            e.target.closest('.invoice-item').remove();
            updateInvoiceTotal();
        }
    });

    invoiceItemsContainer.addEventListener('input', (e) => {
        if (e.target.type === 'number') {
            updateInvoiceTotal();
        }
    });

    const updateInvoiceTotal = () => {
        let total = 0;
        invoiceItemsContainer.querySelectorAll('.invoice-item input[type="number"]').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        invoiceTotalSpan.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    openModalBtn.addEventListener('click', () => {
        newInvoiceForm.reset();
        invoiceItemsContainer.innerHTML = '';
        addInvoiceItem();
        updateInvoiceTotal();
        modal.classList.add('is-visible');
    });

    closeModalBtn.addEventListener('click', () => modal.classList.remove('is-visible'));
    addInvoiceItemBtn.addEventListener('click', addInvoiceItem);

    newInvoiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setButtonLoading(saveInvoiceBtn, true);

        const items = Array.from(invoiceItemsContainer.querySelectorAll('.invoice-item')).map(item => ({
            description: item.querySelector('input[type="text"]').value,
            amount: parseFloat(item.querySelector('input[type="number"]').value)
        }));

        const payload = {
            patientId: document.getElementById('invoicePatient').value,
            issueDate: document.getElementById('invoiceIssueDate').value,
            dueDate: document.getElementById('invoiceDueDate').value,
            items: items
        };

        console.log("Payload da fatura:", payload);
        await new Promise(resolve => setTimeout(resolve, 1500));

        showMessage('invoice-message', 'Fatura criada com sucesso!', true);

        setTimeout(() => {
            modal.classList.remove('is-visible');
            loadInvoices();
        }, 1500);

        setButtonLoading(saveInvoiceBtn, false);
    });

    monthFilter.addEventListener('change', loadInvoices);
    statusFilter.addEventListener('change', loadInvoices);

    const now = new Date();
    monthFilter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    loadInvoices();
}


async function initializeDashboardPage(nutriId) {
    const userNameSpan = document.getElementById('userName');
    const currentDateSpan = document.getElementById('currentDate');

    currentDateSpan.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    try {
        const response = await fetch('/api/auth/me');
        const result = await response.json();
        if (result.success && userNameSpan) {
            userNameSpan.textContent = result.user.name.split(' ')[0];
        }
    } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
    }

    try {
        const response = await fetch('/api/auth/dashboard-overview');
        const result = await response.json();
        if (result.success) {
            updateDashboardUI(result.data);
        }
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
    }
}

function updateDashboardUI(data) {

    document.getElementById('kpi-today-appointments').textContent = data.kpis.todayAppointments;
    document.getElementById('kpi-active-patients').textContent = data.kpis.activePatients;
    document.getElementById('kpi-monthly-revenue').textContent = data.kpis.monthlyRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('kpi-avg-score').textContent = data.kpis.avgScore ? data.kpis.avgScore.toFixed(1) : 'N/A';

    const appointmentsList = document.getElementById('today-appointments-list');
    const emptyAppointmentsState = document.getElementById('empty-appointments-state');
    appointmentsList.innerHTML = '';

    if (data.todayAppointments.length === 0) {
        emptyAppointmentsState.style.display = 'block';
    } else {
        emptyAppointmentsState.style.display = 'none';
        data.todayAppointments.forEach(apt => {
            const item = document.createElement('li');
            item.className = 'list-group-item appointment-item';
            item.innerHTML = `
                <div class="appointment-item-time">${apt.time}</div>
                <div class="appointment-item-divider type-${apt.type}"></div>
                <div class="appointment-item-details flex-grow-1">
                    <div class="patient-name">${apt.patientName}</div>
                    <div class="appointment-type">${apt.title}</div>
                </div>
                <a href="patientsList.html#${apt.patientId}" class="btn btn-sm btn-light"><i class="bi bi-person-fill"></i></a>
            `;
            appointmentsList.appendChild(item);
        });
    }

    const attentionList = document.getElementById('attention-list');
    const emptyAttentionState = document.getElementById('empty-attention-state');
    attentionList.innerHTML = '';

    if (data.attentionList.length === 0) {
        emptyAttentionState.style.display = 'block';
    } else {
        emptyAttentionState.style.display = 'none';
        data.attentionList.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item attention-item';

            const icons = {
                birthday: 'bi-gift-fill',
                return: 'bi-arrow-repeat'
            };

            li.innerHTML = `
                <div class="attention-icon icon-${item.type}">
                    <i class="bi ${icons[item.type]}"></i>
                </div>
                <div class="attention-details">
                    <div class="attention-text">${item.text}</div>
                    <div class="attention-subtext">${item.subtext}</div>
                </div>
            `;
            attentionList.appendChild(li);
        });
    }
}