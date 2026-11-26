const socket = io();
let salaAtual = null;

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

const CARTAS = [
 ['Seu filho quebrou o braço. Pague R$ 20.000 ao Banco.','m',-20000], ['Você ganhou na loteria! Receba R$ 80.000.','m',80000],
 ['Você venceu no bolão! Todos os jogadores lhe pagam R$ 50.000.','all',50000], ['Seu carro foi para a oficina. Pague R$ 60.000.','m',-60000],
 ['IPTU atrasado! Pague R$ 100.000.','m',-100000], ['Vendeu artesanato em Genipabu! Receba R$ 40.000.','m',40000],
 ['Habeas Corpus! Guarde esta carta para sair da prisão.','free'], ['Festa de aniversário: pague R$ 20.000 a cada jogador.','each',20000],
 ['Fiscalização! Vá direto para a prisão.','jail'], ['Avance até o Início e receba seu salário.','start']
];

let AC; let MODO = 'ia', NOME = '';
let G = {p:[], own:[], mort:[], cur:0, roll:0, rolled:false, busy:false, duplas:0};

function modo(m){
  NOME = $('#nome').value.trim() || 'Jogador';
  if(m === 'online'){
    MODO = 'online'; $('#s1').hidden = true; $('#modalOnline').hidden = false; mostrarOpcoes(); return; 
  }
  MODO=m; $('#s1').hidden=true; $('#s2').hidden=false;
  $('#qtd').innerHTML=[2,3,4,5,6,7,8].map(n=>`<option>${n}</option>`).join('');
  montaLinhas();
}

function fecharModalOnline() { $('#modalOnline').hidden = true; $('#s1').hidden = false; MODO = 'ia'; }
function mostrarOpcoes() { $('#telaOpcoesOnline').hidden = false; $('#telaEntrarSala').hidden = true; }
function mostrarEntrarSala() { $('#telaOpcoesOnline').hidden = true; $('#telaEntrarSala').hidden = false; $('#inputCodigoSala').value = ''; $('#inputCodigoSala').focus(); }

function mostrarCriarSala() {
  $('#modalOnline').hidden = true;
  socket.emit('criarSala', { nome: NOME, cor: '#e53935' });
}

function confirmarEntrarSala() {
  const codigo = $('#inputCodigoSala').value.trim().toUpperCase();
  if (codigo.length < 4) return alert('O código deve ter 4 letras.');
  $('#modalOnline').hidden = true;
  socket.emit('entrarSala', { codigo: codigo, nome: NOME, cor: '#1e88e5' });
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
  G.p = lin.map((l,i)=>({name:l.querySelector('input').value||'J'+(i+1), cor:cores[i], money:2560000, pos:0, jail:0, free:0, ferias:0, ai:(MODO==='ia'&&i>0), out:false}));
  G.own=Array(40).fill(-1); G.mort=Array(40).fill(false); G.cur=0; G.duplas=0;
  $('#setup').hidden=true; $('#jogo').hidden=false; montaTabuleiro(); turno();
}

function montaTabuleiro(){
  $('#board').innerHTML = ''; 
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
    d.innerHTML=(c.g?`<i class="band" style="background:${COR[c.g]}"></i>`:'')+`<b>${c.n}</b>`+(c.p?`<small>${R(c.p)}</small>`:'')+`<em class="own"></em><div class="pw"></div>`;
    $('#board').append(d);
  });
}

