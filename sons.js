// ===============================================
//  SONS – Banco Imobiliário do RN
// ===============================================

// 👇👇👇 EFEITOS SONOROS (pasta "sons") 👇👇👇
// Se um arquivo não existir, o jogo continua normal (só não toca aquele som).
const SONS = {
  clique:      "sons/clique.mp3",       // clique em qualquer botão
  dados:       "sons/dados.mp3",        // rolar os dados
  passo:       "sons/passo.mp3",        // cada casa que o peão anda (curtinho!)
  compra:      "sons/compra.mp3",       // comprou propriedade
  aluguel:     "sons/aluguel.mp3",      // pagou aluguel
  carta:       "sons/carta.mp3",        // carta da FORTUNA?
  salario:     "sons/salario.mp3",      // passou no INÍCIO / recebeu dinheiro
  restituicao: "sons/restituicao.mp3",  // Restituição
  receita:     "sons/receita.mp3",      // Receita Federal
  preso:       "sons/preso.mp3",        // Prisão / Camburão
  ferias:      "sons/ferias.mp3",       // Férias
  falencia:    "sons/falencia.mp3",     // Carta do Hacker (perdeu metade)
  faliu:       "sons/faliu.mp3",        // perdeu tudo e saiu
  vitoria:     "sons/vitoria.mp3",      // você ganhou
  derrota:     "sons/derrota.mp3"       // outro jogador ganhou
};

// 👇 MÚSICAS DE FUNDO – tocam em ordem aleatória, uma após a outra
// (troque os nomes/extensões se precisar; pode adicionar ou tirar linhas)
const MUSICAS = [
  "sons/musica1.mp3",   // música 1
  "sons/musica2.mp3",   // música 2
  "sons/musica3.mp3",   // música 3
  "sons/musica4.mp3",   // música 4
  "sons/musica5.mp3"    // música 5
];

// 👇 Volumes de 0 a 1
const VOLUME_EFEITOS = 0.6;
const VOLUME_MUSICA  = 0.15;
// ===============================================

(function () {
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ler = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  // Os EFEITOS sempre tocam. Só a MÚSICA liga/desliga (a escolha fica salva no navegador).
  let musicaLigada = ler("musicaLigada") !== "0";

  const base = {};
  Object.keys(SONS).forEach(k => {
    const a = new Audio(); a.preload = "auto"; a.src = SONS[k]; a.volume = VOLUME_EFEITOS;
    base[k] = a;
  });

  // toca um efeito (pode sobrepor, ex.: vários passos seguidos)
  window.tocar = function (nome) {
    if (!base[nome]) return;
    try {
      const a = base[nome].cloneNode();
      a.volume = VOLUME_EFEITOS;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  };

  // ---- música aleatória (nunca repete a mesma duas vezes seguidas) ----
  const musica = new Audio();
  musica.volume = VOLUME_MUSICA;
  let ultima = -1, tocando = false;

  function proxima() {
    if (!MUSICAS.length) return;
    let i;
    do { i = Math.floor(Math.random() * MUSICAS.length); }
    while (MUSICAS.length > 1 && i === ultima);
    ultima = i;
    musica.src = MUSICAS[i];
    const p = musica.play();
    if (p && p.catch) p.catch(() => {});
  }
  musica.addEventListener("ended", proxima);   // acabou -> sorteia outra
  musica.addEventListener("error", () => {     // arquivo faltando -> pula para outra
    if (tocando && MUSICAS.length > 1) setTimeout(proxima, 300);
  });

  function iniciarMusica() {
    if (!musicaLigada || tocando || !MUSICAS.length) return;
    tocando = true;
    if (ultima >= 0 && musica.paused) {        // estava pausada: continua de onde parou
      const p = musica.play();
      if (p && p.catch) p.catch(() => {});
    } else proxima();
  }

  // clique em qualquer botão + inicia a música no 1º clique
  // (o navegador só libera áudio depois de o jogador clicar em algo)
  document.addEventListener("click", e => {
    iniciarMusica();
    if (e.target.closest("button") && !e.target.closest("#btnMusica")) tocar("clique");
  });

  // botão 🎵 / 🔇 no canto da tela (liga/desliga SÓ a música)
  const btn = document.createElement("button");
  btn.id = "btnMusica";
  btn.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:50;width:46px;height:46px;" +
    "border-radius:50%;padding:0;margin:0;font-size:22px;background:#06163dcc;color:#fff;" +
    "border:1px solid #00e5ff;box-shadow:0 0 12px #00e5ff66;cursor:pointer";
  function atualizar() {
    btn.textContent = musicaLigada ? "🎵" : "🔇";
    btn.title = musicaLigada ? "Desligar música" : "Ligar música";
    btn.style.opacity = musicaLigada ? "1" : ".7";
  }
  btn.onclick = () => {
    musicaLigada = !musicaLigada;
    guardar("musicaLigada", musicaLigada ? "1" : "0");
    if (musicaLigada) { tocando = false; iniciarMusica(); }
    else { musica.pause(); tocando = false; }
    atualizar();
  };
  atualizar();
  document.body.appendChild(btn);
})();