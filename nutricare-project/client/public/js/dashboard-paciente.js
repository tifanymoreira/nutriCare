// dashboard-paciente.js

document.addEventListener('DOMContentLoaded', async () => {
    const pathLower = window.location.pathname.toLowerCase();
    
    // 1. Aniquilador PWA / Cache Fantasma — roda só UMA vez e sem bloquear a navegação.
    if (!localStorage.getItem('pwaCleaned')) {
        localStorage.setItem('pwaCleaned', '1');
        if ('caches' in window) caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
        if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    }

    // Pré-carrega as páginas da navegação inferior quando o navegador ficar ocioso (troca instantânea).
    const prefetchPatientNav = () => {
        document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(a => {
            const href = a.getAttribute('href');
            if (!href || a.classList.contains('active')) return;
            const l = document.createElement('link'); l.rel = 'prefetch'; l.href = href; document.head.appendChild(l);
        });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(prefetchPatientNav, { timeout: 2000 });
    else setTimeout(prefetchPatientNav, 800);

    // 2. Autenticação e Redirecionamento
    const user = await verifySession();
    if (!user || user.role !== 'paciente') {
        window.location.replace('/pages/login.html');
        return;
    }

    // 3. Interface Comum (Avatares)
    const avatarImgs = document.querySelectorAll('img[src*="dicebear"]');
    avatarImgs.forEach(img => img.src = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.name)}`);

    // 4. Roteamento Inteligente baseado na Página
    if (pathLower.includes('dashboard.html')) {
        initDashboard(user);
    } else if (pathLower.includes('appointments.html')) {
        initAppointments(user);
    } else if (pathLower.includes('mealplan.html')) {
        initDietTabs();
        initMealPlan(user);
        initShoppingList();
        initAiChef();
    } else if (pathLower.includes('shoppinglist.html')) {
        initShoppingList();
    } else if (pathLower.includes('aichef.html')) {
        initAiChef();
    } else if (pathLower.includes('profile.html')) {
        initProfile(user);
    } else if (pathLower.includes('receituario.html')) {
        initClinicalNotes('prescription', 'prescriptionsContainer', 'emptyPrescriptions');
    } else if (pathLower.includes('encaminhamentos.html')) {
        initClinicalNotes('referral', 'referralsContainer', 'emptyReferrals');
    }

    // 5. Notificações e Dropdown Superior
    const notifBtn = document.getElementById('notificationBtn');
    const notifDropdown = document.getElementById('notificationDropdown');
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', () => notifDropdown.classList.toggle('is-visible'));
        document.addEventListener('click', (e) => {
            if(!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) notifDropdown.classList.remove('is-visible');
        });
        loadPatientNotifications();
    }

    // 6. Botão de Sair Superior
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // 7. Configura Modal de Agendamento
    setupBookingModal(user);
});

// ======================= UTILITÁRIOS ======================= //

window.showToast = function(message, type = 'success') {
    const toast = document.getElementById('systemToast');
    if(!toast) return;
    const msgEl = document.getElementById('toastMessage');
    const iconEl = toast.querySelector('.toast-icon');
    msgEl.textContent = message;
    toast.className = `custom-toast show ${type}`;
    iconEl.className = type === 'success' ? 'bi bi-check-circle-fill toast-icon' : 'bi bi-exclamation-triangle-fill toast-icon';
    setTimeout(() => toast.classList.remove('show'), 3500);
};

async function verifySession() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.user) return result.user;
        }
    } catch (e) {}
    return null;
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/pages/login.html';
    } catch (e) {
        window.location.href = '/pages/login.html';
    }
}

async function loadPatientNotifications() {
    try {
        const res = await fetch('/api/auth/patient/notifications');
        const data = await res.json();
        const badge = document.getElementById('notificationBadge');
        const list = document.getElementById('notificationList');
        if (data.success && data.notifications.length > 0) {
            badge.textContent = data.notifications.length;
            badge.classList.remove('d-none');
            list.innerHTML = data.notifications.map(n => `
                <div class="notification-item">
                    <div class="notification-icon-status ${n.type === 'success' ? 'status-approved' : 'status-rejected'}">
                        <i class="bi ${n.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
                    </div>
                    <div class="notification-content">
                        ${n.title ? `<div class="notification-title fw-bold text-dark">${escHtml(n.title)}</div>` : ''}
                        <div class="small text-muted">${escHtml(n.message)}</div>
                    </div>
                </div>
            `).join('');
        } else {
            badge.classList.add('d-none');
            list.innerHTML = '<div class="p-4 text-center text-muted small">Sem notificações recentes.</div>';
        }
    } catch (e) {}
}

// ======================= LÓGICA DAS TELAS ======================= //

// --- DASHBOARD PRINCIPAL ---
async function initDashboard(user) {
    const greeting = document.getElementById('greetingText');
    const headerDate = document.getElementById('headerDate');
    if(greeting) greeting.textContent = `Olá, ${user.name.split(' ')[0]}!`;
    if(headerDate) headerDate.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

    try {
        const res = await fetch('/api/auth/patient/dashboard-overview');
        const data = await res.json();
        if(data.success) {
            // Preenchimento de KPIs do Paciente
            if (data.data.kpis.currentWeight) {
                document.getElementById('kpiWeight').textContent = `${data.data.kpis.currentWeight} kg`;
                const diff = parseFloat(data.data.kpis.weightDifference);
                const diffEl = document.getElementById('kpiWeightDiff');
                if(diff < 0) { diffEl.textContent = `${diff} kg`; diffEl.className = 'badge bg-success text-white mt-2'; }
                else if(diff > 0) { diffEl.textContent = `+${diff} kg`; diffEl.className = 'badge bg-danger text-white mt-2'; }
                else { diffEl.textContent = 'Mantido'; }
            }
            if (data.data.kpis.bodyFat) document.getElementById('kpiFat').textContent = `${data.data.kpis.bodyFat} %`;

            // Card de Próxima Consulta
            const nextAppt = data.data.nextAppointment;
            const nextCard = document.getElementById('nextAppointmentCard');
            if(nextAppt && nextCard) {
                nextCard.style.display = 'flex';
                document.getElementById('nextApptTitle').textContent = `Consulta: ${nextAppt.service}`;
                document.getElementById('nextApptInfo').textContent = `${nextAppt.date} às ${nextAppt.time}`;
                document.getElementById('btnRescheduleNext').onclick = () => window.openBookingModal();
            }
        }
    } catch(e) { console.error(e); }

    // Gráfico de evolução corporal
    fetch(`/api/anthropometry/history/${user.id}`)
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.history?.length) return;
            const section = document.getElementById('evolutionSection');
            if (section) section.style.display = '';

            const history = data.history;
            const labels = history.map(h => new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
            const weights = history.map(h => parseFloat(h.weight) || null);
            const fats    = history.map(h => parseFloat(h.body_fat) || null);

            let evoChart = null;
            const canvas = document.getElementById('evolutionChart');
            if (!canvas) return;

            const renderChart = (metric) => {
                if (evoChart) evoChart.destroy();
                const isWeight = metric === 'weight';
                const dataset = isWeight ? weights : fats;
                const color = isWeight ? '#2a9d8f' : '#f4a261';
                const label = isWeight ? 'Peso (kg)' : '% Gordura';

                evoChart = new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label,
                            data: dataset,
                            borderColor: color,
                            backgroundColor: color + '22',
                            borderWidth: 2.5,
                            pointBackgroundColor: color,
                            pointRadius: 4,
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 10 } } },
                            y: { grid: { color: '#f0f0f0' }, ticks: { font: { family: 'Poppins', size: 10 } } }
                        }
                    }
                });
            };

            renderChart('weight');

            document.querySelectorAll('.evo-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.evo-tab').forEach(b => {
                        b.classList.remove('btn-primary-custom', 'active-evo');
                        b.classList.add('text-muted');
                        b.style.background = 'transparent';
                    });
                    btn.classList.add('btn-primary-custom', 'active-evo');
                    btn.classList.remove('text-muted');
                    renderChart(btn.dataset.metric);
                });
            });
        })
        .catch(() => {});

    // Banner de fatura vencida (apenas pacientes particulares)
    if (user.patient_type !== 'convenio') {
        fetch(`/api/auth/patient/${user.id}/invoices`)
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.invoices?.length) return;
                const today = new Date().toISOString().split('T')[0];
                const overdue = data.invoices.filter(inv =>
                    inv.status !== 'Paid' && inv.status !== 'Pago' &&
                    inv.due_date && inv.due_date.substring(0, 10) < today
                );
                if (overdue.length === 0) return;
                const total = overdue.reduce((s, i) => s + parseFloat(i.amount || 0), 0)
                    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const banner = document.createElement('div');
                banner.className = 'glass-card p-3 mb-4 d-flex align-items-center gap-3 accent-danger';
                banner.innerHTML = `
                    <i class="bi bi-exclamation-triangle-fill text-danger fs-4 flex-shrink-0"></i>
                    <div class="flex-grow-1">
                        <div class="fw-bold text-dark small">Você tem ${overdue.length} fatura${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''} — Total: ${total}</div>
                        <div class="text-muted small">Regularize para manter seu acompanhamento ativo.</div>
                    </div>
                    <a href="appointments.html" class="btn btn-danger btn-sm rounded-pill fw-bold px-3 flex-shrink-0">Ver Faturas</a>`;
                const main = document.querySelector('main');
                if (main) main.prepend(banner);
            })
            .catch(() => {});
    }

    // Rastreador de Água — persiste no banco, usa localStorage como cache imediato
    const glasses = document.querySelectorAll('.water-glass');
    const text = document.getElementById('waterCounterText');
    let waterCount = parseInt(localStorage.getItem(`waterCount_${new Date().toDateString()}`)) || 0;

    const updateWaterUI = () => {
        glasses.forEach((g, idx) => {
            if (idx < waterCount) g.classList.add('filled');
            else g.classList.remove('filled');
        });
        if (text) text.textContent = `${waterCount} / 8 Copos`;
    };
    updateWaterUI(); // render imediato com valor do cache

    // Sincroniza com o banco em background (sobrepõe o cache se diferente)
    fetch('/api/auth/patient/water')
        .then(r => r.json())
        .then(d => {
            if (d.success && d.count !== waterCount) {
                waterCount = d.count;
                localStorage.setItem(`waterCount_${new Date().toDateString()}`, waterCount);
                updateWaterUI();
            }
        })
        .catch(() => {});

    glasses.forEach(g => {
        g.addEventListener('click', () => {
            const idx = parseInt(g.getAttribute('data-index'));
            waterCount = (idx === waterCount) ? waterCount - 1 : idx;
            if (waterCount < 0) waterCount = 0;
            localStorage.setItem(`waterCount_${new Date().toDateString()}`, waterCount);
            updateWaterUI();
            // Persiste no banco (fire-and-forget)
            fetch('/api/auth/patient/water', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: waterCount })
            }).catch(() => {});
        });
    });
}

// --- MINHAS CONSULTAS ---
async function initAppointments(user) {
    const listContainer = document.getElementById('appointmentsListContainer');
    const invoicesContainer = document.getElementById('invoicesListContainer');
    const btnNew = document.getElementById('btnNewAppointment');
    const tabBtnAppts = document.getElementById('tabBtnAppts');
    const tabBtnInvoices = document.getElementById('tabBtnInvoices');
    let apptToCancel = null;

    if(btnNew) btnNew.addEventListener('click', () => window.openBookingModal());

    let invoicesTabActive = false;

    // --- Troca de abas ---
    const showAppts = () => {
        invoicesTabActive = false;
        listContainer.style.removeProperty('display');
        invoicesContainer.style.setProperty('display', 'none', 'important');
        if(btnNew) btnNew.style.display = '';
        tabBtnAppts.classList.add('btn-primary-custom');
        tabBtnAppts.classList.remove('text-muted');
        tabBtnAppts.style.background = '';
        tabBtnInvoices.classList.remove('btn-primary-custom');
        tabBtnInvoices.classList.add('text-muted');
        tabBtnInvoices.style.background = 'transparent';
    };

    const showInvoices = () => {
        invoicesTabActive = true;
        listContainer.style.setProperty('display', 'none', 'important');
        invoicesContainer.style.removeProperty('display');
        if(btnNew) btnNew.style.display = 'none';
        tabBtnInvoices.classList.add('btn-primary-custom');
        tabBtnInvoices.classList.remove('text-muted');
        tabBtnInvoices.style.background = '';
        tabBtnAppts.classList.remove('btn-primary-custom');
        tabBtnAppts.classList.add('text-muted');
        tabBtnAppts.style.background = 'transparent';
        if (user.patient_type === 'convenio') {
            renderConvenioMessage();
        } else {
            loadInvoices();
        }
    };

    const renderConvenioMessage = () => {
        invoicesContainer.innerHTML = `
            <div class="glass-card p-4 text-center accent-info">
                <i class="bi bi-shield-check-fill text-info display-4 mb-3 d-block"></i>
                <h5 class="fw-bold text-dark mb-2">Atendimento via Convênio</h5>
                <p class="text-muted small mb-0">Seu atendimento é coberto pelo seu plano de saúde.<br>Nenhum pagamento direto é necessário.</p>
            </div>`;
    };

    if(tabBtnAppts) tabBtnAppts.addEventListener('click', showAppts);
    if(tabBtnInvoices) tabBtnInvoices.addEventListener('click', showInvoices);

    // Ao voltar para o app (ex.: após concluir o pagamento na aba do Mercado Pago),
    // recarrega as faturas para refletir o status atualizado pelo webhook.
    const refreshInvoicesOnReturn = () => {
        if (!invoicesTabActive || user.patient_type === 'convenio') return;
        loadInvoices();
        // Recheca uma vez logo depois, caso o webhook do Mercado Pago ainda
        // estivesse processando no instante em que o paciente voltou.
        setTimeout(() => { if (invoicesTabActive) loadInvoices(); }, 4000);
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshInvoicesOnReturn(); });
    window.addEventListener('focus', refreshInvoicesOnReturn);

    // --- Carregamento de faturas ---
    const loadInvoices = async () => {
        invoicesContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';
        try {
            const res = await fetch(`/api/auth/patient/${user.id}/invoices`);
            const data = await res.json();
            invoicesContainer.innerHTML = '';
            if(data.success && data.invoices && data.invoices.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                data.invoices.forEach(inv => {
                    const isPaid = inv.status === 'Paid' || inv.status === 'Pago';
                    const isOverdue = !isPaid && inv.due_date && inv.due_date.substring(0,10) < today;
                    const amount = parseFloat(inv.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    // O backend pode mandar a data como "YYYY-MM-DD" ou ISO completa; pega só os 10 primeiros chars.
                    const fmtInvDate = (d) => { const s = d ? String(d).substring(0, 10) : ''; const dt = s ? new Date(s + 'T12:00:00') : null; return (dt && !isNaN(dt)) ? dt.toLocaleDateString('pt-BR') : '—'; };
                    const issueDateStr = fmtInvDate(inv.issue_date);
                    const dueDateStr   = fmtInvDate(inv.due_date);

                    let statusBadge;
                    if(isPaid)         statusBadge = '<span class="badge bg-success px-3 py-2 rounded-pill shadow-sm">Pago</span>';
                    else if(isOverdue) statusBadge = '<span class="badge bg-danger px-3 py-2 rounded-pill shadow-sm">Atrasado</span>';
                    else               statusBadge = '<span class="badge bg-warning text-dark px-3 py-2 rounded-pill shadow-sm">Pendente</span>';

                    const payBtn = !isPaid
                        ? `<button type="button" class="btn btn-success rounded-pill fw-bold px-4 shadow-sm mt-3 w-100 btn-pay-invoice" data-id="${inv.id}"><i class="bi bi-credit-card-2-front-fill me-2"></i>Pagar Agora via Mercado Pago</button>`
                        : '';

                    const card = document.createElement('div');
                    card.className = 'glass-card p-4';
                    card.innerHTML = `
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="fw-bold text-dark mb-1">${amount}</h5>
                                <div class="text-muted small"><i class="bi bi-calendar3 me-1"></i>Emissão: ${issueDateStr}</div>
                                <div class="text-muted small"><i class="bi bi-calendar-x me-1"></i>Vencimento: ${dueDateStr}</div>
                            </div>
                            <div>${statusBadge}</div>
                        </div>
                        ${payBtn}
                    `;
                    invoicesContainer.appendChild(card);
                });

                // Botão "Pagar": gera (ou reaproveita) o link do Mercado Pago sob demanda.
                invoicesContainer.querySelectorAll('.btn-pay-invoice').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.id;
                        const orig = btn.innerHTML;
                        btn.disabled = true;
                        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Gerando link seguro...';
                        try {
                            const r = await fetch(`/api/auth/patient/invoices/${id}/pay-link`);
                            const d = await r.json();
                            if (d.success && d.paymentLink) {
                                window.open(d.paymentLink, '_blank', 'noopener,noreferrer');
                            } else {
                                window.showToast(d.message || 'Não foi possível gerar o link de pagamento.', 'error');
                            }
                        } catch (e) {
                            window.showToast('Erro de comunicação ao gerar o pagamento.', 'error');
                        } finally {
                            btn.disabled = false;
                            btn.innerHTML = orig;
                        }
                    });
                });
            } else {
                invoicesContainer.innerHTML = `<div class="glass-card text-center p-5">
                    <i class="bi bi-receipt text-muted display-4 mb-3 d-block opacity-50"></i>
                    <p class="text-muted fw-medium mb-0">Nenhuma fatura encontrada.</p>
                </div>`;
            }
        } catch(e) {
            invoicesContainer.innerHTML = `<div class="glass-card text-center p-4">
                <p class="text-danger fw-medium mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Erro ao carregar faturas.</p>
            </div>`;
        }
    };

    const loadAppointments = async () => {
        try {
            const res = await fetch('/api/auth/patient/appointments');
            const data = await res.json();
            if (data.success) {
                listContainer.innerHTML = '';
                if(data.appointments.length === 0) {
                    listContainer.innerHTML = '<div class="glass-card text-center p-5"><i class="bi bi-calendar-x text-muted display-4 mb-3 d-block opacity-50"></i><p class="text-muted fw-medium mb-0">Nenhuma consulta encontrada.</p></div>';
                    return;
                }
                data.appointments.forEach(apt => {
                    const dateObj = new Date(apt.appointment_date);
                    const dateStr = dateObj.toLocaleDateString('pt-BR');
                    const timeStr = dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                    
                    let statusBadge = '';
                    if(apt.status === 'Pendente') statusBadge = '<span class="badge bg-warning text-dark px-3 py-2 rounded-pill shadow-sm">Aguardando Nutri</span>';
                    else if(apt.status === 'Confirmada') statusBadge = '<span class="badge bg-success px-3 py-2 rounded-pill shadow-sm">Confirmada</span>';
                    else statusBadge = `<span class="badge bg-secondary px-3 py-2 rounded-pill shadow-sm">${apt.status}</span>`;

                    const isOnline = apt.service_type.toLowerCase().includes('online');
                    const typeClass = apt.service_type.toLowerCase().includes('retorno') ? 'type-retorno' : (isOnline ? 'type-online' : 'type-primeira');

                    const videoBtn = (apt.status === 'Confirmada' && isOnline && apt.video_link)
                        ? `<a href="${apt.video_link}" target="_blank" rel="noopener noreferrer" class="btn btn-info text-white rounded-pill fw-bold shadow-sm px-3"><i class="bi bi-camera-video-fill me-1"></i>Entrar na Consulta</a>`
                        : '';

                    const rateBtn = (apt.status === 'Realizada' && !apt.is_rated)
                        ? `<button class="btn btn-warning btn-sm rounded-pill fw-bold px-3 btn-rate" data-id="${apt.id}"><i class="bi bi-star-fill me-1"></i>Avaliar</button>`
                        : (apt.status === 'Realizada' && apt.is_rated)
                        ? `<span class="badge bg-success bg-opacity-10 text-success border border-success rounded-pill px-3 py-2 small"><i class="bi bi-check-circle-fill me-1"></i>Avaliada</span>`
                        : '';

                    const card = document.createElement('div');
                    card.className = `glass-card p-4 appointment-card ${typeClass} d-flex flex-column flex-md-row align-items-md-center`;
                    card.innerHTML = `
                        <div class="appointment-icon ${typeClass} fs-1"><i class="bi bi-calendar-check"></i></div>
                        <div class="appointment-details flex-grow-1 ms-md-3 mt-3 mt-md-0">
                            <h5 class="appointment-title mb-1">${apt.service_type}</h5>
                            <div class="appointment-info text-muted"><i class="bi bi-clock"></i> ${dateStr} às ${timeStr}</div>
                            <div class="mt-2 d-flex flex-wrap gap-2 align-items-center">${statusBadge}${videoBtn}${rateBtn}</div>
                        </div>
                        ${(apt.status === 'Pendente' || apt.status === 'Confirmada') ? `<div class="ms-md-auto mt-3 mt-md-0"><button class="btn btn-outline-danger rounded-pill fw-bold btn-cancel" data-id="${apt.id}">Cancelar</button></div>` : ''}
                    `;
                    listContainer.appendChild(card);
                });

                document.querySelectorAll('.btn-cancel').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        apptToCancel = e.target.getAttribute('data-id');
                        document.getElementById('actionConfirmModal').classList.add('is-visible');
                    });
                });
            }
        } catch(e) {}
    };

    document.getElementById('closeConfirmModalBtn')?.addEventListener('click', () => document.getElementById('actionConfirmModal').classList.remove('is-visible'));
    document.getElementById('confirmCancelBtn')?.addEventListener('click', async () => {
        if(!apptToCancel) return;
        const btn = document.getElementById('confirmCancelBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        try {
            const res = await fetch('/api/auth/patient/appointments', {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: apptToCancel })
            });
            const data = await res.json();
            if(data.success) { window.showToast(data.message, 'success'); loadAppointments(); }
            else window.showToast(data.message, 'error');
        } catch(e) { window.showToast('Erro de conexão', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = 'Sim, Cancelar'; document.getElementById('actionConfirmModal').classList.remove('is-visible'); }
    });
    loadAppointments();

    // --- Modal de avaliação ---
    const ratingModal = document.getElementById('ratingModal');
    if (ratingModal) {
        document.getElementById('closeRatingModal')?.addEventListener('click', () => ratingModal.classList.remove('is-visible'));

        const setupStars = (containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.querySelectorAll('.star').forEach(star => {
                star.addEventListener('click', () => {
                    const val = parseInt(star.dataset.v);
                    container.dataset.value = val;
                    container.querySelectorAll('.star').forEach(s => {
                        s.classList.toggle('active', parseInt(s.dataset.v) <= val);
                    });
                });
            });
        };
        setupStars('nutriStars');
        setupStars('planStars');

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-rate');
            if (btn) {
                document.getElementById('ratingAppointmentId').value = btn.dataset.id;
                document.getElementById('nutriStars').dataset.value = '0';
                document.getElementById('planStars').dataset.value = '0';
                document.querySelectorAll('.star-rating .star').forEach(s => s.classList.remove('active'));
                document.getElementById('ratingComment').value = '';
                ratingModal.classList.add('is-visible');
            }
        });

        document.getElementById('btnSubmitRating')?.addEventListener('click', async () => {
            const nutriRating = parseInt(document.getElementById('nutriStars').dataset.value);
            const planRating  = parseInt(document.getElementById('planStars').dataset.value);
            const appointmentId = document.getElementById('ratingAppointmentId').value;
            if (!nutriRating) { window.showToast('Avalie a nutricionista para continuar.', 'error'); return; }
            const btn = document.getElementById('btnSubmitRating');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Enviando...';
            try {
                const res = await fetch('/api/auth/patient/submit-survey', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        appointmentId,
                        nutriRating,
                        systemRating: nutriRating,
                        mealPlanRating: planRating || null,
                        nutriComments: document.getElementById('ratingComment').value,
                        systemComments: '',
                        mealPlanComments: ''
                    })
                });
                const data = await res.json();
                if (data.success) {
                    window.showToast('Obrigado pela sua avaliação!', 'success');
                    ratingModal.classList.remove('is-visible');
                    loadAppointments();
                } else {
                    window.showToast(data.message || 'Erro ao enviar.', 'error');
                }
            } catch(e) { window.showToast('Erro de conexão.', 'error'); }
            finally { btn.disabled = false; btn.innerHTML = 'Enviar Avaliação'; }
        });
    }
}

// --- Utilitário: escaping HTML para prevenir XSS em innerHTML ---
const escHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// --- HELPER: estado visual do botão de feedback ---
function setFeedbackConsumed(btn, consumed) {
    btn.dataset.consumed = consumed ? '1' : '0';
    if (consumed) {
        btn.style.cssText = 'background:rgba(25,135,84,0.12);border:1.5px solid #198754;color:#198754;';
        btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Consumida hoje!';
    } else {
        btn.style.cssText = 'background:rgba(255,255,255,0.6);border:1.5px solid #dee2e6;color:#6c757d;';
        btn.innerHTML = '<i class="bi bi-circle me-1"></i> Marcar como consumida';
    }
}

// --- ABAS DA TELA DE DIETA (Cardápio / Compras / Chef IA) ---
function initDietTabs() {
    const tabs = document.getElementById('dietTabs');
    if (!tabs) return;
    const buttons = tabs.querySelectorAll('.diet-segment-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.diet-pane').forEach(p => p.classList.add('d-none'));
            const pane = document.getElementById(btn.dataset.pane);
            if (pane) pane.classList.remove('d-none');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// --- MEU PLANO ALIMENTAR ---
const MEAL_ICONS = [
    { re: /pr[ée]\s*-?\s*treino|p[óo]s\s*-?\s*treino|treino/i, icon: 'bi-lightning-charge-fill' },
    { re: /caf[eé]|manh/i,            icon: 'bi-cup-hot-fill' },
    { re: /colaç|colac|desjejum/i,    icon: 'bi-egg-fried' },
    { re: /almo/i,                    icon: 'bi-egg-fried' },
    { re: /lanche|tarde|merenda/i,    icon: 'bi-cookie' },
    { re: /jantar|noite/i,            icon: 'bi-moon-stars-fill' },
    { re: /ceia/i,                    icon: 'bi-moon-fill' },
];
function mealIcon(name) {
    const m = MEAL_ICONS.find(o => o.re.test(name || ''));
    return m ? m.icon : 'bi-clock-history';
}

// Agrupa os itens por "opção" (substituições). Cada opção é uma alternativa: o
// paciente consome UMA delas. Quando há só um grupo, mostra a lista direto.
function renderMealItems(items) {
    if (!items || !items.length) {
        return '<p class="text-muted small mb-0 fst-italic">Nenhum alimento cadastrado.</p>';
    }
    const groups = new Map();
    items.forEach(it => {
        const g = it.optionGroup || 1;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(it);
    });
    const keys = [...groups.keys()].sort((a, b) => a - b);
    const itemRow = (i) => `
        <div class="meal-food-row">
            <span class="meal-food-name">${escHtml(i.foodName)}</span>
            <span class="meal-food-qty">${escHtml(i.quantity)}</span>
        </div>`;

    if (keys.length <= 1) {
        return `<div class="meal-food-list">${groups.get(keys[0]).map(itemRow).join('')}</div>`;
    }
    return keys.map((k, idx) => `
        ${idx > 0 ? '<div class="meal-option-divider"><span>OU</span></div>' : ''}
        <div class="meal-option-block">
            <div class="meal-option-label">Opção ${idx + 1}</div>
            <div class="meal-food-list">${groups.get(k).map(itemRow).join('')}</div>
        </div>`).join('');
}

async function initMealPlan(user) {
    const container = document.getElementById('mealPlanContainer');
    const emptyState = document.getElementById('emptyMealPlanState');
    try {
        const res = await fetch(`/api/auth/mealplan/${user.id}`);
        const data = await res.json();
        container.innerHTML = '';
        if (data.success && data.plan && data.plan.meals.length > 0) {
            const meals = data.plan.meals;
            let html = `
                <div class="meal-plan-hero mb-4">
                    <div class="meal-plan-hero-icon"><i class="bi bi-card-checklist"></i></div>
                    <div>
                        <h5 class="mb-1 fw-bold">${escHtml(data.plan.title) || 'Meu Plano Alimentar'}</h5>
                        <p class="mb-0 small opacity-75">${meals.length} ${meals.length === 1 ? 'refeição prescrita' : 'refeições prescritas'} pela sua nutricionista</p>
                    </div>
                </div>`;

            meals.forEach(meal => {
                const mealNameEsc = escHtml(meal.name);
                html += `
                    <div class="meal-card mb-3">
                        <div class="meal-card-head">
                            <div class="meal-icon-badge"><i class="bi ${mealIcon(meal.name)}"></i></div>
                            <div class="flex-grow-1">
                                <h6 class="meal-card-title">${mealNameEsc}</h6>
                                ${meal.time ? `<span class="meal-time-pill"><i class="bi bi-clock me-1"></i>${escHtml(meal.time)}</span>` : ''}
                            </div>
                        </div>
                        <div class="meal-card-body">
                            ${renderMealItems(meal.items)}
                            ${meal.notes ? `<div class="meal-note-box"><i class="bi bi-chat-left-text-fill"></i><div><span class="meal-box-label">Observações</span>${escHtml(meal.notes)}</div></div>` : ''}
                            ${meal.recipes ? `<div class="meal-recipe-box"><i class="bi bi-fire"></i><div><span class="meal-box-label">Receita sugerida</span>${escHtml(meal.recipes)}</div></div>` : ''}
                            <button class="meal-feedback-btn btn btn-sm rounded-pill fw-semibold px-4 py-2 mt-3"
                                    data-meal-name="${mealNameEsc}" data-consumed="0"
                                    style="background:rgba(255,255,255,0.6);border:1.5px solid #dee2e6;color:#6c757d;">
                                <i class="bi bi-circle me-1"></i> Marcar como consumida
                            </button>
                        </div>
                    </div>`;
            });
            container.innerHTML = html;

            // Alimenta o seletor do Chef IA com as refeições reais do plano
            const aiSelect = document.getElementById('mealSelectAi');
            if (aiSelect) {
                aiSelect.innerHTML = '<option value="" selected disabled>Escolha a Refeição...</option>'
                    + meals.map(m => `<option value="${escHtml(m.name)}">${escHtml(m.name)}</option>`).join('');
            }

            // Carrega feedback de hoje e restaura estados
            try {
                const fbRes = await fetch('/api/auth/patient/meal-feedback');
                const fbData = await fbRes.json();
                if (fbData.success) {
                    container.querySelectorAll('.meal-feedback-btn').forEach(btn => {
                        if (fbData.feedback[btn.dataset.mealName]?.consumed) {
                            setFeedbackConsumed(btn, true);
                        }
                    });
                }
            } catch(e) {}

            // Wiring dos cliques
            container.querySelectorAll('.meal-feedback-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const nowConsumed = btn.dataset.consumed !== '1';
                    setFeedbackConsumed(btn, nowConsumed);
                    try {
                        await fetch('/api/auth/patient/meal-feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mealName: btn.dataset.mealName, consumed: nowConsumed })
                        });
                    } catch(e) {}
                });
            });

        } else {
            emptyState.style.display = 'block';
        }
    } catch(e) {
        container.innerHTML = '<p class="text-danger text-center">Erro ao buscar a dieta.</p>';
    }
}

// --- LISTA DE COMPRAS AUTOMÁTICA ---
async function initShoppingList() {
    const container = document.getElementById('shoppingListContainer');
    const emptyState = document.getElementById('emptyShoppingState');
    const select = document.getElementById('daysMultiplierSelect');
    
    const loadList = async () => {
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';
        emptyState.style.display = 'none';
        try {
            const res = await fetch(`/api/auth/patient/shopping-list?days=${select.value}`);
            const data = await res.json();
            if(data.success && Object.keys(data.shoppingList).length > 0) {
                let html = '';
                for(const [category, items] of Object.entries(data.shoppingList)) {
                    html += `<h6 class="shopping-category-title"><i class="bi bi-tag-fill text-primary me-2"></i>${category}</h6>`;
                    items.forEach(item => {
                        html += `<div class="shopping-item"><input type="checkbox" class="me-3 shadow-sm"><div class="flex-grow-1"><span class="d-block fw-medium">${item.name}</span><span class="badge bg-light text-dark border mt-1">${item.quantity}</span></div></div>`;
                    });
                }
                container.innerHTML = `<div class="glass-card p-4 mb-5 shadow-sm">${html}</div>`;
            } else {
                container.innerHTML = '';
                emptyState.style.display = 'block';
            }
        } catch(e) {}
    };
    select.addEventListener('change', loadList);
    loadList();
}

// --- NUTRI CHEF IA ---
async function initAiChef() {
    const btn = document.getElementById('btnGenerateAiRecipe');
    const select = document.getElementById('mealSelectAi');
    const resultCont = document.getElementById('recipeResultContainer');
    const resultText = document.getElementById('recipeContent');

    if(btn) btn.addEventListener('click', async () => {
        if(!select.value) { window.showToast('Selecione uma refeição.', 'error'); return; }
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Cozinhando ideias...';
        resultCont.classList.add('d-none');
        try {
            const res = await fetch('/api/auth/patient/ai-recipe', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mealName: select.value })
            });
            const data = await res.json();
            if(data.success) {
                resultText.innerHTML = data.recipe;
                resultCont.classList.remove('d-none');
                resultCont.scrollIntoView({ behavior: 'smooth' });
            } else {
                window.showToast(data.message, 'error');
            }
        } catch(e) { window.showToast('Erro ao gerar receita.', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="bi bi-stars"></i> Criar Receita'; }
    });
}

// --- PERFIL ---
async function initProfile(user) {
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;
    const btnLogout = document.getElementById('btnLogoutProfile');
    if(btnLogout) btnLogout.addEventListener('click', handleLogout);
}

// --- RECEITUÁRIO & ENCAMINHAMENTOS ---
async function initClinicalNotes(type, containerId, emptyId) {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyId);
    if (!container) return;

    try {
        const res = await fetch(`/api/auth/patient/clinical-notes?type=${type}`);
        const data = await res.json();
        container.innerHTML = '';

        if (data.success && data.notes && data.notes.length > 0) {
            data.notes.forEach(note => {
                const dateStr = new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                const card = document.createElement('div');
                card.className = 'glass-card p-4 mb-3 border-start border-4 ' + (type === 'prescription' ? 'border-success' : 'border-info');
                card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        ${note.title ? `<h6 class="fw-bold text-dark mb-0">${note.title}</h6>` : `<h6 class="fw-bold text-dark mb-0">${type === 'prescription' ? 'Prescrição' : 'Encaminhamento'}</h6>`}
                        <small class="text-muted ms-2 text-nowrap">${dateStr}</small>
                    </div>
                    <p class="text-muted small mb-0 lh-base">${note.content}</p>`;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
        }
    } catch(e) {
        container.innerHTML = '<p class="text-danger text-center small">Erro ao carregar dados.</p>';
    }
}