const patrimonio = (p,idx) => p.money + T.reduce((s,c,i)=>s+(G.own[i]===idx?(G.mort[i]?c.p/2:c.p):0),0);
function ui(){
  document.querySelectorAll('.pw').forEach(e=>e.innerHTML='');
  G.p.forEach(p=>{ if(!p.out) $('#c'+p.pos+' .pw').innerHTML+=`<span class="pawn" style="background:${p.cor}"></span>`; });
  T.forEach((c,i)=>{ const e=$('#c'+i); if(!e) return; e.classList.toggle('hip',!!G.mort[i]);
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
    const souEu = G.p.length > 0 && G.p[G.cur].id === socket.id;
    h = souEu && !G.busy;
  } else {
    h = !G.p[G.cur].ai && !G.busy;
  }

  $('#bRoll').disabled = !(h && (!G.rolled || G.duplas>0));
  $('#bEnd').disabled = !(h && G.rolled && G.duplas===0);
  $('#bMort').disabled = !h; $('#bTrade').disabled = !h;
}

const log = t => { const p=G.p.find(x=>t.startsWith(x.name)); $('#log').insertAdjacentHTML('afterbegin',`<div class="lg" style="border-color:${p?p.cor:'#00e5ff'}">${t}</div>`); };

function ask(t,b,opts=['OK']){
  return new Promise(res=>{
    $('#mt').innerHTML=t; $('#mb').innerHTML=b; const bx=$('#mbtn'); bx.innerHTML='';
    opts.forEach((o,i)=>{ const e=document.createElement('button'); e.textContent=o; e.onclick=()=>{ $('#modal').hidden=true; res(i); }; bx.append(e); });
    $('#modal').hidden=false;
  });
}

// Lógica para IA e Mesma Máquina
async function turno(){
  const p=G.p[G.cur]; G.rolled=false; G.busy=true; G.duplas=0;
  ui();
  if(p.ferias){ p.ferias--; log(`${p.name} está de férias.`); return fim(true); }
  if(p.jail){
    if(p.free>0 && (p.ai || (await ask('Você está preso','Usar Habeas Corpus?',['Usar','Não']))===0)){ p.free--; p.jail=0; log(`${p.name} saiu da prisão.`); }
    else if(p.jail===2){ p.jail=1; return fim(true); }
    else { pay(p,50000); p.jail=0; }
  }
  G.busy=false; ui();
  if(p.ai){ await sleep(800); await rolar(); await sleep(700); fim(); }
}

async function rolar(){
  if(MODO === 'online') { socket.emit('rolarDados', salaAtual); return; }
  
  G.busy=true; G.rolled=true; ui();
  let a,b; for(let i=0;i<8;i++){ a=1+Math.random()*6|0; b=1+Math.random()*6|0; $('#dados').textContent=`${'⚀⚁⚂⚃⚄⚅'[a-1]} ${'⚀⚁⚂⚃⚄⚅'[b-1]}`; await sleep(90); }
  G.roll=a+b; const p=G.p[G.cur]; log(`${p.name} tirou ${a}+${b} = ${G.roll}`);
  for(let i=0;i<G.roll;i++){ p.pos=(p.pos+1)%40; if(p.pos===0){ p.money+=200000; } ui(); await sleep(160); }
  await land(p); G.busy=false; ui();
}

async function land(p){
  const i=p.pos, c=T[i], me=G.cur;
  if(c.t==='p'||c.t==='c'){
    const o=G.own[i];
    if(o<0){
      if(p.money<c.p) return;
      const compra = p.ai ? p.money-c.p>300000 : (await ask(c.n,`Preço: ${R(c.p)}`,['Comprar','Não']))===0;
      if(compra){ p.money-=c.p; G.own[i]=me; }
    } else if(o!==me && !G.mort[i]){
      const v = c.t==='c' ? 50000*G.roll : aluguel(i,o); pay(p,v,o);
    }
  } else if(c.t==='rf'){ pay(p,200000);
  } else if(c.t==='re'){ p.money+=150000;
  } else if(c.t==='ca'){ p.pos=10; p.jail=2;
  } else if(c.t==='s'){ await carta(p); }
}

async function carta(p){
  const [txt,tipo,v]=CARTAS[Math.random()*CARTAS.length|0];
  await ask('🎴 FORTUNA POTIGUAR',txt);
  if(tipo === 'm'){ p.money += v; } else if(tipo === 'all'){ G.p.filter(x => x!==p && !x.out).forEach(o => { o.money -= v; p.money += v; }); }
  else if(tipo === 'each'){ G.p.filter(x => x!==p && !x.out).forEach(o => { o.money += v; p.money -= v; }); }
  else if(tipo === 'jail'){ p.pos=10; p.jail=2; }
}

function pay(p,v,to=null){ p.money-=v; if(to!==null) G.p[to].money+=v; }
const aluguel=(i,o)=>{ const c=T[i]; return c.p*.1*(T.every((x,j)=>x.g!==c.g||G.own[j]===o)?2:1); };

async function fim(pular){
  if(MODO === 'online') { socket.emit('avancarVez', salaAtual); return; }

  G.busy=true; const p=G.p[G.cur];
  if(p.money<0){ p.out=true; p.money=0; T.forEach((c,i)=>{ if(G.own[i]===G.cur){G.own[i]=-1;G.mort[i]=false;} }); }
  const vivos=G.p.filter(x=>!x.out);
  if(vivos.length===1){ ui(); await ask('🏆 FIM DE JOGO',`${vivos[0].name} venceu!`); return location.reload(); }
  do{ G.cur=(G.cur+1)%G.p.length; }while(G.p[G.cur].out);
  turno();
}

// ==========================================
// LÓGICA DE COMUNICAÇÃO COM O SERVIDOR
// ==========================================

socket.on('salaCriada', (codigo) => { salaAtual = codigo; $('#setup').hidden = true; $('#lobby').hidden = false; $('#codigoSala').textContent = codigo; });
socket.on('entrouSala', (codigo) => { salaAtual = codigo; $('#setup').hidden = true; $('#lobby').hidden = false; $('#codigoSala').textContent = codigo; });

socket.on('atualizarJogo', (estadoServidor) => {
  if (MODO !== 'online') return;

  if (estadoServidor.estado === 'jogando') {
    $('#lobby').hidden = true; $('#jogo').hidden = false;
    
    G.p = estadoServidor.jogadores; G.own = estadoServidor.donos; G.mort = estadoServidor.mort; G.cur = estadoServidor.vezDe;
    
    if (document.querySelectorAll('.cell').length === 0) montaTabuleiro();
    ui(); 
  } else {
    $('#lobby').hidden = false; $('#setup').hidden = true; $('#jogo').hidden = true;
    let html = '<p style="color:#7fdcff; margin-bottom:10px;">Jogadores conectados:</p>';
    estadoServidor.jogadores.forEach((j, index) => {
      html += `<p style="color:${j.cor}; font-weight:bold;">🟢 ${j.name} ${index === 0 ? '(Dono)' : ''}</p>`;
    });
    
    html += `<div style="margin-top:15px; padding:10px; background:#ffffff11; border-radius:8px;">
             <p style="color:#fff; font-size:14px; margin:0 0 5px 0;">Sua cor:</p>
             <select onchange="mudarCorLobby(this.value)" style="width:100%; padding:8px; border-radius:5px; border:none; font-weight:bold;">`;
    CORES.forEach(c => {
        const jogador = estadoServidor.jogadores.find(j => j.id === socket.id);
        const selected = (jogador && jogador.cor === c[1]) ? 'selected' : '';
        html += `<option value="${c[1]}" ${selected}>${c[0]}</option>`;
    });
    html += `</select></div>`;

    if (estadoServidor.jogadores[0].id === socket.id && estadoServidor.jogadores.length >= 2) {
      html += `<button onclick="iniciarJogoOnline()" style="margin-top:15px; width:100%; background:#f2c500; color:#10244d; padding:12px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">▶ Iniciar Partida</button>`;
    }
    $('#listaJogadoresLobby').innerHTML = html;
  }
});

socket.on('resultadoDados', (dados) => {
  if (MODO !== 'online') return;
  $('#dados').textContent = `${'⚀⚁⚂⚃⚄⚅'[dados.a-1]} ${'⚀⚁⚂⚃⚄⚅'[dados.b-1]}`;
  log(`🎲 ${dados.jogador} tirou ${dados.a}+${dados.b} = ${dados.total}`);
  
  const jogador = G.p.find(j => j.name === dados.jogador);
  if(jogador) {
      let posAtual = jogador.pos; let posAntiga = (posAtual - dados.total + 40) % 40;
      jogador.pos = posAntiga; ui(); 

      let passos = 0;
      const animar = setInterval(() => {
          jogador.pos = (jogador.pos + 1) % 40; ui(); passos++;
          if(passos >= dados.total) {
              clearInterval(animar); jogador.pos = posAtual; ui();
              if (dados.acao === 'comprar' && dados.jogadorId === socket.id) {
                  const casa = T[dados.posFinal];
                  ask(casa.n, `Preço: ${R(casa.p)}`, ['Comprar', 'Não']).then(resposta => {
                      if (resposta === 0) socket.emit('comprarPropriedade', salaAtual);
                      else socket.emit('recusarCompra', salaAtual);
                  });
              }
          }
      }, 200);
  }
});

function mudarCorLobby(novaCor) { socket.emit('mudarCor', { codigo: salaAtual, novaCor }); }
function sairDoJogo() { if (confirm('Tem certeza que deseja sair?')) { if (MODO === 'online' && salaAtual) socket.emit('sairSala', salaAtual); location.reload(); } }
function iniciarJogoOnline() { socket.emit('iniciarJogo', salaAtual); }