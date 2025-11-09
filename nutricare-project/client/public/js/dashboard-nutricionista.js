// nutricare-project/client/public/js/dashboard-nutricionista.js

/**
 * ===================================================================
 * ESTRUTURA PRINCIPAL (DOM LOAD, SESSION, ROUTING)
 * ===================================================================
 */
document.addEventListener('DOMContentLoaded', async () => {

    const user = await verifySession(); // Agora retorna o objeto user completo
    if (!user) {
        window.location.href = '/pages/login.html';
        return;
    }
    const nutriName = user.name;
    const nutriID = user.id;

    // Configura a animação inicial (ScrollReveal)
    if (!sessionStorage.getItem('hasAnimated')) {
        const sr = ScrollReveal({ distance: '40px', duration: 2200, delay: 200, reset: false });
        sr.reveal('.stat-card, .data-card, .dashboard-content-header h1, .calendar-card-pro, .kpi-card', { origin: 'bottom', interval: 150 });
        sessionStorage.setItem('hasAnimated', 'true');
    }

    // Roteamento baseado no caminho
    const path = window.location.pathname;
    if (path.endsWith('/nutricionista/dashboard.html')) {
        initializeDashboardPage(nutriID);
        initializeGenerateLinkModal(nutriID);
        // initializePendingAppointments() é chamado dentro de initializeDashboardPage com polling
    } else if (path.endsWith('/nutricionista/patientsList.html')) {
        await initializePatientList(nutriID);
    } else if (path.endsWith('/nutricionista/nutriAgenda.html')) {
        initializeProfessionalAgenda(nutriID, nutriName); // Passando o nome
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


    // Lógica de Logout
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


/**
 * ===================================================================
 * FUNÇÕES DE AUTENTICAÇÃO
 * ===================================================================
 */

// Retorna o objeto user completo da sessão, ou nulo se não estiver logado.
async function verifySession() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.user) {
                return result.user;
            }
        }
        return null;
    } catch (error) {
        console.error('Não foi possível verificar o status de autenticação.', error);
        return null;
    }
}

// Realiza o logout do usuário e redireciona para a página de login.
async function handleLogout() {
    console.log("start handleLogout function")

    sessionStorage.removeItem('hasAnimated');
    window.location.href = '/pages/login.html';
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            sessionStorage.removeItem('hasAnimated');
            setTimeout(50000)
            window.location.href = result.redirectUrl;
        }
    } catch (error) {
        console.error('Erro no logout:', error);
    }


}

/**
 * ===================================================================
 * LÓGICA DE MODAL DE GERAÇÃO DE LINK
 * ===================================================================
 */

// Inicializa o modal de geração de link de cadastro para novos pacientes.
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

/**
 * ===================================================================
 * LÓGICA DE APROVAÇÃO DE PRÉ-AGENDAMENTO (PENDING APPOINTMENTS)
 * ===================================================================
 */

let currentPendingAppointments = []; // Armazena os agendamentos pendentes para acesso no modal.

// Busca no backend a lista de agendamentos com status 'Pendente'.
async function fetchPendingAppointments() {
    try {
        const response = await fetch('/api/auth/nutricionista/appointments/pending');
        const result = await response.json();
        return result.success ? result.pendingAppointments : [];
    } catch (error) {
        console.error('Erro ao buscar pendentes:', error);
        return [];
    }
}

// Envia a atualização de status (Confirmada/Rejeitada) para o backend.
// AGORA ACEITA TIPO E MENSAGEM DE REJEIÇÃO
async function handleStatusUpdate(appointmentId, status, rejectionType = null, rejectionMessage = null) {
    const modal = document.getElementById('pendingAppointmentDetailsModal');
    if (modal) modal.classList.remove('is-visible'); // Fecha o modal de detalhes

    // Adiciona os novos parâmetros à payload
    const payload = {
        appointmentId,
        status
    };

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
        if (result.success) {
            await initializePendingAppointments();
            // Adicionar notificação de sucesso se for o caso
        } else {
            console.error("Erro no processo de atualização de status da consulta pendente:", result.message);
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
    }
}

