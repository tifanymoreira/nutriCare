window.showToast = function(message, type = 'success') {
    let toast = document.getElementById('globalSystemToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalSystemToast';
        toast.className = 'custom-toast';
        toast.innerHTML = `<i class="toast-icon"></i><span class="toast-message"></span>`;
        document.body.appendChild(toast);
    }
    const msgEl = toast.querySelector('.toast-message');
    const iconEl = toast.querySelector('.toast-icon');

    msgEl.textContent = message;
    toast.className = `custom-toast show ${type}`;
    if (type === 'success') {
        iconEl.className = 'bi bi-check-circle-fill toast-icon';
    } else if (type === 'error') {
        iconEl.className = 'bi bi-exclamation-triangle-fill toast-icon';
    } else {
        iconEl.className = 'bi bi-info-circle-fill toast-icon';
    }
    setTimeout(() => toast.classList.remove('show'), 3500);
};

window.showConfirm = function(title, message, confirmText, confirmClass, onConfirm) {
    let modal = document.getElementById('globalConfirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalConfirmModal';
        modal.className = 'modal-backdrop';
        modal.style.zIndex = '1070';
        modal.innerHTML = `
            <div class="modal-content text-center p-4 p-md-5" style="max-width: 420px;">
                <button class="modal-close" onclick="document.getElementById('globalConfirmModal').classList.remove('is-visible')">&times;</button>
                <div class="mb-4 mt-2">
                    <div id="confirmIconContainer" class="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style="width: 80px; height: 80px;">
                        <i id="confirmIcon" style="font-size: 2.5rem;"></i>
                    </div>
                    <h3 class="fw-bold text-dark mb-2" id="confirmTitle"></h3>
                    <p class="text-muted small mb-0" id="confirmMessage"></p>
                </div>
                <div class="d-flex justify-content-center gap-3">
                    <button class="btn btn-light w-50 fw-bold border" onclick="document.getElementById('globalConfirmModal').classList.remove('is-visible')">Cancelar</button>
                    <button id="confirmBtnYes" class="btn w-50 fw-bold shadow-sm"></button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const iconContainer = document.getElementById('confirmIconContainer');
    const icon = document.getElementById('confirmIcon');
    const btnYes = document.getElementById('confirmBtnYes');
    if (confirmClass === 'danger') {
        iconContainer.className = 'd-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 text-danger rounded-circle mb-3';
        icon.className = 'bi bi-exclamation-triangle-fill';
        btnYes.className = 'btn btn-danger w-50 fw-bold shadow-sm';
    } else {
        iconContainer.className = 'd-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle mb-3';
        icon.className = 'bi bi-question-circle-fill';
        btnYes.className = 'btn btn-primary-custom w-50 fw-bold shadow-sm';
    }
    btnYes.textContent = confirmText;
    btnYes.onclick = () => { modal.classList.remove('is-visible'); if (onConfirm) onConfirm(); };
    setTimeout(() => modal.classList.add('is-visible'), 10);
};

document.addEventListener('DOMContentLoaded', async () => {

    const user = await verifySession();
    if (!user) {
        window.location.href = '/pages/login.html';
        return;
    }
    const nutriName = user.name;
    const nutriID = user.id;

    // --- GLOBAL UX: Topbar & Dark Mode Initialization ---
    const toggleBtn = document.getElementById('darkModeToggle');
    const savedTheme = localStorage.getItem('nutriTheme') || 'light';
    if(savedTheme === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); if(toggleBtn) toggleBtn.innerHTML = '<i class="bi bi-sun-fill text-warning"></i>'; }
    if(toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('nutriTheme', newTheme);
            toggleBtn.innerHTML = newTheme === 'dark' ? '<i class="bi bi-sun-fill text-warning"></i>' : '<i class="bi bi-moon-stars-fill text-dark"></i>';
        });
    }
    const topbarName = document.getElementById('topbarNutriName');
    if(topbarName) topbarName.textContent = user.name.split(' ')[0];
    
    const topAvatar = document.getElementById('topbarAvatar');
    if (topAvatar) topAvatar.src = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.name)}`;

    // --- UX: Lógica de Busca Global e Autocomplete ---
    const globalSearchInput = document.getElementById('globalSearchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (globalSearchInput && searchSuggestions) {
        let searchTimeout;
        const systemPages = [
            { name: 'Visão Geral', url: 'dashboard.html', icon: 'bi-grid-1x2-fill' },
            { name: 'Meus Pacientes', url: 'patientsList.html', icon: 'bi-people-fill' },
            { name: 'Minha Agenda', url: 'nutriAgenda.html', icon: 'bi-calendar2-week-fill' },
            { name: 'Minhas Métricas', url: 'nutriMetrics.html', icon: 'bi-graph-up-arrow' },
            { name: 'Configurações', url: 'nutriConfig.html', icon: 'bi-person-fill-gear' },
            { name: 'Faturamento', url: 'nutriInvoicing.html', icon: 'bi-cash-stack' }
        ];

        globalSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            clearTimeout(searchTimeout);
            
            if (term.length < 2) {
                searchSuggestions.classList.remove('show');
                return;
            }

            searchTimeout = setTimeout(async () => {
                let resultsHtml = '';
                
                const matchedPages = systemPages.filter(p => p.name.toLowerCase().includes(term));
                if (matchedPages.length > 0) {
                    resultsHtml += `<div class="px-3 py-2 bg-light border-bottom"><small class="text-muted fw-bold" style="font-size: 0.7rem; text-transform: uppercase;">Páginas do Sistema</small></div>`;
                    matchedPages.forEach(p => {
                        resultsHtml += `<a href="${p.url}" class="dropdown-item d-flex align-items-center gap-2 py-2 search-suggestion-item"><div class="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style="width:30px; height:30px;"><i class="bi ${p.icon}"></i></div> <span class="fw-medium text-dark">${p.name}</span></a>`;
                    });
                }

                try {
                    const response = await fetch(`/api/auth/patientList`);
                    const data = await response.json();
                    if (data.success && data.patients) {
                        const matchedPatients = data.patients.filter(p => p.nome.toLowerCase().includes(term) || p.email.toLowerCase().includes(term)).slice(0, 5);
                        if (matchedPatients.length > 0) {
                            resultsHtml += `<div class="px-3 py-2 bg-light border-bottom"><small class="text-muted fw-bold" style="font-size: 0.7rem; text-transform: uppercase;">Pacientes</small></div>`;
                            matchedPatients.forEach(p => {
                                resultsHtml += `<a href="patientsList.html?q=${encodeURIComponent(p.nome)}" class="dropdown-item d-flex align-items-center gap-2 py-2 search-suggestion-item">
                                    <img src="https://api.dicebear.com/8.x/bottts/svg?seed=${p.id}" width="32" height="32" class="rounded-circle border bg-white shadow-sm">
                                    <div>
                                        <div class="fw-bold text-dark mb-0 lh-sm" style="font-size: 0.85rem;">${p.nome}</div>
                                        <div class="text-muted" style="font-size: 0.75rem;">${p.email}</div>
                                    </div>
                                </a>`;
                            });
                        }
                    }
                } catch (err) { console.error('Erro no autocomplete de pacientes', err); }

                if (resultsHtml === '') {
                    resultsHtml = `<div class="p-4 text-center text-muted small"><i class="bi bi-search d-block fs-4 mb-2 opacity-50"></i>Nenhum resultado para "${term}"</div>`;
                }

                searchSuggestions.innerHTML = resultsHtml;
                searchSuggestions.classList.add('show');
            }, 300);
        });

        globalSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const term = e.target.value.trim();
                if (term) window.location.href = `patientsList.html?q=${encodeURIComponent(term)}`;
            }
        });

        document.addEventListener('click', (e) => {
            if (!globalSearchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
                searchSuggestions.classList.remove('show');
            }
        });
        
        globalSearchInput.addEventListener('focus', () => {
            if (globalSearchInput.value.length >= 2 && searchSuggestions.innerHTML.trim() !== '') {
                searchSuggestions.classList.add('show');
            }
        });
    }

    // --- UX: Notificações Reais ---
    async function loadGlobalNotifications() {
        const badge = document.getElementById('notificationBadge');
        const countBadge = document.getElementById('notificationCountBadge');
        const list = document.getElementById('notificationList');
        if (!list) return;
        try {
            const res = await fetch('/api/auth/nutricionista/notifications');
            const data = await res.json();
            if (data.success) {
                const notifs = data.notifications;
                if (notifs.length > 0) {
                    badge.classList.remove('d-none');
                    countBadge.textContent = `${notifs.length} nova${notifs.length > 1 ? 's' : ''}`;
                    list.innerHTML = notifs.map(n => `<div class="p-3 border-bottom notification-item bg-white" style="cursor:pointer;" onclick="window.location.href='dashboard.html'"><p class="small text-dark fw-bold mb-1"><i class="bi ${n.icon} ${n.color} me-1"></i> ${n.title}</p><p class="small text-muted mb-0">${n.message}</p></div>`).join('');
                } else {
                    badge.classList.add('d-none');
                    countBadge.textContent = '0';
                    list.innerHTML = '<div class="p-4 text-center text-muted small">Nenhuma notificação pendente.</div>';
                }
            }
        } catch(e) { console.error('Erro notificações', e); }
    }
    loadGlobalNotifications();
    setInterval(loadGlobalNotifications, 10000); // Atualiza a cada 10s

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
        initializeProfessionalAgenda(nutriID, nutriName);
        initializeAgendaModals(nutriID);
    } else if (path.endsWith('/nutricionista/nutriMetrics.html')) {
        initializeMetricsPage(nutriID);
    } else if (path.endsWith('/nutricionista/nutriConfig.html')) {
        initializeNutriConfigPage(nutriID);
    } else if (path.endsWith('/nutricionista/nutriInvoicing.html')) {
        initializeInvoicingPage(nutriID);
    }

    initializeSecurityTimeout();

    const logoutButton = document.getElementById('logoutBtn');
    const modal = document.getElementById('logoutModal');
    const buttonYes = document.getElementById('btnYes');
    const buttonNo = document.getElementById('btnNo');
    const closeLogoutModalBtn = document.getElementById('closeLogoutModal');

    if (logoutButton && modal && buttonYes && buttonNo && closeLogoutModalBtn) {
        logoutButton.addEventListener('click', () => modal.classList.add('is-visible'));
        buttonYes.addEventListener('click', async () => await handleLogout());
        buttonNo.addEventListener('click', () => modal.classList.remove('is-visible'));
        closeLogoutModalBtn.addEventListener('click', () => modal.classList.remove('is-visible'));
    }
});

function initializeSecurityTimeout() {
    let timeout;
    const resetTimer = () => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            window.showToast('Sessão encerrada por inatividade para sua segurança e proteção dos dados do paciente.', 'error');
            await handleLogout();
        }, 15 * 60 * 1000); // 15 minutos de tolerância
    };
    
    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimer, true);
    });
    resetTimer();
}

async function verifySession() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.user) return result.user;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function handleLogout() {
    sessionStorage.removeItem('hasAnimated');
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const result = await response.json();
        if (result.success) window.location.href = result.redirectUrl;
    } catch (error) {
        window.location.href = '/pages/login.html';
    }
}

function initializeGenerateLinkModal(nutriId) {
    const modal = document.getElementById('generateLinkModal');
    const openBtn = document.getElementById('openGenerateLinkModal');
    if (!openBtn) return;

    const closeBtn = document.getElementById('closeGenerateLinkModal');
    const copyBtn = document.getElementById('copyLinkBtn');
    const linkSpan = document.getElementById('generatedLink');
    const typeRadios = document.querySelectorAll('input[name="linkType"]');

    const generateUrl = () => {
        const selectedType = document.querySelector('input[name="linkType"]:checked').value;
        const baseUrl = window.location.origin || 'http://localhost:3000';
        return `${baseUrl}/pages/paciente/preSchedule.html?nutriId=${nutriId}&type=${selectedType}`;
    };

    openBtn.addEventListener('click', () => {
        modal.classList.add('is-visible');
        linkSpan.textContent = "Gerando seu link...";
        setTimeout(() => {
            linkSpan.textContent = generateUrl();
        }, 500);
    });

    typeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            linkSpan.textContent = generateUrl();
        });
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('is-visible'));
    copyBtn.addEventListener('click', () => {
        if (linkSpan.textContent.startsWith("http")) {
            navigator.clipboard.writeText(linkSpan.textContent).then(() => {
                copyBtn.innerHTML = '<i class="bi bi-check-lg"></i> Copiado!';
                setTimeout(() => copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copiar Link', 2000);
            });
        }
    });
}

