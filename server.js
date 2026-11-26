const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

let db = null;
try {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    let serviceAccount;
    if (process.env.FIREBASE_KEY) {
        serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
    } else {
        serviceAccount = require('./serviceAccountKey.json');
    }
    initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore();
    console.log('✅ Firebase conectado com sucesso!');
} catch (error) {
    console.log('⚠️ Firebase não conectado.', error.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(__dirname));

const salas = {};

const T = [
 {n:'INÍCIO',t:'in'}, {n:'Av. Hermes',t:'p',p:100000}, {n:'Cosern',t:'c',p:200000},
 {n:'Maracajaú',t:'p',p:60000}, {n:'FORTUNA',t:'s'}, {n:'Roberto Freire',t:'p',p:220000},
 {n:'CaboTelecom',t:'c',p:150000}, {n:'Princesa Isabel',t:'p',p:220000}, {n:'Salgado Filho',t:'p',p:240000}, {n:'FORTUNA',t:'s'},
 {n:'PRISÃO',t:'pr'}, {n:'Rua Chile',t:'p',p:180000}, {n:'Mina Brejuí',t:'c',p:200000}, {n:'Ganho do Igapó',t:'p',p:180000},
 {n:'Quarto Centenário',t:'p',p:200000}, {n:'FORTUNA',t:'s'}, {n:'Minas de Sal',t:'c',p:150000},
 {n:'Tirol',t:'p',p:350000}, {n:'Receita Federal',t:'rf'}, {n:'Petrópolis',t:'p',p:400000},
 {n:'FÉRIAS',t:'fe'}, {n:'Rio Branco',t:'p',p:120000}, {n:'FORTUNA',t:'s'}, {n:'Deodoro',t:'p',p:100000},
 {n:'Newton Navarro',t:'p',p:140000}, {n:'Moema Tinoco',t:'p',p:200000}, {n:'Parque Eólico',t:'c',p:200000},
 {n:'FORTUNA',t:'s'}, {n:'Prudente de Morais',t:'p',p:160000}, {n:'Praça Cívica',t:'p',p:320000},
 {n:'CAMBURÃO',t:'ca'}, {n:'Relógio',t:'p',p:300000}, {n:'FORTUNA',t:'s'}, {n:'Afonso Pena',t:'p',p:300000},
 {n:'Caern',t:'c',p:200000}, {n:'Ponta Negra',t:'p',p:280000}, {n:'Praia do Meio',t:'p',p:260000},
 {n:'Restituição',t:'re'}, {n:'Redinha',t:'p',p:260000}, {n:'FORTUNA',t:'s'}
];

io.on('connection', (socket) => {
    socket.on('criarSala', (dadosJogador) => {
        const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
        salas[codigoSala] = {
            jogadores: [{ id: socket.id, name: dadosJogador.nome, cor: dadosJogador.cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false }],
            donos: Array(40).fill(-1), mort: Array(40).fill(false), vezDe: 0, estado: 'esperando'
        };
        socket.join(codigoSala);
        socket.emit('salaCriada', codigoSala);
        io.to(codigoSala).emit('atualizarJogo', salas[codigoSala]);
    });

    socket.on('entrarSala', ({ codigo, nome, cor }) => {
        if (!salas[codigo]) return socket.emit('erro', 'Sala não encontrada');
        salas[codigo].jogadores.push({ id: socket.id, name: nome, cor: cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false });
        socket.join(codigo);
        socket.emit('entrouSala', codigo);
        io.to(codigo).emit('atualizarJogo', salas[codigo]);
    });

    socket.on('mudarCor', ({ codigo, novaCor }) => {
        if (salas[codigo]) {
            const jogador = salas[codigo].jogadores.find(j => j.id === socket.id);
            if (jogador) { jogador.cor = novaCor; io.to(codigo).emit('atualizarJogo', salas[codigo]); }
        }
    });

    socket.on('iniciarJogo', (codigo) => {
        if (salas[codigo]) { salas[codigo].estado = 'jogando'; io.to(codigo).emit('atualizarJogo', salas[codigo]); }
    });

    socket.on('rolarDados', async (codigo) => {
        const sala = salas[codigo];
        if (!sala || sala.estado !== 'jogando') return;
        const jogadorAtual = sala.jogadores[sala.vezDe];
        const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6), total = a + b;
        jogadorAtual.pos = (jogadorAtual.pos + total) % 40;
        
        const casa = T[jogadorAtual.pos];
        let acaoNecessaria = null;

        if (casa.t === 'p' || casa.t === 'c') {
            if (sala.donos[jogadorAtual.pos] === -1) acaoNecessaria = 'comprar';
            else if (sala.donos[jogadorAtual.pos] !== sala.vezDe) {
                const valorAluguel = casa.t === 'c' ? 50000 * total : casa.p * 0.1;
                jogadorAtual.money -= valorAluguel; sala.jogadores[sala.donos[jogadorAtual.pos]].money += valorAluguel;
            }
        } else if (casa.t === 'ca') { jogadorAtual.pos = 10; jogadorAtual.jail = 2; }
        else if (casa.t === 'rf') { jogadorAtual.money -= 200000; }
        else if (casa.t === 're') { jogadorAtual.money += 150000; }

        if (db) { try { await db.collection('salas').doc(codigo).set({ jogadores: sala.jogadores, vezDe: sala.vezDe, atualizadoEm: new Date() }, { merge: true }); } catch (e) {} }

        io.to(codigo).emit('resultadoDados', { a, b, total, jogador: jogadorAtual.name, jogadorId: jogadorAtual.id, posFinal: jogadorAtual.pos, acao: acaoNecessaria });

        if (!acaoNecessaria && casa.t !== 'ca') {
            sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
            io.to(codigo).emit('atualizarJogo', sala);
        }
    });

    socket.on('comprarPropriedade', async (codigo) => {
        const sala = salas[codigo]; const jogador = sala.jogadores[sala.vezDe]; const casa = T[jogador.pos];
        if (jogador.money >= casa.p) { jogador.money -= casa.p; sala.donos[jogador.pos] = sala.vezDe; }
        sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('recusarCompra', (codigo) => {
        const sala = salas[codigo];
        sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
        io.to(codigo).emit('atualizarJogo', sala);
    });

    // NOVO: Avançar a vez manualmente no online
    socket.on('avancarVez', (codigo) => {
        const sala = salas[codigo];
        if (sala) {
            sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;
            io.to(codigo).emit('atualizarJogo', sala);
        }
    });

    socket.on('disconnect', () => {
        for (const codigo in salas) {
            const sala = salas[codigo], index = sala.jogadores.findIndex(j => j.id === socket.id);
            if (index !== -1) {
                sala.jogadores.splice(index, 1);
                socket.leave(codigo);
                if (sala.jogadores.length === 0) delete salas[codigo];
                else io.to(codigo).emit('atualizarJogo', sala);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SERVIDOR RODANDO NA PORTA ${PORT}`));