// Renderiza a lista de agendamentos pendentes na interface.
function renderPendingAppointments(appointments) {
    currentPendingAppointments = appointments; // Armazena os dados brutos
    const list = document.getElementById('pending-appointments-list');
    const emptyState = document.getElementById('empty-pending-state');
    const pendingCount = document.getElementById('pendingCount');

    list.innerHTML = '';

    if (!appointments || appointments.length === 0) {
        emptyState.style.display = 'block';
        pendingCount.textContent = '0';
        return;
    }

    emptyState.style.display = 'none';
    pendingCount.textContent = appointments.length;

    appointments.forEach(apt => {
        const dateBR = new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR');

        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center p-3 list-pending-item';
        item.dataset.appointmentId = apt.id; // Adiciona o ID para fácil referência
        item.style.cursor = 'pointer'; // Adiciona um indicador visual de clique

        // Renderiza apenas um resumo, o clique abre os detalhes no modal
        item.innerHTML = `
            <div>
                <div class="fw-bold">${apt.patient_name} <span class="badge text-bg-warning">${apt.service_type}</span></div>
                <div class="text-muted small">Dia: ${dateBR} às ${apt.time} (${apt.duration} min)</div>
            </div>
            <div>
                <button type="button" class="btn btn-sm btn-light btn-view-details" data-id="${apt.id}" title="Ver detalhes"><i class="bi bi-eye"></i></button>
            </div>
        `;
        list.appendChild(item);
    });

    // Adiciona o listener de clique para ABRIR O MODAL
    list.querySelectorAll('.list-group-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Garante que o clique em botões dentro do item não abra o modal, caso mais ações sejam adicionadas.
            if (e.target.closest('button')) return;

            const appointmentId = item.dataset.appointmentId;
            // Busca o objeto completo na lista de agendamentos pendentes
            const appointmentData = currentPendingAppointments.find(a => a.id == appointmentId);
            if (appointmentData) {
                openPendingAppointmentDetailsModal(appointmentData);
            }
        });
    });
}

// Função helper para calcular a idade
function calculateAge(birthDateString) {
    if (!birthDateString) return 'Não informada';
    try {
        const birthDate = new Date(birthDateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < (birthDate.getDate() + 1))) { // Ajuste para fuso
            age--;
        }
        return age + " anos";
    } catch (e) {
        return 'Data inválida';
    }
}

// Abre o modal com os detalhes do pré-agendamento.
function openPendingAppointmentDetailsModal(apt) {
    const modal = document.getElementById('pendingAppointmentDetailsModal');
    if (!modal) return;

    // Popula os dados da consulta
    document.getElementById('modalPendingService').textContent = apt.service_type;
    document.getElementById('modalPendingDuration').textContent = apt.duration;
    // Popula os dados do solicitante
    document.getElementById('modalPendingPatientName').textContent = apt.patient_name;
    document.getElementById('modalPendingPatientEmail').textContent = apt.patient_email;
    document.getElementById('modalPendingPatientPhone').textContent = apt.patient_phone;

    document.getElementById('modalPendingPatientAge').textContent = calculateAge(apt.birth_date);
    document.getElementById('modalPendingObjective').textContent = apt.objective || 'Não informado';

    const dateBR = new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR');
    document.getElementById('modalPendingDateTime').textContent = `${dateBR} às ${apt.time}`;

    // Popula os dados do solicitante
    document.getElementById('modalPendingPatientName').textContent = apt.patient_name;
    document.getElementById('modalPendingPatientEmail').textContent = apt.patient_email;
    document.getElementById('modalPendingPatientPhone').textContent = apt.patient_phone;

    // Configura os botões de ação
    const btnApprove = document.getElementById('btnApprovePending');
    const btnReject = document.getElementById('btnRejectPending');
    const closeBtn = document.getElementById('closePendingAppointmentModal');

    // Clonar e substituir botões para garantir a remoção de listeners antigos
    const newBtnApprove = btnApprove.cloneNode(true);
    const newBtnReject = btnReject.cloneNode(true);

    btnApprove.parentNode.replaceChild(newBtnApprove, btnApprove);
    btnReject.parentNode.replaceChild(newBtnReject, btnReject);

    // 1. APROVAR: Ação direta
    newBtnApprove.addEventListener('click', () => handleStatusUpdate(apt.id, 'Confirmada'));

    // 2. REJEITAR: Abre o modal de rejeição para escolher o tipo
    newBtnReject.addEventListener('click', () => {
        modal.classList.remove('is-visible'); // Fecha o modal de detalhes
        openRejectActionModal(apt.id);        // Abre o modal de ação de rejeição
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
        // Reabre o modal de detalhes
        const appointmentData = currentPendingAppointments.find(a => a.id == appointmentId);
        if (appointmentData) {
            openPendingAppointmentDetailsModal(appointmentData);
        }
    };


    // 1. Reset e configuração do estado inicial
    form.reset();
    messageContainer.classList.remove('visible', 'error', 'success');
    document.getElementById('rejectionAppointmentId').value = appointmentId;

    // 2. Lógica de Alternância de Rádio Buttons
    const handleRadioChange = () => {
        messageContainer.classList.remove('visible', 'error');
        
        // Campo de texto fica HABILITADO em ambos os casos
        messageInput.disabled = false;
        // E a mensagem é OBRIGATÓRIA em ambos os casos
        messageInput.setAttribute('required', 'true');

        if (typeCancellation.checked) {
            // Cenário: Cancelamento Total
            messageInput.placeholder = "Justificativa da Nutricionista (Obrigatória)";
            messageInput.value = defaultMessage; // Mensagem padrão para cancelamento
        } else {
            // Cenário: Sugestão de Reagendamento
            messageInput.placeholder = "Mensagem enviada ao paciente (editável)";
            messageInput.value = 'Horário indisponível. Por favor, reagende a consulta para outro horário disponível.'; // Msg padrão para reagendamento
        }
    };

    typeReschedule.addEventListener('change', handleRadioChange);
    typeCancellation.addEventListener('change', handleRadioChange);

    // Garante que o estado inicial (Reagendamento) seja carregado
    typeReschedule.checked = true;
    handleRadioChange();

    // 3. Lógica de Submissão do Formulário de Rejeição
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitRejectionBtn');
        // setButtonLoading(btn, true); 

        const rejectionType = document.querySelector('input[name="rejectionType"]:checked').value;
        const rejectionMessage = messageInput.value.trim();

        if (rejectionType === 'cancelamento' && rejectionMessage.length === 0) {
            messageContainer.textContent = "A justificativa é obrigatória para o Cancelamento Total.";
            messageContainer.classList.add('error', 'visible');
            // setButtonLoading(btn, false);
            return;
        }

        await handleStatusUpdate(appointmentId, 'Rejeitada', rejectionType, rejectionMessage);

        // setButtonLoading(btn, false);
        modal.classList.remove('is-visible');
    };

    // 4. Exibir o modal

    closeBtn.onclick = () => modal.classList.remove('is-visible');
    modal.classList.add('is-visible');
}

