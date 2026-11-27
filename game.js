const socket = io();
let salaAtual = null;

const PID = (() => {
  try {
    let p = localStorage.getItem('pid');
    if (!p) { p = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pid', p); }
    return p;
  } catch (e) { return Math.random().toString(36).slice(2); }
})();
const salvarSessao = () => { try { localStorage.setItem('sessao', JSON.stringify({ codigo: salaAtual, nome: NOME })); } catch (e) {} };
const limparSessao = () => { try { localStorage.removeItem('sessao'); } catch (e) {} };

const $ = s => document.querySelector(s);
const R = n => 'R$ ' + n.toLocaleString('pt-BR');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===== JANELA MODAL (estava faltando!) =====
function ask(titulo, corpo, botoes = ['OK']) {
  return new Promise(res => {
    $('#mt').innerHTML = titulo;
    $('#mb').innerHTML = corpo;
    const box = $('#mbtn'); box.innerHTML = '';
    botoes.forEach((txt, i) => {
      const b = document.createElement('button');
      b.textContent = txt;
      b.onclick = () => { $('#modal').hidden = true; res(i); };
      box.appendChild(b);
    });
    $('#modal').hidden = false;
  });
}

// ===== CASAS E ALUGUEL =====
const CUSTO_CASA = {rosa:120000, azul:50000, vermelho:75000, amarelo:150000,
                    laranja:80000, vclaro:100000, vescuro:100000, roxo:115000};
// sem casa = 10% do preço; cada casa dobra; hotel = 5 casas (x32)
const aluguelProp = (c, casas, hotel) => c.p * 0.1 * Math.pow(2, hotel ? 5 : casas);

// ganhos/perdas: online vêm do servidor, offline são contados aqui
const perdasDe = p => MODO === 'online' ? (p.gasto || 0) : (totalGasto[p.name] || 0);
const ganhosDe = p => MODO === 'online' ? (p.ganho || 0) : (totalGanho[p.name] || 0);

// evita HTML injetado por nomes de jogadores
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ===== AVISOS GRANDES NO MEIO DO TABULEIRO =====
(function () {
  const st = document.createElement('style');
  st.textContent = `
  .aviso{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:8;pointer-events:none;animation:avIn .35s ease-out}
  .aviso.sai{animation:avOut .35s ease-in forwards}
  .av-box{background:#06163df5;border:.5cqw solid var(--cor);box-shadow:0 0 4cqw var(--cor);border-radius:2cqw;padding:2.5cqw 5cqw;text-align:center;max-width:72%}
  .av-emoji{font-size:clamp(40px,10cqw,110px);line-height:1.1}
  .av-tit{font-family:Orbitron,'Segoe UI',sans-serif;font-weight:800;font-size:clamp(18px,4.2cqw,46px);color:#fff;text-shadow:0 0 12px var(--cor)}
  .av-txt{font-size:clamp(13px,2.4cqw,26px);color:#ffe36b;margin-top:.8cqw}
  @keyframes avIn{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
  @keyframes avOut{to{opacity:0;transform:scale(1.15)}}`;
  document.head.appendChild(st);
})();

let filaAviso = Promise.resolve();
function aviso(emoji, titulo, texto = '', cor = '#00e5ff', ms = 2300, som = '') {
  filaAviso = filaAviso.then(() => new Promise(res => {
    const board = $('#board');
    if (!board) return res();
    if (som) tocar(som); // 🔊 som do aviso (nome = tipo do aviso)
    if (getComputedStyle(board).position === 'static') board.style.position = 'relative';
    const el = document.createElement('div');
    el.className = 'aviso';
    el.style.setProperty('--cor', cor);
    el.innerHTML = `<div class="av-box"><div class="av-emoji">${emoji}</div><div class="av-tit">${titulo}</div>${texto ? `<div class="av-txt">${texto}</div>` : ''}</div>`;
    board.appendChild(el);
    setTimeout(() => { el.classList.add('sai'); setTimeout(() => { el.remove(); res(); }, 350); }, ms);
  }));
  return filaAviso;
}

// lista: [{tipo, nome, valor, jogadorId | eu}]  tipos: preso, ferias, salario, falencia, faliu
function mostrarAvisos(lista) {
  const ps = (lista || []).map(a => {
    const eu = a.eu !== undefined ? a.eu : (a.jogadorId === socket.id);
    const n = esc(a.nome || '');
    let t;
    if (a.tipo === 'preso')
      t = eu ? ['🚓', 'Você foi preso!', 'Direto para a Prisão.', '#d62d2d'] : ['🚓', `${n} foi preso!`, '', '#d62d2d'];
    else if (a.tipo === 'ferias')
      t = eu ? ['🏖️', 'Você tirou férias!', 'Aproveite o descanso.', '#00b8d9'] : ['🏖️', `${n} tirou férias!`, '', '#00b8d9'];
    else if (a.tipo === 'salario')
      t = eu ? ['💰', 'Você recebeu o salário!', `+ ${R(a.valor)}`, '#43a047'] : ['💰', `${n} recebeu o salário!`, `+ ${R(a.valor)}`, '#43a047'];
    else if (a.tipo === 'falencia')
      t = eu ? ['💥', 'Você faliu!', `Perdeu metade do saldo: − ${R(a.valor)}`, '#d62d2d'] : ['💥', `${n} faliu!`, `Perdeu metade do saldo: − ${R(a.valor)}`, '#d62d2d'];
    else if (a.tipo === 'faliu')
      t = eu ? ['💥', 'Você perdeu tudo!', 'Você saiu da partida.', '#d62d2d'] : ['💥', `${n} perdeu tudo!`, 'Saiu da partida.', '#d62d2d'];
    else if (a.tipo === 'receita')
      t = eu ? ['🏛️', 'Receita Federal!', `Você pagou ${R(a.valor)} de impostos`, '#d62d2d'] : ['🏛️', `${n} caiu na Receita Federal!`, `Pagou ${R(a.valor)} de impostos`, '#d62d2d'];
    else if (a.tipo === 'restituicao')
      t = eu ? ['🤑', 'Restituição!', `Você recebeu + ${R(a.valor)}`, '#43a047'] : ['🤑', `${n} recebeu a Restituição!`, `+ ${R(a.valor)}`, '#43a047'];
    else return Promise.resolve();
    return aviso(t[0], t[1], t[2], t[3], 2300, a.tipo);
  });
  return Promise.all(ps);
}
// modos offline: "eu" = jogador humano contra a IA; no multiplayer local usa o nome
const avisoLocal = (tipo, p, valor) => mostrarAvisos([{ tipo, nome: p.name, valor, eu: MODO === 'ia' && !p.ai }]);

// ===== FIM DE JOGO =====
function tabelaResumo(resumo) {
  return '<div style="text-align:left; font-size:13px; max-height:45vh; overflow:auto;">' +
    [...resumo].sort((a, b) => b.patrimonio - a.patrimonio).map((r, k) =>
      `<div style="margin-bottom:8px; padding:6px 8px; border-left:5px solid ${r.cor}; background:#0000000d; border-radius:0 6px 6px 0; ${r.out ? 'opacity:.6;' : ''}">
        <b>${['🥇', '🥈', '🥉'][k] || (k + 1) + 'º'} ${esc(r.name)}${r.out ? ' (saiu/faliu)' : ''}</b><br>
        Patrimônio: ${R(r.patrimonio)}<br>
        <span style="color:#2e8b3d">Ganhos: ${R(r.ganho)}</span> · <span style="color:#d62d2d">Perdas: ${R(r.gasto)}</span>
      </div>`).join('') + '</div>';
}
function resumoLocal() {
  return G.p.map((p, i) => ({ name: p.name, cor: p.cor, patrimonio: patrimonio(p, i), ganho: totalGanho[p.name] || 0, gasto: totalGasto[p.name] || 0, out: !!p.out }));
}
function voltarParaInicio() { limparSessao(); location.reload(); }

async function fimDeJogo(nome, eu, resumo) {
  tocar(eu ? 'vitoria' : 'derrota'); // 🔊
  await aviso('🏆', eu ? 'VOCÊ GANHOU!' : `${esc(nome)} venceu!`,
    eu ? 'Todos os outros jogadores saíram ou faliram.' : 'A partida terminou.', '#f2c500', 3200);
  const r = await ask(eu ? '🏆 Você ganhou!' : `🏆 ${esc(nome)} venceu!`,
    eu ? 'Parabéns! Você foi o último jogador na partida.' : 'A partida acabou. O que deseja fazer?',
    ['Ver ganhos', 'Sair']);
  if (r === 0) await ask('📊 Resultado final', tabelaResumo(resumo), ['Voltar à tela inicial']);
  voltarParaInicio();
}

const COR = {rosa:'#d6409f',roxo:'#7b3fa0',laranja:'#f28c1e',amarelo:'#f2c500',vermelho:'#d62d2d',vclaro:'#7ccc5a',vescuro:'#2e8b3d',azul:'#3ba0d8',preto:'#222'};
const CORES = [['Vermelho','#e53935'],['Roxo','#8e24aa'],['Rosa','#ec407a'],['Amarelo','#fdd835'],['Azul','#1e88e5'],['Verde','#43a047'],['Laranja','#fb8c00'],['Marrom','#6d4c41']];

const P = (n,p,g) => ({n,p,g,t:'p'});
const C = (n,p)   => ({n,p,g:'preto',t:'c'});
const S = {n:'FORTUNA?',t:'s'};
const T = [
 {n:'INÍCIO',t:'in',img:'inicio'}, P('Av. Hermes da Fonseca',100000,'vclaro'), C('Cosern',200000), P('Parrachos de Maracajaú',60000,'vescuro'), S,
 P('Av. Roberto Freire',220000,'vermelho'), C('CaboTelecom',150000), P('Rua Princesa Isabel',220000,'vermelho'), P('Av. Salgado Filho',240000,'vermelho'), S,
 {n:'PRISÃO',t:'pr',img:'prisao'}, P('Rua Chile',180000,'azul'), C('Mina Brejuí',200000), P('Ganho do Igapó',180000,'azul'),
 P('Viaduto do Quarto Centenário',200000,'azul'), S, C('Minas de Sal de Macau',150000), P('Tirol',350000,'rosa'),
 {n:'Receita Federal',t:'rf',p:-200000}, P('Petrópolis',400000,'rosa'), {n:'FÉRIAS',t:'fe',img:'feriado'},
 P('Av. Rio Branco',120000,'roxo'), S, P('Av. Deodoro da Fonseca',100000,'roxo'), P('Ponte Newton Navarro',140000,'vescuro'),
 P('Av. Moema Tinoco',200000,'vescuro'), C('Parque Eólico de Rio do Fogo',200000), S, P('Av. Prudente de Morais',160000,'vclaro'),
 P('Praça Cívica',320000,'laranja'), {n:'CAMBURÃO',t:'ca',img:'camburao'}, P('Praça do Relógio (Alecrim)',300000,'laranja'), S,
 P('Av. Afonso Pena',300000,'laranja'), C('Caern',200000), P('Praia de Ponta Negra',280000,'amarelo'), P('Praia do Meio',260000,'amarelo'),
 {n:'Restituição',t:'re',p:150000}, P('Praia da Redinha',260000,'amarelo'), S
];

const XY = i => i<=10 ? [10,10-i] : i<20 ? [20-i,0] : i<=30 ? [0,i-20] : [i-30,10];

const CARTAS = [
 // ========== SORTE / GANHOS ==========
 ['Seu filho quebrou o braço. Pague R$ 20.000 ao Banco.','m',-20000],
 ['Você ganhou na loteria! Receba R$ 80.000.','m',80000],
 ['Você venceu no bolão! Todos os jogadores lhe pagam R$ 50.000.','all',50000],
 ['Seu carro foi para a oficina. Pague R$ 60.000.','m',-60000],
 ['IPTU atrasado! Pague R$ 100.000.','m',-100000],
 ['Vendeu artesanato em Genipabu! Receba R$ 40.000.','m',40000],
 ['Habeas Corpus! Guarde esta carta para sair da prisão.','free'],
 ['Festa de aniversário: pague R$ 20.000 a cada jogador.','each',20000],
 ['Fiscalização! Vá direto para a prisão.','jail'],
 ['Avance até o Início e receba seu salário.','start'],
 ['Seu time ganhou o Campeonato Potiguar! Receba R$ 120.000.','m',120000],
 ['Passeio de buggy nas dunas: pague R$ 30.000.','m',-30000],
 ['Apostou no América e ele perdeu : pague R$ 50.000','m',-50000],
 ['Apostou no ABC e ele perdeu : pague R$ 50.000','m',-50000],
 ['Apostou no ABC e ele ganhou : receba R$ 40.000','m',40000],
 ['Apostou no América e ele ganhou : receba R$ 40.000','m',40000],
 ['Foi no Parque das Dunas e achou uma maleta : receba R$ 20.000','m',20000],
 ['Foi dar um rolê no NatalShopping com crush : pague R$ 25.000','m',-25000],
 ['Ganhou o concurso DoSol : ganhe R$10.000 de todos os jogadores','all',10000],
 ['Foi no Beco da Lama e perdeu a carteira : perdeu 50.000','m',-50000],
 ['Recebeu herança de parentes dos outros jogadores','all',25000],

 // ========== NOVAS CARTAS DE SORTE ==========
 ['Ganhou o prêmio de melhor torcedor no estádio Arena das Dunas! Receba R$ 60.000.','m',60000],
 ['Sua banda de forró foi contratada para o Carnatal! Receba R$ 90.000.','m',90000],
 ['Vendeu cocadas na Praia de Ponta Negra e lucrou bem! Receba R$ 35.000.','m',35000],
 ['Achou um tesouro enterrado na Fortaleza dos Reis Magos! Receba R$ 150.000.','m',150000],
 ['Seu barco voltou cheio de pescado em Areia Branca! Receba R$ 70.000.','m',70000],
 ['Ganhou um quadro raro num leilão em Galinhos! Receba R$ 110.000.','m',110000],
 ['Foi eleito vereador em Natal e recebeu o salário adiantado! Receba R$ 130.000.','m',130000],
 ['Seu petróleo brotou no quintal em Mossoró! Receba R$ 200.000.','m',200000],
 ['Fez a melhor carne de sol do RN e ganhou o concurso! Receba R$ 45.000.','m',45000],
 ['Turista gringo comprou seu artesanato de rendeira! Receba R$ 55.000.','m',55000],
 ['Ganhou a corrida de jangadas em Pirangi do Norte! Receba R$ 75.000.','m',75000],
 ['Vendeu a casa em Pipa por um bom preço! Receba R$ 180.000.','m',180000],
 ['Seu restaurante em Tibau foi eleito o melhor do estado! Receba R$ 85.000.','m',85000],
 ['Ganhou o bingo beneficente da igreja de Santa Cruz! Receba R$ 30.000.','m',30000],
 ['Sua vaquinha no Agreste deu cria e rendeu lucro! Receba R$ 65.000.','m',65000],
 ['Ganhou o campeonato de surfe em Baía Formosa! Receba R$ 50.000.','m',50000],
 ['Vendeu castanha de caju em grande quantidade! Receba R$ 95.000.','m',95000],
 ['Seu engenho de cana em Ceará-Mirim faturou alto! Receba R$ 125.000.','m',125000],
 ['Achou uma moeda de ouro no Mercado Público de Natal! Receba R$ 140.000.','m',140000],
 ['Ganhou o prêmio de melhor cuscuz do RN! Receba R$ 40.000.','m',40000],
 ['Tirou a sorte grande no bingo do Natal Shopping! Receba R$ 100.000.','m',100000],
 ['Seu canal no YouTube sobre o RN viralizou! Receba R$ 160.000.','m',160000],
 ['Vendeu o carro por mais do que comprou! Receba R$ 70.000.','m',70000],
 ['Recebeu uma indenização inesperada do Banco! Receba R$ 115.000.','m',115000],
 ['Ganhou uma bicicleta numa rifa em Parnamirim! Receba R$ 25.000.','m',25000],
 ['Sua loja em Caicó vendeu tudo no São João! Receba R$ 105.000.','m',105000],
 ['Foi sorteado no consórcio do Banco! Receba R$ 170.000.','m',170000],
 ['Ganhou um prêmio de fotografia com a lua de Natal! Receba R$ 60.000.','m',60000],
 ['Seu filho passou no vestibular da UFRN! Receba R$ 50.000 de bônus.','m',50000],
 ['Encontrou uma mala de dinheiro na Praia dos Artistas! Receba R$ 190.000.','m',190000],
 ['Vendeu mel de engenho em Serra Negra do Norte! Receba R$ 45.000.','m',45000],
 ['Ganhou o concurso de quadrilha junina em Mossoró! Receba R$ 55.000.','m',55000],
 ['Seu jumento ganhou a corrida em São José de Mipibu! Receba R$ 35.000.','m',35000],
 ['Recebeu uma herança de um tio distante em Lisboa! Receba R$ 220.000.','m',220000],
 ['Ganhou o festival de jazz em Pipa! Receba R$ 80.000.','m',80000],
 ['Sua pousada em Tibau do Sul lotou na alta temporada! Receba R$ 150.000.','m',150000],
 ['Achou petróleo na praia de Areia Preta? Brincadeira, mas rendeu R$ 90.000.','m',90000],
 ['Ganhou o prêmio de melhor queijo coalho artesanal! Receba R$ 65.000.','m',65000],
 ['Sua vaquinha leiteira em Lajes produziu recorde! Receba R$ 75.000.','m',75000],
 ['Vendeu ovos de codorna em João Câmara e lucrou! Receba R$ 30.000.','m',30000],
 ['Recebeu um bônus da Caern por economia de água! Receba R$ 40.000.','m',40000],
 ['Ganhou o campeonato de futebol de areia em Ponta Negra! Receba R$ 85.000.','m',85000],
 ['Seu restaurante de camarão em Galinhos faturou alto! Receba R$ 120.000.','m',120000],
 ['Ganhou uma viagem para Fernando de Noronha e revendeu! Receba R$ 100.000.','m',100000],

 // ========== NOVAS CARTAS DE AZAR ==========
 ['O carro quebrou na BR-101 e a oficina cobrou caro! Pague R$ 45.000.','m',-45000],
 ['Foi multado por excesso de velocidade na Av. Salgado Filho! Pague R$ 30.000.','m',-30000],
 ['Seu celular caiu no mar em Maracajaú! Pague R$ 25.000.','m',-25000],
 ['Perdeu a carteira no Carnatal! Pague R$ 20.000.','m',-20000],
 ['Foi assaltado na Praia de Ponta Negra! Pague R$ 35.000.','m',-35000],
 ['O telhado da sua casa voou com o vento em Natal! Pague R$ 80.000.','m',-80000],
 ['Sua conta de luz da Cosern veio altíssima! Pague R$ 40.000.','m',-40000],
 ['Teve que pagar fiança para um amigo preso no Camburão! Pague R$ 60.000.','m',-60000],
 ['A seca no Seridó matou sua plantação! Pague R$ 90.000.','m',-90000],
 ['Sua jangada afundou em Areia Branca! Pague R$ 50.000.','m',-50000],
 ['Foi picado por uma água-viva em Pirangi! Pague R$ 15.000.','m',-15000],
 ['O ar-condicionado quebrou no verão de 40 graus! Pague R$ 30.000.','m',-30000],
 ['Sua moto foi roubada em Mossoró! Pague R$ 45.000.','m',-45000],
 ['Perdeu a aposta no jogo do ABC e pagou caro! Pague R$ 55.000.','m',-55000],
 ['Teve que reformar a casa depois da chuva em Natal! Pague R$ 70.000.','m',-70000],
 ['Sua nota fiscal foi cancelada e você perdeu o valor! Pague R$ 65.000.','m',-65000],
 ['Foi parado na blitz da Lei Seca e pagou multa! Pague R$ 25.000.','m',-25000],
 ['O IPVA do seu carro atrasou e veio com juros! Pague R$ 35.000.','m',-35000],
 ['Foi cobrado por um serviço que não contratou! Pague R$ 20.000.','m',-20000],
 ['A enchente na Ribeira levou seus móveis! Pague R$ 75.000.','m',-75000],
 ['Sua loja em Caicó foi assaltada no São João! Pague R$ 85.000.','m',-85000],
 ['Teve que pagar pensão atrasada do filho! Pague R$ 60.000.','m',-60000],
 ['O pneu do carro furou na estrada e o conserto foi caro! Pague R$ 18.000.','m',-18000],
 ['Foi demitido e teve que pagar as contas do mês! Pague R$ 100.000.','m',-100000],
 ['Sua encomenda dos Correios foi extraviada! Pague R$ 22.000.','m',-22000],
 ['O dentista cobrou caro pelo tratamento! Pague R$ 28.000.','m',-28000],
 ['Foi ao médico e descobriu uma doença rara! Pague R$ 110.000.','m',-110000],
 ['O banco cobrou tarifas indevidas (mas você perdeu a causa)! Pague R$ 15.000.','m',-15000],
 ['Foi multado por pescar em época de defeso! Pague R$ 40.000.','m',-40000],
 ['Seu cavalo fugiu e você teve que pagar pela busca! Pague R$ 32.000.','m',-32000],
 ['A festa de casamento estourou o orçamento! Pague R$ 95.000.','m',-95000],
 ['Seu filho quebrou o vidro do vizinho com a bola! Pague R$ 12.000.','m',-12000],
 ['Foi enganado por um golpe no WhatsApp! Pague R$ 48.000.','m',-48000],
 ['A diarista quebrou sua TV nova! Pague R$ 38.000.','m',-38000],
 ['Foi ao dentista e precisou de implante! Pague R$ 70.000.','m',-70000],
 ['O cachorro comeu o sofá novo! Pague R$ 26.000.','m',-26000],
 ['Seu cartão de crédito foi clonado! Pague R$ 52.000.','m',-52000],
 ['Perdeu o voo para Fernando de Noronha e não teve reembolso! Pague R$ 60.000.','m',-60000],
 ['Foi ao show do artista famoso e o ingresso foi caro! Pague R$ 20.000.','m',-20000],
 ['A tinta do seu carro descascou com o sol do RN! Pague R$ 28.000.','m',-28000],
 ['Sua rede social foi hackeada e você perdeu seguidores (e dinheiro)! Pague R$ 18.000.','m',-18000],
 ['O gás acabou no meio do churrasco e você teve que comprar outro! Pague R$ 10.000.','m',-10000],
 ['Foi ao oftalmologista e precisou de óculos novos! Pague R$ 24.000.','m',-24000],
 ['Um hacker invadiu o ! Você foi a falência.','bankrupt'],

 // ========== CARTAS ESPECIAIS (all / each / free / jail / start) ==========
 ['Ganhou o concurso de melhor fantasia no Carnatal! Todos os jogadores lhe pagam R$ 30.000.','all',30000],
 ['Fez aniversário e ganhou presente de todos os jogadores! Receba R$ 25.000 de cada.','all',25000],
 ['Ganhou uma aposta contra todos os jogadores no jogo do América! Receba R$ 40.000 de cada.','all',40000],
 ['Seu time ganhou o clássico e todos os torcedores rivais lhe pagam R$ 20.000.','all',20000],
 ['Vendeu um terreno em Pipa por um preço alto e todos os jogadores querem sua comissão! Receba R$ 35.000 de cada.','all',35000],
 ['Foi eleito o melhor cozinheiro do RN e todos os jogadores pagam R$ 15.000 pelo prato.','all',15000],
 ['Seu som automotivo foi eleito o melhor da cidade e todos pagam R$ 20.000 para ouvir.','all',20000],
 ['Ganhou o bingo da terceira idade e todos os jogadores contribuem com R$ 10.000.','all',10000],
 ['Sua casa foi sorteada no programa de TV e todos os jogadores pagam R$ 45.000 de taxa.','all',45000],
 ['Descobriu uma fonte de água no seu quintal e todos os jogadores pagam R$ 18.000 para usar.','all',18000],
 ['Foi ao médico e o tratamento custou caro! Pague R$ 25.000 a cada jogador (que riu de você).','each',25000],
 ['Fez uma festa junina e gastou demais! Pague R$ 30.000 a cada jogador.','each',30000],
 ['Perdeu uma aposta para todos os jogadores no jogo do ABC! Pague R$ 20.000 a cada.','each',20000],
 ['Sua empresa faliu e você deve salários! Pague R$ 35.000 a cada jogador.','each',35000],
 ['Comprou uma rodada de cerveja para todos no bar do Beco da Lama! Pague R$ 15.000 a cada.','each',15000],
 ['Foi ao casamento do amigo e o presente foi caro! Pague R$ 12.000 a cada jogador.','each',12000],
 ['Sua vaquinha de leite secou e você deve a todos os jogadores! Pague R$ 18.000 a cada.','each',18000],
 ['Habeas Corpus! Guarde esta carta para sair da prisão.','free'],
 ['Mandado de soltura! Use quando for preso para sair imediatamente.','free'],
 ['Advogado conseguiu sua liberdade! Guarde esta carta para sair da prisão.','free'],
 ['Fiscalização da Receita Federal! Vá direto para a prisão.','jail'],
 ['A polícia te pegou com contrabando em Macau! Vá direto para a prisão.','jail'],
 ['Foi pego dirigindo sem CNH! Vá direto para a prisão.','jail'],
 ['Foi acusado de fraude no Banco e vai preso! Vá direto para a prisão.','jail'],
 ['Avance até o Início e receba seu salário.','start'],
 ['Volte ao Início para buscar seu pagamento atrasado! Receba o salário.','start'],
 ['Seu contracheque chegou! Avance ao Início e receba R$ 200.000.','start']
];

let AC; let MODO = 'ia', NOME = '';
let G = {p:[], own:[], mort:[], casas:[], hotel:[], cur:0, roll:0, rolled:false, busy:false, duplas:0, historico:[]};
let totalGasto = {}; let totalGanho = {};

function modo(m){
  NOME = $('#nome').value.trim() || 'Jogador';
  if(m === 'online'){ MODO = 'online'; $('#s1').hidden = true; $('#modalOnline').hidden = false; mostrarOpcoes(); return; }
  MODO=m; $('#s1').hidden=true; $('#s2').hidden=false;
  $('#qtd').innerHTML=[2,3,4,5,6,7,8].map(n=>`<option>${n}</option>`).join('');
  montaLinhas();
}

function voltarInicio() {
  $('#s1').hidden = false;
  $('#s2').hidden = true;
  MODO = 'ia';
}

function fecharModalOnline() { $('#modalOnline').hidden = true; $('#s1').hidden = false; MODO = 'ia'; }
function mostrarOpcoes() { $('#telaOpcoesOnline').hidden = false; $('#telaEntrarSala').hidden = true; }
function mostrarEntrarSala() { $('#telaOpcoesOnline').hidden = true; $('#telaEntrarSala').hidden = false; $('#inputCodigoSala').value = ''; $('#inputCodigoSala').focus(); }
function mostrarCriarSala() { $('#modalOnline').hidden = true; socket.emit('criarSala', { nome: NOME, cor: '#e53935', pid: PID }); }
function confirmarEntrarSala() { const c = $('#inputCodigoSala').value.trim().toUpperCase(); if(c.length<4) return alert('Código inválido'); $('#modalOnline').hidden = true; socket.emit('entrarSala', { codigo: c, nome: NOME, cor: '#1e88e5', pid: PID }); }

function montaLinhas(){
  const n=+$('#qtd').value; let h='';
  for(let i=0;i<n;i++){
    const ia = MODO==='ia' && i>0;
    const nomePadrao = MODO==='ia' ? (i===0?NOME:'Potiguar0'+(83+i)) : (i===0?NOME:'Jogador '+(i+1));
    h+=`<div class="lin">
          <input value="${nomePadrao}" ${ia?'disabled':''} style="flex:2; margin-bottom:0;">
          <select style="flex:1; margin-bottom:0;">${CORES.map((c,j)=>`<option value="${c[1]}" ${j===i?'selected':''}>${c[0]}</option>`).join('')}</select>
        </div>`;
  }
  $('#linhas').innerHTML=h;
}

function iniciar(){
  AC = AC || new (window.AudioContext||window.webkitAudioContext)();
  const lin=[...document.querySelectorAll('.lin')];
  const cores=lin.map(l=>l.querySelector('select').value);
  if(new Set(cores).size<cores.length) return alert('Escolha cores diferentes!');
  G.p = lin.map((l,i)=>({name:l.querySelector('input').value||'J'+(i+1), cor:cores[i], money:2560000, pos:0, jail:0, free:0, ferias:0, ai:(MODO==='ia'&&i>0), out:false}));
  G.own=Array(40).fill(-1); G.mort=Array(40).fill(false); G.casas=Array(40).fill(0); G.hotel=Array(40).fill(false); G.cur=0; G.duplas=0;
  G.historico = [];
  G.p.forEach(p => { totalGasto[p.name] = 0; totalGanho[p.name] = 0; });
  
  $('#setup').hidden=true; $('#s2').hidden=true; $('#jogo').hidden=false; 
  montaTabuleiro(); 
  turno(); // ESSA LINHA É FUNDAMENTAL PARA INICIAR O JOGO
}

function montaTabuleiro(){
  $('#board').innerHTML = ''; 
  const centro = document.createElement('div'); centro.className = 'centro';
  centro.innerHTML = `<h2>BANCO IMOBILIÁRIO<br>DO RN</h2><div id="dados">🎲 🎲</div><div id="botoes">
      <button id="bRoll" onclick="rolar()">Rolar dados</button>
      <button id="bMort" onclick="hipotecas()">Hipotecar</button>
      <button id="bTrade" onclick="negociar()">Negociar</button>
      <button id="bBuild" onclick="construir()">Construir</button>
      <button id="bEnd" onclick="fim()">Encerrar vez</button></div>`;
  $('#board').appendChild(centro);

  T.forEach((c,i)=>{
    const d=document.createElement('div'); d.className='cell'+(c.img?' img':'')+(c.t==='s'?' s':'');
    d.id='c'+i; const [r,k]=XY(i); d.style.gridRow=r+1; d.style.gridColumn=k+1;
    if(c.img) d.style.backgroundImage=`url(img/${c.img}.png)`;
    
    let label = c.n;
    if(c.t==='rf') label = `Receita<br><span style="font-size:0.8em">-R$ 200.000</span>`;
    else if(c.t==='re') label = `Restituição<br><span style="font-size:0.8em">+R$ 150.000</span>`;
    else if(c.t==='p') label = `${c.n}<br><span style="font-size:0.8em">${R(c.p)}</span>`;

    d.innerHTML=(c.g?`<i class="band" style="background:${COR[c.g]}"></i>`:'')+`<b>${label}</b><em class="own"></em><div class="pw"></div><div class="houses"></div>`;
    $('#board').append(d);
  });
}

const patrimonio = (p,idx) => p.money + T.reduce((s,c,i)=>s+(G.own[i]===idx?(G.mort[i]?c.p/2:c.p):0),0);

function ui(){
  document.querySelectorAll('.pw').forEach(e=>e.innerHTML='');
  G.p.forEach(p=>{ if(!p.out) $('#c'+p.pos+' .pw').innerHTML+=`<span class="pawn" style="background:${p.cor}"></span>`; });
  
  T.forEach((c,i)=>{ 
    const e=$('#c'+i); if(!e) return; 
    e.classList.toggle('hip',!!G.mort[i]);
    const d=G.own[i]>=0?G.p[G.own[i]]:null, o=e.querySelector('.own');
    o.style.background=d?d.cor:'none'; o.textContent=d?'● '+d.name.slice(0,10):'';
    e.style.boxShadow=d?`inset 0 0 0 .5cqw ${d.cor}`:'none';
    
    const hDiv = e.querySelector('.houses');
    if (hDiv) {
      hDiv.innerHTML = '';
      if (G.hotel[i]) hDiv.innerHTML = '🏨';
      else if (G.casas[i] > 0) hDiv.innerHTML = '🏠'.repeat(G.casas[i]);
    }
  });

  $('#rank').innerHTML=G.p.map((p,i)=>({p,i,v:patrimonio(p,i)})).sort((a,b)=>b.v-a.v)
    .map((o,k)=>`
      <div class="rk ${o.i===G.cur?'vez':''} ${o.p.out?'out':''}">
        <span class="pos">${['🥇','🥈','🥉'][k]||k+1}</span>
        <i class="dot" style="background:${o.p.cor}"></i>
        <div class="inf">
            <b>${o.p.name}${o.p.free?' 🔑':''}${o.p.jail?' 🔒':''}${o.p.ferias?' 🏖️':''}${o.p.offline?' 🔌':''}${o.i===G.cur?' ◄':''}</b>
            <small style="color:#ff8888">Perdas: ${R(perdasDe(o.p))}</small>
            <small style="color:#7ccc5a">Ganhos: ${R(ganhosDe(o.p))}</small>
        </div>
        <div class="tot">${R(o.v)}</div>
      </div>`).join('');

  // Atualiza o histórico
  $('#log').innerHTML = G.historico.slice(0, 15).map(t => {
    const jogador = G.p.find(x => t.includes(x.name));
    const cor = jogador ? jogador.cor : '#00e5ff';
    return `<div class="lg" style="border-color:${cor}">${t}</div>`;
  }).join('');
      
  let h;
  if (MODO === 'online') {
    h = G.p.length > 0 && G.p[G.cur].id === socket.id && !G.busy;
  } else {
    h = !G.p[G.cur].ai && !G.busy;
  }

  $('#bRoll').disabled = !(h && (!G.rolled || G.duplas>0));
  $('#bEnd').disabled = !(h && G.rolled && G.duplas===0);
  $('#bMort').disabled = !h; $('#bTrade').disabled = !h; $('#bBuild').disabled = !h;
}

function addLog(txt) { 
  G.historico.unshift(txt); 
  ui(); 
}

async function turno(){
  const p=G.p[G.cur]; G.rolled=false; G.busy=true; G.duplas=0;
  ui();
  if(p.ferias){ p.ferias--; addLog(`${p.name} está de férias.`); return fim(true); }
  if(p.jail){
    if(p.free>0 && (p.ai || (await ask('Você está preso','Usar Habeas Corpus?',['Usar','Não']))===0)){ p.free--; p.jail=0; addLog(`${p.name} saiu da prisão.`); }
    else if(p.jail===2){ p.jail=1; return fim(true); }
    else { pay(p,50000); p.jail=0; }
  }
  G.busy=false; ui();
  if(p.ai){ await sleep(800); await rolar(); await sleep(700); fim(); }
}

async function rolar(){
  if(MODO === 'online') { G.busy = true; ui(); socket.emit('rolarDados', salaAtual); return; }
  
  G.busy=true; G.rolled=true; ui();
  tocar('dados'); // 🔊
  let a,b; for(let i=0;i<8;i++){ a=1+Math.random()*6|0; b=1+Math.random()*6|0; $('#dados').textContent=`${'⚀⚁⚂⚃⚄⚅'[a-1]} ${'⚀⚁⚂⚃⚄⚅'[b-1]}`; await sleep(90); }
  G.roll=a+b; const p=G.p[G.cur]; addLog(`${p.name} tirou ${a}+${b} = ${G.roll}`);
  
  for(let i=0;i<G.roll;i++){ 
      p.pos=(p.pos+1)%40; tocar('passo'); // 🔊
      if(p.pos===0){ p.money+=200000; totalGanho[p.name]+=200000; addLog(`${p.name} passou pelo Início (+200k)`); ui(); await avisoLocal('salario', p, 200000); } 
      ui(); await sleep(160); 
  }
  await land(p); G.busy=false; ui();
}

async function land(p){
  const i=p.pos, c=T[i], me=G.cur;
  if(c.t==='p'||c.t==='c'){
    const o=G.own[i];
    if(o<0){
      if(p.money<c.p) return;
      const compra = p.ai ? p.money-c.p>300000 : (await ask(c.n,`Preço: ${R(c.p)}`,['Comprar','Não']))===0;
      if(compra){ 
          p.money-=c.p; totalGasto[p.name]+=c.p; G.own[i]=me; 
          addLog(`${p.name} comprou ${c.n} por ${R(c.p)}`); tocar('compra'); // 🔊

      }
    } else if(o!==me && !G.mort[i]){
      let v = c.t==='c' ? 80000*G.roll : aluguelProp(c, G.casas[i], G.hotel[i]);
      
      pay(p,v,o); tocar('aluguel'); // 🔊

      totalGasto[p.name]+=v; totalGanho[G.p[o].name]+=v;
      addLog(`${p.name} pagou ${R(v)} de aluguel a ${G.p[o].name} (${c.n})`);
      if(!p.ai) await ask('Aluguel',`Você pagou ${R(v)} a ${G.p[o].name}.`);
    }
  } else if(c.t==='rf'){ pay(p,200000); totalGasto[p.name]+=200000; addLog(`${p.name} pagou R$ 200k à Receita.`); ui(); await avisoLocal('receita', p, 200000);
  } else if(c.t==='re'){ p.money+=150000; totalGanho[p.name]+=150000; addLog(`${p.name} recebeu R$ 150k de Restituição.`); ui(); await avisoLocal('restituicao', p, 150000);
  } else if(c.t==='ca'){ 
      p.pos=10; p.jail=2; addLog(`${p.name} foi preso!`);
      ui(); await avisoLocal('preso', p);
  } else if(c.t==='s'){ await carta(p); }
  else if(c.t==='fe'){ p.ferias = 2; addLog(`${p.name} tirou férias!`); ui(); await avisoLocal('ferias', p); }
}

// CARTA 
async function carta(p){
  const [txt,tipo,v]=CARTAS[Math.random()*CARTAS.length|0];
  tocar('carta'); // 🔊
  await ask('🎴 FORTUNA?',txt);
  if(tipo === 'm'){ p.money += v; if(v>0) totalGanho[p.name]+=v; else totalGasto[p.name]+=Math.abs(v); addLog(`${p.name}: ${txt}`); }
  else if(tipo === 'all'){ G.p.filter(x => x!==p && !x.out).forEach(o => { o.money -= v; totalGasto[o.name]+=v; p.money += v; totalGanho[p.name]+=v; }); addLog(`${p.name} recebeu de todos.`); }
  else if(tipo === 'each'){ G.p.filter(x => x!==p && !x.out).forEach(o => { o.money += v; totalGanho[o.name]+=v; p.money -= v; totalGasto[p.name]+=v; }); addLog(`${p.name} pagou a todos.`); }
  else if(tipo === 'jail'){ p.pos=10; p.jail=2; addLog(`${p.name} foi preso pela fiscalização.`); ui(); await avisoLocal('preso', p); }
  else if(tipo === 'bankrupt'){
    // perde metade do saldo atual
    const perdido = Math.max(0, Math.floor(p.money/2));
    p.money -= perdido;
    totalGasto[p.name] += perdido;
    addLog(`💥 ${p.name} faliu! Perdeu metade do saldo (${R(perdido)}).`);
    ui();
    await avisoLocal('falencia', p, perdido);

    // Se ficou negativo, oferece vender propriedades ao banco (preço inicial)
    if(p.money < 0){
      const minhasProps = T.map((c,i)=>i).filter(i => G.own[i] === G.cur);

      if(minhasProps.length > 0){
        const valorVenda = minhasProps.reduce((s,i)=> s + T[i].p, 0);

        let r;
        if(p.ai){
          // IA pensa se vale a pena vender para continuar
          r = iaDecideVender(p, minhasProps, valorVenda);
        } else {
          r = await ask('🏚️ Vender propriedades?',
            `Seu saldo está negativo (${R(p.money)}).<br>` +
            `Você tem ${minhasProps.length} propriedade(s) que podem ser vendidas ao banco por <b>${R(valorVenda)}</b> (preço inicial).<br><br>` +
            `Deseja vender tudo ao banco para continuar no jogo?`,
            ['Vender e continuar', 'Não, sair do jogo']);
        }

        if(r === 0){
          minhasProps.forEach(i => {
            p.money += T[i].p;
            totalGanho[p.name] += T[i].p;
            G.own[i] = -1;
            G.mort[i] = false;
            G.casas[i] = 0;
            G.hotel[i] = false;
          });
          addLog(`🏚️ ${p.name} vendeu ${minhasProps.length} propriedade(s) ao banco por ${R(valorVenda)}.`);
          ui();
          await avisoLocal('salario', p, valorVenda);
        }
      }

      // Se ainda continuar negativo (mesmo após vender ou se recusou), aí sim faliu de verdade
      if(p.money < 0){
        await avisoLocal('faliu', p);
        p.out = true;
        p.money = 0;
        T.forEach((c,i)=>{
          if(G.own[i] === G.cur){
            G.own[i] = -1;
            G.mort[i] = false;
            G.casas[i] = 0;
            G.hotel[i] = false;
          }
        });
      }
    }
    ui();
  }
  else if(tipo === 'free'){ p.free++; addLog(`${p.name} guardou um Habeas Corpus.`); }
  else if(tipo === 'start'){ p.pos = 0; p.money += 200000; totalGanho[p.name] += 200000; addLog(`${p.name} voltou ao Início e recebeu 200k.`); ui(); await avisoLocal('salario', p, 200000); }
  ui();
}

///PAGAR
function pay(p,v,to=null){ p.money-=v; if(to!==null) G.p[to].money+=v; }

// IA decide se vende as propriedades ao banco para continuar no jogo.
// Retorna 0 = "Vender e continuar" | 1 = "Não, sair do jogo"
function iaDecideVender(p, props, valorVenda){
    const saldoAposVenda = p.money + valorVenda;

    // 1) Se mesmo após vender continuar negativo, não adianta vender → sai
    if(saldoAposVenda < 0) return 1;

    // 2) Se vender deixa ela "quase quebrada" (menos de 10% do patrimônio),
    //    a IA prefere sair para não ficar só pagando aluguel
    const patrimonioOriginal = props.reduce((s,i)=> s + T[i].p, 0);
    if(saldoAposVenda < patrimonioOriginal * 0.1) return 1;

    // 3) Caso contrário, vale a pena continuar com o caixa que sobrou
    return 0;
}

///FIM DA RODADA
async function fim(pular){
  if(MODO === 'online') { socket.emit('avancarVez', salaAtual); return; }

  G.busy=true; const p=G.p[G.cur];

  if(p.money < 0){
    // 1) Se tem propriedades, pergunta se quer vender ao banco pelo preço inicial
    const minhasProps = T.map((c,i)=>i).filter(i => G.own[i] === G.cur);

    if(minhasProps.length > 0){
      const valorVenda = minhasProps.reduce((s,i)=> s + T[i].p, 0);

      // IA decide sozinha (não abre modal); humano vê o ask()
      let r;
      if(p.ai){
        r = iaDecideVender(P,minhasProps, valorVenda); // IA sempre aceita vender para continuar
      } else {
        r = await ask('🏚️ Vender propriedades?',
          `Seu saldo está negativo (${R(p.money)}).<br>` +
          `Você tem ${minhasProps.length} propriedade(s) que podem ser vendidas ao banco por <b>${R(valorVenda)}</b> (preço inicial).<br><br>` +
          `Deseja vender tudo ao banco para continuar no jogo?`,
          ['Vender e continuar', 'Não, sair do jogo']);
      }

      if(r === 0){
        minhasProps.forEach(i => {
          p.money += T[i].p;
          totalGanho[p.name] += T[i].p;
          G.own[i] = -1;
          G.mort[i] = false;
          G.casas[i] = 0;
          G.hotel[i] = false;
        });
        addLog(`🏚️ ${p.name} vendeu ${minhasProps.length} propriedade(s) ao banco por ${R(valorVenda)}.`);
        ui();
        await avisoLocal('salario', p, valorVenda);
      }
    }

    // 2) Se mesmo após a venda (ou se recusou) o saldo continuar negativo, aí sim faliu
    if(p.money < 0){
      await avisoLocal('faliu', p);
      p.out = true;
      p.money = 0;
      T.forEach((c,i)=>{
        if(G.own[i] === G.cur){
          G.own[i] = -1;
          G.mort[i] = false;
          G.casas[i] = 0;
          G.hotel[i] = false;
        }
      });
    }
  }

  const vivos=G.p.filter(x=>!x.out);
  if(vivos.length===1){ ui(); await fimDeJogo(vivos[0].name, MODO==='ia' && !vivos[0].ai, resumoLocal()); return; }
  do{ G.cur=(G.cur+1)%G.p.length; }while(G.p[G.cur].out);
  turno();
}

function hipotecas(){
  const me=G.cur;
  const minhas = T.map((c,i)=>i).filter(i=>G.own[i]===me);
  
  if(minhas.length === 0) return ask('Hipotecar', 'Você não tem propriedades.');

  const lista=()=>{ 
    const h = minhas.map(i=>
      `<div class="r" style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span>${T[i].n}</span>
        <button onclick="hip(${i})" style="padding:5px 10px; font-size:12px;">${G.mort[i]?'Resgatar '+R(T[i].p*.55):'Hipotecar +'+R(T[i].p/2)}</button>
      </div>`).join('');
    return `<div style="max-height:200px; overflow-y:auto;">${h}</div>`; 
  };
  
  window.hip=i=>{ 
      if (MODO === 'online') {
        socket.emit('hipotecarPropriedade', { codigo: salaAtual, pos: i, hipotecar: !G.mort[i] });
        setTimeout(() => { $('#mb').innerHTML = lista(); }, 300);
        return;
      }
      if(G.mort[i]){ if(G.p[me].money<T[i].p*.55) return alert('Sem dinheiro para resgatar'); G.p[me].money-=T[i].p*.55; G.mort[i]=false; addLog(`${G.p[me].name} resgatou ${T[i].n}`); }
      else{ G.mort[i]=true; G.p[me].money+=T[i].p/2; addLog(`${G.p[me].name} hipotecou ${T[i].n}`); } 
      
      $('#mb').innerHTML=lista(); 
      ui(); 
  };
  ask('🏦 Hipotecas',lista(),['Fechar']);
}

function construir(){
  const me = G.cur;
  // true se o jogador tem TODAS as propriedades da mesma cor da casa "pos"
  const completo = pos => T.every((c,i) => c.t!=='p' || c.g!==T[pos].g || G.own[i]===me);
  const minhas = T.map((c,i)=>i).filter(i => T[i].t==='p' && G.own[i]===me);
  if(minhas.length === 0) return ask('Construir', 'Você ainda não tem terrenos.');

  const lista = () => {
    let html = '<p style="font-size:13px; margin:0 0 8px;">Só dá para construir com <b>todas</b> as propriedades da mesma cor.</p><div style="max-height:240px; overflow-y:auto;">';
    minhas.forEach(i => {
      const custo = CUSTO_CASA[T[i].g];
      const estado = G.hotel[i] ? '🏨 Hotel' : `${G.casas[i]}/4 casas`;
      let btn;
      if (G.hotel[i]) btn = '<small>Máximo</small>';
      else if (G.mort[i]) btn = '<small>Hipotecada</small>';
      else if (!completo(i)) btn = '<small>Faltam as da mesma cor</small>';
      else btn = `<button onclick="fazerConstrucao(${i})" style="padding:5px 10px; font-size:12px;">${G.casas[i]===4?'Hotel':'Casa'} ${R(custo)}</button>`;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                 <span style="text-align:left;">${T[i].n} (${estado})</span>${btn}</div>`;
    });
    return html + '</div>';
  };

  window.fazerConstrucao = pos => {
    if (G.hotel[pos] || G.mort[pos] || !completo(pos)) return;
    const custo = CUSTO_CASA[T[pos].g];
    if (G.p[me].money < custo) return alert(`Você não tem ${R(custo)}.`);

    if (MODO === 'online') {
      socket.emit('construir', { codigo: salaAtual, pos });
      setTimeout(() => { $('#mb').innerHTML = lista(); }, 300);
      return;
    }
    G.p[me].money -= custo; totalGasto[G.p[me].name] += custo;
    if (G.casas[pos] < 4) G.casas[pos]++; else { G.casas[pos] = 0; G.hotel[pos] = true; }
    addLog(`${G.p[me].name} construiu em ${T[pos].n}`);
    $('#mb').innerHTML = lista(); ui();
  };
  ask('🏠 Construir', lista(), ['Fechar']);
}

function negociar(){ 
  const me = G.cur;
  const outros = G.p.map((p,i)=>i).filter(i=>i!==me && !G.p[i].out);
  
  if(outros.length === 0) return ask('Negociar', 'Não há outros jogadores para negociar.');

  const props = j => T.map((c,i)=>i).filter(i=>G.own[i]===j).map(i=>`<option value="${i}">${T[i].n} (${R(T[i].p)})</option>`).join('');

  let html = `
    <div style="text-align:left;">
      <p><b>Com quem?</b><br>
      <select id="tj" onchange="atualizaNegociacao()">${outros.map(i=>`<option value="${i}">${G.p[i].name}</option>`).join('')}</select></p>
      
      <p><b>Você dá:</b><br>
      <select id="tm"><option value="-1">(Nenhuma propriedade)</option>${props(me)}</select></p>
      
      <p><b>Você recebe:</b><br>
      <select id="tx"><option value="-1">(Nenhuma propriedade)</option>${props(outros[0])}</select></p>
      
      <p><b>Dinheiro que VOCÊ paga (negativo = você recebe):</b><br>
      <input id="td" type="number" value="0" step="10000" style="width:100%;"></p>
    </div>
  `;

  window.atualizaNegociacao = () => {
    const alvo = +$('#tj').value;
    $('#tx').innerHTML = '<option value="-1">(Nenhuma propriedade)</option>' + props(alvo);
  };

  ask('🤝 Negociar', html, ['Propor', 'Cancelar']).then(async (r) => {
    if (r !== 0) return;

    const j = +$('#tj').value;
    const m = +$('#tm').value;
    const x = +$('#tx').value;
    const d = +$('#td').value||0;

    const dou = (m >= 0 ? T[m].p : 0) + Math.max(d, 0);
    const recebo = (x >= 0 ? T[x].p : 0) + Math.max(-d, 0);
    const o = G.p[j];

    if (MODO === 'online') {
      socket.emit('proporNegociacao', { codigo: salaAtual, jogadorAlvoId: o.id, dar: m, receber: x, dinheiro: d });
      return addLog(`🤝 Proposta enviada para ${o.name}.`);
    }

    const ok = o.ai ? dou >= recebo * 1.1 : true; 

    if (!ok) return addLog(`🤝 ${o.name} recusou a proposta.`);
    if (d > G.p[me].money || -d > o.money) return ask('Erro', 'Negociação cancelada: falta dinheiro.');

    if (m >= 0) G.own[m] = j; 
    if (x >= 0) G.own[x] = me; 
    G.p[me].money -= d; 
    o.money += d;

    addLog(`🤝 Negócio fechado entre ${G.p[me].name} e ${o.name}!`);
    ui();
  });
}

socket.on('salaCriada', (c) => { salaAtual = c; $('#setup').hidden = true; $('#lobby').hidden = false; $('#codigoSala').textContent = c; });
socket.on('entrouSala', (c) => { salaAtual = c; $('#setup').hidden = true; $('#lobby').hidden = false; $('#codigoSala').textContent = c; });

let animando = false, pendente = null, jogoAcabou = false;

// quem faliu online escolhe: continuar assistindo ou voltar para a tela inicial
async function perguntarSaida() {
  const r = await ask('💥 Você perdeu tudo', 'Você saiu da partida. O que deseja fazer?', ['Continuar assistindo', 'Sair para o início']);
  if (r === 1) { socket.emit('sairSala', { codigo: salaAtual, pid: PID }); voltarParaInicio(); }
}

function aplicarEstado(s) {
  $('#lobby').hidden = true; $('#jogo').hidden = false;
  G.p = s.jogadores; G.own = s.donos; G.mort = s.mort; G.casas = s.casas; G.hotel = s.hotel; G.cur = s.vezDe; G.busy = false;
  if (document.querySelectorAll('.cell').length === 0) montaTabuleiro();
  ui();
}

socket.on('atualizarJogo', (s) => {
  if (MODO !== 'online') return;
  if (s.estado === 'fim') return;
  if (s.estado === 'jogando') {
    salvarSessao();
    if (animando) { pendente = s; return; } // espera o peão terminar de andar
    aplicarEstado(s);
  } else {
    $('#lobby').hidden = false; $('#setup').hidden = true; $('#jogo').hidden = true;
    let html = '<p style="color:#7fdcff; margin-bottom:10px;">Jogadores conectados:</p>';
    s.jogadores.forEach((j, i) => { html += `<p style="color:${j.cor}; font-weight:bold;">🟢 ${esc(j.name)} ${i === 0 ? '(Dono)' : ''}</p>`; });
    html += `<div style="margin-top:15px; padding:10px; background:#ffffff11; border-radius:8px;"><p style="color:#fff; font-size:14px; margin:0 0 5px 0;">Sua cor:</p><select onchange="mudarCorLobby(this.value)" style="width:100%; padding:8px; border-radius:5px; border:none; font-weight:bold;">`;
    CORES.forEach(c => { const j = s.jogadores.find(x => x.id === socket.id); html += `<option value="${c[1]}" ${(j && j.cor === c[1])?'selected':''}>${c[0]}</option>`; });
    html += `</select></div>`;
    if (s.jogadores[0].id === socket.id && s.jogadores.length >= 2) html += `<button onclick="iniciarJogoOnline()" style="margin-top:15px; width:100%; background:#f2c500; color:#10244d; padding:12px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">▶ Iniciar Partida</button>`;
    $('#listaJogadoresLobby').innerHTML = html;
  }
});

socket.on('resultadoDados', async (d) => {
  if (MODO !== 'online') return;

  if (d.jogador === 'Sistema') { addLog(d.acaoMsg); return; }
  $('#dados').textContent = `${'⚀⚁⚂⚃⚄⚅'[d.a-1]} ${'⚀⚁⚂⚃⚄⚅'[d.b-1]}`;
  addLog(`🎲 ${d.jogador} tirou ${d.a}+${d.b} = ${d.total}`);
  tocar('dados'); // 🔊
  if (d.acaoMsg) addLog(`➡️ ${d.acaoMsg}`);
  if (d.acaoMsg && d.acaoMsg.startsWith('Aluguel')) setTimeout(() => tocar('aluguel'), d.total * 200); // 🔊 toca quando o peão chega

  const jogador = G.p.find(j => j.id === d.jogadorId) || G.p.find(j => j.name === d.jogador);
  animando = true;
  try {
    if (jogador) {
      if (d.posIni !== undefined) jogador.pos = d.posIni;
      ui();
      for (let i = 0; i < d.total; i++) { await sleep(200); jogador.pos = (jogador.pos + 1) % 40; tocar('passo'); ui(); }
      jogador.pos = d.posFinal; ui();
    }
    await mostrarAvisos(d.avisos); // preso, férias, salário, falência (para todos)
  } finally {
    animando = false;
    if (pendente) { const st = pendente; pendente = null; aplicarEstado(st); }
  }

    // eu faliu nesta jogada?
  if (!jogoAcabou && (d.avisos || []).some(a => a.tipo === 'faliu' && a.jogadorId === socket.id)) { await perguntarSaida(); return; }
  if (d.acao === 'comprar') {
    const casa = T[d.posFinal];
    ask(casa.n, `Preço: ${R(casa.p)}<br>Seu saldo: ${R(jogador.money)}`, ['Comprar', 'Não comprar']).then(r => {
      if (r === 0) { tocar('compra'); socket.emit('comprarPropriedade', salaAtual); } // 🔊
      else socket.emit('recusarCompra', salaAtual);
    });
  }
  else if (d.acao === 'preso') {
    ask('🚓 Camburão!', 'Você foi preso.', ['Pagar Fiança (200k)', 'Ficar Preso']).then(r => {
      socket.emit(r === 0 ? 'pagarFianca' : 'avancarVez', salaAtual);
    });
  }
  else if (d.acao === 'carta') {
    const [txt,tipo,v] = CARTAS[Math.random()*CARTAS.length|0];
    tocar('carta'); // 🔊
    ask('🎴 FORTUNA?', txt).then(() => socket.emit('acaoCarta', { codigo: salaAtual, tipo, v }));
  }
});

// avisos que vêm de cartas (preso, salário, falência) e eliminações
socket.on('avisos', async (lista) => {
  if (MODO !== 'online') return;
  while (animando) await sleep(100);
    await mostrarAvisos(lista);
  if (!jogoAcabou && lista.some(a => a.tipo === 'faliu' && a.jogadorId === socket.id)) perguntarSaida();
});

// sobrou só um jogador: fim da partida
socket.on('fimJogo', async (d) => {
  if (MODO !== 'online') return;
  jogoAcabou = true;
  while (animando) await sleep(100);
  await sleep(300);
  await filaAviso;
  await fimDeJogo(d.vencedor, d.vencedorId === socket.id, d.resumo);
});

function mudarCorLobby(c) { socket.emit('mudarCor', { codigo: salaAtual, novaCor: c }); }
function sairDoJogo() {
  if (confirm('Sair?')) {
    if (MODO === 'online' && salaAtual) socket.emit('sairSala', { codigo: salaAtual, pid: PID });
    limparSessao();
    setTimeout(() => location.reload(), 300);
  }
}
function iniciarJogoOnline() { socket.emit('iniciarJogo', salaAtual); }

socket.on('receberProposta', async p => {
  const nome = i => i >= 0 ? T[i].n : 'nenhuma propriedade';
  const din = p.dinheiro >= 0 ? `${esc(p.de)} te paga ${R(p.dinheiro)}` : `Você paga ${R(-p.dinheiro)}`;
  const r = await ask('🤝 Proposta de ' + esc(p.de),
    `${esc(p.de)} te dá: <b>${nome(p.dar)}</b><br>${esc(p.de)} quer: <b>${nome(p.receber)}</b><br>${din}`,
    ['Aceitar', 'Recusar']);
  socket.emit('responderNegociacao', { codigo: p.codigo, aceitou: r === 0, deId: p.deId, dar: p.dar, receber: p.receber, dinheiro: p.dinheiro });
});

// ===== RECONEXÃO =====
// bloqueou a tela / caiu a internet: volta sozinho, sem perguntar
socket.on('connect', () => {
  if (MODO === 'online' && salaAtual) socket.emit('reconectar', { codigo: salaAtual, pid: PID });
});
socket.on('reconectado', cod => { salaAtual = cod; MODO = 'online'; $('#setup').hidden = true; $('#modalOnline').hidden = true; });
socket.on('reconexaoFalhou', () => { limparSessao(); alert('Não foi possível voltar para essa partida (ela acabou ou o servidor reiniciou).'); location.reload(); });
socket.on('erro', m => { alert(m); location.reload(); });

// atualizou a página: pergunta se quer voltar
(async () => {
  let ses = null;
  try { ses = JSON.parse(localStorage.getItem('sessao') || 'null'); } catch (e) {}
  if (!ses || !ses.codigo) return;
  const r = await ask('🔄 Voltar para a partida?', `Você estava na sala <b>${esc(ses.codigo)}</b> como <b>${esc(ses.nome)}</b>.`, ['Voltar', 'Não']);
  if (r === 0) { MODO = 'online'; NOME = ses.nome; salaAtual = ses.codigo; socket.emit('reconectar', { codigo: ses.codigo, pid: PID }); }
  else { socket.emit('sairSala', { codigo: ses.codigo, pid: PID }); limparSessao(); }
})();