// ======================= LÓGICA DO MODAL DE AGENDAMENTO ======================= //

let bookModalInstance = null;

function setupBookingModal(user) {
    const modalEl = document.getElementById('bookAppointmentModal');
    if (!modalEl) return;
    
    if (typeof bootstrap !== 'undefined') {
        bookModalInstance = new bootstrap.Modal(modalEl);
    }
    
    const dateInput = document.getElementById('bookDate');
    const serviceSelect = document.getElementById('bookService');
    const timeSlotsContainer = document.getElementById('bookTimeSlots');
    const timeInput = document.getElementById('bookTime');
    const form = document.getElementById('bookAppointmentForm');
    const btnSubmit = document.getElementById('btnConfirmBooking');
    
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    
    const loadTimes = async () => {
        const dateStr = dateInput.value;
        const serviceOpt = serviceSelect.options[serviceSelect.selectedIndex];
        
        if (!dateStr || !serviceOpt.value) return;
        
        timeSlotsContainer.innerHTML = '<div class="text-center w-100 p-2"><span class="spinner-border spinner-border-sm text-primary"></span> Buscando horários...</div>';
        timeInput.value = '';
        
        try {
            const res = await fetch(`/api/auth/schedule/available?nutriId=${user.nutriID}&date=${dateStr}`);
            const data = await res.json();
            
            if (data.success && data.availableSlots && data.availableSlots.length > 0) {
                let html = '';
                data.availableSlots.forEach(time => {
                    html += `<button type="button" class="btn btn-outline-primary fw-bold btn-sm time-slot-btn" data-time="${time}">${time}</button>`;
                });
                timeSlotsContainer.innerHTML = html;
                
                timeSlotsContainer.querySelectorAll('.time-slot-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        timeSlotsContainer.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('active', 'btn-primary', 'text-white'));
                        e.target.classList.add('active', 'btn-primary', 'text-white');
                        timeInput.value = e.target.getAttribute('data-time');
                    });
                });
            } else {
                timeSlotsContainer.innerHTML = `<div class="text-muted small w-100 p-2 bg-light rounded text-center border border-dashed">${data.message || 'Nenhum horário disponível.'}</div>`;
            }
        } catch (e) {
            timeSlotsContainer.innerHTML = '<div class="text-danger small w-100 p-2 bg-light rounded text-center border border-dashed">Erro ao buscar horários.</div>';
        }
    };
    
    dateInput.addEventListener('change', loadTimes);
    serviceSelect.addEventListener('change', loadTimes);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!timeInput.value) { window.showToast('Por favor, selecione um horário.', 'error'); return; }
        
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Confirmando...';
        
        const serviceOpt = serviceSelect.options[serviceSelect.selectedIndex];
        const payload = {
            nutriId: user.nutriID,
            service: { name: serviceOpt.value, duration: parseInt(serviceOpt.getAttribute('data-duration')) },
            date: dateInput.value, time: timeInput.value,
            objective: document.getElementById('bookObjective').value || 'Agendamento pelo painel do paciente'
        };
        
        try {
            const res = await fetch('/api/auth/schedule/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.success) {
                window.showToast('Agendamento solicitado com sucesso!', 'success');
                if (bookModalInstance) bookModalInstance.hide();
                form.reset(); timeSlotsContainer.innerHTML = '';
                setTimeout(() => window.location.reload(), 1500);
            } else { window.showToast(data.message || 'Erro ao agendar.', 'error'); }
        } catch (e) { window.showToast('Erro de conexão.', 'error'); } 
        finally { btnSubmit.disabled = false; btnSubmit.innerHTML = 'Confirmar Agendamento'; }
    });
}

window.openBookingModal = function() {
    if (bookModalInstance) bookModalInstance.show();
    else window.showToast('Carregando modal...', 'error');
}