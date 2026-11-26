/* =====================================================
   BANCO IMOBILIÁRIO DO RN - lógica do jogo
   ===================================================== */

const socket = io(); // CONECTA AO SERVIDOR
let salaAtual = null; // GUARDA O CÓDIGO DA SALA
let MINHA_COR = '#e53935'; // Cor padrão

const $ = s => document.querySelector(s);
const R = n => 'R$ ' + n.toLocaleString('pt-BR');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const COR = {rosa:'#d6409f',roxo:'#7b3fa0',laranja:'#f28c1e',amarelo:'#f2c500',vermelho:'#d62d2d',
  vclaro:'#7ccc5a',vescuro:'#2e8b3d',azul:'#3ba0d8',preto:'#222'};
const CORES = [['Vermelho','#e53935'],['Roxo','#8e24aa'],['Rosa','#ec407a'],['Amarelo','#fdd835'],
  ['Azul','#1e88e5'],['Verde','#43a047'],['Laranja','#fb8c00'],['Marrom','#6d4c41']];

const P = (n,p,g) => ({n,p,g,t:'p'});
const C = (n,p)   => ({n,p,g:'preto',t:'c'});
const S = {n:'FORTUNA',t:'s'};
const T = [
 {n:'INÍCIO',t:'in',img:'inicio'}, P('Av. Hermes da Fonseca',100000,'vclaro'), C('Cosern',200000),
 P('Parrachos de Maracajaú',60000,'vescuro'), S, P('Av. Roberto Freire',220000,'vermelho'),
 C('CaboTelecom',150000), P('Rua Princesa Isabel',220000,'vermelho'), P('Av. Salgado Filho',240000,'vermelho'), S,
 {n:'PRISÃO',t:'pr',img:'prisao'},
 P('Rua Chile',180000,'azul'), C('Mina Brejuí',200000), P('Ganho do Igapó',180000,'azul'),
 P('Viaduto do Quarto Centenário',200000,'azul'), S, C('Minas de Sal de Macau',150000),
 P('Tirol',350000,'rosa'), {n:'Receita Federal -R$ 200.000',t:'rf'}, P('Petrópolis',400000,'rosa'),
 {n:'FÉRIAS',t:'fe',img:'feriado'},
 P('Av. Rio Branco',120000,'roxo'), S, P('Av. Deodoro da Fonseca',100000,'roxo'),
 P('Ponte Newton Navarro',140000,'vescuro'), P('Av. Moema Tinoco',200000,'vescuro'),
 C('Parque Eólico de Rio do Fogo',200000), S, P('Av. Prudente de Morais',160000,'vclaro'),
 P('Praça Cívica',320000,'laranja'),
 {n:'CAMBURÃO',t:'ca',img:'camburao'},
 P('Praça do Relógio (Alecrim)',300000,'laranja'), S, P('Av. Afonso Pena',300000,'laranja'),
 C('Caern',200000), P('Praia de Ponta Negra',280000,'amarelo'), P('Praia do Meio',260000,'amarelo'),
 {n:'Restituição de Renda +R$ 150.000',t:'re'}, P('Praia da Redinha',260000,'amarelo'), S
];

const XY = i => i<=10 ? [10,10-i] : i<20 ? [20-i,0] : i<=30 ? [0,i-20] : [i-30,10];

