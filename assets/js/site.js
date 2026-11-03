// MVA Multicar: menu, filtros da vitrine, movimento e galeria. JavaScript puro; o site funciona sem ele.
(() => {
  const movimento = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

  // Menu do celular
  const cabecalho = document.querySelector("[data-cabecalho]");
  const botaoMenu = cabecalho?.querySelector("[data-menu]");
  const fecharMenu = () => {
    botaoMenu.setAttribute("aria-expanded", "false");
    cabecalho.removeAttribute("data-aberto");
  };
  botaoMenu?.addEventListener("click", () => {
    const abrir = botaoMenu.getAttribute("aria-expanded") !== "true";
    botaoMenu.setAttribute("aria-expanded", String(abrir));
    cabecalho.toggleAttribute("data-aberto", abrir);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cabecalho?.hasAttribute("data-aberto")) {
      fecharMenu();
      botaoMenu.focus();
    }
  });

  // Filtros da vitrine (specs/site.md §3.2): preço, carroceria, marca, ano e câmbio, com o estado na URL.
  const filtros = document.querySelector("[data-filtros]");
  if (filtros) {
    const campos = ["q", "carroceria", "marca", "ano", "cambio", "preco_max", "ordem"];
    const vitrine = document.querySelector("[data-vitrine]");
    const fim = vitrine.querySelector(".vitrine__item--fim");
    const cards = [...vitrine.querySelectorAll("[data-carroceria]")];
    const normalizar = (texto = "") => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const ordens = {
      "menor-preco": (a, b) => a.dataset.preco - b.dataset.preco,
      "maior-preco": (a, b) => b.dataset.preco - a.dataset.preco,
      "menor-km": (a, b) => a.dataset.km - b.dataset.km,
    };
    const resultado = filtros.querySelector("[data-resultado]");
    const vazio = document.querySelector("[data-vazio]");

    const aplicar = (gravarUrl = true) => {
      const f = Object.fromEntries(new FormData(filtros));
      const termos = normalizar(f.q).split(/\s+/).filter(Boolean);
      let total = 0;
      for (const card of cards) {
        const d = card.dataset;
        const passa =
          (!f.carroceria || d.carroceria === f.carroceria) &&
          (!f.marca || d.marca === f.marca) &&
          (!f.ano || Number(d.ano) >= Number(f.ano)) &&
          (!f.cambio || d.cambio === f.cambio) &&
          (!f.preco_max || Number(d.preco) <= Number(f.preco_max)) &&
          termos.every((termo) => d.busca.includes(termo));
        card.closest("li").hidden = !passa;
        if (passa) total++;
      }
      const ordem = ordens[f.ordem] || ((a, b) => a.closest("li").dataset.posicao - b.closest("li").dataset.posicao);
      for (const card of [...cards].sort(ordem)) vitrine.insertBefore(card.closest("li"), fim);
      resultado.textContent = total === 1 ? "1 carro" : `${total} carros`;
      vazio.hidden = total > 0;
      if (gravarUrl) {
        const params = new URLSearchParams();
        for (const campo of campos) if (f[campo]) params.set(campo, f[campo]);
        const busca = params.toString();
        history.replaceState(null, "", `${location.pathname}${busca ? `?${busca}` : ""}${location.hash}`);
      }
    };

    const marcar = (campo, valor) => {
      const el = filtros.elements[campo];
      if (!el) return;
      if (el instanceof RadioNodeList) for (const opcao of el) opcao.checked = opcao.value === valor;
      else el.value = valor;
    };

    const inicial = new URLSearchParams(location.search);
    if (campos.some((campo) => inicial.has(campo))) {
      for (const campo of campos) if (inicial.has(campo)) marcar(campo, inicial.get(campo));
      aplicar(false);
    }

    filtros.addEventListener("change", () => aplicar());
    filtros.elements.q?.addEventListener("input", () => aplicar());
    filtros.addEventListener("submit", (e) => {
      e.preventDefault();
      aplicar();
    });
    filtros.addEventListener("reset", () => requestAnimationFrame(() => aplicar()));
  }

  // Formulários que montam a mensagem e abrem o WhatsApp; nada é enviado ao site (specs/site.md §6).
  for (const form of document.querySelectorAll("[data-form-whatsapp]")) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const linhas = [form.dataset.abertura];
      for (const el of form.querySelectorAll("[data-rotulo]")) {
        const valor = el.matches("fieldset") ? el.querySelector("input:checked")?.value : el.value.trim();
        if (valor) linhas.push(`${el.dataset.rotulo}: ${valor}`);
      }
      window.open(`https://wa.me/${form.dataset.numero}?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank", "noopener");
    });
  }

  // Movimento (specs/design.md §8): os cards de veículo abaixo da primeira tela chegam ao aparecer;
  // o que já está visível no carregamento fica como está.
  if (movimento && "IntersectionObserver" in window) {
    const alvos = [...document.querySelectorAll("[data-chegada]")].filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas
          .filter((entrada) => entrada.isIntersecting)
          .forEach((entrada, i) => {
            entrada.target.style.setProperty("--atraso", `${i * 90}ms`);
            entrada.target.classList.add("chegou");
            observador.unobserve(entrada.target);
          });
      },
      { threshold: 0.35, rootMargin: "0px 0px -5% 0px" },
    );
    for (const el of alvos) {
      el.classList.add("a-chegar");
      observador.observe(el);
    }
  }

  // Galeria do veículo: rolagem nativa com setas, miniaturas e teclado.
  for (const galeria of document.querySelectorAll("[data-galeria]")) {
    const trilho = galeria.querySelector(".galeria__trilho");
    const total = trilho.children.length;
    const contador = galeria.querySelector("[data-contador]");
    const anterior = galeria.querySelector("[data-anterior]");
    const proxima = galeria.querySelector("[data-proxima]");
    const miniaturas = [...galeria.querySelectorAll("[data-miniatura]")];
    const faixa = galeria.querySelector(".galeria__miniaturas");
    let atual = 0;

    const ir = (indice) => {
      const alvo = Math.max(0, Math.min(total - 1, indice));
      trilho.scrollTo({ left: alvo * trilho.clientWidth, behavior: movimento ? "smooth" : "auto" });
    };
    const marcar = (indice) => {
      if (indice === atual) return;
      atual = indice;
      contador.textContent = String(indice + 1);
      anterior.disabled = indice === 0;
      proxima.disabled = indice === total - 1;
      miniaturas.forEach((m, j) => m.setAttribute("aria-current", String(j === indice)));
      const mini = miniaturas[indice];
      if (mini && faixa) {
        const esquerda = mini.offsetLeft - (faixa.clientWidth - mini.offsetWidth) / 2;
        faixa.scrollTo({ left: esquerda, behavior: movimento ? "smooth" : "auto" });
      }
    };

    let quadro = 0;
    trilho.addEventListener(
      "scroll",
      () => {
        cancelAnimationFrame(quadro);
        quadro = requestAnimationFrame(() => marcar(Math.round(trilho.scrollLeft / trilho.clientWidth)));
      },
      { passive: true },
    );
    anterior.disabled = true;
    anterior.addEventListener("click", () => ir(atual - 1));
    proxima.addEventListener("click", () => ir(atual + 1));
    miniaturas.forEach((m, j) =>
      m.addEventListener("click", (e) => {
        e.preventDefault();
        ir(j);
      }),
    );
    trilho.addEventListener("keydown", (e) => {
      const teclas = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: total - 1 };
      if (e.key in teclas) {
        e.preventDefault();
        ir(teclas[e.key]);
      }
    });
  }
})();