// Função de inicialização que é chamada periodicamente (polling) para manter a lista atualizada.
async function initializePendingAppointments() {
    const pending = await fetchPendingAppointments();
    renderPendingAppointments(pending);
}

/**
 * ===================================================================
 * LÓGICA DE AGENDA (COM MODAL WHATSAPP)
 * ===================================================================
 */

// Busca os agendamentos confirmados para um dia específico.
async function getAppointmentsForDay(nutriId, dateStr) {
    try {
        const response = await fetch(`/api/auth/nutricionista/appointments?date=${dateStr}`);
        if (response.ok) {
            const result = await response.json();
            return result.success ? result.appointments : [];
        }
        return [];
    } catch (error) {
        console.error("Erro ao buscar agendamentos do dia:", error);
        return [];
    }
}

// Abre o modal de contato do paciente com informações preenchidas e link para o WhatsApp.
function openPatientContactModal(apt, date, nutriName) {
    const modal = document.getElementById('patientContactModal');
    const closeBtn = document.getElementById('closePatientContactModal');

    // Popula os detalhes da consulta no modal.
    document.getElementById('modalPatientName').textContent = apt.patientName;
    document.getElementById('modalAppointmentService').textContent = apt.title;
    document.getElementById('modalAppointmentDateTime').textContent = `${date} às ${apt.time}`;

    // Popula as informações de contato do paciente.
    document.getElementById('modalPatientPhone').textContent = apt.phone || 'N/A';
    document.getElementById('modalPatientEmail').textContent = apt.email || 'N/A';

    // Gera uma mensagem amigável e o link para o WhatsApp.
    const patientFirstName = apt.patientName.split(' ')[0];
    const nutriFirstName = nutriName.split(' ')[0];
    const phone = apt.phone.replace(/\D/g, '');
    const message = `Olá, ${patientFirstName}! Eu sou a Dra. ${nutriFirstName} do NutriCare. Vi que temos uma consulta de ${apt.title.toLowerCase()} marcada para o dia ${date} às ${apt.time}. Gostaria de confirmar se está tudo certo ou se precisa de alguma orientação prévia? Estou à disposição!`;

    const wppLink = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;

    const wppButton = document.getElementById('btnWppContact');
    wppButton.href = wppLink;

    // Exibe o modal.
    modal.classList.add('is-visible');

    closeBtn.onclick = () => modal.classList.remove('is-visible');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('is-visible'); };
}

