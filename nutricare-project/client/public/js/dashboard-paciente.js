document.addEventListener("DOMContentLoaded", async function () {
    try {
        const userData = await getUserData(); 
        if (userData) {
            await initializeDashboard(userData);
        } else {
            window.location.href = '/pages/login.html';
        }
    } catch (error) {
        console.error("Erro ao inicializar o dashboard:", error);
        window.location.href = '/pages/login.html';
    }
});

async function getUserData() {
    try {
        const response = await fetch('/api/auth/me'); 
        const result = await response.json();
        return result.success ? result.user : null;
    } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        return null;
    }
}

async function getNutriName(nutriId) {
    if (!nutriId) return "Nenhum";
    try {
        const response = await fetch(`/api/auth/nutricionista/${nutriId}`);
        const result = await response.json();
        return result.success ? result.nutricionista.name : "Não encontrado";
    } catch (error) {
        console.error('Erro ao buscar nome do nutricionista:', error);
        return "Indisponível";
    }
}

async function initializeDashboard(user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('date').textContent = getTodayDate();
    
    // CORRIGIDO: Chamada de API em vez de consulta direta
    const nutriName = await getNutriName(user.nutriID);
    document.getElementById('nutriName').textContent = nutriName;

    initializeChart(); // Função do gráfico separada
}

function initializeChart() {
    const ctx = document.getElementById('progressChart')?.getContext('2d');
    if (ctx) {
        new Chart(ctx, { /* Configuração do gráfico aqui */ });
    }
}

function getTodayDate() {
    const date = new Date();
    const day = date.getDate();
    const month = date.toLocaleString('pt-BR', { month: 'long' });
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
}