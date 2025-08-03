document.addEventListener("DOMContentLoaded", async function () {
    let nome = "Andrelina Moreira"
    let date = await getTodayDate();
    console.log("Formatted date = " + date)


    const nutriName = document.getElementById('nutriName')
    const todayDate = document.getElementById('date')
    const ctx = document.getElementById('progressChart')?.getContext('2d');

    nutriName.innerHTML = nome
    todayDate.innerHTML = date;
    if (ctx) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mai', 'Jun', 'Jul', 'Ago'],
                datasets: [{
                    label: 'Peso (kg)',
                    data: [85, 83.5, 82, 82.5],
                    backgroundColor: 'rgba(26, 116, 49, 0.1)',
                    borderColor: 'rgba(26, 116, 49, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: 'rgba(26, 116, 49, 1)',
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: 'rgba(26, 116, 49, 1)',
                    pointHoverBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            drawBorder: false,
                        },
                    },
                    x: {
                        grid: {
                            display: false,
                        }
                    }
                }
            }
        });
    }


});

async function getTodayDate() {
    let date = new Date()
    console.log(date)
    let day = date.getDay() + 3

    let month = date.getMonth() + 1
    var formattedMonth = await idToTextMonths(month)

    let year = date.getFullYear()

    let formattedDate = `${day} de ${formattedMonth} de ${year}`
    console.log("Formatted Date = " + formattedDate)

    return formattedDate
}

async function idToTextMonths(number) {
    var month;

    switch (number) {
        case 1:
            month = "Janeiro"
            break;
        case 2:
            month = "Fevereiro"
            break;
        case 3:
            month = "Março"
            break;
        case 4:
            month = "Abril"
            break;
        case 5:
            month = "Maio"
            break;
        case 6:
            month = "Junho"
            break;
        case 7:
            month = "Julho"
            break;
        case 8:
            month = "Agosto"
            break;
        case 9:
            month = "Setembro"
            break;
        case 10:
            month = "Outubro"
            break;
        case 11:
            month = "Novembro"
            break;
        case 12:
            month = "Dezembro"
            break;
    }
    return month
}
