const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

let db = null;
try {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    let serviceAccount = process.env.FIREBASE_KEY ? JSON.parse(process.env.FIREBASE_KEY) : require('./serviceAccountKey.json');
    initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore();
    console.log('✅ Firebase conectado!');
} catch (error) { console.log('⚠️ Sem Firebase.'); }

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(__dirname));

const salas = {};
const CUSTO_CASA = {rosa:120000, azul:50000, vermelho:75000, amarelo:150000,
                    laranja:80000, vclaro:100000, vescuro:100000, roxo:115000};

// sem casa = 10% do preço; cada casa dobra; hotel = 5 casas (x32)
const aluguelProp = (c, casas, hotel) => c.p * 0.1 * Math.pow(2, hotel ? 5 : casas);
const temGrupo = (sala, idx, pos) => T.every((c,i) => c.t!=='p' || c.g!==T[pos].g || sala.donos[i]===idx);

// registro de ganhos e perdas (aparece no ranking)
const ganhar = (j, v) => { j.money += v; j.ganho = (j.ganho || 0) + v; };
const perder = (j, v) => { j.money -= v; j.gasto = (j.gasto || 0) + v; };

// mensagem no histórico de todos
const msg = (cod, texto) => io.to(cod).emit('resultadoDados', { a: 0, b: 0, total: 0, jogador: 'Sistema', acaoMsg: texto });
// guarda a identidade (pid) sem enviá-la aos outros jogadores
const comPid = (j, pid) => Object.defineProperty(j, 'pid', { value: pid });

const T = [
 {n:'INÍCIO',t:'in'}, {n:'Av. Hermes',t:'p',p:100000,g:'vclaro'}, {n:'Cosern',t:'c',p:200000},
 {n:'Maracajaú',t:'p',p:60000,g:'vescuro'}, {n:'FORTUNA?',t:'s'}, {n:'Roberto Freire',t:'p',p:220000,g:'vermelho'},
 {n:'CaboTelecom',t:'c',p:150000}, {n:'Princesa Isabel',t:'p',p:220000,g:'vermelho'}, {n:'Salgado Filho',t:'p',p:240000,g:'vermelho'}, {n:'FORTUNA?',t:'s'},
 {n:'PRISÃO',t:'pr'}, {n:'Rua Chile',t:'p',p:180000,g:'azul'}, {n:'Mina Brejuí',t:'c',p:200000}, {n:'Ganho do Igapó',t:'p',p:180000,g:'azul'},
 {n:'Quarto Centenário',t:'p',p:200000,g:'azul'}, {n:'FORTUNA?',t:'s'}, {n:'Minas de Sal',t:'c',p:150000},
 {n:'Tirol',t:'p',p:350000,g:'rosa'}, {n:'Receita Federal',t:'rf',p:-200000}, {n:'Petrópolis',t:'p',p:400000,g:'rosa'},
 {n:'FÉRIAS',t:'fe'}, {n:'Rio Branco',t:'p',p:120000,g:'roxo'}, {n:'FORTUNA?',t:'s'}, {n:'Deodoro',t:'p',p:100000,g:'roxo'},
 {n:'Newton Navarro',t:'p',p:140000,g:'vescuro'}, {n:'Moema Tinoco',t:'p',p:200000,g:'vescuro'}, {n:'Parque Eólico',t:'c',p:200000},
 {n:'FORTUNA?',t:'s'}, {n:'Prudente de Morais',t:'p',p:160000,g:'vclaro'}, {n:'Praça Cívica',t:'p',p:320000,g:'laranja'},
 {n:'CAMBURÃO',t:'ca'}, {n:'Relógio',t:'p',p:300000,g:'laranja'}, {n:'FORTUNA?',t:'s'}, {n:'Afonso Pena',t:'p',p:300000,g:'laranja'},
 {n:'Caern',t:'c',p:200000}, {n:'Ponta Negra',t:'p',p:280000,g:'amarelo'}, {n:'Praia do Meio',t:'p',p:260000,g:'amarelo'},
 {n:'Restituição',t:'re',p:150000}, {n:'Redinha',t:'p',p:260000,g:'amarelo'}, {n:'FORTUNA?',t:'s'}
];