// Inicializa a visualização da agenda profissional, com navegação e renderização dos compromissos.
function initializeProfessionalAgenda(nutriId, nutriName) {
    const header = document.getElementById('currentDayHeader');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const todayBtn = document.getElementById('todayBtn');
    const datePicker = document.getElementById('datePicker');
    const timelineContainer = document.getElementById('timelineContainer');
    const emptyState = document.getElementById('emptyAgendaState');

    let currentDate = new Date();
    let pollingInterval = null; // Variável para controlar o polling

    /**
     * FUNÇÃO CORRIGIDA
     * Formata um objeto Date para uma string 'YYYY-MM-DD' de forma segura,
     * usando os componentes da data local (getFullYear, getMonth, getDate).
     * Isso evita o bug de conversão de fuso horário que ocorria com .toISOString().
     */
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

        // Renderiza o grid de horários de fundo.
        for (let hour = workHours.start; hour <= workHours.end; hour++) {
            const slot = document.createElement('div');
            slot.className = 'timeline-slot';
            slot.style.minHeight = `${60 * minutesPerPixel}px`;
            slot.innerHTML = `
                <div class="timeline-time">${String(hour).padStart(2, '0')}:00</div>
                <div class="timeline-line"></div>
            `;
            timelineContainer.appendChild(slot);
        }

        // Verifica se há agendamentos e os renderiza na timeline.
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
            const workStartHour = workHours.start;

            const topPosition = (((aptHour - workStartHour) * 60) + aptMinute) * minutesPerPixel;
            const duration = apt.duration || 60;

            aptBlock.style.top = `${topPosition}px`;
            aptBlock.style.height = `${duration * minutesPerPixel}px`;

            aptBlock.innerHTML = `
                <div class="appointment-patient-name">${apt.patientName}</div>
                <div class="appointment-details-pro">${apt.title} - ${apt.time} (${duration} min)</div>
            `;

            // Adiciona o evento de clique para abrir o modal de contato do paciente.
            aptBlock.addEventListener('click', () => {
                openPatientContactModal(apt, readableDate, nutriName);
            });

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

        datePicker.value = getDateString(currentDate);
    };

    // Inicia ou para o polling (atualização automática) da agenda.
    const startOrStopPolling = () => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }

        const today = new Date();
        const isToday = currentDate.toDateString() === today.toDateString();

        // O polling só é ativado se a visualização for do dia atual.
        if (isToday) {
            pollingInterval = setInterval(renderDayView, 5000);
        }
    }

    // Adiciona os listeners para os botões de navegação da agenda.
    prevDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        renderDayView();
        startOrStopPolling();
    });

    nextDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        renderDayView();
        startOrStopPolling();
    });

    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        renderDayView();
        startOrStopPolling();
    });

    datePicker.addEventListener('change', (e) => {
        // CORREÇÃO: O uso de 'T00:00:00' garante que a data seja interpretada no fuso horário local,
        // evitando o bug de pular para o dia anterior em alguns fusos.
        const selectedDate = new Date(e.target.value + 'T00:00:00');
        currentDate = selectedDate;
        renderDayView();
        startOrStopPolling();
    });

    // Inicialização da agenda.
    renderDayView();
    startOrStopPolling();

    // Garante que o polling pare ao sair da página.
    window.addEventListener('beforeunload', () => {
        if (pollingInterval) clearInterval(pollingInterval);
    });
}

// Inicializa os modais relacionados à configuração da agenda.
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

    const loadSelectedDates = async () => {
        try {
            const response = await fetch('/api/auth/nutricionista/details');
            const result = await response.json();
            if (result.success && result.data.availableDays) {
                selectedDates = new Set(result.data.availableDays);
                renderCalendar();
            }
        } catch (error) {
            console.error("Erro ao carregar datas salvas:", error);
        }
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
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-container');
        if (isLoading) {
            btnText.style.display = 'none';
            spinner.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
        }
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

        const datesArray = Array.from(selectedDates);

        const formData = {
            dates: datesArray,
            startTime: form.querySelector('#startTime').value,
            endTime: form.querySelector('#endTime').value,
            slotDuration: form.querySelector('input[name="slotDuration"]:checked').value
        };

        if (formData.dates.length === 0) {
            showMessage('schedule-settings-message', 'Selecione pelo menos um dia no calendário.', false);
            setButtonLoading(generateBtn, false);
            return;
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
                setTimeout(() => {
                    modal.classList.remove('is-visible');
                    initializeProfessionalAgenda(nutriId);
                }, 1500);
            } else {
                showMessage('schedule-settings-message', result.message, false);
            }
        } catch (error) {
            showMessage('schedule-settings-message', 'Erro de comunicação ao gerar a agenda. Tente novamente.', false);
        } finally {
            setButtonLoading(generateBtn, false);
        }
    };

    openModalBtn.addEventListener('click', () => {
        calendarDate = new Date();
        selectedDates.clear();
        loadSelectedDates();
        modal.classList.add('is-visible');
    });

    closeModalBtn.addEventListener('click', () => modal.classList.remove('is-visible'));
    prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
    nextMonthBtn.addEventListener('click', () => navigateMonth(1));
    form.addEventListener('submit', handleFormSubmit);

    setButtonLoading(generateBtn, false);
}

