document.addEventListener('DOMContentLoaded', async () => {
    var nutriID = await verifySession();
    console.log("nutriID =", nutriID);

    const userNameSpan = document.getElementById('userName');
    const logoutButton = document.getElementById('logoutBtn');
    const generateLinkButton = document.getElementById('generateLinkBtn');
    const copyLinkButton = document.getElementById('copyLinkBtn');

    const activePatient = document.getElementById('activePatient');
    var tableDataActivePatient = await getTotalActivePatient(nutriID);
    tableDataActivePatient[0] == null ? activePatient.textContent = 0 : activePatient.textContent = tableDataActivePatient.totalActivePatients;

    const score = document.getElementById('score');
    var tableDataScore = await getScoreMedium(nutriID);
    console.log("tableDataScore =", tableDataScore);
    tableDataScore == null ? score.textContent = "0.0/5" : score.textContent = `${tableDataScore.totalScore}/5`;

    // const todayAgenda = document.getElementById('todayAgenda');
    // var tableDataTodayAgenda = await getTodayAgenda(nutriID);
    // tableDataTodayAgenda == null ? todayAgenda.textContent = "Nenhum paciente" : todayAgenda.textContent = tableDataTodayAgenda

    // const payback = document.getElementById('payback');
    // var tableDataPayback = await getTotalPayback(nutriID);
    // tableDataPayback == null ? payback.textContent = "R$00,00" : payback.textContent = tableDataPayback.totalPayback;

    // var patientData = await getPatientData(nutriID);
    // const patientNameNext = document.getElementById('patientNameNext');
    // patientNameNext.textContent = patientData.name;
    // const type = document.getElementById('type');
    // type.textContent = patientData.type;

    // const time = document.getElementById('time');
    // var tableDataNextPatient = await getNextPatient(nutriID);
    // time.textContent = tableDataNextPatient.time;

    // const status = document.getElementById('status');
    // var tableDataNextPatient = await getNextPatient(nutriID);
    // status.textContent = tableDataNextPatient.status;

    async function fetchUserData() {
        console.log("== start fetchUserData function ==")
        try {
            const response = await fetch('/api/auth/me');
            const result = await response.json();
            console.log("result")
            console.log(result)

            if (result.success) {
                userNameSpan.textContent = `${result.user.name}`;
            } else {
                window.location.href = '/pages/login.html';
            }
        } catch (error) {
            console.error('Erro ao buscar dados do usuário:', error);
            window.location.href = '/pages/login.html';
        }
    }

    async function handleLogout() {
        console.log("== start handleLogout function ==")
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                window.location.href = result.redirectUrl;
            } else {
                alert('Erro ao tentar fazer logout. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro no processo de logout:', error);
            alert('Não foi possível comunicar com o servidor para sair.');
        }
    }

    async function generateLink() {
        console.log("== start generateLink function ==")
        try {
            const response = await fetch('/api/auth/generateLink', { method: 'POST' });
            const result = await response.json();

            document.getElementById('generatedLink').textContent = result.link;
            document.getElementById('linkContainer').classList.remove('hidden');
            document.getElementById('button').classList.remove('hidden');

            if (copyLinkButton) {
                console.log("Entrou no if do copyLinkButton")
                copyLinkButton.addEventListener('click', () => {
                    const linkText = document.getElementById('generatedLink').textContent;
                    navigator.clipboard.writeText(linkText)
                        .then(() => console.log('Link copiado para a área de transferência'))
                        .catch(err => console.error('Erro ao copiar o link:', err));
                });
            }

        } catch (error) {
            console.error('Erro ao gerar o link:', error);
        }
    }

    async function verifySession() {
        console.log("== start verifySession function ==")
        var id;
        try {
            const response = await fetch('/api/auth/me');
            console.log("how's response = ", response)
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) {
                    id = result.user.id;
                }
            }
        } catch (error) {
            console.error('Não foi possível verificar o status de autenticação.', error);
        }

        return id
    }

    async function getTotalActivePatient(nutriID) {
        console.log("== start getTotalActivePatient function ==");
        try {
            const response = await fetch(`/api/auth/getPatientCount?nutriId=${nutriID}`);
            const result = await response.json();

            console.log("getTotalActivePatient | result = ");
            console.log(result);

            if (result.success) {
                return result.totalPacientes;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Erro ao buscar total de pacientes com o erro:');
            console.log(error);
            return 0;
        }
    }

    async function getScoreMedium(nutriID) {
        console.log("== start getScoreMedium function ==");
        try {
            const response = await fetch(`/api/auth/getScoreMedium?nutriId=${nutriID}`);
            const result = await response.json();

            console.log("getScoreMedium | result = ");
            console.log(result);

            if (result.success) {
                return result.medium;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Erro ao buscar média do score com o erro:');
            console.log(error);
            return 0;
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    if (generateLinkButton) {
        generateLinkButton.addEventListener('click', generateLink);
    }

    await fetchUserData();
});
