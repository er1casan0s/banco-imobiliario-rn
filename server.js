const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

let db = null;
try {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    const serviceAccount = require('./serviceAccountKey.json');
    initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore();
    console.log('✅ Firebase conectado com sucesso!');
} catch (error) {
    console.log('⚠️ Firebase não conectado (jogo vai rodar sem salvar).');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(__dirname));

const salas = {};

io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);

    socket.on('criarSala', (dadosJogador) => {
        const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
        salas[codigoSala] = {
            jogadores: [
                { id: socket.id, name: dadosJogador.nome, cor: dadosJogador.cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false }
            ],
            donos: Array(40).fill(-1),
            mort: Array(40).fill(false),
            vezDe: 0,
            estado: 'esperando'
        };
        socket.join(codigoSala);
        socket.emit('salaCriada', codigoSala);
        io.to(codigoSala).emit('atualizarCores', salas[codigoSala].jogadores);
    });

    socket.on('entrarSala', ({ codigo, nome, cor }) => {
        if (!salas[codigo]) return socket.emit('erro', 'Sala não encontrada');
        if (salas[codigo].jogadores.length >= 8) return socket.emit('erro', 'Sala cheia');
        
        salas[codigo].jogadores.push({ 
            id: socket.id, name: nome, cor: cor, pos: 0, money: 2560000, jail: 0, free: 0, ferias: 0, out: false 
        });
        
        socket.join(codigo);
        socket.emit('entrouSala', codigo);
        io.to(codigo).emit('atualizarJogo', salas[codigo]);
        io.to(codigo).emit('atualizarCores', salas[codigo].jogadores);
    });

    // Novidade: Avisa a todos quando a cor for alterada no seletor
    socket.on('mudarCor', ({ codigo, novaCor }) => {
        if (salas[codigo]) {
            const jogador = salas[codigo].jogadores.find(j => j.id === socket.id);
            if (jogador) {
                jogador.cor = novaCor;
                io.to(codigo).emit('atualizarCores', salas[codigo].jogadores);
            }
        }
    });

    socket.on('iniciarJogo', (codigo) => {
        if (salas[codigo]) {
            salas[codigo].estado = 'jogando';
            io.to(codigo).emit('atualizarJogo', salas[codigo]);
        }
    });

    socket.on('rolarDados', async (codigo) => {
        const sala = salas[codigo];
        if (!sala || sala.estado !== 'jogando') return;
        const jogadorAtual = sala.jogadores[sala.vezDe];
        const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6), total = a + b;
        
        jogadorAtual.pos = (jogadorAtual.pos + total) % 40;
        sala.vezDe = (sala.vezDe + 1) % sala.jogadores.length;

        if (db) {
            try { await db.collection('salas').doc(codigo).set({ jogadores: sala.jogadores, vezDe: sala.vezDe, atualizadoEm: new Date() }, { merge: true }); } catch (e) {}
        }

        io.to(codigo).emit('resultadoDados', { a, b, total, jogador: jogadorAtual.name, posFinal: jogadorAtual.pos });
        io.to(codigo).emit('atualizarJogo', sala);
    });

    socket.on('sairSala', (codigo) => {
        if (salas[codigo]) {
            salas[codigo].jogadores = salas[codigo].jogadores.filter(j => j.id !== socket.id);
            socket.leave(codigo);
            if (salas[codigo].jogadores.length === 0) delete salas[codigo];
            else io.to(codigo).emit('atualizarJogo', salas[codigo]);
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

const PORT = 3000;
server.listen(PORT, () => console.log(`=================================\nSERVIDOR RODANDO: http://localhost:${PORT}\n=================================`));