// Inicializa a página de lista de pacientes, com busca e modal de detalhes.
async function initializePatientList(nutriId) {
    const tableBody = document.getElementById('patientTableBody');
    const searchInput = document.getElementById('patientSearchInput');
    const modal = document.getElementById('patientDetailsModal');
    const closeModalBtn = document.getElementById('closePatientModal');
    const emptyState = document.getElementById('emptyState');
    // Referência para o novo botão de agendar retorno.
    const btnScheduleReturn = document.getElementById('btnScheduleReturn');

    let allPatients = [];
    let currentPatientId = null;

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
            <td><span class="badge rounded-pill bg-success-subtle text-success-emphasis">${patient.status || 'Ativo'}</span></td>
            <td>${patient.appointmentDate || 'N/A'}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-light me-1 btn-ver-detalhes" data-patient-id="${patient.id}"><i class="bi bi-eye"></i></button>
                <a href="planeEditor.html?patientId=${patient.id}" class="btn btn-sm btn-light"><i class="bi bi-file-earmark-text"></i></a>
            </td>
        `;
            tableBody.appendChild(tr);
        });
    };

    const getPatientData = async () => {
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

    // Carrega e exibe todos os detalhes de um paciente no modal.
    const initPatientDetails = async (patientId) => {
        currentPatientId = patientId; // Armazena o ID do paciente atual.
        const loadingState = document.getElementById('modalLoadingState');
        const detailsContent = document.getElementById('modalDetailsContent');
        const planPane = document.getElementById('plan-pane');
        const consultationFormContainer = document.getElementById('consultation-form-container');
        const timelineContainer = document.getElementById('consultation-history-timeline');

        loadingState.style.display = 'block';
        detailsContent.style.display = 'none';
        planPane.innerHTML = '';
        consultationFormContainer.innerHTML = '';
        timelineContainer.innerHTML = '';

        // Reseta para a aba de acompanhamento.
        const followupTab = new bootstrap.Tab(document.getElementById('followup-tab'));
        followupTab.show();

        try {
            // Realiza todas as chamadas de API em paralelo para otimizar o carregamento.
            const [patientResponse, anamneseResponse, mealPlanResponse, consultationResponse] = await Promise.all([
                fetch(`/api/auth/patientDetails/${patientId}`),
                fetch(`/api/auth/anamneseDetails/${patientId}`),
                fetch(`/api/auth/mealplan/${patientId}`),
                fetch(`/api/auth/consultations/${patientId}`)
            ]);

            const patientResult = await patientResponse.json();
            const anamneseResult = await anamneseResponse.json();
            const mealPlanResult = await mealPlanResponse.json();
            const consultationResult = await consultationResponse.json();

            if (patientResult.success && anamneseResult.success && consultationResult.success) {
                const patient = patientResult.patients[0];
                const anamnese = anamneseResult.patients[0];

                // Preenche as abas de Detalhes e Anamnese.
                document.getElementById('modalPatientName').textContent = patient.nome;
                document.getElementById('modalPatientEmail').textContent = patient.email;
                document.getElementById('patientAvatar').src = `https://api.dicebear.com/8.x/bottts/svg?seed=${patient.id}`;
                document.getElementById('patientPhone').textContent = patient.phone || 'Não informado';
                document.getElementById('patientBirthdate').textContent = new Date(anamnese.birthdate).toLocaleDateString('pt-BR');
                document.getElementById('patientAppointmentDate').textContent = patient.appointmentDate || 'Nenhuma';
                document.getElementById('patientStatus').innerHTML = `<span class="badge rounded-pill bg-success-subtle text-success-emphasis">${patient.status || 'Ativo'}</span>`;

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

                // Preenche a aba de Plano Alimentar.
                if (mealPlanResult.success && mealPlanResult.plan && mealPlanResult.plan.meals.length > 0) {
                    planPane.innerHTML = `<div class="p-3"><h6>Plano Atual do Paciente</h6><p>Clique no botão para visualizar ou editar o plano de ${patient.nome}.</p><a href="planeEditor.html?patientId=${patientId}" class="btn btn-primary-custom"><i class="bi bi-layout-text-window-reverse"></i> Abrir Editor</a></div>`;
                } else {
                    planPane.innerHTML = `
                    <div class="text-center p-5">
                        <div class="empty-state-icon mx-auto mb-3" style="width: 60px; height: 60px; font-size: 2rem;"><i class="bi bi-file-earmark-plus"></i></div>
                        <h5 class="empty-state-title">Nenhum plano alimentar por aqui!</h5>
                        <p class="empty-state-text">Parece que ${patient.nome.split(' ')[0]} ainda não tem um plano. Que tal criar um agora para ajudar no seu progresso?</p>
                        <a href="planeEditor.html?patientId=${patientId}" class="btn btn-primary-custom mt-3"><i class="bi bi-plus-circle-fill me-2"></i>Adicionar Plano Alimentar</a>
                    </div>`;
                }

                // Renderiza a timeline de acompanhamento e o formulário.
                renderConsultationTimeline(consultationResult.history, consultationResult.pendingAppointments, patientId);

                const sortedPending = (consultationResult.pendingAppointments || []).sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));
                const itemToLoad = sortedPending.length > 0 ? sortedPending[0] : (consultationResult.history && consultationResult.history.length > 0 ? consultationResult.history[0] : null);

                if (itemToLoad) {
                    const isHistory = !sortedPending.some(p => p.id === itemToLoad.id);
                    renderConsultationForm(itemToLoad, patientId, isHistory);
                } else {
                    consultationFormContainer.innerHTML = '<div class="text-center p-5 border-dashed rounded-3"><p class="text-muted">Nenhuma consulta encontrada para este paciente.</p></div>';
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

    // Renderiza a timeline de histórico de consultas.
    const renderConsultationTimeline = (history, pendingAppointments, patientId) => {
        const timelineContainer = document.getElementById('consultation-history-timeline');
        timelineContainer.innerHTML = '';

        const allItems = [];
        if (pendingAppointments && pendingAppointments.length > 0) {
            allItems.push(...pendingAppointments.map(p => ({ ...p, isHistory: false })));
        }
        if (history && history.length > 0) {
            allItems.push(...history.map(h => ({ ...h, appointment_date: h.consultation_date, isHistory: true })));
        }

        if (allItems.length === 0) {
            timelineContainer.innerHTML = '<p class="text-muted small text-center mt-3">Nenhum histórico de consulta encontrado.</p>';
            return;
        }

        allItems.sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));

        allItems.forEach(item => {
            const itemDiv = document.createElement('div');
            const date = new Date(item.appointment_date);
            const isPast = date < new Date();

            itemDiv.className = `timeline-item ${isPast ? 'past' : ''}`;
            itemDiv.dataset.appointmentId = item.id;
            itemDiv.innerHTML = `
                <div class="timeline-icon"><i class="bi ${item.isHistory ? 'bi-check2-all' : 'bi-clock-history'}"></i></div>
                <div class="timeline-header">
                    <strong class="small">${item.service_type || 'Acompanhamento'}</strong>
                    <span class="text-muted small">${date.toLocaleDateString('pt-BR')}</span>
                </div>
            `;
            timelineContainer.appendChild(itemDiv);

            itemDiv.addEventListener('click', () => {
                document.querySelectorAll('.timeline-item.active').forEach(el => el.classList.remove('active'));
                itemDiv.classList.add('active');
                renderConsultationForm(item, patientId, item.isHistory);
            });
        });

        // Ativa o primeiro item da lista por padrão.
        if (timelineContainer.firstChild.classList.contains('timeline-item')) {
            timelineContainer.firstChild.classList.add('active');
        }
    };

    // Renderiza o formulário de acompanhamento da consulta.
    const renderConsultationForm = (appointment, patientId, isHistory) => {
        const formContainer = document.getElementById('consultation-form-container');
        const isPast = new Date(appointment.appointment_date) < new Date();
        const isDisabled = isHistory ? 'disabled' : '';

        formContainer.innerHTML = `
            <form id="consultationForm" data-appointment-id="${appointment.id}" data-patient-id="${patientId}">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">Acompanhamento da Consulta</h5>
                    <span class="badge ${isHistory ? 'bg-secondary' : (isPast ? 'bg-warning text-dark' : 'bg-primary')}">${isHistory ? 'Realizada' : (isPast ? 'A Fazer' : 'Agendada')}</span>
                </div>

                <h6>Medidas Antropométricas</h6>
                <div class="row g-3 mb-3">
                    <div class="col-md-6"><label class="form-label small">Peso (kg)</label><input type="number" step="0.1" class="form-control form-control-sm" id="consultationWeight" value="${appointment.weight || ''}" ${isDisabled} required></div>
                    <div class="col-md-6"><label class="form-label small">Altura (cm)</label><input type="number" class="form-control form-control-sm" id="consultationHeight" value="${appointment.height || ''}" ${isDisabled} required></div>
                    <div class="col-md-6"><label class="form-label small">Cintura (cm)</label><input type="number" step="0.1" class="form-control form-control-sm" id="circum_waist" value="${appointment.circum_waist || ''}" ${isDisabled}></div>
                    <div class="col-md-6"><label class="form-label small">Abdômen (cm)</label><input type="number" step="0.1" class="form-control form-control-sm" id="circum_abdomen" value="${appointment.circum_abdomen || ''}" ${isDisabled}></div>
                    <div class="col-md-6"><label class="form-label small">Quadril (cm)</label><input type="number" step="0.1" class="form-control form-control-sm" id="circum_hip" value="${appointment.circum_hip || ''}" ${isDisabled}></div>
                    <div class="col-md-6"><label class="form-label small">Braço (cm)</label><input type="number" step="0.1" class="form-control form-control-sm" id="circum_arm" value="${appointment.circum_arm || ''}" ${isDisabled}></div>
                </div>
                
                <h6>Dobras Cutâneas (mm)</h6>
                <div class="row g-3 mb-3">
                    <div class="col-md-6"><label class="form-label small">Tríceps</label><input type="number" step="0.1" class="form-control form-control-sm" id="skinfold_triceps" value="${appointment.skinfold_triceps || ''}" ${isDisabled}></div>
                    <div class="col-md-6"><label class="form-label small">Subescapular</label><input type="number" step="0.1" class="form-control form-control-sm" id="skinfold_subscapular" value="${appointment.skinfold_subscapular || ''}" ${isDisabled}></div>
                    <div class="col-md-6"><label class="form-label small">Supra-ilíaca</label><input type="number" step="0.1" class="form-control form-control-sm" id="skinfold_suprailiac" value="${appointment.skinfold_suprailiac || ''}" ${isDisabled}></div>
                    <div class="col-md-6"><label class="form-label small">Abdominal</label><input type="number" step="0.1" class="form-control form-control-sm" id="skinfold_abdominal" value="${appointment.skinfold_abdominal || ''}" ${isDisabled}></div>
                </div>
                
                <div class="row g-3 mb-3">
                     <div class="col-md-6"><label class="form-label small">Gordura Corporal (%)</label><input type="number" step="0.1" class="form-control form-control-sm" id="body_fat_percentage" value="${appointment.body_fat_percentage || ''}" ${isDisabled}></div>
                </div>

                <h6>Anotações (Método SOAP)</h6>
                <div class="mb-2">
                    <label for="subjective_notes" class="form-label small"><strong>S (Subjetivo):</strong> Relato do paciente</label>
                    <textarea class="form-control" id="subjective_notes" rows="2" ${isDisabled} required>${appointment.subjective_notes || ''}</textarea>
                </div>
                <div class="mb-2">
                    <label for="objective_notes" class="form-label small"><strong>O (Objetivo):</strong> Dados objetivos e medidas</label>
                    <textarea class="form-control" id="objective_notes" rows="2" ${isDisabled} required>${appointment.objective_notes || ''}</textarea>
                </div>
                <div class="mb-2">
                    <label for="assessment_notes" class="form-label small"><strong>A (Avaliação):</strong> Análise e diagnóstico nutricional</label>
                    <textarea class="form-control" id="assessment_notes" rows="2" ${isDisabled} required>${appointment.assessment_notes || ''}</textarea>
                </div>
                <div class="mb-3">
                    <label for="plan_notes" class="form-label small"><strong>P (Plano):</strong> Conduta e plano de ação</label>
                    <textarea class="form-control" id="plan_notes" rows="2" ${isDisabled} required>${appointment.plan_notes || ''}</textarea>
                </div>
                
                <div id="consultation-message" class="form-message-container mb-3"></div>
                
                ${!isHistory ? `
                    <div class="d-grid">
                        <button type="submit" class="btn btn-primary-custom"><i class="bi bi-check-circle-fill me-2"></i> Salvar Acompanhamento</button>
                    </div>`
                : ''}
            </form>
        `;

        // Adiciona o listener de submit apenas se o formulário não for histórico.
        if (!isHistory) {
            formContainer.querySelector('#consultationForm').addEventListener('submit', handleSaveConsultation);
        }
    };

    // Lida com o salvamento dos dados da consulta.
    const handleSaveConsultation = async (e) => {
        e.preventDefault();
        const form = e.target;
        const patientId = form.dataset.patientId;
        const messageContainer = document.getElementById('consultation-message');

        const payload = {
            appointmentId: form.dataset.appointmentId,
            patientId: patientId,
            weight: document.getElementById('consultationWeight').value,
            height: document.getElementById('consultationHeight').value,
            circum_waist: document.getElementById('circum_waist').value,
            circum_abdomen: document.getElementById('circum_abdomen').value,
            circum_hip: document.getElementById('circum_hip').value,
            circum_arm: document.getElementById('circum_arm').value,
            skinfold_triceps: document.getElementById('skinfold_triceps').value,
            skinfold_subscapular: document.getElementById('skinfold_subscapular').value,
            skinfold_suprailiac: document.getElementById('skinfold_suprailiac').value,
            skinfold_abdominal: document.getElementById('skinfold_abdominal').value,
            body_fat_percentage: document.getElementById('body_fat_percentage').value,
            subjective_notes: document.getElementById('subjective_notes').value,
            objective_notes: document.getElementById('objective_notes').value,
            assessment_notes: document.getElementById('assessment_notes').value,
            plan_notes: document.getElementById('plan_notes').value,
        };

        try {
            const response = await fetch('/api/auth/consultations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            messageContainer.textContent = result.message;
            messageContainer.className = `form-message-container ${result.success ? 'success' : 'error'} visible`;

            if (result.success) {
                setTimeout(() => {
                    initPatientDetails(patientId); // Recarrega os dados do paciente
                }, 1500);
            }
        } catch (error) {
            console.error(error);
            messageContainer.textContent = 'Erro de comunicação ao salvar.';
            messageContainer.className = 'form-message-container error visible';
        }
    };

    /**
     * FUNÇÃO INDEPENDENTE PARA AGENDAMENTO DE RETORNO
     * Abre e gerencia o modal de agendamento de retorno.
     */
    const openScheduleReturnModal = (patientId) => {
        const modal = document.getElementById('scheduleReturnModal');
        const datePickerEl = document.getElementById('returnDatePicker');
        const patientName = document.getElementById('modalPatientName').textContent;
        document.getElementById('returnPatientName').textContent = patientName;

        let selectedDate = null;
        let selectedTime = null;

        if (window.returnDatePickerInstance) {
            window.returnDatePickerInstance.destroy();
        }

        window.returnDatePickerInstance = new Datepicker(datePickerEl, {
            format: 'yyyy-mm-dd',
            language: 'pt-BR',
            autohide: true,
            todayHighlight: true
        });

        datePickerEl.addEventListener('changeDate', async e => {
            selectedDate = e.detail.date.toISOString().split('T')[0];
            document.getElementById('returnSelectedDate').textContent = `Horários para ${e.detail.date.toLocaleDateString('pt-BR')}`;

            const timeSlotsList = document.getElementById('returnTimeSlots');
            const loader = document.getElementById('return-slots-loader');
            loader.style.display = 'block';
            timeSlotsList.innerHTML = '';

            const response = await fetch(`/api/auth/schedule/available?nutriId=${nutriId}&date=${selectedDate}`);
            const result = await response.json();

            loader.style.display = 'none';
            if (result.success && result.availableSlots.length > 0) {
                result.availableSlots.forEach(time => {
                    const slot = document.createElement('div');
                    slot.className = 'time-slot';
                    slot.textContent = time;
                    slot.addEventListener('click', () => {
                        document.querySelectorAll('#returnTimeSlots .time-slot').forEach(s => s.classList.remove('selected'));
                        slot.classList.add('selected');
                        selectedTime = time;
                        document.getElementById('confirmReturnScheduleBtn').disabled = false;
                    });
                    timeSlotsList.appendChild(slot);
                });
            } else {
                timeSlotsList.innerHTML = '<p class="text-muted text-center small">Nenhum horário disponível.</p>';
            }
        });


        document.getElementById('confirmReturnScheduleBtn').onclick = async () => {
            if (!selectedDate || !selectedTime) {
                // 
                return;
            }

            try {
                const response = await fetch('/api/auth/appointments/schedule-return', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        patientId: currentPatientId,
                        returnDate: selectedDate,
                        returnTime: selectedTime
                    })
                });

                const result = await response.json();

                if (result.success) {
                    console.log("result.success")
                    modal.classList.remove('is-visible');

                    initPatientDetails(currentPatientId);
                }
            } catch (error) {
                console.log("erro no agendamento do retorno")
                console.log(error);
            }
        };

        const closeModalBtn = document.getElementById('closeScheduleReturnModal');
        closeModalBtn.onclick = () => {
            modal.classList.remove('is-visible');
        };
        modal.classList.add('is-visible');
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

    // Adiciona o listener para o novo botão de agendar retorno.
    btnScheduleReturn.addEventListener('click', () => {
        if (currentPatientId) {
            openScheduleReturnModal(currentPatientId);
        }
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
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-container');
        if (isLoading) {
            btnText.style.display = 'none';
            spinner.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
        }
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
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-container');
        if (isLoading) {
            btnText.style.display = 'none';
            spinner.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
        }
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

// Inicializa a página principal do dashboard da nutricionista.
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

    // Carga inicial dos agendamentos pendentes.
    await initializePendingAppointments();

    // Inicia o polling para manter a lista de pendentes atualizada a cada 5 segundos.
    setInterval(initializePendingAppointments, 5000);
}

/**
 * ATUALIZADO
 * Atualiza os elementos da interface do dashboard com os dados dinâmicos vindos do backend.
 * Garante que os agendamentos do dia e o total de pacientes ativos sejam exibidos corretamente.
 */
function updateDashboardUI(data) {
    // Atualiza os KPIs no topo do dashboard.
    document.getElementById('kpi-today-appointments').textContent = data.kpis.todayAppointments;
    document.getElementById('kpi-active-patients').textContent = data.kpis.activePatients;
    document.getElementById('kpi-monthly-revenue').textContent = data.kpis.monthlyRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Formata a nota média para uma casa decimal ou exibe 'N/A' se não houver avaliações.
    const avgScore = data.kpis.avgScore ? parseFloat(data.kpis.avgScore).toFixed(1) : 'N/A';
    document.getElementById('kpi-avg-score').textContent = avgScore;


    const appointmentsList = document.getElementById('today-appointments-list');
    const emptyAppointmentsState = document.getElementById('empty-appointments-state');
    appointmentsList.innerHTML = '';

    // Verifica se há agendamentos para hoje e os renderiza na lista.
    if (!data.todayAppointments || data.todayAppointments.length === 0) {
        emptyAppointmentsState.style.display = 'block';
    } else {
        emptyAppointmentsState.style.display = 'none';
        data.todayAppointments.forEach(apt => {
            const item = document.createElement('li');
            item.className = 'list-group-item appointment-item';

            const typeClass = apt.service_type.toLowerCase().includes('retorno') ? 'retorno' :
                (apt.service_type.toLowerCase().includes('online') ? 'online' : 'primeira');


            item.innerHTML = `
                <div class="appointment-item-time">${apt.time}</div>
                <div class="appointment-item-divider type-${typeClass}"></div>
                <div class="appointment-item-details flex-grow-1">
                    <div class="patient-name">${apt.patient_name}</div>
                    <div class="appointment-type">${apt.service_type}</div>
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