let currentPendingAppointments = [];

async function fetchPendingAppointments() {
    try {
        const response = await fetch('/api/auth/nutricionista/appointments/pending');
        const result = await response.json();
        return result.success ? result.pendingAppointments : [];
    } catch (error) { return []; }
}

async function handleStatusUpdate(appointmentId, status, rejectionType = null, rejectionMessage = null) {
    const modal = document.getElementById('pendingAppointmentDetailsModal');
    if (modal) modal.classList.remove('is-visible');

    const payload = { appointmentId, status };
    if (status === 'Rejeitada') {
        payload.rejectionType = rejectionType;
        payload.rejectionMessage = rejectionMessage;
    }

    try {
        const response = await fetch('/api/auth/nutricionista/appointments/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) await initializePendingAppointments();
    } catch (error) { console.error('Erro ao atualizar status:', error); }
}

function renderPendingAppointments(appointments) {
    currentPendingAppointments = appointments;
    const list = document.getElementById('pending-appointments-list');
    const emptyState = document.getElementById('empty-pending-state');
    const pendingCount = document.getElementById('pendingCount');

    if (!list) return;

    list.innerHTML = '';

    if (!appointments || appointments.length === 0) {
        if(emptyState) emptyState.style.display = 'block';
        if(pendingCount) pendingCount.textContent = '0';
        return;
    }

    if(emptyState) emptyState.style.display = 'none';
    if(pendingCount) pendingCount.textContent = appointments.length;

    appointments.forEach(apt => {
        const dateBR = new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR');
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center p-3 list-pending-item';
        item.dataset.appointmentId = apt.id;
        item.style.cursor = 'pointer';

        item.innerHTML = `
            <div>
                <div class="fw-bold">${apt.patient_name} <span class="badge text-bg-warning">${apt.service_type}</span></div>
                <div class="text-muted small">Dia: ${dateBR} às ${apt.time} (${apt.duration} min)</div>
            </div>
            <div><button type="button" class="btn btn-sm btn-light btn-view-details"><i class="bi bi-eye"></i></button></div>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll('.list-group-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const appointmentData = currentPendingAppointments.find(a => a.id == item.dataset.appointmentId);
            if (appointmentData) openPendingAppointmentDetailsModal(appointmentData);
        });
    });
}

function calculateAge(birthDateString) {
    if (!birthDateString) return '--';
    try {
        const birthDate = new Date(birthDateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    } catch (e) { return '--'; }
}

function openPendingAppointmentDetailsModal(apt) {
    const modal = document.getElementById('pendingAppointmentDetailsModal');
    if (!modal) return;

    document.getElementById('modalPendingService').textContent = apt.service_type;
    document.getElementById('modalPendingDuration').textContent = apt.duration;
    document.getElementById('modalPendingPatientName').textContent = apt.patient_name;
    document.getElementById('modalPendingPatientEmail').textContent = apt.patient_email;
    document.getElementById('modalPendingPatientPhone').textContent = apt.patient_phone;
    document.getElementById('modalPendingPatientAge').textContent = calculateAge(apt.birth_date) + ' anos';
    document.getElementById('modalPendingObjective').textContent = apt.objective || 'Não informado';

    const dateBR = new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR');
    document.getElementById('modalPendingDateTime').textContent = `${dateBR} às ${apt.time}`;

    const btnApprove = document.getElementById('btnApprovePending');
    const btnReject = document.getElementById('btnRejectPending');
    const closeBtn = document.getElementById('closePendingAppointmentModal');

    const newBtnApprove = btnApprove.cloneNode(true);
    const newBtnReject = btnReject.cloneNode(true);
    btnApprove.parentNode.replaceChild(newBtnApprove, btnApprove);
    btnReject.parentNode.replaceChild(newBtnReject, btnReject);

    newBtnApprove.addEventListener('click', () => handleStatusUpdate(apt.id, 'Confirmada'));
    newBtnReject.addEventListener('click', () => {
        modal.classList.remove('is-visible');
        openRejectActionModal(apt.id);
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('is-visible'));
    modal.classList.add('is-visible');
}

function openRejectActionModal(appointmentId) {
    const modal = document.getElementById('rejectActionModal');
    const closeBtn = document.getElementById('closeRejectActionModal');
    const form = document.getElementById('rejectionForm');
    const messageInput = document.getElementById('rejectionMessage');
    const typeReschedule = document.getElementById('typeReschedule');
    const typeCancellation = document.getElementById('typeCancellation');
    const messageContainer = document.getElementById('rejection-message-container');
    const defaultMessage = "Não estarei disponível na clínica nessa data, o horário foi bloqueado em minha agenda. Por favor, reagende para a próxima semana.";
    const backBtn = document.getElementById('backToDetailsBtn');

    backBtn.onclick = () => {
        modal.classList.remove('is-visible');
        const appointmentData = currentPendingAppointments.find(a => a.id == appointmentId);
        if (appointmentData) openPendingAppointmentDetailsModal(appointmentData);
    };

    form.reset();
    messageContainer.classList.remove('visible', 'error', 'success');
    document.getElementById('rejectionAppointmentId').value = appointmentId;

    const handleRadioChange = () => {
        messageContainer.classList.remove('visible', 'error');
        messageInput.disabled = false;
        messageInput.setAttribute('required', 'true');

        if (typeCancellation.checked) {
            messageInput.placeholder = "Justificativa da Nutricionista (Obrigatória)";
            messageInput.value = defaultMessage;
        } else {
            messageInput.placeholder = "Mensagem enviada ao paciente (editável)";
            messageInput.value = 'Horário indisponível. Por favor, reagende a consulta para outro horário disponível.';
        }
    };

    typeReschedule.addEventListener('change', handleRadioChange);
    typeCancellation.addEventListener('change', handleRadioChange);
    typeReschedule.checked = true;
    handleRadioChange();

    form.onsubmit = async (e) => {
        e.preventDefault();
        const rejectionType = document.querySelector('input[name="rejectionType"]:checked').value;
        const rejectionMessage = messageInput.value.trim();

        if (rejectionType === 'cancelamento' && rejectionMessage.length === 0) {
            messageContainer.textContent = "A justificativa é obrigatória para o Cancelamento Total.";
            messageContainer.classList.add('error', 'visible');
            return;
        }
        await handleStatusUpdate(appointmentId, 'Rejeitada', rejectionType, rejectionMessage);
        modal.classList.remove('is-visible');
    };

    closeBtn.onclick = () => modal.classList.remove('is-visible');
    modal.classList.add('is-visible');
}

async function initializePendingAppointments() {
    const pending = await fetchPendingAppointments();
    renderPendingAppointments(pending);
}

async function getAppointmentsForDay(nutriId, dateStr) {
    try {
        const response = await fetch(`/api/auth/nutricionista/appointments?date=${dateStr}`);
        if (response.ok) {
            const result = await response.json();
            return result.success ? result.appointments : [];
        }
        return [];
    } catch (error) { return []; }
}

function openPatientContactModal(apt, date, nutriName, customMessage = "") {
    const modal = document.getElementById('patientContactModal');
    const closeBtn = document.getElementById('closePatientContactModal');
    if(!modal) return;

    document.getElementById('modalPatientName').textContent = apt.patientName;
    document.getElementById('modalAppointmentService').textContent = apt.title;
    document.getElementById('modalAppointmentDateTime').textContent = `${date} às ${apt.time}`;
    document.getElementById('modalPatientPhone').textContent = apt.phone || 'N/A';
    document.getElementById('modalPatientEmail').textContent = apt.email || 'N/A';

    const patientFirstName = apt.patientName.split(' ')[0];
    const nutriFirstName = nutriName.split(' ')[0];
    const phone = apt.phone.replace(/\D/g, '');
    
    let message = '';
    if (customMessage && customMessage.trim() !== "") {
        message = customMessage
            .replace(/{paciente}/g, patientFirstName)
            .replace(/{nutri}/g, nutriFirstName)
            .replace(/{servico}/g, apt.title.toLowerCase())
            .replace(/{data}/g, date)
            .replace(/{hora}/g, apt.time);
    } else {
        message = `Olá, ${patientFirstName}! Eu sou a Dra. ${nutriFirstName} do NutriCare. Vi que temos uma consulta de ${apt.title.toLowerCase()} marcada para o dia ${date} às ${apt.time}. Gostaria de confirmar se está tudo certo ou se precisa de alguma orientação prévia? Estou à disposição!`;
    }

    const wppLink = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    document.getElementById('btnWppContact').href = wppLink;

    modal.classList.add('is-visible');
    closeBtn.onclick = () => modal.classList.remove('is-visible');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('is-visible'); };
}

async function initializeProfessionalAgenda(nutriId, nutriName) {
    const header = document.getElementById('currentDayHeader');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const todayBtn = document.getElementById('todayBtn');
    const datePicker = document.getElementById('datePicker');
    const timelineContainer = document.getElementById('timelineContainer');
    const emptyState = document.getElementById('emptyAgendaState');

    if(!header) return;
    
    let globalWppMessage = "";
    try {
        const res = await fetch('/api/auth/nutricionista/details');
        const data = await res.json();
        if(data.success && data.data.wppMessage) globalWppMessage = data.data.wppMessage;
    } catch(e) { console.error(e); }

    let currentDate = new Date();
    let pollingInterval = null;

    const getDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const workHours = { start: 8, end: 18 };
    const totalMinutes = (workHours.end - workHours.start) * 60;
    const minutesPerPixel = 1;

    const renderDayView = async () => {
        timelineContainer.innerHTML = '';
        updateHeader();
        const dateStr = getDateString(currentDate);
        const readableDate = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

        const appointments = await getAppointmentsForDay(nutriId, dateStr);

        for (let hour = workHours.start; hour <= workHours.end; hour++) {
            const slot = document.createElement('div');
            slot.className = 'timeline-slot';
            slot.style.minHeight = `${60 * minutesPerPixel}px`;
            slot.innerHTML = `<div class="timeline-time">${String(hour).padStart(2, '0')}:00</div><div class="timeline-line"></div>`;
            timelineContainer.appendChild(slot);
        }

        if (appointments.length === 0) {
            timelineContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        timelineContainer.style.display = 'block';
        timelineContainer.style.height = `${totalMinutes * minutesPerPixel + 60}px`;
        emptyState.style.display = 'none';

        appointments.forEach(apt => {
            const aptBlock = document.createElement('div');
            const typeClass = apt.title.toLowerCase().includes('retorno') ? 'type-retorno' :
                (apt.title.toLowerCase().includes('online') ? 'type-online' : 'type-primeira');

            aptBlock.className = `appointment-block-pro ${typeClass}`;
            const [aptHour, aptMinute] = apt.time.split(':').map(Number);
            const topPosition = (((aptHour - workHours.start) * 60) + aptMinute) * minutesPerPixel;
            const duration = apt.duration || 60;

            aptBlock.style.top = `${topPosition}px`;
            aptBlock.style.height = `${duration * minutesPerPixel}px`;

            aptBlock.innerHTML = `
                <div class="appointment-patient-name">${apt.patientName}</div>
                <div class="appointment-details-pro">${apt.title} - ${apt.time} (${duration} min)</div>
            `;

            aptBlock.addEventListener('click', () => openPatientContactModal(apt, readableDate, nutriName, globalWppMessage));
            timelineContainer.appendChild(aptBlock);
        });
    };

    const updateHeader = () => {
        const today = new Date();
        const isToday = currentDate.toDateString() === today.toDateString();
        header.textContent = isToday ? 'Hoje' : currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        datePicker.value = getDateString(currentDate);
    };

    const startOrStopPolling = () => {
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
        const today = new Date();
        if (currentDate.toDateString() === today.toDateString()) {
            pollingInterval = setInterval(renderDayView, 5000);
        }
    }

    prevDayBtn.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 1); renderDayView(); startOrStopPolling(); });
    nextDayBtn.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 1); renderDayView(); startOrStopPolling(); });
    todayBtn.addEventListener('click', () => { currentDate = new Date(); renderDayView(); startOrStopPolling(); });
    datePicker.addEventListener('change', (e) => { currentDate = new Date(e.target.value + 'T00:00:00'); renderDayView(); startOrStopPolling(); });

    renderDayView();
    startOrStopPolling();

    window.addEventListener('beforeunload', () => { if (pollingInterval) clearInterval(pollingInterval); });
}

function initializeAgendaModals(nutriId) {
    const modal = document.getElementById('scheduleSettingsModal');
    const openModalBtn = document.getElementById('openScheduleSettingsModalBtn');
    if (!openModalBtn || !modal) return;

    const closeModalBtn = document.getElementById('closeScheduleSettingsModal');
    const form = document.getElementById('scheduleSettingsForm');
    const generateBtn = document.getElementById('generateScheduleBtn');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const monthDisplay = document.getElementById('monthDisplay');
    const calendarGrid = document.getElementById('calendarProGrid');

    let calendarDate = new Date();
    let selectedDates = new Set();

    const loadSelectedDates = async () => {
        try {
            const response = await fetch('/api/auth/nutricionista/details');
            const result = await response.json();
            if (result.success && result.data.availableDays) {
                selectedDates = new Set(result.data.availableDays);
                renderCalendar();
            }
        } catch (error) { console.error("Erro ao carregar datas salvas:", error); }
    }

    const renderCalendar = () => {
        calendarGrid.innerHTML = '';
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        let startDayOfWeek = firstDayOfMonth.getDay();

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
            if (selectedDates.has(dateStr)) dayDiv.classList.add('selected');
            calendarGrid.appendChild(dayDiv);
        }
    };

    calendarGrid.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('calendar-pro-day') && !target.classList.contains('other-month')) {
            const date = target.dataset.date;
            if (selectedDates.has(date)) { selectedDates.delete(date); target.classList.remove('selected'); }
            else { selectedDates.add(date); target.classList.add('selected'); }
        }
    });

    const navigateMonth = (direction) => { calendarDate.setMonth(calendarDate.getMonth() + direction); renderCalendar(); };

    const setButtonLoading = (btn, isLoading) => {
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-container');
        if (isLoading) { btnText.style.display = 'none'; spinner.style.display = 'inline-block'; }
        else { btnText.style.display = 'inline-block'; spinner.style.display = 'none'; }
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
            dates: Array.from(selectedDates),
            startTime: form.querySelector('#startTime').value,
            endTime: form.querySelector('#endTime').value,
            slotDuration: form.querySelector('input[name="slotDuration"]:checked').value
        };

        if (formData.dates.length === 0) {
            showMessage('schedule-settings-message', 'Selecione pelo menos um dia no calendário.', false);
            setButtonLoading(generateBtn, false); return;
        }

        try {
            const response = await fetch('/api/auth/nutricionista/generateAgenda', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (result.success) {
                showMessage('schedule-settings-message', result.message, true);
                setTimeout(() => { modal.classList.remove('is-visible'); initializeProfessionalAgenda(nutriId); }, 1500);
            } else { showMessage('schedule-settings-message', result.message, false); }
        } catch (error) { showMessage('schedule-settings-message', 'Erro de comunicação ao gerar a agenda.', false); }
        finally { setButtonLoading(generateBtn, false); }
    };

    openModalBtn.addEventListener('click', () => { calendarDate = new Date(); selectedDates.clear(); loadSelectedDates(); modal.classList.add('is-visible'); });
    closeModalBtn.addEventListener('click', () => modal.classList.remove('is-visible'));
    prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
    nextMonthBtn.addEventListener('click', () => navigateMonth(1));
    form.addEventListener('submit', handleFormSubmit);

    setButtonLoading(generateBtn, false);
}
  

let globalPatientData = null;
let globalAnamneseData = null;
let patientCharts = { evolution: null, radar: null };
const premiumColors = { primary: '#2a9d8f', secondary: '#f4a261', info: '#0dcaf0', danger: '#e76f51', dark: '#264653', lightGray: '#e9ecef' };

async function initializePatientList(nutriId) {
    const tableBody = document.getElementById('patientTableBody');
    const tableElement = document.getElementById('patientTable');
    const searchInput = document.getElementById('patientSearchInput');
    const modal = document.getElementById('patientDetailsModal');
    const closeModalBtn = document.getElementById('closePatientModal');
    const emptyState = document.getElementById('emptyState');

    if(!tableBody) return;

    // --- EXAMS UPLOAD SIMULATION ---
    const fileUploadExame = document.getElementById('fileUploadExame');
    if (fileUploadExame) {
        fileUploadExame.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const emptyState = document.getElementById('empty-exams');
                if (emptyState) emptyState.style.display = 'none';
                const container = document.getElementById('exams-list-container');
                const file = e.target.files[0];
                const date = new Date().toLocaleDateString('pt-BR');
                container.innerHTML += `
                    <div class="col-md-6 col-lg-4">
                        <div class="p-3 bg-white border rounded-4 shadow-sm d-flex align-items-center gap-3" style="animation: fadeIn 0.4s ease-out;">
                            <div class="bg-danger bg-opacity-10 text-danger p-3 rounded-circle"><i class="bi bi-file-earmark-pdf-fill fs-4"></i></div>
                            <div class="flex-grow-1 overflow-hidden"><h6 class="fw-bold text-dark mb-1 text-truncate">${file.name}</h6><p class="text-muted small mb-0">Enviado: ${date}</p></div>
                            <button class="btn btn-light text-primary border rounded-circle"><i class="bi bi-download"></i></button>
                        </div>
                    </div>`;
            }
        });
    }

    let allPatients = [];
    let currentPatientId = null;
    let filteredPatients = [];
    let currentPage = 1;
    const itemsPerPage = 5;

    const openAnthropometryModal = (patientId) => {
        const anthroModal = document.getElementById('anthropometryModal');
        document.getElementById('anthro_patient_id').value = patientId;
        document.getElementById('anthropometryForm').reset();
        document.getElementById('anthroResultsBox').style.display = 'none';
        if (modal.classList.contains('is-visible')) { modal.style.zIndex = "1040"; }
        anthroModal.classList.add('is-visible');
    };

    const closeAnthroModalBtn = document.getElementById('closeAnthropometryModal');
    if (closeAnthroModalBtn) {
        closeAnthroModalBtn.addEventListener('click', () => {
            document.getElementById('anthropometryModal').classList.remove('is-visible');
            modal.style.zIndex = "1045";
        });
    }

    const anthroForm = document.getElementById('anthropometryForm');
    if (anthroForm) {
        anthroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btnSubmitAnthro');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
            submitBtn.disabled = true;

            const payload = {
                patient_id: document.getElementById('anthro_patient_id').value,
                age: document.getElementById('anthro_age').value, gender: document.getElementById('anthro_gender').value,
                activity_level: document.getElementById('anthro_activity_level').value, weight: document.getElementById('anthro_weight').value, height: document.getElementById('anthro_height').value,
                fold_chest: document.getElementById('anthro_fold_chest').value, fold_midaxillary: document.getElementById('anthro_fold_midaxillary').value, fold_triceps: document.getElementById('anthro_fold_triceps').value,
                fold_subscapular: document.getElementById('anthro_fold_subscapular').value, fold_abdominal: document.getElementById('anthro_fold_abdominal').value, fold_suprailiac: document.getElementById('anthro_fold_suprailiac').value,
                fold_thigh: document.getElementById('anthro_fold_thigh').value
            };

            try {
                const response = await fetch('/api/anthropometry/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await response.json();

                if (response.ok) {
                    const resultsBox = document.getElementById('anthroResultsBox');
                    resultsBox.style.display = 'block';
                    document.getElementById('res_bmi').textContent = data.results.bmi; document.getElementById('res_bf').textContent = data.results.bodyFat;
                    document.getElementById('res_lm').textContent = data.results.leanMass; document.getElementById('res_bmr').textContent = data.results.bmr; document.getElementById('res_tdee').textContent = data.results.tdee;
                    const modalContent = document.querySelector('#anthropometryModal .modal-content');
                    modalContent.scrollTo({ top: modalContent.scrollHeight, behavior: 'smooth' });
                    
                    if(currentPatientId) await initializePatientAnalytics(currentPatientId, globalAnamneseData);

                } else { alert('Erro ao processar: ' + data.error); }
            } catch (error) { alert('Falha de comunicação com o servidor de cálculos.'); }
            finally { submitBtn.innerHTML = originalText; submitBtn.disabled = false; }
        });
    }

    const renderTable = () => {
        tableBody.innerHTML = '';
        
        if(filteredPatients.length === 0) {
            tableElement.style.display = 'none';
            emptyState.style.display = 'block';
            const pagCont = document.getElementById('paginationContainer');
            if(pagCont) pagCont.style.setProperty('display', 'none', 'important');
            return;
        }
        
        tableElement.style.display = 'table';
        emptyState.style.display = 'none';
        const pagCont = document.getElementById('paginationContainer');
        if(pagCont) pagCont.style.setProperty('display', 'flex', 'important');
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

        paginatedPatients.forEach((patient, index) => {
            const tr = document.createElement('tr');
            tr.style.animation = `fadeIn 0.3s ease-out ${index * 0.05}s both`;

            const statusClass = (patient.status === 'Inativo' || patient.status === 'Cancelado') ? 'bg-secondary text-secondary' : 'bg-success text-success border-success';
            
            tr.innerHTML = `
                <td class="ps-4 py-3">
                    <div class="d-flex align-items-center gap-3">
                        <img src="https://api.dicebear.com/8.x/bottts/svg?seed=${patient.id}" class="rounded-circle shadow-sm border border-2 border-white" width="48" height="48" alt="Avatar">
                        <div>
                            <div class="fw-bold text-dark mb-1">${patient.nome}</div>
                            <div class="text-muted small"><i class="bi bi-envelope me-1"></i>${patient.email}</div>
                        </div>
                    </div>
                </td>
                <td class="py-3">
                    <div class="text-dark fw-medium small"><i class="bi bi-telephone text-primary me-1 opacity-75"></i>${patient.phone || 'N/A'}</div>
                </td>
                <td class="py-3">
                    <span class="badge ${statusClass} bg-opacity-10 border border-opacity-25 rounded-pill px-3 py-2"><i class="bi bi-circle-fill me-1" style="font-size: 0.4rem; vertical-align: middle;"></i> ${patient.status || 'Ativo'}</span>
                </td>
                <td class="py-3">
                    <div class="text-primary fw-bold small bg-primary bg-opacity-10 d-inline-block px-3 py-2 rounded-3"><i class="bi bi-calendar-event me-1"></i>${patient.appointmentDate || 'Não agendada'}</div>
                </td>
                <td class="text-end pe-4 py-3">
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn btn-sm btn-light text-primary border shadow-sm btn-ver-detalhes fw-semibold" data-patient-id="${patient.id}"><i class="bi bi-journal-medical me-1"></i> Prontuário</button>
                        <button class="btn btn-sm btn-light text-info border shadow-sm btn-open-anthro px-2" data-patient-id="${patient.id}" data-bs-toggle="tooltip" title="Calculadora Científica"><i class="bi bi-calculator"></i></button>
                        <a href="planeEditor.html?patientId=${patient.id}" class="btn btn-sm btn-light text-success border shadow-sm px-2" data-bs-toggle="tooltip" title="Editor de Dieta"><i class="bi bi-apple"></i></a>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        
        renderPaginationControls();

        const tooltipTriggerList = [].slice.call(tableBody.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    };

    const renderPaginationControls = () => {
        const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
        const paginationList = document.getElementById('paginationList');
        const paginationInfo = document.getElementById('paginationInfo');
        
        if (!paginationList || !paginationInfo) return;
        
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(startIndex + itemsPerPage - 1, filteredPatients.length);
        paginationInfo.textContent = `Mostrando ${startIndex} a ${endIndex} de ${filteredPatients.length} pacientes`;

        let html = '';
        html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage - 1}"><i class="bi bi-chevron-left"></i></a></li>`;
        
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${currentPage === i ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
        
        html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage + 1}"><i class="bi bi-chevron-right"></i></a></li>`;
        
        paginationList.innerHTML = html;
        
        paginationList.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.getAttribute('data-page'));
                if (page >= 1 && page <= totalPages) {
                    currentPage = page;
                    renderTable();
                }
            });
        });
    };

    const getPatientData = async () => {
        tableElement.style.display = 'table';
        emptyState.style.display = 'none';
        const pagCont = document.getElementById('paginationContainer');
        if(pagCont) pagCont.style.setProperty('display', 'none', 'important');
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="text-muted mt-3 mb-0">Carregando lista de pacientes...</p></td></tr>';
        try {
            const response = await fetch(`/api/auth/patientList`);
            const data = await response.json();
            if (data.success && Array.isArray(data.patients)) { 
                allPatients = data.patients; 
                
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                allPatients.sort((a, b) => {
                    const dateA = a.lastUpdateDate ? new Date(a.lastUpdateDate) : new Date(0);
                    const dateB = b.lastUpdateDate ? new Date(b.lastUpdateDate) : new Date(0);
                    
                    const aRecent = a.status === 'Ativo' && dateA >= thirtyDaysAgo;
                    const bRecent = b.status === 'Ativo' && dateB >= thirtyDaysAgo;

                    // Prioridade para ativos + com retorno nos ultimos 30 dias
                    if (aRecent && !bRecent) return -1;
                    if (!aRecent && bRecent) return 1;
                    
                    // Desempate: quem atualizou há menos tempo fica por cima
                    return dateB - dateA;
                });

                filteredPatients = [...allPatients];
                currentPage = 1;
                renderTable(); 
            } else { 
                allPatients = []; 
                filteredPatients = [];
                renderTable(); 
            }
        } catch (error) { emptyState.style.display = 'block'; tableBody.innerHTML = ''; }
        
        // UX: Filtro de paciente se vindo da Busca Global
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query && searchInput) {
            searchInput.value = query;
            setTimeout(() => { searchInput.dispatchEvent(new Event('input')); }, 300);
        }
    };

    const initPatientDetails = async (patientId) => {
        currentPatientId = patientId;
        const loadingState = document.getElementById('modalLoadingState');
        const detailsContent = document.getElementById('modalDetailsContent');
        const planPane = document.getElementById('plan-pane');

        loadingState.style.display = 'block'; detailsContent.style.display = 'none';
        const followupTab = new bootstrap.Tab(document.getElementById('followup-tab')); followupTab.show();

        try {
            const [patientRes, anamneseRes, mealPlanRes, consultationRes] = await Promise.all([
                fetch(`/api/auth/patientDetails/${patientId}`), 
                fetch(`/api/auth/anamneseDetails/${patientId}`),
                fetch(`/api/auth/mealplan/${patientId}`), 
                fetch(`/api/auth/consultations/${patientId}`)
            ]);

            const pResult = await patientRes.json(); 
            const aResult = await anamneseRes.json();
            const mResult = await mealPlanRes.json(); 
            const cResult = await consultationRes.json();
            
            await initializePatientAnalytics(patientId, aResult.patients[0]);

            if (pResult.success && aResult.success && cResult.success) {
                globalPatientData = pResult.patients[0]; 
                globalAnamneseData = aResult.patients[0];
                const age = calculateAge(globalAnamneseData.birthdate);

                document.getElementById('modalPatientName').textContent = globalPatientData.nome;
                document.getElementById('modalPatientEmail').textContent = globalPatientData.email;
                document.getElementById('patientAvatar').src = `https://api.dicebear.com/8.x/bottts/svg?seed=${globalPatientData.id}`;
                document.getElementById('patientPhone').textContent = globalPatientData.phone || 'Não informado';
                document.getElementById('patientBirthdate').textContent = globalAnamneseData.birthdate ? new Date(globalAnamneseData.birthdate).toLocaleDateString('pt-BR') : 'N/A';
                document.getElementById('patientAge').textContent = age;
                // document.getElementById('patientAppointmentDate').textContent = globalPatientData.appointmentDate || 'Sem retorno marcado';
                document.getElementById('patientStatusBadge').innerHTML = `<span class="badge bg-success bg-opacity-10 text-success border border-success px-3 py-2 rounded-pill">${globalPatientData.status || 'Ativo'}</span>`;

                const val = (v) => v ? v : '<span class="text-muted fw-normal fst-italic">Não preenchido</span>';
                document.getElementById('anamneseObjetivos').innerHTML = val(globalAnamneseData.objective);
                document.getElementById('anamneseSaude').innerHTML = val(globalAnamneseData.health_issue);
                document.getElementById('anamneseCirurgia').innerHTML = val(globalAnamneseData.surgerie);
                document.getElementById('anamneseAlergias').innerHTML = val(globalAnamneseData.allergic);
                document.getElementById('anamneseMedicacao').innerHTML = val(globalAnamneseData.medicine);
                document.getElementById('anamneseAtividade').innerHTML = val(globalAnamneseData.exercise);
                document.getElementById('anamneseAlcool').innerHTML = val(globalAnamneseData.alcohol);
                document.getElementById('anamneseDigestao').innerHTML = val(globalAnamneseData.digestion);
                document.getElementById('anamneseIntestino').innerHTML = val(globalAnamneseData.intestino);
                document.getElementById('anamneseSono').innerHTML = val(globalAnamneseData.wake_up_time);
                document.getElementById('anamneseExpectativas').innerHTML = val(globalAnamneseData.final_question);

                if (mResult.success && mResult.plan && mResult.plan.meals.length > 0) {
                    planPane.innerHTML = `<div class="text-center p-5 bg-white rounded-4 shadow-sm border"><div class="display-1 text-success mb-3"><i class="bi bi-file-earmark-check"></i></div><h4 class="fw-bold">Plano Ativo</h4><p class="text-muted mb-4">O paciente já possui uma dieta estruturada.</p><a href="planeEditor.html?patientId=${patientId}" class="btn btn-success btn-lg px-5 rounded-pill shadow-sm"><i class="bi bi-pencil-square me-2"></i> Abrir Editor de Dieta</a></div>`;
                } else {
                    planPane.innerHTML = `<div class="text-center p-5 bg-white rounded-4 shadow-sm border"><div class="display-1 text-secondary opacity-50 mb-3"><i class="bi bi-file-earmark-x"></i></div><h4 class="fw-bold">Nenhum plano alimentar</h4><p class="text-muted mb-4">Crie a primeira prescrição dietética para impulsionar os resultados.</p><a href="planeEditor.html?patientId=${patientId}" class="btn btn-primary btn-lg px-5 rounded-pill shadow-sm"><i class="bi bi-plus-lg me-2"></i> Prescrever Dieta</a></div>`;
                }

                const allAppts = [...(cResult.pendingAppointments || []).map(p => ({ ...p, isHistory: false })), ...(cResult.history || []).map(h => ({ ...h, appointment_date: h.consultation_date, isHistory: true }))];
                allAppts.sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));

                renderConsultationTimeline(allAppts, patientId);
                renderRecordsTab(cResult.history || []);

                if (allAppts.length > 0) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const apptDateStr = new Date(allAppts[0].appointment_date || allAppts[0].consultation_date).toISOString().split('T')[0];
                    
                    if (apptDateStr === todayStr) {
                        renderConsultationForm(allAppts[0], patientId, false);
                    } else {
                        renderReadOnlyConsultation(allAppts[0]);
                    }
                } else {
                    document.getElementById('consultation-form-container').innerHTML = '<div class="text-center py-5"><i class="bi bi-clipboard-x display-4 text-muted opacity-25"></i><p class="text-muted mt-3 fw-medium">Nenhum histórico de consulta.</p></div>';
                }

                loadingState.style.display = 'none'; detailsContent.style.display = 'block';
                
                // Lógica de Inteligência Artificial de Exames
                const btnAnalyzeExamAI = document.getElementById('btnAnalyzeExamAI');
                if (btnAnalyzeExamAI) {
                    const newBtn = btnAnalyzeExamAI.cloneNode(true);
                    btnAnalyzeExamAI.parentNode.replaceChild(newBtn, btnAnalyzeExamAI);
                    
                    document.getElementById('aiExamSummaryInput').value = '';
                    document.getElementById('aiExamResultContainer').style.display = 'none';

                    newBtn.addEventListener('click', async () => {
                        const summaryText = document.getElementById('aiExamSummaryInput').value.trim();
                        if (!summaryText) { showToast("Insira o resumo ou os dados do exame.", "error"); return; }

                        const resultContainer = document.getElementById('aiExamResultContainer');
                        const resultText = document.getElementById('aiExamInsightText');

                        newBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Analisando...';
                        newBtn.disabled = true;
                        resultContainer.style.display = 'none';

                        const patientHistory = {
                            objective: globalAnamneseData?.objective || 'Não informado',
                            health_issues: globalAnamneseData?.health_issue || 'Nenhum problema',
                            age: calculateAge(globalAnamneseData?.birthdate)
                        };

                        try {
                            const resAI = await fetch('/api/auth/exam-insight', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ examSummary: summaryText, patientHistory })
                            });
                            const dataAI = await resAI.json();
                            if (dataAI.success) {
                                resultText.innerHTML = dataAI.insight.replace(/\n/g, '<br>');
                                resultContainer.style.display = 'block';
                            } else { showToast("Erro na IA: " + dataAI.message, "error"); }
                        } catch (err) { showToast("Falha de conexão com a IA.", "error"); }
                        finally { newBtn.innerHTML = '<i class="bi bi-magic me-2"></i> Analisar com Gemini AI'; newBtn.disabled = false; }
                    });
                }
            }
        } catch (error) { loadingState.innerHTML = '<p class="text-danger fw-bold text-center mt-4"><i class="bi bi-exclamation-triangle"></i> Erro ao carregar prontuário.</p>'; }
    };

    const renderConsultationTimeline = (allItems, patientId) => {
        const timelineContainer = document.getElementById('consultation-history-timeline');
        timelineContainer.innerHTML = '';

        if (allItems.length === 0) {
            timelineContainer.innerHTML = '<p class="text-muted small">Nenhum registro.</p>'; return;
        }

        allItems.forEach(item => {
            const itemDiv = document.createElement('div');
            const dateStr = new Date(item.appointment_date || item.consultation_date).toLocaleDateString('pt-BR');
            const statusColor = item.isHistory ? '#adb5bd' : '#2a9d8f';
            const todayStr = new Date().toISOString().split('T')[0];
            const itemDateStr = new Date(item.appointment_date || item.consultation_date).toISOString().split('T')[0];
            const isToday = todayStr === itemDateStr;

            itemDiv.className = `timeline-modern-item`;
            itemDiv.innerHTML = `
                <span class="date-badge">${dateStr} ${isToday ? '<span class="text-primary">(Hoje)</span>' : ''}</span>
                <p class="service-title"><span class="status-dot" style="background:${statusColor};"></span>${item.service_type || 'Acompanhamento'}</p>
            `;
            timelineContainer.appendChild(itemDiv);

            itemDiv.addEventListener('click', () => {
                document.querySelectorAll('.timeline-modern-item.active').forEach(el => el.classList.remove('active'));
                itemDiv.classList.add('active');
                
                if (isToday) {
                    renderConsultationForm(item, patientId, false); 
                } else {
                    renderReadOnlyConsultation(item);               
                }
            });
        });
        timelineContainer.firstChild.classList.add('active');
    };

    const renderReadOnlyConsultation = (appointment) => {
        const container = document.getElementById('consultation-form-container');
        const dateStr = new Date(appointment.appointment_date || appointment.consultation_date).toLocaleDateString('pt-BR');
        
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-secondary border-opacity-25">
                <div>
                    <h4 class="mb-0 fw-bold text-dark"><i class="bi bi-journal-check text-secondary me-2"></i>Prontuário Arquivado</h4>
                    <p class="text-secondary small mb-0 mt-2 bg-secondary bg-opacity-10 d-inline-block px-3 py-2 rounded">
                        <i class="bi bi-info-circle-fill text-secondary me-1"></i>
                        Consulta do dia <strong>${dateStr}</strong>. Este é um registro histórico consolidado e está oculto para edições.
                    </p>
                </div>
                <span class="badge bg-light text-secondary border px-3 py-2 rounded-pill shadow-sm"><i class="bi bi-lock-fill me-1"></i> Somente Leitura</span>
            </div>
            
            <div class="read-only-box border-start border-4 border-primary bg-light bg-opacity-50">
                <h6 class="fw-bold text-primary mb-2 text-uppercase small">Subjetivo (Relatos)</h6>
                <p class="mb-0 text-dark">${appointment.subjective_notes || '<span class="text-muted fst-italic">Nenhuma anotação subjetiva registrada na época.</span>'}</p>
            </div>
            <div class="read-only-box border-start border-4 border-info bg-light bg-opacity-50 mt-3">
                <h6 class="fw-bold text-info mb-2 text-uppercase small">Objetivo (Medidas)</h6>
                <div class="d-flex gap-3 mb-3 small fw-bold text-dark border-bottom pb-2">
                    <span class="bg-white border px-2 py-1 rounded shadow-sm">Peso: ${appointment.weight || '--'}kg</span>
                    <span class="bg-white border px-2 py-1 rounded shadow-sm">Altura: ${appointment.height || '--'}cm</span>
                    <span class="bg-white border px-2 py-1 rounded shadow-sm">Gordura: ${appointment.body_fat_percentage || '--'}%</span>
                </div>
                <p class="mb-0 text-dark">${appointment.objective_notes || '<span class="text-muted fst-italic">Sem anotações complementares.</span>'}</p>
            </div>
            <div class="read-only-box border-start border-4 border-warning bg-light bg-opacity-50 mt-3">
                <h6 class="fw-bold text-warning mb-2 text-uppercase small">Avaliação (Diagnóstico)</h6>
                <p class="mb-0 text-dark">${appointment.assessment_notes || '<span class="text-muted fst-italic">Nenhuma avaliação clínica registrada.</span>'}</p>
            </div>
            <div class="read-only-box border-start border-4 border-success bg-light bg-opacity-50 mt-3">
                <h6 class="fw-bold text-success mb-2 text-uppercase small">Plano (Conduta)</h6>
                <p class="mb-0 text-dark">${appointment.plan_notes || '<span class="text-muted fst-italic">Nenhuma conduta ou plano registrado.</span>'}</p>
            </div>
        `;
    };

    const renderConsultationForm = (appointment, patientId, isHistory) => {
        const formContainer = document.getElementById('consultation-form-container');
        const dateStr = new Date().toLocaleDateString('pt-BR');

        formContainer.innerHTML = `
            <form id="consultationForm" data-appointment-id="${appointment.id}" data-patient-id="${patientId}">
                <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-primary border-opacity-25">
                    <div>
                        <h4 class="mb-0 fw-bold text-dark"><i class="bi bi-pencil-square text-primary me-2"></i>Anotações da Consulta</h4>
                        <p class="text-primary small mb-0 mt-2 bg-primary bg-opacity-10 d-inline-block px-3 py-2 rounded">
                            <i class="bi bi-calendar-check-fill text-primary me-1"></i>
                            <strong>Consulta de Hoje (${dateStr}):</strong> Os campos abaixo estão livres para edição. Não se esqueça de salvar ao finalizar.
                        </p>
                    </div>
                    <span class="badge bg-primary px-3 py-2 rounded-pill shadow-sm"><i class="bi bi-unlock-fill me-1"></i> Editando</span>
                </div>

                <div class="d-flex justify-content-between align-items-center mb-4 bg-light p-3 rounded-3 border border-secondary border-opacity-25 shadow-sm">
                    <div>
                        <strong class="text-dark d-block mb-1"><i class="bi bi-calculator-fill text-info me-1"></i> Calculadora Científica Rápida</strong>
                        <span class="small text-muted">Acesse a calculadora de Pollock (7 dobras) sem sair da tela de edição.</span>
                    </div>
                    <button type="button" class="btn btn-outline-info btn-sm px-3 rounded-pill fw-bold shadow-sm btn-open-anthro-banner" data-patient-id="${patientId}">Abrir Calculadora</button>
                </div>

                <div class="soap-section bg-white border border-light shadow-sm">
                    <div class="soap-section-title"><i class="bi bi-person-lines-fill text-primary"></i> Subjetivo (Ouvir)</div>
                    <textarea class="form-control form-control-soap" id="subjective_notes" rows="3" placeholder="Quais são as queixas do paciente hoje? Relato sobre sono, fome, saciedade...">${appointment.subjective_notes || ''}</textarea>
                </div>

                <div class="soap-section bg-white border border-light shadow-sm">
                    <div class="soap-section-title"><i class="bi bi-clipboard2-data-fill text-primary"></i> Objetivo (Medir)</div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-4"><label class="form-label small fw-bold text-muted">Peso Atual (kg)</label><input type="number" step="0.1" class="form-control form-control-soap" id="consultationWeight" value="${appointment.weight || ''}"></div>
                        <div class="col-md-4"><label class="form-label small fw-bold text-muted">Altura (cm)</label><input type="number" class="form-control form-control-soap" id="consultationHeight" value="${appointment.height || ''}"></div>
                        <div class="col-md-4"><label class="form-label small fw-bold text-muted">% Gordura Corporal</label><input type="number" step="0.1" class="form-control form-control-soap" id="bodyFat" value="${appointment.body_fat_percentage || ''}"></div>
                    </div>
                    <textarea class="form-control form-control-soap" id="objective_notes" rows="2" placeholder="Exames laboratoriais entregues, observações físicas gerais...">${appointment.objective_notes || ''}</textarea>
                </div>

                <div class="soap-section bg-white border border-light shadow-sm">
                    <div class="soap-section-title"><i class="bi bi-diagram-3-fill text-primary"></i> Avaliação (Diagnóstico)</div>
                    <textarea class="form-control form-control-soap" id="assessment_notes" rows="2" placeholder="Diagnóstico e avaliação do estado nutricional atual...">${appointment.assessment_notes || ''}</textarea>
                </div>

                <div class="soap-section bg-white border border-light shadow-sm">
                    <div class="soap-section-title"><i class="bi bi-map-fill text-primary"></i> Plano (Conduta)</div>
                    <textarea class="form-control form-control-soap" id="plan_notes" rows="2" placeholder="O que será feito? Ajustes na dieta, nova prescrição de suplementos, etc...">${appointment.plan_notes || ''}</textarea>
                </div>
                
                <div id="consultation-message" class="form-message-container mb-3 mt-3"></div>
                <div class="d-flex justify-content-end mt-4"><button type="submit" class="btn btn-primary btn-lg px-5 rounded-pill shadow-lg fw-bold"><i class="bi bi-lock-fill me-2"></i> Assinar e Salvar Prontuário</button></div>
            </form>
        `;

        formContainer.querySelector('#consultationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';
            btn.disabled = true;

            const payload = {
                appointmentId: appointment.id,
                patientId: patientId,
                subjectiveNotes: document.getElementById('subjective_notes').value,
                objectiveNotes: document.getElementById('objective_notes').value,
                assessmentNotes: document.getElementById('assessment_notes').value,
                planNotes: document.getElementById('plan_notes').value,
                weight: document.getElementById('consultationWeight').value,
                height: document.getElementById('consultationHeight').value,
                bodyFat: document.getElementById('bodyFat').value
            };

            try {
                const response = await fetch('/api/auth/nutricionista/appointment/save-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                const msg = document.getElementById('consultation-message');
                
                if (result.success) {
                    msg.textContent = "Prontuário salvo e assinado digitalmente com sucesso!";
                    msg.className = `form-message-container success visible`;
                } else {
                    msg.textContent = "Erro ao salvar prontuário.";
                    msg.className = `form-message-container error visible`;
                }

                setTimeout(() => msg.classList.remove('visible'), 4000);
            } catch (error) {
                console.error("Erro ao salvar prontuário", error);
            } finally {
                btn.innerHTML = '<i class="bi bi-lock-fill me-2"></i> Assinar e Salvar Prontuário'; 
                btn.disabled = false;
            }
        });
    };

    const renderRecordsTab = (history) => {
        const container = document.getElementById('records-container');
        if (!history || history.length === 0) {
            container.innerHTML = '<div class="col-12"><div class="text-center py-5"><i class="bi bi-folder-x display-4 text-muted opacity-25"></i><p class="text-muted mt-3">Nenhum histórico consolidado para exportação.</p></div></div>';
            return;
        }

        container.innerHTML = history.map(item => `
            <div class="col-md-6 col-lg-4">
                <div class="file-card p-4 border rounded-4 bg-white shadow-sm h-100 d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="bg-primary bg-opacity-10 text-primary p-2 rounded-3"><i class="bi bi-file-earmark-medical fs-4"></i></div>
                        <span class="badge bg-light text-secondary border">${item.service_type || 'Consulta'}</span>
                    </div>
                    <h5 class="fw-bold text-dark mb-1">${new Date(item.consultation_date).toLocaleDateString('pt-BR')}</h5>
                    <p class="small text-muted flex-grow-1">Prontuário completo contendo SOAP e métricas do paciente.</p>
                    <button class="btn btn-outline-primary w-100 fw-bold rounded-pill export-pdf-btn mt-2" data-full='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                        <i class="bi bi-download me-1"></i> Baixar PDF
                    </button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.export-pdf-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.currentTarget;
                const originalHtml = btnEl.innerHTML;
                btnEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Gerando Relatório...';
                btnEl.disabled = true;
                
                try {
                    const itemData = JSON.parse(btnEl.getAttribute('data-full'));
                    await exportConsultationToPDF(itemData, globalPatientData, globalAnamneseData);
                } catch (err) {
                    console.error("Erro ao exportar PDF:", err);
                    window.showToast("Ocorreu um erro ao tentar gerar o PDF.", "error");
                } finally {
                    btnEl.innerHTML = originalHtml;
                    btnEl.disabled = false;
                }
            });
        });
    };

     const exportConsultationToPDF = async (appointment, patient, anamnese) => {
        if(typeof html2pdf === 'undefined') {
            window.showToast("A biblioteca de PDF não está carregada. Verifique se adicionou o script no HTML.", "error");
            return;
        }

         let nutriData = { name: 'Nutricionista', email: 'contato@clinica.com', phone: 'Não informado' };
        try {
            const nutriRes = await fetch('/api/auth/nutricionista/details');
            const nData = await nutriRes.json();
            if (nData.success) {
                nutriData.name = nData.data.name || nutriData.name;
                nutriData.email = nData.data.email || nutriData.email;
                nutriData.phone = nData.data.phone || nutriData.phone;
            }
        } catch(e) { console.warn("Aviso: Não foi possível buscar dados do Nutricionista."); }
 
        let anthroHistory = [];
        try {
            const anthroRes = await fetch(`/api/anthropometry/history/${patient.id}`);
            const aData = await anthroRes.json();
            if (aData.success && aData.history) {
                anthroHistory = aData.history.sort((a,b) => new Date(a.date) - new Date(b.date));
            }
        } catch(e) { console.warn("Aviso: Não foi possível buscar histórico antropométrico."); }

        const age = calculateAge(anamnese.birthdate);
        const birthDateFormatted = anamnese.birthdate ? new Date(anamnese.birthdate).toLocaleDateString('pt-BR') : 'N/A';
        const consultDateFormatted = new Date(appointment.consultation_date).toLocaleDateString('pt-BR');

        // 3. Montar a Tabela de Evolução (Apenas se houver histórico)
        let evolutionHtml = '';
        if (anthroHistory.length > 0) {
            const tableRows = anthroHistory.map(h => `
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 10px 8px; color: #495057;">${new Date(h.date).toLocaleDateString('pt-BR')}</td>
                    <td style="padding: 10px 8px; color: #495057; text-align: center;">${h.weight} kg</td>
                    <td style="padding: 10px 8px; color: #e76f51; text-align: center; font-weight: bold;">${h.body_fat}%</td>
                    <td style="padding: 10px 8px; color: #2a9d8f; text-align: center; font-weight: bold;">${h.lean_mass} kg</td>
                </tr>
            `).join('');

            evolutionHtml = `
                <div style="page-break-inside: avoid; margin-top: 30px;">
                    <h3 style="color: #2a9d8f; font-size: 18px; border-bottom: 1px solid #e9ecef; padding-bottom: 10px; margin-bottom: 15px;">Evolução Antropométrica</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                        <thead>
                            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 12px 8px; color: #264653; text-transform: uppercase;">Data da Avaliação</th>
                                <th style="padding: 12px 8px; color: #264653; text-transform: uppercase; text-align: center;">Peso Total</th>
                                <th style="padding: 12px 8px; color: #264653; text-transform: uppercase; text-align: center;">% Gordura</th>
                                <th style="padding: 12px 8px; color: #264653; text-transform: uppercase; text-align: center;">Massa Magra</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;
        }
 
        const element = document.createElement('div');
        element.innerHTML = `
            <div style="font-family: 'Poppins Neue', Poppins, Arial, sans-serif; color: #333; padding: 30px; background: #fff;">
                
                <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #2a9d8f; padding-bottom: 20px; margin-bottom: 30px;">
                    <div>
                        <h1 style="color: #2a9d8f; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px;">NutriCare</h1>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #6c757d; text-transform: uppercase; letter-spacing: 1px;">Relatório de Evolução Clínica</p>
                    </div>
                    <div style="text-align: right; font-size: 13px; color: #495057; line-height: 1.5;">
                        <strong style="color: #264653; font-size: 15px;">Dra. ${nutriData.name}</strong><br>
                        Email: ${nutriData.email}<br>
                        Telefone: ${nutriData.phone}<br>
                    </div>
                </div>

                <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px; border-left: 4px solid #f4a261;">
                    <h3 style="margin: 0 0 15px 0; color: #264653; font-size: 16px; text-transform: uppercase;">Dados do Paciente</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 14px;">
                        <div style="flex: 1; min-width: 200px;">
                            <p style="margin: 0 0 5px 0;"><strong>Nome:</strong> ${patient.nome}</p>
                            <p style="margin: 0 0 5px 0;"><strong>Idade:</strong> ${age} anos (Nasc: ${birthDateFormatted})</p>
                            <p style="margin: 0 0 5px 0;"><strong>Contato:</strong> ${patient.phone || '--'} | ${patient.email}</p>
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            <p style="margin: 0 0 5px 0;"><strong>Objetivo Inicial:</strong> ${anamnese.objective || 'Não informado'}</p>
                            <p style="margin: 0 0 5px 0;"><strong>Patologias:</strong> ${anamnese.health_issue || 'Nenhuma relatada'}</p>
                        </div>
                    </div>
                </div>

                <div style="page-break-inside: avoid;">
                    <h3 style="color: #2a9d8f; font-size: 18px; border-bottom: 1px solid #e9ecef; padding-bottom: 10px; margin-bottom: 20px;">Detalhes da Consulta: ${consultDateFormatted}</h3>

                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #264653; text-transform: uppercase;">S - Subjetivo (Relato do Paciente)</h4>
                        <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.6; color: #495057;">
                            ${appointment.subjective_notes || 'Nenhuma anotação subjetiva registrada nesta consulta.'}
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #264653; text-transform: uppercase;">O - Objetivo (Medidas Atuais)</h4>
                        <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.6; color: #495057;">
                            <div style="display: flex; gap: 20px; margin-bottom: 10px; font-weight: bold; color: #2a9d8f;">
                                <span>Peso Atual: ${appointment.weight || '--'} kg</span>
                                <span>Altura: ${appointment.height || '--'} cm</span>
                                <span>% Gordura: ${appointment.body_fat_percentage || '--'} %</span>
                            </div>
                            ${appointment.objective_notes || 'Nenhuma anotação objetiva complementar.'}
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #264653; text-transform: uppercase;">A - Avaliação (Diagnóstico Clínico)</h4>
                        <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.6; color: #495057;">
                            ${appointment.assessment_notes || 'Nenhuma avaliação registrada nesta consulta.'}
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #264653; text-transform: uppercase;">P - Plano (Conduta Nutricional)</h4>
                        <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.6; color: #495057;">
                            ${appointment.plan_notes || 'Nenhum plano ou conduta registrados.'}
                        </div>
                    </div>
                </div>

                ${evolutionHtml}

                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #ced4da; text-align: center; color: #adb5bd; font-size: 11px;">
                    <p style="margin: 0;">Documento gerado eletronicamente pelo sistema <strong>NutriCare</strong>.</p>
                    <p style="margin: 5px 0 0 0;">As informações contidas neste prontuário são confidenciais e protegidas por sigilo profissional.</p>
                </div>
            </div>
        `;
 
        const opt = {
            margin:       [10, 10, 10, 10], 
            filename:     `Prontuario_${patient.nome.replace(/\s+/g, '_')}_${consultDateFormatted.replace(/\//g, '-')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }  
        };
 
        html2pdf().set(opt).from(element).save();
    };

    document.body.addEventListener('click', (event) => {
        const btnTable = event.target.closest('.btn-open-anthro');
        if (btnTable) openAnthropometryModal(btnTable.getAttribute('data-patient-id'));

        const btnBanner = event.target.closest('.btn-open-anthro-banner');
        if (btnBanner) openAnthropometryModal(btnBanner.getAttribute('data-patient-id'));
    });

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filteredPatients = allPatients.filter(p => p.nome.toLowerCase().includes(term) || p.email.toLowerCase().includes(term));
        currentPage = 1;
        renderTable();
    });

    tableBody.addEventListener('click', (event) => {
        const btn = event.target.closest('.btn-ver-detalhes');
        if (btn) {
            modal.style.zIndex = "1045";
            modal.classList.add('is-visible');
            initPatientDetails(btn.getAttribute('data-patient-id'));
        }
    });

    closeModalBtn.addEventListener('click', () => modal.classList.remove('is-visible'));

    const scheduleReturnBtn = document.getElementById('btnScheduleReturn');
    if(scheduleReturnBtn) {
        scheduleReturnBtn.addEventListener('click', () => { if (currentPatientId) document.getElementById('scheduleReturnModal').classList.add('is-visible'); });
    }
    const closeReturnModalBtn = document.getElementById('closeScheduleReturnModal');
    if(closeReturnModalBtn) {
        closeReturnModalBtn.addEventListener('click', () => document.getElementById('scheduleReturnModal').classList.remove('is-visible'));
    }

    // --- NOVA LÓGICA: EDIÇÃO DE ANAMNESE (FICHA BASE) ---
    const editAnamneseModal = document.getElementById('editAnamneseModal');
    const openEditAnamneseBtn = document.getElementById('btnEditAnamnese');
    const closeEditAnamneseBtn = document.getElementById('closeEditAnamneseModal');
    const editAnamneseForm = document.getElementById('editAnamneseForm');

    if (openEditAnamneseBtn && editAnamneseModal) {
        openEditAnamneseBtn.addEventListener('click', () => {
            if (!globalAnamneseData) return;
            
            // Preenche o modal com os dados atuais
            document.getElementById('edit_health_issue').value = globalAnamneseData.health_issue || '';
            document.getElementById('edit_allergic').value = globalAnamneseData.allergic || '';
            document.getElementById('edit_avoidment').value = globalAnamneseData.avoidment || '';
            document.getElementById('edit_medicine').value = globalAnamneseData.medicine || '';
            document.getElementById('edit_exercise').value = globalAnamneseData.exercise || '';
            document.getElementById('edit_digestion').value = globalAnamneseData.digestion || '';
            document.getElementById('edit_intestino').value = globalAnamneseData.intestino || '';
            document.getElementById('edit_sleep').value = globalAnamneseData.wake_up_time || '';

            // Trata o z-index para sobrepor o modal de Detalhes do Paciente
            if (modal.classList.contains('is-visible')) { modal.style.zIndex = "1040"; }
            editAnamneseModal.classList.add('is-visible');
        });
    }

    if (closeEditAnamneseBtn) {
        closeEditAnamneseBtn.addEventListener('click', () => {
            editAnamneseModal.classList.remove('is-visible');
            modal.style.zIndex = "1045"; // Restaura o z-index do modal pai
        });
    }

    if (editAnamneseForm) {
        editAnamneseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btnSaveAnamnese');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';
            submitBtn.disabled = true;

            const payload = {
                health_issue: document.getElementById('edit_health_issue').value,
                allergic: document.getElementById('edit_allergic').value,
                avoidment: document.getElementById('edit_avoidment').value,
                medicine: document.getElementById('edit_medicine').value,
                exercise: document.getElementById('edit_exercise').value,
                digestion: document.getElementById('edit_digestion').value,
                intestino: document.getElementById('edit_intestino').value,
                sleep: document.getElementById('edit_sleep').value
            };

            try {
                const response = await fetch(`/api/auth/anamnese/${currentPatientId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                
                if (data.success) {
                    window.showToast('Ficha base atualizada com sucesso!', 'success');
                    editAnamneseModal.classList.remove('is-visible');
                    modal.style.zIndex = "1045";
                    // Recarrega os dados do paciente para atualizar a tela principal instantaneamente
                    initPatientDetails(currentPatientId);
                } else {
                    window.showToast(data.message || 'Erro ao atualizar ficha.', 'error');
                }
            } catch (error) {
                console.error(error);
                window.showToast('Falha na comunicação com o servidor.', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    getPatientData();
}

async function initializePatientAnalytics(patientId, anamneseData) {
    const kpiContainer = document.getElementById('analytics-kpi-container');
    const tableBody = document.getElementById('analytics-history-table');

    try {
        const response = await fetch(`/api/anthropometry/history/${patientId}`);
        if (!response.ok) throw new Error('Falha na rota do servidor.');
        
        const result = await response.json();

        if (!result.success || result.history.length === 0) {
            kpiContainer.innerHTML = '<div class="col-12"><div class="alert alert-light border text-center text-muted">Ainda não há avaliações antropométricas para gerar análises.</div></div>';
            return;
        }

        const data = result.history.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        renderAnalyticsKPIs(data);
        tableBody.innerHTML = data.map(entry => `<tr><td class="fw-bold">${new Date(entry.date).toLocaleDateString('pt-BR')}</td><td>${entry.weight}kg</td><td class="text-danger fw-medium">${entry.body_fat}%</td><td class="text-success fw-medium">${entry.lean_mass}kg</td></tr>`).reverse().join('');
        renderEvolutionChart(data);
        renderSkinfoldRadar(data);
        
        generateClinicalInsights(data, anamneseData);

    } catch (error) { console.error("Erro no Analytics:", error); }
}

function renderAnalyticsKPIs(data) {
    const last = data[data.length - 1];
    const prev = data[data.length - 2] || last;
    const diffWeight = (last.weight - prev.weight).toFixed(1);

    const kpiContainer = document.getElementById('analytics-kpi-container');
    kpiContainer.innerHTML = `
        <div class="col-md-4">
            <div class="p-3 bg-white rounded-4 border shadow-sm">
                <span class="text-muted small fw-bold">VARIAÇÃO DE PESO</span>
                <div class="d-flex align-items-center gap-2">
                    <h3 class="mb-0 fw-bold">${last.weight}kg</h3>
                    <span class="badge ${diffWeight <= 0 ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${diffWeight <= 0 ? 'text-success' : 'text-danger'}">${diffWeight > 0 ? '+' : ''}${diffWeight}kg</span>
                </div>
            </div>
        </div>
        <div class="col-md-4"><div class="p-3 bg-white rounded-4 border shadow-sm"><span class="text-muted small fw-bold">% GORDURA ATUAL</span><h3 class="mb-0 fw-bold text-primary">${last.body_fat}%</h3></div></div>
        <div class="col-md-4"><div class="p-3 bg-white rounded-4 border shadow-sm"><span class="text-muted small fw-bold">MASSA MAGRA</span><h3 class="mb-0 fw-bold text-success">${last.lean_mass}kg</h3></div></div>
    `;
}

function renderEvolutionChart(data) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (patientCharts.evolution) patientCharts.evolution.destroy();

    patientCharts.evolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })),
            datasets: [
                { label: 'Peso (kg)', data: data.map(d => d.weight), borderColor: premiumColors.primary, backgroundColor: 'rgba(42, 157, 143, 0.1)', fill: true, tension: 0.4, yAxisID: 'y' },
                { label: 'Gordura (%)', data: data.map(d => d.body_fat), borderColor: premiumColors.danger, borderDash: [5, 5], tension: 0.4, yAxisID: 'y1' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { type: 'linear', position: 'left', grid: { display: false } }, y1: { type: 'linear', position: 'right', grid: { color: '#f1f1f1' } } } }
    });
}

function renderSkinfoldRadar(data) {
    const ctx = document.getElementById('skinfoldRadarChart').getContext('2d');
    if (patientCharts.radar) patientCharts.radar.destroy();

    const last = data[data.length - 1];
    patientCharts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Peitoral', 'Axilar', 'Tríceps', 'Subescapular', 'Abdominal', 'Suprailíaca', 'Coxa'],
            datasets: [{ label: 'Última Avaliação', data: [last.fold_chest, last.fold_midaxillary, last.fold_triceps, last.fold_subscapular, last.fold_abdominal, last.fold_suprailiac, last.fold_thigh], backgroundColor: 'rgba(42, 157, 143, 0.2)', borderColor: premiumColors.primary, pointBackgroundColor: premiumColors.primary }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display: true }, suggestMin: 0 } } }
    });
}

async function generateClinicalInsights(data, anamnese) {
    const insightBox = document.getElementById('clinical-insights-content');
    
    if (data.length < 2) {
        insightBox.innerHTML = '<p class="small text-muted p-3"><i class="bi bi-info-circle me-1"></i>Faça a segunda avaliação para a Inteligência Artificial gerar insights comparativos.</p>'; 
        return;
    }

    const last = data[data.length - 1];
    const prev = data[data.length - 2];

    insightBox.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-grow text-primary spinner-grow-sm mb-2" role="status"></div>
            <div class="spinner-grow text-info spinner-grow-sm mb-2 mx-1" role="status"></div>
            <div class="spinner-grow text-primary spinner-grow-sm mb-2" role="status"></div>
            <p class="small text-primary fw-bold mt-2"><i class="bi bi-stars"></i>Analisando o prontuário...</p>
        </div>
    `;

    try {
        const payload = {
            objective: anamnese.objective,
            sleep: anamnese.wake_up_time,
            intestine: anamnese.intestino,
            currentFat: last.body_fat,
            previousFat: prev.body_fat,
            currentLeanMass: last.lean_mass,
            previousLeanMass: prev.lean_mass
        };

        const response = await fetch('/api/ai/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            let borderClass = 'border-primary';
            let iconClass = 'text-primary';
            let title = 'ANÁLISE CLÍNICA ';
            
            if (last.body_fat < prev.body_fat) { 
                borderClass = 'border-success'; 
                iconClass = 'text-success'; 
                title = 'EVOLUÇÃO POSITIVA '; 
            } else if (last.body_fat >= prev.body_fat) { 
                borderClass = 'border-danger'; 
                iconClass = 'text-danger'; 
                title = 'ALERTA METABÓLICO '; 
            }

            insightBox.innerHTML = `
                <div class="mb-3 p-3 border-start ${borderClass} border-4 bg-white shadow-sm rounded">
                    <small class="${iconClass} d-block fw-bold mb-2">
                        <i class="bi bi-robot me-1"></i> ${title}
                    </small>
                    <span class="small text-dark lh-base d-block" style="font-size: 0.9rem;">${result.insight}</span>
                    <div class="text-end mt-3">
                    </div>
                </div>
            `;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        insightBox.innerHTML = `
            <div class="p-3 border-start border-warning border-4 bg-light rounded">
                <small class="text-warning fw-bold"><i class="bi bi-exclamation-triangle me-1"></i>Aviso</small>
                <p class="small text-muted mb-0 mt-1">A IA não pôde ser ativada. Verifique se a chave da API (GEMINI_API_KEY) está configurada corretamente no servidor.</p>
            </div>
        `;
    }
}

function initializeMetricsPage(nutriId) {
    const filterButtons = document.getElementById('time-filter-buttons');
    const loadingState = document.getElementById('metricsLoading');
    const contentState = document.getElementById('metricsContent');
    if (!filterButtons) return;

    let chartInstances = {};
    const colors = { primary: '#2a9d8f', primaryLight: 'rgba(42, 157, 143, 0.2)', secondary: '#f4a261', warning: '#e9c46a', dark: '#264653', gray: '#e9ecef' };

    const fetchDataForPeriod = async (days) => {
        try {
            const response = await fetch(`/api/auth/metrics?period=${days}`);
            if (!response.ok) throw new Error('Falha ao buscar dados');
            return await response.json();
        } catch (error) {
            return {
                data: {
                    kpis: { revenue: 0, patients: 0, retention: 0, avgAppointments: 0 },
                    evolution: { labels: ['A', 'B', 'C'], revenue: [0, 0, 0], patients: [0, 0, 0] },
                    appointmentTypes: { labels: ['Sem Dados'], data: [1] },
                    patientGoals: { labels: ['Sem Dados'], data: [1] }
                }
            };
        }
    };

    const updateUI = (data) => {
        document.getElementById('kpi-revenue').textContent = (parseFloat(data.kpis.revenue) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('kpi-patients').textContent = data.kpis.patients || 0;
        document.getElementById('kpi-retention').textContent = `${data.kpis.retention || 0}%`;
        document.getElementById('kpi-avg-appointments').textContent = data.kpis.avgAppointments || 0;

        Object.values(chartInstances).forEach(chart => { if (chart) chart.destroy(); });

        const ctxRev = document.getElementById('revenuePatientsChart').getContext('2d');
        let gradientBar = ctxRev.createLinearGradient(0, 0, 0, 400);
        gradientBar.addColorStop(0, colors.primary);
        gradientBar.addColorStop(1, 'rgba(42, 157, 143, 0.4)');

        chartInstances.revenue = new Chart(ctxRev, {
            type: 'bar',
            data: {
                labels: data.evolution.labels,
                datasets: [
                    { label: 'Faturamento (R$)', data: data.evolution.revenue, backgroundColor: gradientBar, borderRadius: 6, borderSkipped: false, yAxisID: 'y' },
                    { label: 'Novos Pacientes', data: data.evolution.patients, borderColor: colors.secondary, backgroundColor: '#fff', borderWidth: 3, pointBackgroundColor: colors.secondary, pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7, type: 'line', tension: 0.4, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 20, font: { family: 'Poppins', size: 12 } } }, tooltip: { backgroundColor: 'rgba(33, 37, 41, 0.9)', titleFont: { family: 'Poppins', size: 13 }, bodyFont: { family: 'Poppins', size: 13 }, padding: 12, cornerRadius: 8 } },
                scales: { x: { grid: { display: false }, ticks: { font: { family: 'Poppins' } } }, y: { beginAtZero: true, position: 'left', grid: { color: colors.gray, borderDash: [5, 5] }, title: { display: false }, ticks: { font: { family: 'Poppins' } } }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { stepSize: 1, font: { family: 'Poppins' } } } }
            }
        });

        const ctxAppt = document.getElementById('appointmentsTypeChart').getContext('2d');
        chartInstances.appointments = new Chart(ctxAppt, {
            type: 'doughnut',
            data: { labels: data.appointmentTypes.labels, datasets: [{ data: data.appointmentTypes.data, backgroundColor: [colors.primary, colors.warning, colors.secondary, colors.dark], borderWidth: 0, hoverOffset: 10 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, padding: 20, font: { family: 'Poppins' } } } } }
        });

        const ctxGoals = document.getElementById('patientGoalsChart').getContext('2d');
        chartInstances.goals = new Chart(ctxGoals, {
            type: 'bar',
            data: { labels: data.patientGoals.labels, datasets: [{ label: 'Pacientes', data: data.patientGoals.data, backgroundColor: colors.dark, borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: colors.gray, borderDash: [5, 5] }, ticks: { stepSize: 1, font: { family: 'Poppins' } } }, y: { grid: { display: false }, ticks: { font: { family: 'Poppins' } } } } }
        });
    };

    const handleFilterClick = async (e) => {
        const button = e.target;
        if (button.tagName !== 'BUTTON' || button.classList.contains('active')) return;

        filterButtons.querySelector('.active').classList.remove('active');
        button.classList.add('active');
        contentState.style.opacity = '0.4';
        contentState.style.pointerEvents = 'none';

        const response = await fetchDataForPeriod(button.dataset.period);
        updateUI(response.data);

        contentState.style.opacity = '1';
        contentState.style.pointerEvents = 'auto';
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

    const requirements = { length: document.getElementById('length-update'), lowercase: document.getElementById('lowercase-update'), uppercase: document.getElementById('uppercase-update'), special: document.getElementById('special-update'), match: document.getElementById('match-update') };

    const setButtonLoading = (btn, isLoading) => {
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-container');
        if (isLoading) { btnText.style.display = 'none'; spinner.style.display = 'inline-block'; }
        else { btnText.style.display = 'inline-block'; spinner.style.display = 'none'; }
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
            if (result.success) { nameInput.value = result.data.name; emailInput.value = result.data.email; phoneInput.value = result.data.phone; }
            else { showMessage('details-message', 'Erro ao carregar seus dados.', false); }
        } catch (error) { showMessage('details-message', 'Erro de comunicação com o servidor.', false); }
    };

    if(detailsForm) {
        detailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setButtonLoading(saveDetailsBtn, true);
            const payload = { name: nameInput.value, email: emailInput.value, phone: phoneInput.value };
            try {
                const response = await fetch('/api/auth/nutricionista/details', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await response.json();
                showMessage('details-message', result.message, result.success);
            } catch (error) { showMessage('details-message', 'Erro de comunicação ao salvar.', false); }
            finally { setButtonLoading(saveDetailsBtn, false); }
        });
    }

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

    if(newPasswordInput) newPasswordInput.addEventListener('input', validatePassword);
    if(confirmPasswordInput) confirmPasswordInput.addEventListener('input', validatePassword);

    if(passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validatePassword()) { showMessage('password-message', 'Por favor, cumpra todos os requisitos.', false); return; }

            setButtonLoading(savePasswordBtn, true);
            const payload = { currentPassword: document.getElementById('currentPassword').value, newPassword: newPasswordInput.value };

            try {
                const response = await fetch('/api/auth/nutricionista/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await response.json();
                showMessage('password-message', result.message, result.success);
                if (result.success) { passwordForm.reset(); Object.values(requirements).forEach(req => req.classList.remove('valid')); }
            } catch (error) { showMessage('password-message', 'Erro ao alterar senha.', false); }
            finally { setButtonLoading(savePasswordBtn, false); }
        });
    }

    loadNutriData();
}