// passa a vez para o próximo jogador que ainda está na partida
// (quem está de férias ou preso perde a vez, como no modo offline)
function proxVez(sala, cod) {
    const n = sala.jogadores.length;
    for (let k = 0; k < n * 5; k++) {
        sala.vezDe = (sala.vezDe + 1) % n;
        const j = sala.jogadores[sala.vezDe];
        if (j.out) continue;
        if (j.ferias > 0) {
            j.ferias--;
            msg(cod, `🏖️ ${j.name} está de férias e perde a vez.`);
            continue;
        }
        if (j.jail > 0) {
            if (j.free > 0) { // usa o Habeas Corpus
                j.free--; j.jail = 0;
                msg(cod, `🔑 ${j.name} usou o Habeas Corpus e saiu da prisão.`);
                return;
            }
            if (j.jail === 2) { // 1ª rodada preso: perde a vez
                j.jail = 1;
                msg(cod, `🔒 ${j.name} está preso e perde a vez.`);
                continue;
            }
            // 2ª rodada: paga R$ 50.000 e sai, jogando normalmente
            perder(j, Math.min(50000, Math.max(0, j.money)));
            j.jail = 0;
            msg(cod, `🔓 ${j.name} pagou R$ 50.000 e saiu da prisão.`);
            return;
        }
        return;
    }
}

function liberarBens(sala, idx) {
    sala.donos.forEach((d, i) => { if (d === idx) { sala.donos[i] = -1; sala.mort[i] = false; sala.casas[i] = 0; sala.hotel[i] = false; } });
}

const patrimonioDe = (sala, idx) => sala.jogadores[idx].money +
    T.reduce((s, c, i) => s + (sala.donos[i] === idx && (c.t === 'p' || c.t === 'c') ? (sala.mort[i] ? c.p / 2 : c.p) : 0), 0);

const resumoSala = sala => sala.jogadores.map((j, i) => ({
    name: j.name, cor: j.cor, patrimonio: patrimonioDe(sala, i), ganho: j.ganho || 0, gasto: j.gasto || 0, out: !!j.out
}));

// quem ficou com saldo negativo perde tudo e sai da partida
function varrerFalencias(sala, cod, avisos) {
    sala.jogadores.forEach((j, i) => {
        if (j.out || j.money >= 0) return;

        // Se tem propriedades, vende tudo ao banco pelo preço inicial antes de falir
        const props = T.map((c, k) => k).filter(k => sala.donos[k] === i);
        if (props.length > 0) {
            let valorVenda = 0;
            props.forEach(k => {
                valorVenda += T[k].p;
                sala.donos[k] = -1;
                sala.mort[k] = false;
                sala.casas[k] = 0;
                sala.hotel[k] = false;
            });
            ganhar(j, valorVenda);
            msg(cod, `🏚️ ${j.name} vendeu ${props.length} propriedade(s) ao banco por R$ ${valorVenda.toLocaleString('pt-BR')} para continuar.`);
        }

        // Se mesmo assim continuar negativo, aí sim faliu
        if (j.money < 0) {
            j.out = true; j.money = 0;
            liberarBens(sala, i);
            avisos.push({ tipo: 'faliu', jogadorId: j.id, nome: j.name });
            msg(cod, `${j.name} faliu e saiu da partida.`);
        }
    });
}

// se sobrou só um jogador, ele ganha
function checarVitoria(cod) {
    const sala = salas[cod];
    if (!sala || sala.estado !== 'jogando' || sala.jogadores.length < 2) return false;
    const vivos = sala.jogadores.filter(x => !x.out);
    if (vivos.length !== 1) return false;
    sala.estado = 'fim';
    io.to(cod).emit('fimJogo', { vencedor: vivos[0].name, vencedorId: vivos[0].id, resumo: resumoSala(sala) });
    setTimeout(() => { delete salas[cod]; }, 300000);
    return true;
}