// ========== CARTAS EXPANDIDAS (SORTE E AZAR) ==========
const CARTAS = [
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
 ['Foi no Beco da Lama e perdeu a carteira : perdeu 50.000','m',50000],
 ['Recebeu herança de parentes dos outros jogadores','all',25000],
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

let AC;
let MODO = 'ia', NOME = '';
let G = {p:[], own:[], mort:[], cur:0, roll:0, rolled:false, busy:false, duplas:0};

function beep(f,d,tipo='square',v=.07,atraso=0){
  if(!AC) return;
  const o=AC.createOscillator(), g=AC.createGain(); o.type=tipo; o.frequency.value=f; g.gain.value=v;
  o.connect(g); g.connect(AC.destination); const s=AC.currentTime+atraso;
  o.start(s); g.gain.exponentialRampToValueAtTime(.001,s+d); o.stop(s+d);
}
const somDado  = () => { for(let i=0;i<9;i++) beep(120+Math.random()*250,.05,'square',.06,i*.07); };
const somCarta = () => { beep(700,.1,'triangle',.1); beep(1100,.18,'triangle',.1,.09); };

function modo(m){
  NOME = $('#nome').value.trim() || 'Jogador';
  
  if(m === 'online'){
    MODO = 'online';
    $('#s1').hidden = true;
    $('#modalOnline').hidden = false;
    mostrarOpcoes();

    // --- Avisa o servidor quando a cor for trocada no seletor ---
    $('#corOnline').onchange = () => {
      if (salaAtual) {
        socket.emit('mudarCor', { codigo: salaAtual, novaCor: $('#corOnline').value });
      }
    };
    return; 
  }
  
  MODO=m; $('#s1').hidden=true; $('#s2').hidden=false;
  $('#qtd').innerHTML=[2,3,4,5,6,7,8].map(n=>`<option>${n}</option>`).join('');
  montaLinhas();
}

// ========== FUNÇÕES DO MODAL ONLINE ==========
function fecharModalOnline() {
  $('#modalOnline').hidden = true;
  $('#s1').hidden = false; // Volta para a tela inicial
  MODO = 'ia'; // Reseta o modo
}

function mostrarOpcoes() {
  $('#telaOpcoesOnline').hidden = false;
  $('#telaEntrarSala').hidden = true;
}

function mostrarCriarSala() {
  MINHA_COR = $('#corOnline').value;
  $('#modalOnline').hidden = true;
  socket.emit('criarSala', { nome: NOME, cor: MINHA_COR }); // Envia o nome e a cor juntos
}

function mostrarEntrarSala() {
  $('#telaOpcoesOnline').hidden = true;
  $('#telaEntrarSala').hidden = false;
  $('#inputCodigoSala').value = '';
  $('#inputCodigoSala').focus();
}

function confirmarEntrarSala() {
  const codigo = $('#inputCodigoSala').value.trim().toUpperCase();
  if (codigo.length < 4) {
    return alert('O código deve ter 4 letras.');
  }
  
  const corEscolhida = $('#corOnline').value; // Pega a cor certa
  $('#modalOnline').hidden = true;
  
  socket.emit('entrarSala', { 
      codigo: codigo, 
      nome: NOME, 
      cor: corEscolhida 
  });
}

function montaLinhas(){
  const n=+$('#qtd').value; let h='';
  for(let i=0;i<n;i++){
    const ia = MODO==='ia' && i>0;
    const nome = MODO==='ia' ? (i===0?NOME:'Potiguar'+(83+i).toString().padStart(3,'0')) : (i===0?NOME:'Jogador '+(i+1));
    h+=`<div class="lin"><input value="${nome}" ${ia?'disabled':''}>
    <select>${CORES.map((c,j)=>`<option value="${c[1]}" ${j===i?'selected':''}>${c[0]}</option>`).join('')}</select></div>`;
  }
  $('#linhas').innerHTML=h;
}

function iniciar(){
  AC = AC || new (window.AudioContext||window.webkitAudioContext)();
  const lin=[...document.querySelectorAll('.lin')];
  const cores=lin.map(l=>l.querySelector('select').value);
  if(new Set(cores).size<cores.length) return alert('Cada jogador precisa de uma cor diferente!');
  G.p = lin.map((l,i)=>({name:l.querySelector('input').value||'J'+(i+1), cor:cores[i],
        money:2560000, pos:0, jail:0, free:0, ferias:0, ai:(MODO==='ia'&&i>0), out:false}));
  G.own=Array(40).fill(-1); G.mort=Array(40).fill(false); G.cur=0;
  G.duplas=0;
  $('#setup').hidden=true; $('#jogo').hidden=false; montaTabuleiro(); turno();
}

function montaTabuleiro(){
  $('#board').innerHTML = ''; // Limpa o tabuleiro antes de desenhar (evita duplicar)
  
  // Recria a área central (que foi apagada pelo innerHTML = '')
  const centro = document.createElement('div');
  centro.className = 'centro';
  centro.innerHTML = `
      <h2>BANCO IMOBILIÁRIO<br>DO RN</h2>
      <div id="dados">🎲 🎲</div>
      <div id="botoes">
        <button id="bRoll" onclick="rolar()">Rolar dados</button>
        <button id="bMort" onclick="hipotecas()">Hipotecar</button>
        <button id="bTrade" onclick="negociar()">Negociar</button>
        <button id="bEnd" onclick="fim()">Encerrar vez</button>
      </div>
  `;
  $('#board').appendChild(centro);

  T.forEach((c,i)=>{
    const d=document.createElement('div'); d.className='cell'+(c.img?' img':'')+(c.t==='s'?' s':'');
    d.id='c'+i; const [r,k]=XY(i); d.style.gridRow=r+1; d.style.gridColumn=k+1;
    if(c.img) d.style.backgroundImage=`url(img/${c.img}.png)`;
    d.innerHTML=(c.g?`<i class="band" style="background:${COR[c.g]}"></i>`:'')+`<b>${c.n}</b>`+
      (c.p?`<small>${R(c.p)}</small>`:'')+`<em class="own"></em><div class="pw"></div>`;
    $('#board').append(d);
  });
}

const patrimonio = (p,idx) => p.money + T.reduce((s,c,i)=>s+(G.own[i]===idx?(G.mort[i]?c.p/2:c.p):0),0);
function ui(){
  document.querySelectorAll('.pw').forEach(e=>e.innerHTML='');
  G.p.forEach(p=>{ if(!p.out) $('#c'+p.pos+' .pw').innerHTML+=`<span class="pawn" style="background:${p.cor}"></span>`; });
  T.forEach((c,i)=>{ const e=$('#c'+i); e.classList.toggle('hip',!!G.mort[i]);
    const d=G.own[i]>=0?G.p[G.own[i]]:null, o=e.querySelector('.own');
    o.style.background=d?d.cor:'none'; o.textContent=d?'● '+d.name.slice(0,10):'';
    e.style.boxShadow=d?`inset 0 0 0 .5cqw ${d.cor}`:'none'; });
  $('#rank').innerHTML=G.p.map((p,i)=>({p,i,v:patrimonio(p,i)})).sort((a,b)=>b.v-a.v)
    .map((o,k)=>`<div class="rk ${o.i===G.cur?'vez':''} ${o.p.out?'out':''}">
      <span class="pos">${['🥇','🥈','🥉'][k]||k+1}</span><i class="dot" style="background:${o.p.cor}"></i>
      <div class="inf"><b>${o.p.name}${o.p.free?' 🔑':''}${o.p.jail?' 🔒':''}${o.p.ferias?' 🏖️':''}${o.i===G.cur?' ◄':''}</b><small>💰 ${R(o.p.money)}</small></div>
      <div class="tot">${R(o.v)}</div></div>`).join('');
      
  let h;
  if (MODO === 'online') {
    const souEu = G.p[G.cur].id === socket.id;
    h = souEu && !G.busy;
  } else {
    h = !G.p[G.cur].ai && !G.busy;
  }

  $('#bRoll').disabled = !(h && (!G.rolled || G.duplas>0));
  $('#bEnd').disabled = !(h && G.rolled && G.duplas===0);
  $('#bMort').disabled = !h; 
  $('#bTrade').disabled = !h;
}

const log = t => {
  const p=G.p.find(x=>t.startsWith(x.name));
  $('#log').insertAdjacentHTML('afterbegin',`<div class="lg" style="border-color:${p?p.cor:'#00e5ff'}">${t}</div>`); };

function ask(t,b,opts=['OK']){
  return new Promise(res=>{
    $('#mt').innerHTML=t; $('#mb').innerHTML=b; const bx=$('#mbtn'); bx.innerHTML='';
    opts.forEach((o,i)=>{ const e=document.createElement('button'); e.textContent=o;
      e.onclick=()=>{ $('#modal').hidden=true; res(i); }; bx.append(e); });
    $('#modal').hidden=false;
  });
}

async function turno(){
  const p=G.p[G.cur]; G.rolled=false; G.busy=true;
  G.duplas=0;
  ui();
  if(p.ferias){
    p.ferias--;
    log(`${p.name} está de férias e passa a rodada.`);
    if(!p.ai) await ask('🏖️ FÉRIAS','Você está de férias e passa esta rodada.');
    return fim(true);
  }
  if(p.jail){
    if(p.free>0 && (p.ai || (await ask('Você está preso','Usar sua carta de Habeas Corpus?',['Usar','Não']))===0)){
      p.free--; p.jail=0; log(`${p.name} usou a carta e saiu da prisão.`);
    } else if(p.jail===2){ p.jail=1; log(`${p.name} passa a rodada preso.`); return fim(true); }
    else { pay(p,50000); p.jail=0; log(`${p.name} pagou fiança de ${R(50000)} e saiu.`); }
  }
  G.busy=false; ui();
  if(p.ai){ await sleep(800); await rolar(); await sleep(700); fim(); }
}

async function rolar(){
  if(MODO === 'online') {
    // Se for online, avisa o servidor e espera a resposta
    socket.emit('rolarDados', salaAtual);
    return; 
  }
  
  // Se for local/IA, mantém a lógica antiga
  G.busy=true; G.rolled=true; ui(); somDado();
  let a,b; for(let i=0;i<8;i++){ a=1+Math.random()*6|0; b=1+Math.random()*6|0;
    $('#dados').textContent=`${'⚀⚁⚂⚃⚄⚅'[a-1]} ${'⚀⚁⚂⚃⚄⚅'[b-1]}`; await sleep(90); }
  G.roll=a+b; const p=G.p[G.cur]; log(`${p.name} tirou ${a}+${b} = ${G.roll}`);
  for(let i=0;i<G.roll;i++){
    p.pos=(p.pos+1)%40;
    if(p.pos===0){ p.money+=200000; log(`${p.name} passou pelo Início: +${R(200000)}`); }
    ui(); await sleep(160);
  }
  if(a===b){
    G.duplas++;
    if(G.duplas>=3){
      pay(p,10000);
      log(`🎲 ${p.name} tirou a 3ª dupla seguida e perdeu ${R(10000)}!`);
      if(!p.ai) await ask('🎲 Três duplas!','Você tirou dados iguais 3 vezes seguidas e perdeu R$ 10.000!');
      G.duplas=0;
    } else {
      log(`🎲 ${p.name} tirou dupla! Joga novamente.`);
      if(!p.ai) await ask('🎲 Dupla!','Você tirou dados iguais e vai jogar novamente!');
    }
  } else {
    G.duplas=0;
  }
  await land(p); G.busy=false; ui();
}

function pay(p,v,to=null){ p.money-=v; if(to!==null) G.p[to].money+=v; }
const aluguel=(i,o)=>{ const c=T[i];
  return c.p*.1*(T.every((x,j)=>x.g!==c.g||G.own[j]===o)?2:1); };

async function land(p){
  const i=p.pos, c=T[i], me=G.cur;
  if(c.t==='p'||c.t==='c'){
    const o=G.own[i];
    if(o<0){
      if(p.money<c.p) return log(`${p.name} não tem dinheiro para ${c.n}.`);
      const compra = p.ai ? p.money-c.p>300000
        : (await ask(c.n,`Preço: ${R(c.p)}<br>Seu saldo: ${R(p.money)}`,['Comprar','Não comprar']))===0;
      if(compra){ p.money-=c.p; G.own[i]=me; log(`${p.name} comprou ${c.n}.`); }
    } else if(o!==me && !G.mort[i]){
      const v = c.t==='c' ? 50000*G.roll : aluguel(i,o);
      pay(p,v,o); log(`${p.name} pagou ${R(v)} a ${G.p[o].name} (${c.n}).`);
      const dono = G.p[o];
      if(dono.ferias) log(`🏖️ ${dono.name} está de férias, mas recebeu o aluguel.`);
      if(!p.ai) await ask('Aluguel',`Você pagou ${R(v)} a ${G.p[o].name}.${dono.ferias?'<br>(Ele está de férias, mas recebeu!)':''}`);
    }
  } else if(c.t==='rf'){ pay(p,200000); log(`${p.name} pagou ${R(200000)} à Receita Federal.`);
    if(!p.ai) await ask('Receita Federal','Você perdeu R$ 200.000.');
  } else if(c.t==='re'){ p.money+=150000; log(`${p.name} recebeu restituição: +${R(150000)}.`);
    if(!p.ai) await ask('Restituição de Renda','Você ganhou R$ 150.000!');
  } else if(c.t==='ca'){ await preso(p);
  } else if(c.t==='s'){ await carta(p); }
  else if(c.t==='fe'){ await ferias(p); }
}

async function ferias(p){
  log(`${p.name} tirou férias! Vai descansar por 1 rodada. 🏖️`);
  if(!p.ai) await ask('🏖️ FÉRIAS!','Você tirou férias!<br>Vai passar a próxima rodada descansando.<br>Mas continue recebendo aluguéis normalmente!');
  p.ferias = 2;
}

async function preso(p){
  beep(600,.15,'sawtooth',.08); beep(900,.15,'sawtooth',.08,.18);
  log(`${p.name} foi levado de volta para a Prisão 🚓`);
  if(!p.ai) await ask('🚓 Camburão!','Você foi levado de volta para a Prisão.');
  
  p.pos=10; ui();
  
  // Pergunta se quer pagar a fiança
  const paga = p.money>=200000 && (p.ai ? p.money>800000
    : (await ask('Camburão! 🚓','Pagar fiança de R$ 200.000 para sair agora e continuar jogando?<br>(Se não, fica 1 rodada sem jogar)',['Pagar fiança e jogar','Ficar preso']))===0);
  
  if(paga){ 
    pay(p,200000); 
    log(`${p.name} pagou fiança de ${R(200000)} e vai jogar! 🎲`); 
    
    // --- AQUI ESTÁ A MÁGICA ---
    // Libera o jogador para rolar os dados novamente nesta mesma rodada
    p.jail = 0; 
    G.rolled = false; 
    G.busy = false;
    ui(); // Atualiza os botões da tela para liberar o "Rolar Dados"
    // ---------------------------
    
  } else { 
    p.jail=2; 
    log(`${p.name} foi preso e vai perder a vez!`); 
  }
}

async function carta(p){
  const [txt,tipo,v]=CARTAS[Math.random()*CARTAS.length|0]; somCarta();
  await ask('🎴 FORTUNA POTIGUAR',txt);
  const outros = G.p.filter(x => x!==p && !x.out);
  
  if(tipo === 'm'){ p.money += v; log(`${p.name}: ${txt}`);
  } else if(tipo === 'all'){ outros.forEach(o => { o.money -= v; p.money += v; }); log(`${p.name}: ${txt} (todos pagaram ${R(v)})`);
  } else if(tipo === 'each'){ outros.forEach(o => { o.money += v; p.money -= v; }); log(`${p.name}: ${txt} (pagou ${R(v)} a cada um)`);
  } else if(tipo === 'free'){ p.free++; log(`${p.name}: ${txt} (agora tem ${p.free} carta(s) de soltura)`);
  } else if(tipo === 'jail'){ log(`${p.name}: ${txt}`); await preso(p);
  } else if(tipo === 'start'){ p.pos = 0; p.money += 200000; ui(); log(`${p.name}: ${txt} (+${R(200000)} de salário)`);
    if(!p.ai) await ask('🏁 INÍCIO','Você avançou ao Início e recebeu R$ 200.000 de salário!');
  }
  ui();
}

async function fim(pular){
  G.busy=true; const p=G.p[G.cur];
  if(!pular && G.duplas>0){
    G.rolled=false; G.busy=false; ui();
    log(`${p.name} vai rolar novamente (dupla).`);
    if(p.ai){ await sleep(700); await rolar(); await sleep(700); fim(); }
    return;
  }
  while(p.money<0){
    const i=T.map((c,i)=>i).filter(i=>G.own[i]===G.cur&&!G.mort[i]).sort((a,b)=>T[b].p-T[a].p)[0];
    if(i===undefined) break; G.mort[i]=true; p.money+=T[i].p/2; log(`${p.name} hipotecou ${T[i].n}.`);
  }
  if(p.money<0){
    p.out=true; p.money=0; T.forEach((c,i)=>{ if(G.own[i]===G.cur){G.own[i]=-1;G.mort[i]=false;} });
    log(`💥 ${p.name} faliu e saiu do jogo!`); await ask('Falência',`${p.name} faliu e saiu do jogo.`);
  }
  const vivos=G.p.filter(x=>!x.out);
  if(vivos.length===1){ ui(); await ask('🏆 FIM DE JOGO',`${vivos[0].name} venceu!`); return location.reload(); }
  G.duplas=0;
  do{ G.cur=(G.cur+1)%G.p.length; }while(G.p[G.cur].out);
  turno();
}

function hipotecas(){
  const me=G.p[G.cur];
  const lista=()=>{ const h=T.map((c,i)=>i).filter(i=>G.own[i]===G.cur).map(i=>
    `<div class="r"><span>${T[i].n}</span><button onclick="hip(${i})">${G.mort[i]?'Resgatar '+R(T[i].p*.55):'Hipotecar +'+R(T[i].p/2)}</button></div>`).join('');
    return `Saldo: ${R(me.money)}<br>${h||'Você não tem propriedades.'}`; };
  window.hip=i=>{ if(G.mort[i]){ if(me.money<T[i].p*.55) return; me.money-=T[i].p*.55; G.mort[i]=false; }
    else{ G.mort[i]=true; me.money+=T[i].p/2; } $('#mb').innerHTML=lista(); ui(); };
  ask('Hipotecas',lista(),['Fechar']);
}

function negociar(){
  const me=G.cur, outros=G.p.map((p,i)=>i).filter(i=>i!==me&&!G.p[i].out);
  const props=j=>T.map((c,i)=>i).filter(i=>G.own[i]===j).map(i=>`<option value="${i}">${T[i].n}</option>`).join('');
  window.atualiza=()=>{ $('#tx').innerHTML='<option value="-1">(nenhum)</option>'+props(+$('#tj').value); };
  ask('Negociar',`Com quem?<select id="tj" onchange="atualiza()">${outros.map(i=>`<option value="${i}">${G.p[i].name}</option>`).join('')}</select>
    Você dá:<select id="tm"><option value="-1">(nenhum)</option>${props(me)}</select>
    Você recebe:<select id="tx"></select>
    Dinheiro que VOCÊ paga (negativo = você recebe):<input id="td" type="number" value="0" step="10000">`,
    ['Propor','Cancelar']).then(async r=>{
    if(r!==0) return; const j=+$('#tj').value, m=+$('#tm').value, x=+$('#tx').value, d=+$('#td').value||0;
    const dou=(m>=0?T[m].p:0)+Math.max(d,0), recebo=(x>=0?T[x].p:0)+Math.max(-d,0), o=G.p[j];
    const ok = o.ai ? dou>=recebo*1.1 : (await ask('Proposta de '+G.p[me].name,
      `${G.p[me].name} oferece: ${m>=0?T[m].n:'nada'} ${d>0?'+ '+R(d):''}<br>Quer: ${x>=0?T[x].n:'nada'} ${d<0?'+ '+R(-d):''}`,['Aceitar','Recusar']))===0;
    if(!ok) return log(`${o.name} recusou a proposta.`);
    if(d>G.p[me].money || -d>o.money) return log('Negociação cancelada: falta dinheiro.');
    if(m>=0) G.own[m]=j; if(x>=0) G.own[x]=me; G.p[me].money-=d; o.money+=d;
    log(`🤝 Negócio fechado entre ${G.p[me].name} e ${o.name}!`); ui();
  });
  atualiza();
}

// ==========================================
// LÓGICA DE COMUNICAÇÃO COM O SERVIDOR (ONLINE)
// ==========================================

socket.on('salaCriada', (codigo) => {
  salaAtual = codigo;
  $('#setup').hidden = true;
  $('#lobby').hidden = false;
  $('#codigoSala').textContent = codigo;
  $('#listaJogadoresLobby').innerHTML = `<p style="color:#43a047;">🟢 ${NOME} (Você - Dono da Sala)</p>`;
});

// --- AQUI ESTÁ O EVENTO QUE ESTAVA FALTANDO ---
socket.on('entrouSala', (codigo) => {
  salaAtual = codigo; // Guarda o código da sala atual
  $('#setup').hidden = true;
  $('#lobby').hidden = false;
  $('#codigoSala').textContent = codigo; // Mostra o código na tela
});

socket.on('atualizarJogo', (estadoServidor) => {
  if (MODO !== 'online') return;

  if (estadoServidor.estado === 'jogando') {
    $('#lobby').hidden = true;
    $('#jogo').hidden = false;
    
    G.p = estadoServidor.jogadores;
    G.own = estadoServidor.donos;
    G.mort = estadoServidor.mort;
    G.cur = estadoServidor.vezDe;
    
    if (document.querySelectorAll('.cell').length === 0) {
        montaTabuleiro(); 
    }
    ui(); 
  } else {
    // TELA DE LOBBY (ESPERA)
    $('#lobby').hidden = false;
    $('#setup').hidden = true;
    $('#jogo').hidden = true;
    
    // Atualiza o código da sala na tela
    $('#codigoSala').textContent = salaAtual || 'XXXX';

    let html = '<p style="color:#7fdcff; margin-bottom:10px;">Jogadores conectados:</p>';
    
    // Pega o nome correto de cada jogador da lista
    estadoServidor.jogadores.forEach((j, index) => {
      html += `<p style="color:#43a047; font-weight:bold;">🟢 ${j.name} ${index === 0 ? '(Dono da Sala)' : ''}</p>`;
    });
    
    // Botão de iniciar para o dono da sala
    if (estadoServidor.jogadores[0].id === socket.id && estadoServidor.jogadores.length >= 2) {
      html += `<button onclick="iniciarJogoOnline()" style="margin-top:15px; width:100%; background:#f2c500; color:#10244d;">▶ Iniciar Partida</button>`;
    }

    $('#listaJogadoresLobby').innerHTML = html;
  }
});

socket.on('erro', (mensagem) => {
  alert('Erro: ' + mensagem);
  $('#lobby').hidden = true;
  $('#setup').hidden = false;
  $('#s1').hidden = false;
});

socket.on('resultadoDados', (dados) => {
  if (MODO !== 'online') return;
  
  somDado();
  $('#dados').textContent = `${'⚀⚁⚂⚃⚄⚅'[dados.a-1]} ${'⚀⚁⚂⚃⚄⚅'[dados.b-1]}`;
  log(`🎲 ${dados.jogador} tirou ${dados.a}+${dados.b} = ${dados.total}`);
  
  const jogador = G.p.find(j => j.name === dados.jogador);
  if(jogador) {
      let posAtual = jogador.pos; 
      let posAntiga = (posAtual - dados.total + 40) % 40;
      
      jogador.pos = posAntiga;
      ui(); 

      let passos = 0;
      const animar = setInterval(() => {
          jogador.pos = (jogador.pos + 1) % 40;
          ui();
          passos++;
          if(passos >= dados.total) {
              clearInterval(animar);
              jogador.pos = posAtual; 
              ui();
              
              // Se o jogador da vez caiu no camburão
              if (dados.caiuNoCamburao && dados.jogadorId === socket.id) {
                  // Pergunta para o jogador
                  ask('🚓 Camburão!', 'Pagar fiança de R$ 200.000 para sair agora?<br>(Se não, fica 1 rodada preso)', ['Pagar fiança', 'Ficar preso'])
                  .then(escolha => {
                      if (escolha === 0 && jogador.money >= 200000) {
                          socket.emit('pagarFianca', salaAtual); // Avisa o servidor
                      } else {
                          socket.emit('pagarFianca', salaAtual); // Avisa o servidor mesmo se recusar (para passar a vez)
                      }
                  });
              }
          }
      }, 200);
  }
});

socket.on('atualizarCores', (jogadores) => {
  // Só faz isso se estivermos na tela de escolha de sala
  if ($('#modalOnline').hidden) return;

  const coresEmUso = jogadores.map(j => j.cor);

  const select = $('#corOnline');
  for (let i = 0; i < select.options.length; i++) {
    const opt = select.options[i];
    if (coresEmUso.includes(opt.value) && opt.selected === false) {
      opt.disabled = true; 
      if (!opt.text.includes('(em uso)')) opt.text += " (em uso)";
    } else if (!coresEmUso.includes(opt.value)) {
      opt.disabled = false; 
      opt.text = opt.text.replace(" (em uso)", "");
    }
  }
  
  if (select.options[select.selectedIndex].disabled) {
      for (let i = 0; i < select.options.length; i++) {
          if (!select.options[i].disabled) {
              select.selectedIndex = i;
              break;
          }
      }
  }
});

function sairDoJogo() {
  if (confirm('Tem certeza que deseja sair? Você perderá o progresso da partida.')) {
    if (MODO === 'online' && salaAtual) {
      socket.emit('sairSala', salaAtual);
    }
    location.reload();
  }
}

function iniciarJogoOnline() {
  socket.emit('iniciarJogo', salaAtual);
}