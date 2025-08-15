const listaItens = document.getElementById("lista-itens");
const folhaCardapio = document.getElementById("folha-cardapio");
const itensArrastaveisOriginais = document.querySelectorAll(".item-arrastavel");

function criarItemCardapio(nomeDoItem, dataItem) {
    const itemDiv = document.createElement("div");
    itemDiv.className = "item-cardapio";
    itemDiv.setAttribute("data-item", dataItem);
    itemDiv.innerHTML = `
      <div class="info">
          <span class="nome-item">${nomeDoItem}</span>
          <div class="porcao">
              <label>Porção (g): </label>
              <span class="porcao-display">0</span>
              <input type="number" class="input-porcao escondido" value="0" min="0">
          </div>
      </div>
      <div class="acoes">
          <button class="btn-acao btn-editar">Editar</button>
          <button class="btn-acao btn-excluir">Excluir</button>
      </div>
  `;
    return itemDiv;
}

function alternarModoEdicao(itemCardapio) {
    const porcaoDisplay = itemCardapio.querySelector(".porcao-display");
    const inputPorcao = itemCardapio.querySelector(".input-porcao");
    const btnEditar = itemCardapio.querySelector(".btn-editar");

    const estaEmModoVisualizacao = btnEditar.classList.contains("btn-editar");

    if (estaEmModoVisualizacao) {
        porcaoDisplay.classList.add("escondido");
        inputPorcao.classList.remove("escondido");
        inputPorcao.focus();
        btnEditar.textContent = "Salvar";
        btnEditar.classList.remove("btn-editar");
        btnEditar.classList.add("btn-salvar");
    } else {
        porcaoDisplay.textContent = inputPorcao.value;
        porcaoDisplay.classList.remove("escondido");
        inputPorcao.classList.add("escondido");
        btnEditar.textContent = "Editar";
        btnEditar.classList.remove("btn-salvar");
        btnEditar.classList.add("btn-editar");
    }
}

async function excluirItemCardapio(itemCardapio) {
    const dataItem = itemCardapio.getAttribute("data-item");
    itemCardapio.remove();
    const itemOriginal = listaItens.querySelector(
        `.item-arrastavel[data-item="${dataItem}"]`
    );
    if (itemOriginal) {
        itemOriginal.classList.remove("item-usado");
        itemOriginal.setAttribute("draggable", "true");
    }
}

itensArrastaveisOriginais.forEach((item) => {
    item.addEventListener("dragstart", (e) => {
        if (e.target.classList.contains("item-usado")) {
            e.preventDefault();
            return;
        }
        e.target.classList.add("arrastando");
        e.dataTransfer.setData("text/plain", e.target.dataset.item);
    });

    item.addEventListener("dragend", (e) => {
        e.target.classList.remove("arrastando");
    });
});

folhaCardapio.addEventListener("dragover", (e) => {
    e.preventDefault();
    folhaCardapio.classList.add("drag-over");
});

folhaCardapio.addEventListener("dragleave", () => {
    folhaCardapio.classList.remove("drag-over");
});

folhaCardapio.addEventListener("drop", (e) => {
    e.preventDefault();
    folhaCardapio.classList.remove("drag-over");

    const dataItem = e.dataTransfer.getData("text/plain");
    const itemOriginal = listaItens.querySelector(
        `.item-arrastavel[data-item="${dataItem}"]`
    );

    const jaExiste = folhaCardapio.querySelector(
        `.item-cardapio[data-item="${dataItem}"]`
    );
    if (jaExiste) {
        alert("Este item já foi adicionado ao cardápio!");
        return;
    }

    const nomeDoItem = itemOriginal.textContent;
    const novoItem = criarItemCardapio(nomeDoItem, dataItem);

    folhaCardapio.appendChild(novoItem);

    alternarModoEdicao(novoItem);

    itemOriginal.classList.add("item-usado");
    itemOriginal.setAttribute("draggable", "false");
});

folhaCardapio.addEventListener("click", (e) => {
    const target = e.target;

    if (
        target.classList.contains("btn-editar") ||
        target.classList.contains("btn-salvar")
    ) {
        const itemCardapio = target.closest(".item-cardapio");
        alternarModoEdicao(itemCardapio);
    }

    if (target.classList.contains("btn-excluir")) {
        const itemCardapio = target.closest(".item-cardapio")
    }
})