// nutricare-project/client/public/js/preSchedule.js
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const nutriId = urlParams.get('nutriId');
    if (!nutriId) {
        document.body.innerHTML = "<div class='container text-center mt-5'><p class='alert alert-danger'>Erro: Link de agendamento inválido. Verifique o URL fornecido.</p></div>";
        return;
    }

    // Mapeamento de elementos do DOM
    const elements = {
        steps: document.querySelectorAll('.booking-step'),
        serviceItems: document.querySelectorAll('.service-item'),
        datepickerEl: document.getElementById('datepicker'),
        timeSlotsContainer: document.querySelector('.time-slots-list'),
        slotsLoader: document.getElementById('slots-loader'),
        agendaAlertMessage: document.getElementById('agenda-alert-message'),
        backToStep1Btn: document.getElementById('backToStep1'),
        backToStep2Btn: document.getElementById('backToStep2'),
        bookingForm: document.getElementById('bookingForm'),
        anamneseLink: document.getElementById('anamneseLink'),
        dateSelectedDisplay: document.getElementById('selectedDate'),
        loadingMessage: document.getElementById('loading-message'),
        nutriNameDisplay: document.getElementById('nutriName'),
        summaryService: document.getElementById('summaryService'),
        summaryPrice: document.getElementById('summaryPrice'),
        summaryDateTime: document.getElementById('summaryDateTime'),
        confirmBookingBtn: document.getElementById('confirmBookingBtn'),
    };

    let bookingState = {
        nutriId: nutriId,
        service: null,
        date: null,
        time: null,
        slotDuration: null,
    };

    let datepickerInstance = null;

    // FUNÇÕES DE UI
    const toggleLoader = (show) => {
        if (elements.loadingMessage) elements.loadingMessage.style.display = show ? 'block' : 'none';
    };

    const goToStep = (stepNumber) => {
        elements.steps.forEach(step => step.classList.remove('active'));
        document.getElementById(`step${stepNumber}`).classList.add('active');
        document.getElementById('booking-flow').scrollIntoView({ behavior: 'smooth' });
    };

    const showAgendaAlert = (message) => {
        elements.agendaAlertMessage.textContent = message;
        elements.agendaAlertMessage.style.display = 'block';
    };

    // FUNÇÕES DE LÓGICA
    const loadNutriName = async () => {
        toggleLoader(true);
        try {
            const response = await fetch(`/api/auth/nutricionista/${nutriId}`);
            const result = await response.json();
            if (result.success && elements.nutriNameDisplay) {
                elements.nutriNameDisplay.textContent = `Dra. ${result.nutricionista.name}`;
            } else {
                elements.nutriNameDisplay.textContent = `Nutricionista (ID: ${nutriId})`;
            }
        } catch (error) {
            console.error('Erro ao buscar nome da Nutri:', error);
            elements.nutriNameDisplay.textContent = `Nutricionista (Erro)`;
        } finally {
            toggleLoader(false);
        }
    };

    const getDateString = (date) => date.toISOString().split('T')[0];

    const isDateDisabled = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date.getDay() === 0 || date < today;
    };

    const fetchAndRenderAvailableTimes = async (dateStr) => {
        elements.timeSlotsContainer.innerHTML = '';
        elements.slotsLoader.style.display = 'block';
        elements.agendaAlertMessage.style.display = 'none';

        try {
            const response = await fetch(`/api/auth/schedule/available?nutriId=${bookingState.nutriId}&date=${dateStr}`);
            const result = await response.json();

            elements.slotsLoader.style.display = 'none';

            if (!result.success || result.availableSlots.length === 0) {
                showAgendaAlert(result.message || 'Nenhum horário disponível para esta data.');
                return;
            }

            bookingState.slotDuration = result.slotDuration;

            if (bookingState.service.duration > bookingState.slotDuration) {
                showAgendaAlert(`O serviço selecionado (${bookingState.service.duration} min) requer um tempo maior que os horários disponíveis (${bookingState.slotDuration} min). Por favor, escolha outro serviço.`);
                return;
            }

            result.availableSlots.forEach(time => {
                const slot = document.createElement('div');
                slot.className = 'time-slot';
                slot.textContent = time;
                slot.addEventListener('click', () => {
                    bookingState.time = time;
                    elements.summaryDateTime.textContent = `${new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')} às ${time}`;
                    goToStep(3);
                });
                elements.timeSlotsContainer.appendChild(slot);
            });

        } catch (error) {
            elements.slotsLoader.style.display = 'none';
            showAgendaAlert('Erro de comunicação ao carregar horários. Tente novamente.');
        }
    };

    const initializeDatepicker = () => {
        if (datepickerInstance) datepickerInstance.destroy();

        datepickerInstance = new Datepicker(elements.datepickerEl, {
            format: 'yyyy-mm-dd',
            language: 'pt-BR',
            autohide: true,
            todayHighlight: true,
            datesDisabled: isDateDisabled,
        });

        elements.datepickerEl.addEventListener('changeDate', (e) => {
            const selectedDate = e.detail.date;
            if (isDateDisabled(selectedDate)) {
                elements.timeSlotsContainer.innerHTML = '';
                elements.dateSelectedDisplay.textContent = 'Data indisponível';
                showAgendaAlert('Esta data não está disponível para agendamento.');
                bookingState.date = null;
                return;
            }
            const dateStr = getDateString(selectedDate);
            bookingState.date = dateStr;
            elements.dateSelectedDisplay.textContent = `Horários para ${selectedDate.toLocaleDateString('pt-BR')}`;
            fetchAndRenderAvailableTimes(dateStr);
        });
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();

        const btn = elements.confirmBookingBtn;
        const originalBtnText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';

        const patientData = {
            name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
        };

        const payload = { ...bookingState, patientData };

        try {
            const response = await fetch('/api/auth/schedule/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                const urlParams = new URLSearchParams({
                    nutriId: bookingState.nutriId,
                    appointmentId: result.appointmentId, // Passa o ID do agendamento
                    patientName: encodeURIComponent(patientData.name),
                    patientEmail: encodeURIComponent(patientData.email),
                    patientPhone: encodeURIComponent(patientData.phone),
                });

                elements.anamneseLink.href = `/pages/paciente/anamnese.html?${urlParams.toString()}`;
                goToStep(4);
            }
        } catch (error) {
            console.log(`erro = `, result.message)
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    };

    // INICIALIZAÇÃO E EVENT LISTENERS
    elements.serviceItems.forEach(item => {
        item.addEventListener('click', () => {
            bookingState.service = {
                name: item.querySelector('h5').textContent,
                duration: parseInt(item.dataset.duration, 10),
                price: item.querySelector('strong').textContent
            };

            elements.summaryService.textContent = bookingState.service.name;
            elements.summaryPrice.textContent = bookingState.service.price;

            bookingState.date = null;
            bookingState.time = null;
            elements.dateSelectedDisplay.textContent = 'Escolha uma data no calendário';
            elements.timeSlotsContainer.innerHTML = '';
            elements.agendaAlertMessage.style.display = 'none';

            initializeDatepicker();
            goToStep(2);
        });
    });

    elements.backToStep1Btn.addEventListener('click', () => goToStep(1));
    elements.backToStep2Btn.addEventListener('click', () => goToStep(2));
    elements.bookingForm.addEventListener('submit', handleBookingSubmit);

    loadNutriName();
    goToStep(1);
});