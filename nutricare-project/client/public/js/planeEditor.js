document.addEventListener("DOMContentLoaded", () => {
    const foodItems = document.querySelectorAll(".food-item");
    const mealPlanCanvas = document.getElementById("mealPlanCanvas");
    const addMealBtn = document.getElementById("addMealBtn");

    let draggedItem = null;

    foodItems.forEach(item => {
        item.addEventListener("dragstart", (e) => {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add("dragging"), 0);
        });

        item.addEventListener("dragend", () => {
            draggedItem.classList.remove("dragging");
            draggedItem = null;
        });
    });

    const createMealCard = (mealName = "Nova Refeição") => {
        const mealId = `meal-${Date.now()}`;
        const card = document.createElement("div");
        card.className = "meal-card";
        card.setAttribute("data-meal-id", mealId);
        card.innerHTML = `
            <div class="meal-card-header">
                <h5 class="meal-title" contenteditable="true">${mealName}</h5>
                <div class="meal-actions">
                    <button class="btn btn-sm btn-icon text-danger btn-delete-meal"><i class="bi bi-trash-fill"></i></button>
                </div>
            </div>
            <div class="meal-card-body">
                <div class="text-muted text-center small">Arraste alimentos aqui</div>
            </div>
        `;

        const mealBody = card.querySelector(".meal-card-body");
        setupDropzone(mealBody);

        card.querySelector('.btn-delete-meal').addEventListener('click', () => {
            card.remove();
        });

        mealPlanCanvas.appendChild(card);
    };

    const setupDropzone = (zone) => {
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.closest('.meal-card').classList.add("drag-over");
        });

        zone.addEventListener("dragleave", () => {
            zone.closest('.meal-card').classList.remove("drag-over");
        });

        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.closest('.meal-card').classList.remove("drag-over");
            
            if (draggedItem) {
                const foodName = draggedItem.getAttribute("data-food-name");

                if (zone.querySelector('.text-muted')) {
                    zone.innerHTML = '';
                }

                addFoodToMeal(foodName, zone);
            }
        });
    };

    // Adiciona um item de comida a uma refeição
    const addFoodToMeal = (name, mealBody) => {
        const foodElement = document.createElement("div");
        foodElement.className = "meal-food-item";
        foodElement.innerHTML = `
            <span class="food-name">${name}</span>
            <div class="d-flex align-items-center gap-2">
                <div class="food-quantity">
                    <input type="text" class="form-control form-control-sm" placeholder="Ex: 100g">
                </div>
                <button class="btn btn-sm btn-icon text-secondary btn-delete-food"><i class="bi bi-x-circle"></i></button>
            </div>
        `;
        foodElement.querySelector('.btn-delete-food').addEventListener('click', () => {
            foodElement.remove();
            if (!mealBody.hasChildNodes()) {
                 mealBody.innerHTML = '<div class="text-muted text-center small">Arraste alimentos aqui</div>';
            }
        });

        mealBody.appendChild(foodElement);
    };

    addMealBtn.addEventListener("click", () => createMealCard());

    createMealCard("Café da Manhã");
    createMealCard("Almoço");
    createMealCard("Jantar");
});