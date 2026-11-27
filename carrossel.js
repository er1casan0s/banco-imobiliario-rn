// ===============================================
//  CARROSSEL DE FUNDO – Banco Imobiliário do RN
// ===============================================

// 👇👇👇 TROQUE AQUI OS CAMINHOS DAS SUAS 13 IMAGENS 👇👇👇
const IMAGENS_CARROSSEL = [
  "imagens/1.jpg",   // imagem 1
  "imagens/2.jpg",   // imagem 2
  "imagens/3.jpg",   // imagem 3
  "imagens/4.jpg",   // imagem 4
  "imagens/5.png",   // imagem 5
  "imagens/6.jpg",   // imagem 6
  "imagens/7.jpg",   // imagem 7
  "imagens/8.jpg",   // imagem 8
  "imagens/9.jpg",   // imagem 9
  "imagens/10.jpg",  // imagem 10
  "imagens/11.jpg",  // imagem 11
  "imagens/12.jpg",  // imagem 12
  "imagens/13.png",  // imagem 13
  
];

// 👇 Tempo (em milissegundos) que cada imagem fica na tela. 6000 = 6 segundos
const TEMPO_POR_IMAGEM = 6000;
// ===============================================

(function () {
  const box = document.createElement("div");
  box.className = "bg-carrossel";

  const slides = IMAGENS_CARROSSEL.map(() => {
    const d = document.createElement("div");
    d.className = "slide";
    box.appendChild(d);
    return d;
  });

  document.body.prepend(box);

  const carregadas = new Set();
  function carregar(i) {
    i = i % IMAGENS_CARROSSEL.length;
    if (carregadas.has(i)) return;
    carregadas.add(i);
    slides[i].style.backgroundImage = `url("${IMAGENS_CARROSSEL[i]}")`;
  }

  let atual = 0;
  carregar(0);
  carregar(1);
  slides[0].classList.add("ativo");

  setInterval(() => {
    const anterior = atual;
    atual = (atual + 1) % slides.length;
    carregar(atual);
    carregar(atual + 1); // já deixa a próxima carregando

    slides[anterior].classList.remove("ativo");
    slides[anterior].classList.add("saindo");
    slides[atual].classList.remove("saindo");
    slides[atual].classList.add("ativo");

    setTimeout(() => slides[anterior].classList.remove("saindo"), 2000);
  }, TEMPO_POR_IMAGEM);
})();