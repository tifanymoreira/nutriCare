document.addEventListener("DOMContentLoaded", () => {
    const nutriId = new URLSearchParams(window.location.search).get('nutriId');
    if (!nutriId) {
        document.body.innerHTML = "<p class='text-center mt-5'>Erro: Link de agendamento inválido. Verifique o URL fornecido.</p>";
        return;
    }

    const steps = document.querySelectorAll('.booking-step');
    const serviceItems = document.querySelectorAll('.service-item');
    const datepickerEl = document.getElementById('datepicker');
    const timeSlotsContainer = document.getElementById('time-slots-list');
    const backToStep1Btn = document.getElementById('backToStep1');
    const backToStep2Btn = document.getElementById('backToStep2');
    const bookingForm = document.getElementById('bookingForm');
    const anamneseLink = document.getElementById('anamneseLink');

    let bookingState = {
        nutriId: nutriId,
        service: null,
        date: null,
        time: null,
    };

    
    function goToStep(stepNumber) {
        steps.forEach(step => step.classList.remove('active'));
        document.getElementById(`step${stepNumber}`).classList.add('active');
    }


    serviceItems.forEach(item => {
        item.addEventListener('click', () => {
            const serviceName = item.querySelector('h5').textContent;
            const price = item.querySelector('strong').textContent;
            
            bookingState.service = {
                id: item.dataset.serviceId,
                name: serviceName,
                duration: parseInt(item.dataset.duration, 10),
                price: price
            };
            
            document.getElementById('summaryService').textContent = serviceName;
            document.getElementById('summaryPrice').textContent = price;

            initializeDatepicker();
            goToStep(2);
        });
    });


    let datepickerInstance = null;

    function initializeDatepicker() {
        if (datepickerInstance) {
            datepickerInstance.destroy();
        }
        datepickerInstance = new Datepicker(datepickerEl, {
            format: 'dd/mm/yyyy',
            language: 'pt-BR',
            autohide: true,
            todayHighlight: true,
            datesDisabled: (date) => {
                return date.getDay() === 0; 
            }
        });

        datepickerEl.addEventListener('changeDate', (e) => {
            const selectedDate = e.detail.date;
            bookingState.date = selectedDate.toLocaleDateString('pt-BR');
            document.getElementById('selectedDate').textContent = `Horários para ${bookingState.date}`;
            fetchAndRenderAvailableTimes(selectedDate);
        });
    }

    async function fetchAndRenderAvailableTimes(date) {
        timeSlotsContainer.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div>';
        
        await new Promise(resolve => setTimeout(resolve, 500)); 
        const availableTimes = generateFakeTimeSlots();

        timeSlotsContainer.innerHTML = '';
        if (availableTimes.length === 0) {
            timeSlotsContainer.innerHTML = '<p class="text-muted text-center small">Nenhum horário disponível para esta data.</p>';
            return;
        }

        availableTimes.forEach(time => {
            const slot = document.createElement('div');
            slot.className = 'time-slot';
            slot.textContent = time;
            slot.addEventListener('click', () => {
                bookingState.time = time;
                document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
                document.getElementById('summaryDateTime').textContent = `${bookingState.date} às ${bookingState.time}`;
                goToStep(3);
            });
            timeSlotsContainer.appendChild(slot);
        });
    }
    
    function generateFakeTimeSlots() {
        return ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
    }

    backToStep1Btn.addEventListener('click', () => goToStep(1));
    
    
    backToStep2Btn.addEventListener('click', () => goToStep(2));
    
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const confirmBtn = document.getElementById('confirmBookingBtn');
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Confirmando...';

        const patientData = {
            name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
        };

        const payload = { ...bookingState, ...patientData };
        
        console.log("Enviando para o servidor:", payload);
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        
        const patientId = "paciente123"; 
        anamneseLink.href = `/pages/paciente/anamnese.html?nutriId=${nutriId}&patientId=${patientId}`;
        
        goToStep(4);
    });

});