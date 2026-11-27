const CACHE = 'banco-rn-v3'; // Mude o número da versão aqui
const ASSETS = ['/', '/index.html', '/style.css', '/game.js', '/sons.js', '/acessibilidade.js', '/carrossel.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});