(function () {
  const ler = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const cfg = Object.assign({ fs: 1, legivel: false, contraste: false, semAnim: false, tempo: 1 },
                            JSON.parse(ler('a11y') || '{}'));
  window.A11Y = cfg;   // o game.js lê cfg.tempo

  function aplicar() {
    document.documentElement.style.setProperty('--fs', cfg.fs);
    document.body.classList.toggle('fonte-legivel', cfg.legivel);
    document.body.classList.toggle('alto-contraste', cfg.contraste);
    document.body.classList.toggle('sem-anim', cfg.semAnim);
    gravar('a11y', JSON.stringify(cfg));
    painel.querySelectorAll('[data-k]').forEach(b => {
      const k = b.dataset.k; if (k in cfg && typeof cfg[k] === 'boolean') b.setAttribute('aria-pressed', cfg[k]);
    });
  }

  const btn = document.createElement('button');
  btn.id = 'btnA11y'; btn.textContent = '♿'; btn.title = 'Acessibilidade';
  btn.setAttribute('aria-label', 'Abrir opções de acessibilidade'); btn.setAttribute('aria-expanded', 'false');

  const painel = document.createElement('div');
  painel.id = 'painelA11y'; painel.hidden = true; painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Acessibilidade');
  painel.innerHTML = `
    <button data-a="menor">🔽 Letra menor (A−)</button>
    <button data-a="maior">🔼 Letra maior (A+)</button>
    <button data-k="legivel"   aria-pressed="false">🔤 Fonte mais legível</button>
    <button data-k="contraste" aria-pressed="false">🌓 Alto contraste</button>
    <button data-k="semAnim"   aria-pressed="false">⏸ Sem animações</button>
    <button data-a="tempo">⏱ Avisos mais lentos</button>`;

  painel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) cfg[b.dataset.k] = !cfg[b.dataset.k];
    if (b.dataset.a === 'maior') cfg.fs = Math.min(1.75, +(cfg.fs + .15).toFixed(2));
    if (b.dataset.a === 'menor') cfg.fs = Math.max(.75, +(cfg.fs - .15).toFixed(2));
    if (b.dataset.a === 'tempo') cfg.tempo = cfg.tempo >= 3 ? 1 : cfg.tempo + 1;  // 1x, 2x, 3x
    aplicar();
  });
  btn.onclick = () => { painel.hidden = !painel.hidden; btn.setAttribute('aria-expanded', !painel.hidden); };

  document.body.append(btn, painel);
  aplicar();
})();