async function initializeDashboardPage(nutriId) {
    const userNameSpan = document.getElementById('userName');
    const currentDateSpan = document.getElementById('currentDate');

    if(currentDateSpan) currentDateSpan.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    try {
        const response = await fetch('/api/auth/me');
        const result = await response.json();
        if (result.success && userNameSpan) userNameSpan.textContent = result.user.name.split(' ')[0];
    } catch (error) { console.error('Erro ao buscar dados:', error); }

    try {
        const response = await fetch('/api/auth/dashboard-overview');
        const result = await response.json();
        if (result.success) updateDashboardUI(result.data);
    } catch (error) { console.error('Erro ao buscar dashboard:', error); }

    await initializePendingAppointments();
    setInterval(initializePendingAppointments, 5000);
}

function updateDashboardUI(data) {
    document.getElementById('kpi-today-appointments').textContent = data.kpis.todayAppointments;
    document.getElementById('kpi-active-patients').textContent = data.kpis.activePatients;
    document.getElementById('kpi-monthly-revenue').textContent = (parseFloat(data.kpis.monthlyRevenue) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('kpi-avg-score').textContent = data.kpis.avgScore ? parseFloat(data.kpis.avgScore).toFixed(1) : 'N/A';

    const appointmentsList = document.getElementById('today-appointments-list');
    const emptyAppointmentsState = document.getElementById('empty-appointments-state');
    
    if(appointmentsList) {
        appointmentsList.innerHTML = '';
        if (!data.todayAppointments || data.todayAppointments.length === 0) {
            emptyAppointmentsState.style.display = 'block';
        } else {
            emptyAppointmentsState.style.display = 'none';
            data.todayAppointments.forEach(apt => {
                const item = document.createElement('li');
                item.className = 'list-group-item appointment-item';
                const typeClass = apt.service_type.toLowerCase().includes('retorno') ? 'retorno' : (apt.service_type.toLowerCase().includes('online') ? 'online' : 'primeira');

                item.innerHTML = `
                    <div class="appointment-item-time">${apt.time}</div>
                    <div class="appointment-item-divider type-${typeClass}"></div>
                    <div class="appointment-item-details flex-grow-1">
                        <div class="patient-name">${apt.patient_name}</div>
                        <div class="appointment-type">${apt.service_type}</div>
                    </div>
                `;
                appointmentsList.appendChild(item);
            });
        }
    }

    const attentionList = document.getElementById('attention-list');
    const emptyAttentionState = document.getElementById('empty-attention-state');
    
    if(attentionList) {
        attentionList.innerHTML = '';
        if (!data.attentionList || data.attentionList.length === 0) {
            emptyAttentionState.style.display = 'block';
        } else {
            emptyAttentionState.style.display = 'none';
            data.attentionList.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-group-item attention-item d-flex align-items-center gap-3 p-3';
                li.innerHTML = `
                    <div class="attention-icon text-primary-custom" style="font-size: 1.5rem;"><i class="bi bi-gift-fill"></i></div>
                    <div class="attention-details">
                        <div class="fw-bold text-dark">${item.text}</div>
                        <div class="small text-muted">${item.subtext}</div>
                    </div>
                `;
                attentionList.appendChild(li);
            });
        }
    }
}

