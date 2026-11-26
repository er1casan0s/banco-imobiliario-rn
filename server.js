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

io.on('connection', (socket) => {
    socket.on('criarSala', (dados) => {
        const cod = Math.random().toString(36).substring(2, 6).toUpperCase();
        salas[cod] = {
            jogadores: [{ id: socket.id, name: dados.nome, cor: dados.cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false, casas: 0, hotel: false }],
            donos: Array(40).fill(-1), casas: Array(40).fill(0), hotel: Array(40).fill(false), mort: Array(40).fill(false), vezDe: 0, estado: 'esperando'
        };
        socket.join(cod);
        socket.emit('salaCriada', cod);
        io.to(cod).emit('atualizarJogo', salas[cod]);
    });

    socket.on('entrarSala', ({ codigo, nome, cor }) => {
        if (!salas[codigo]) return socket.emit('erro', 'Sala não encontrada');
        salas[codigo].jogadores.push({ id: socket.id, name: nome, cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false });
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
        const posAnt = j.pos;
        j.pos = (posAnt + total) % 40;
        if (j.pos < posAnt) j.money += 200000; // passou pelo Início
        
        const casa = T[j.pos];
        let acao = null;
        let acaoMsg = '';

        if (casa.t === 'p' || casa.t === 'c') {
            const dono = sala.donos[j.pos];
            if (dono === -1) {
                acao = 'comprar';
            } else if (dono !== sala.vezDe && !sala.mort[j.pos]) {
                let aluguelBase = casa.t === 'c' ? 50000 * total : aluguelProp(casa, sala.casas[j.pos], sala.hotel[j.pos]);
                j.money -= aluguelBase;
                sala.jogadores[dono].money += aluguelBase;
                acaoMsg = `Aluguel de R$ ${aluguelBase.toLocaleString('pt-BR')} pago a ${sala.jogadores[dono].name}`;
            }
        } else if (casa.t === 'ca') {
            j.pos = 10; j.jail = 2;
            acao = 'preso';
            acaoMsg = 'Caiu no Camburão e foi para a Prisão!';
        } else if (casa.t === 'rf') {
            j.money -= 200000;
            acaoMsg = 'Pagou R$ 200.000 à Receita Federal';
        } else if (casa.t === 're') {
            j.money += 150000;
            acaoMsg = 'Recebeu R$ 150.000 de Restituição';
        } else if (casa.t === 'fe') {
            j.ferias = 2;
            acaoMsg = 'Tirou férias!';
        } else if (casa.t === 's') {
            acao = 'carta';
        }

        if (db) { try { await db.collection('salas').doc(codigo).set({ jogadores: sala.jogadores, vezDe: sala.vezDe, atualizadoEm: new Date() }, { merge: true }); } catch (e) {} }

        io.to(codigo).emit('resultadoDados', { 
            a, b, total, 
            jogador: j.name, 
            jogadorId: j.id,
            posFinal: j.pos, 
            acao, 
            acaoMsg 
        });

        if (!acao && casa.t !== 'ca') {
            sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
            io.to(codigo).emit('atualizarJogo', sala);
        }
    });

    socket.on('comprarPropriedade', async (codigo) => {
        const sala = salas[codigo]; 
        const j = sala.jogadores[sala.vezDe]; 
        const casa = T[j.pos];
        
        if (j.money >= casa.p) { 
            j.money -= casa.p; 
            sala.donos[j.pos] = sala.vezDe; 
        }
        sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('recusarCompra', (codigo) => {
        const sala = salas[codigo];
        sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('acaoCarta', ({ codigo, tipo, v }) => {
        const sala = salas[codigo]; if (!sala) return;
        const j = sala.jogadores[sala.vezDe];
        const outros = sala.jogadores.filter(x => x !== j && !x.out);
        if (tipo === 'm') j.money += v;
        else if (tipo === 'all') outros.forEach(o => { o.money -= v; j.money += v; });
        else if (tipo === 'each') outros.forEach(o => { o.money += v; j.money -= v; });
        else if (tipo === 'jail') { j.pos = 10; j.jail = 2; }
        else if (tipo === 'free') j.free++;
        else if (tipo === 'start') { j.pos = 0; j.money += 200000; }
        else if (tipo === 'bankrupt') j.money = 0;
        sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('construir', ({ codigo, pos }) => {
        const sala = salas[codigo]; if (!sala) return;
        const dono = sala.donos[pos], jog = sala.jogadores[dono];
        if (dono < 0 || !jog || jog.id !== socket.id || T[pos].t !== 'p' || sala.mort[pos] || sala.hotel[pos] || !temGrupo(sala, dono, pos)) return;
        const custo = CUSTO_CASA[T[pos].g];
        if (jog.money < custo) return;
        jog.money -= custo;
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
            sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
            io.to(codigo).emit('atualizarJogo', sala);
        }
    });

    socket.on('avancarVez', (codigo) => {
        const sala = salas[codigo];
        if (sala) { sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length; io.to(codigo).emit('atualizarJogo', sala); }
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
            io.to(codigo).emit('resultadoDados', { a: 0, b: 0, total: 0, jogador: 'Sistema', acaoMsg: `Negócio fechado entre ${proponente.name} e ${alvo.name}!` });
        } else {
            io.to(codigo).emit('resultadoDados', { a: 0, b: 0, total: 0, jogador: 'Sistema', acaoMsg: `${alvo.name} recusou a proposta de ${proponente.name}.` });
        }
    });

    socket.on('disconnect', () => {
        for (const cod in salas) {
            const sala = salas[cod], idx = sala.jogadores.findIndex(j => j.id === socket.id);
            if (idx !== -1) { sala.jogadores.splice(idx, 1); socket.leave(cod); if (sala.jogadores.length === 0) delete salas[cod]; else io.to(cod).emit('atualizarJogo', sala); break; }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`RODANDO NA PORTA ${PORT}`));