io.on('connection', (socket) => {
    socket.on('criarSala', (dados) => {
        const cod = Math.random().toString(36).substring(2, 6).toUpperCase();
        salas[cod] = {
            jogadores: [comPid({ id: socket.id, name: dados.nome, cor: dados.cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false, casas: 0, hotel: false }, dados.pid)],
            donos: Array(40).fill(-1), casas: Array(40).fill(0), hotel: Array(40).fill(false), mort: Array(40).fill(false), vezDe: 0, estado: 'esperando'
        };
        socket.join(cod);
        socket.emit('salaCriada', cod);
        io.to(cod).emit('atualizarJogo', salas[cod]);
    });

    socket.on('entrarSala', ({ codigo, nome, cor, pid }) => {
        if (!salas[codigo]) return socket.emit('erro', 'Sala não encontrada');
        if (salas[codigo].estado !== 'esperando') return socket.emit('erro', 'A partida já começou');
        salas[codigo].jogadores.push(comPid({ id: socket.id, name: nome, cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false }, pid));
        socket.join(codigo);
        socket.emit('entrouSala', codigo);
        io.to(codigo).emit('atualizarJogo', salas[codigo]);
    });

    socket.on('mudarCor', ({ codigo, novaCor }) => {
        if (salas[codigo]) {
            const j = salas[codigo].jogadores.find(x => x.id === socket.id);
            if (j) { j.cor = novaCor; io.to(codigo).emit('atualizarJogo', salas[codigo]); }
        }
    });

    socket.on('iniciarJogo', (codigo) => {
        if (salas[codigo]) { salas[codigo].estado = 'jogando'; io.to(codigo).emit('atualizarJogo', salas[codigo]); }
    });

    socket.on('rolarDados', async (codigo) => {
        const sala = salas[codigo];
        if (!sala || sala.estado !== 'jogando') return;
        const j = sala.jogadores[sala.vezDe];
        const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6), total = a + b;
        const posIni = j.pos;
        j.pos = (posIni + total) % 40;

        const avisos = [];
        if (j.pos < posIni) { // passou pelo Início
            ganhar(j, 200000);
            avisos.push({ tipo: 'salario', jogadorId: j.id, nome: j.name, valor: 200000 });
        }

        const casa = T[j.pos];
        let acao = null;
        let acaoMsg = '';

        if (casa.t === 'p' || casa.t === 'c') {
            const dono = sala.donos[j.pos];
            if (dono === -1) {
                acao = 'comprar';
            } else if (dono !== sala.vezDe && !sala.mort[j.pos]) {
                let aluguelBase = casa.t === 'c' ? 80000 * total : aluguelProp(casa, sala.casas[j.pos], sala.hotel[j.pos]);
                perder(j, aluguelBase);
                ganhar(sala.jogadores[dono], aluguelBase);
                acaoMsg = `Aluguel de R$ ${aluguelBase.toLocaleString('pt-BR')} pago a ${sala.jogadores[dono].name}`;
            }
        } else if (casa.t === 'ca') {
            j.pos = 10; j.jail = 2;
            acao = 'preso';
            acaoMsg = 'Caiu no Camburão e foi para a Prisão!';
            avisos.push({ tipo: 'preso', jogadorId: j.id, nome: j.name });
        } else if (casa.t === 'rf') {
            perder(j, 200000);
            acaoMsg = 'Pagou R$ 200.000 à Receita Federal';
        } else if (casa.t === 're') {
            ganhar(j, 150000);
            acaoMsg = 'Recebeu R$ 150.000 de Restituição';
        } else if (casa.t === 'fe') {
            j.ferias = 2;
            acaoMsg = 'Tirou férias!';
            avisos.push({ tipo: 'ferias', jogadorId: j.id, nome: j.name });
        } else if (casa.t === 's') {
            acao = 'carta';
        }

        varrerFalencias(sala, codigo, avisos);

        if (db) { try { await db.collection('salas').doc(codigo).set({ jogadores: sala.jogadores, vezDe: sala.vezDe, atualizadoEm: new Date() }, { merge: true }); } catch (e) {} }

        io.to(codigo).emit('resultadoDados', {
            a, b, total,
            jogador: j.name,
            jogadorId: j.id,
            posIni,
            posFinal: j.pos,
            acao,
            acaoMsg,
            avisos
        });

        if (!acao && casa.t !== 'ca') {
            proxVez(sala);
            io.to(codigo).emit('atualizarJogo', sala);
        }
        checarVitoria(codigo);
    });

    socket.on('comprarPropriedade', async (codigo) => {
        const sala = salas[codigo];
        const j = sala.jogadores[sala.vezDe];
        const casa = T[j.pos];

        if (j.money >= casa.p) {
            perder(j, casa.p);
            sala.donos[j.pos] = sala.vezDe;
        }
        proxVez(sala);
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('recusarCompra', (codigo) => {
        const sala = salas[codigo];
        proxVez(sala);
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('acaoCarta', ({ codigo, tipo, v }) => {
        const sala = salas[codigo]; if (!sala) return;
        v = Number(v) || 0;
        const j = sala.jogadores[sala.vezDe];
        const outros = sala.jogadores.filter(x => x !== j && !x.out);
        const avisos = [];
        if (tipo === 'm') { if (v >= 0) ganhar(j, v); else perder(j, -v); }
        else if (tipo === 'all') outros.forEach(o => { perder(o, v); ganhar(j, v); });
        else if (tipo === 'each') outros.forEach(o => { ganhar(o, v); perder(j, v); });
        else if (tipo === 'jail') {
            j.pos = 10; j.jail = 2;
            avisos.push({ tipo: 'preso', jogadorId: j.id, nome: j.name });
        }
        else if (tipo === 'free') j.free++;
        else if (tipo === 'start') {
            j.pos = 0; ganhar(j, 200000);
            avisos.push({ tipo: 'salario', jogadorId: j.id, nome: j.name, valor: 200000 });
        }
        else if (tipo === 'bankrupt') { // perde metade do saldo atual
    const perdido = Math.max(0, Math.floor(j.money / 2));
    perder(j, perdido);
    avisos.push({ tipo: 'falencia', jogadorId: j.id, nome: j.name, valor: perdido });

    // Se ficou negativo, vende propriedades ao banco (preço inicial) antes de falir
    if (j.money < 0) {
        const props = T.map((c, k) => k).filter(k => sala.donos[k] === sala.vezDe);
        if (props.length > 0) {
            let valorVenda = 0;
            props.forEach(k => {
                valorVenda += T[k].p;
                sala.donos[k] = -1;
                sala.mort[k] = false;
                sala.casas[k] = 0;
                sala.hotel[k] = false;
            });
            ganhar(j, valorVenda);
            msg(codigo, `🏚️ ${j.name} vendeu ${props.length} propriedade(s) ao banco por R$ ${valorVenda.toLocaleString('pt-BR')} para continuar.`);
        }
    }
}
        varrerFalencias(sala, codigo, avisos);
        proxVez(sala);
        io.to(codigo).emit('atualizarJogo', sala);
        if (avisos.length) io.to(codigo).emit('avisos', avisos);
        checarVitoria(codigo);
    });

    socket.on('construir', ({ codigo, pos }) => {
        const sala = salas[codigo]; if (!sala) return;
        const dono = sala.donos[pos], jog = sala.jogadores[dono];
        if (dono < 0 || !jog || jog.id !== socket.id || T[pos].t !== 'p' || sala.mort[pos] || sala.hotel[pos] || !temGrupo(sala, dono, pos)) return;
        const custo = CUSTO_CASA[T[pos].g];
        if (jog.money < custo) return;
        perder(jog, custo);
        if (sala.casas[pos] < 4) sala.casas[pos]++; else { sala.casas[pos] = 0; sala.hotel[pos] = true; }
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('hipotecarPropriedade', ({ codigo, pos, hipotecar }) => {
        const sala = salas[codigo];
        if (!sala) return;

        const jogadorIndex = sala.donos[pos];
        if (jogadorIndex === -1) return;

        const jogador = sala.jogadores[jogadorIndex];

        if (hipotecar) {
            jogador.money += T[pos].p / 2;
            sala.mort[pos] = true;
        } else {
            const custoResgate = T[pos].p * 0.55;
            if (jogador.money >= custoResgate) {
                jogador.money -= custoResgate;
                sala.mort[pos] = false;
            }
        }

        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('pagarFianca', async (codigo) => {
        const sala = salas[codigo];
        if (sala) {
            const j = sala.jogadores[sala.vezDe];
            if (j.money >= 200000) { j.money -= 200000; j.jail = 0; j.pos = 10; }
            proxVez(sala);
            io.to(codigo).emit('atualizarJogo', sala);
        }
    });

    socket.on('avancarVez', (codigo) => {
        const sala = salas[codigo];
        if (sala) { proxVez(sala); io.to(codigo).emit('atualizarJogo', sala); }
    });

    socket.on('proporNegociacao', ({ codigo, jogadorAlvoId, dar, receber, dinheiro }) => {
        const sala = salas[codigo];
        if (!sala) return;
        const jogadorAtual = sala.jogadores[sala.vezDe];
        io.to(jogadorAlvoId).emit('receberProposta', { de: jogadorAtual.name, deId: socket.id, dar, receber, dinheiro, codigo });
    });

    socket.on('responderNegociacao', ({ codigo, aceitou, deId, dar, receber, dinheiro }) => {
        const sala = salas[codigo];
        if (!sala) return;
        const alvo = sala.jogadores.find(j => j.id === socket.id);
        const proponente = sala.jogadores.find(j => j.id === deId);

        if (!alvo || !proponente) return;

        if (aceitou) {
            const iProp = sala.jogadores.findIndex(j => j.id === deId);
            const iAlvo = sala.jogadores.findIndex(j => j.id === socket.id);
            if (dar >= 0) sala.donos[dar] = iAlvo;         // o que o proponente DÁ vai para o alvo
            if (receber >= 0) sala.donos[receber] = iProp; // o que ele RECEBE vai para o proponente

            proponente.money -= dinheiro;
            alvo.money += dinheiro;

            io.to(codigo).emit('atualizarJogo', sala);
            msg(codigo, `Negócio fechado entre ${proponente.name} e ${alvo.name}!`);
        } else {
            msg(codigo, `${alvo.name} recusou a proposta de ${proponente.name}.`);
        }
    });

    socket.on('reconectar', ({ codigo, pid }) => {
        const sala = salas[codigo];
        const j = sala && sala.estado === 'jogando' && sala.jogadores.find(x => x.pid === pid);
        if (!j || j.out) return socket.emit('reconexaoFalhou');
        const estavaOff = j.offline;
        j.id = socket.id; j.offline = false; delete j.offlineDesde;
        socket.join(codigo);
        socket.emit('reconectado', codigo);
        if (estavaOff) msg(codigo, `${j.name} voltou para a partida.`);
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('sairSala', ({ codigo, pid } = {}) => {
        const sala = salas[codigo]; if (!sala) return;
        const idx = sala.jogadores.findIndex(j => j.pid === pid);
        if (idx === -1) return;
        if (sala.estado === 'esperando') {
            sala.jogadores.splice(idx, 1);
            if (sala.jogadores.length === 0) delete salas[codigo]; else io.to(codigo).emit('atualizarJogo', sala);
            return;
        }
        if (sala.estado !== 'jogando') return;
        const j = sala.jogadores[idx];
        if (j.out) return;
        j.out = true; j.offline = true; j.offlineDesde = Date.now();
        liberarBens(sala, idx);
        msg(codigo, `${j.name} saiu da partida.`);
        if (sala.vezDe === idx) proxVez(sala);
        io.to(codigo).emit('atualizarJogo', sala);
        checarVitoria(codigo);
    });

    socket.on('disconnect', () => {
        for (const cod in salas) {
            const sala = salas[cod], idx = sala.jogadores.findIndex(j => j.id === socket.id);
            if (idx === -1) continue;
            if (sala.estado === 'jogando') {
                const j = sala.jogadores[idx];
                if (j.out) break;
                j.offline = true; j.offlineDesde = Date.now();
                msg(cod, `${j.name} saiu (conexão perdida). Pode voltar a qualquer momento.`);
                io.to(cod).emit('atualizarJogo', sala);
            } else if (sala.estado === 'esperando') {
                sala.jogadores.splice(idx, 1);
                if (sala.jogadores.length === 0) delete salas[cod]; else io.to(cod).emit('atualizarJogo', sala);
            }
            break;
        }
    });
});

// pula a vez de quem está offline há mais de 20s (ou saiu); apaga salas vazias após 10 min
setInterval(() => {
    const agora = Date.now();
    for (const cod in salas) {
        const sala = salas[cod];
        if (sala.estado !== 'jogando') continue;
        if (sala.jogadores.every(j => j.out || (j.offline && agora - j.offlineDesde > 600000))) { delete salas[cod]; continue; }
        const j = sala.jogadores[sala.vezDe];
        if (j && (j.out || (j.offline && agora - j.offlineDesde > 20000))) {
            if (!j.out) msg(cod, `Vez de ${j.name} pulada (offline).`);
            proxVez(sala);
            io.to(cod).emit('atualizarJogo', sala);
        }
    }
}, 2000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`RODANDO NA PORTA ${PORT}`));