function initializeInvoicingPage(nutriId) {
    const tableBody = document.getElementById('invoicesTableBody');
    const emptyState = document.getElementById('invoicesEmptyState');
    const monthFilter = document.getElementById('monthFilter');
    const statusFilter = document.getElementById('statusFilter');

    if(!tableBody) return;

    const modal = document.getElementById('newInvoiceModal');
    const openModalBtn = document.getElementById('openNewInvoiceModalBtn');
    const closeModalBtn = document.getElementById('closeNewInvoiceModal');
    const newInvoiceForm = document.getElementById('newInvoiceForm');
    const invoiceItemsContainer = document.getElementById('invoiceItemsContainer');
    const invoiceTotalSpan = document.getElementById('invoiceTotal');
    const addInvoiceItemBtn = document.getElementById('addInvoiceItemBtn');
    const saveInvoiceBtn = document.getElementById('saveInvoiceBtn');

    const setButtonLoading = (btn, isLoading) => {
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-container');
        if (isLoading) { btnText.style.display = 'none'; spinner.style.display = 'inline-block'; }
        else { btnText.style.display = 'inline-block'; spinner.style.display = 'none'; }
        btn.disabled = isLoading;
    };

    const showMessage = (containerId, message, isSuccess = true) => {
        const container = document.getElementById(containerId);
        container.textContent = message;
        container.className = `form-message-container ${isSuccess ? 'success' : 'error'} visible`;
        setTimeout(() => container.classList.remove('visible'), 5000);
    };

    const loadPatientsForInvoice = async () => {
        try {
            const response = await fetch('/api/auth/patientList');
            const data = await response.json();
            const select = document.getElementById('invoicePatient');
            if (data.success && select) {
                select.innerHTML = '<option value="" disabled selected>Selecione um paciente...</option>';
                data.patients.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.nome;
                    select.appendChild(opt);
                });
            }
        } catch (e) { console.error('Erro ao carregar pacientes para fatura', e); }
    };

    const loadInvoices = async () => {
        const month = monthFilter.value;
        const status = statusFilter.value;

        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando faturas...</td></tr>';

        try {
            const response = await fetch('/api/auth/invoices');
            const result = await response.json();

            if (result.success) {
                const allInvoices = result.data.invoices || [];
                
                let monthlyRevenue = 0;
                let pendingRevenue = 0;
                let paidCount = 0;
                const currentMonthStr = new Date().toISOString().slice(0, 7);
                
                allInvoices.forEach(inv => {
                    const amt = parseFloat(inv.amount) || 0;
                    if (inv.status === 'Paid') {
                        if (inv.issueDate.startsWith(currentMonthStr)) {
                            monthlyRevenue += amt;
                            paidCount++;
                        }
                    } else if (inv.status === 'Pending' || inv.status === 'Overdue') {
                        pendingRevenue += amt;
                    }
                });
                
                document.getElementById('kpi-monthly-revenue').textContent = monthlyRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                document.getElementById('kpi-pending-revenue').textContent = pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                document.getElementById('kpi-avg-ticket').textContent = paidCount > 0 ? (monthlyRevenue / paidCount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

                let filteredInvoices = allInvoices;
                if (month) filteredInvoices = filteredInvoices.filter(inv => inv.issueDate.startsWith(month));
                if (status && status !== 'all') filteredInvoices = filteredInvoices.filter(inv => inv.status === status);
                
                tableBody.innerHTML = '';
                if (filteredInvoices.length === 0) {
                    emptyState.style.display = 'block';
                } else {
                    emptyState.style.display = 'none';
                    filteredInvoices.forEach(invoice => {
                        const tr = document.createElement('tr');
                        const issueDate = new Date(invoice.issueDate).toLocaleDateString('pt-BR');
                        const dueDate = new Date(invoice.dueDate).toLocaleDateString('pt-BR');
                        const amount = parseFloat(invoice.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                        let badgeClass = 'bg-secondary';
                        let statusText = invoice.status;
                        if (invoice.status === 'Paid') { badgeClass = 'bg-success'; statusText = 'Pago'; }
                        else if (invoice.status === 'Pending') { badgeClass = 'bg-warning text-dark'; statusText = 'Pendente'; }
                        else if (invoice.status === 'Overdue') { badgeClass = 'bg-danger'; statusText = 'Atrasado'; }
                        else if (invoice.status === 'Canceled') { badgeClass = 'bg-dark'; statusText = 'Cancelado'; }
                        
                        let actionBtns = '';
                        if (invoice.payment_link && invoice.status !== 'Paid' && invoice.status !== 'Canceled') {
                            actionBtns += `<button class="btn btn-sm btn-light border text-primary shadow-sm me-1" onclick="navigator.clipboard.writeText('${invoice.payment_link}'); window.showToast('Link de pagamento copiado!', 'success')" title="Copiar Link"><i class="bi bi-link-45deg"></i></button>`;
                        }
                        if (invoice.status !== 'Paid' && invoice.status !== 'Canceled') {
                            actionBtns += `<button class="btn btn-sm btn-light border text-success shadow-sm" onclick="markAsPaid(${invoice.id})" title="Marcar como Pago"><i class="bi bi-check2-circle"></i></button>`;
                        }

                        tr.innerHTML = `
                            <td>
                                <span class="text-muted small fw-bold me-2">#${invoice.id}</span>
                                <span class="fw-medium text-dark">${invoice.patientName}</span>
                            </td>
                            <td>${issueDate}</td>
                            <td>${dueDate}</td>
                            <td class="text-end fw-bold text-dark">${amount}</td>
                            <td class="text-center"><span class="badge ${badgeClass}">${statusText}</span></td>
                            <td class="text-end">${actionBtns || '-'}</td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
            }
        } catch (error) {
            console.error("Erro ao carregar faturas", error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar faturas.</td></tr>';
        }
    };

    const updateInvoiceTotal = () => {
        let total = 0;
        invoiceItemsContainer.querySelectorAll('.invoice-item input[type="number"]').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        invoiceTotalSpan.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const addInvoiceItem = () => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'invoice-item d-flex gap-2 mb-2';
        itemDiv.innerHTML = `
            <div class="flex-grow-1"><input type="text" class="form-control" placeholder="Descrição do serviço" required></div>
            <div style="width: 120px;"><input type="number" class="form-control text-end" placeholder="Valor" min="0" step="0.01" required></div>
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
        if (e.target.type === 'number') updateInvoiceTotal();
    });

    openModalBtn.addEventListener('click', () => {
        newInvoiceForm.reset();
        invoiceItemsContainer.innerHTML = '';
        addInvoiceItem();
        updateInvoiceTotal();
        loadPatientsForInvoice();
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

        try {
            const response = await fetch('/api/auth/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                if (result.paymentLink) {
                    showMessage('invoice-message', 'Fatura e Link MercadoPago gerados!', true);
                    setTimeout(() => {
                        window.showConfirm('Link Gerado', 'O link de pagamento foi gerado. O paciente também o recebeu automaticamente no WhatsApp. Deseja copiar o link?', 'Copiar Link', 'primary', () => {
                            navigator.clipboard.writeText(result.paymentLink);
                            window.showToast('Link de pagamento copiado!', 'success');
                        });
                    }, 500);
                } else {
                    showMessage('invoice-message', 'Fatura criada com sucesso!', true);
                }
                setTimeout(() => {
                    modal.classList.remove('is-visible');
                    loadInvoices();
                }, 1500);
            } else {
                showMessage('invoice-message', result.message || 'Erro ao criar fatura.', false);
            }
        } catch (e) {
            console.error("Erro ao criar fatura", e);
            showMessage('invoice-message', 'Erro de comunicação ao criar fatura.', false);
        } finally {
            setButtonLoading(saveInvoiceBtn, false);
        }
    });

    monthFilter.addEventListener('change', loadInvoices);
    statusFilter.addEventListener('change', loadInvoices);

    window.markAsPaid = async (id) => {
        window.showConfirm('Baixa Manual', 'Tem certeza que deseja marcar esta fatura como paga manualmente?', 'Sim, marcar como paga', 'primary', async () => {
            try {
                const res = await fetch(`/api/auth/invoices/${id}/paid`, { method: 'PUT' });
                if((await res.json()).success) loadInvoices();
                else window.showToast('Falha ao atualizar fatura.', 'error');
            } catch(e) { console.error(e); window.showToast('Erro de comunicação.', 'error'); }
        });
    };

    const now = new Date();
    monthFilter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    loadInvoices();
}