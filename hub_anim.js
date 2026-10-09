/* ============================================================================
 * hub_anim.js -- Menu Utama isometrik
 * Lingkaran pusat bercahaya + jalur cahaya oranye menuju 4 modul (seperti ilustrasi).
 * Animasi pembuka: lingkaran pusat muncul -> jalur cahaya "tergambar" -> tiap modul
 * meluncur dari pusat lewat jalurnya ke posisinya. Titik cahaya terus mengalir di jalur.
 *
 * - Tata letak isometrik hanya pada layar >= 1000px dan bukan Mode HP; selain itu
 *   kartu tetap berupa grid biasa (dekorasi disembunyikan lewat CSS).
 * - Versi penuh sekali per sesi tab; berikutnya versi singkat. ALWAYS_FULL = true untuk selalu penuh.
 * - Klik / tombol apa pun = lewati. Hormati "prefers-reduced-motion". Tidak mengubah app.js.
 * ============================================================================ */
(function () {
  'use strict';
  var ALWAYS_FULL = false;
  var EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
  var EASE_BACK = 'cubic-bezier(.34,1.45,.5,1)';
  var NS = 'http://www.w3.org/2000/svg';
  var PATHS = {           // koordinat viewBox 1100x760, pusat (550,380); ujung = sudut panggung
    belanja:    'M550 380 C 480 380, 450 235, 378 235',
    pendapatan: 'M550 380 C 620 380, 650 255, 722 255',
    gabungan:   'M550 380 C 620 380, 650 615, 722 615',
    klaim:      'M550 380 C 480 380, 450 615, 378 615'
  };
  var current = null;

  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function played() { try { return sessionStorage.getItem('hubIsoPlayed') === '1'; } catch (e) { return false; } }
  function markPlayed() { try { sessionStorage.setItem('hubIsoPlayed', '1'); } catch (e) {} }
  function shown(n) { return !!n && getComputedStyle(n).display !== 'none'; }
  function svg(tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }

  // skala panggung agar muat di lebar layar (panggung dirancang 1100px)
  function fit() {
    var g = document.querySelector('.hub-menu-grid.hub-stage'); if (!g) return;
    var hs = Math.max(0.6, Math.min(1, (window.innerWidth - 40) / 1100));
    g.style.setProperty('--hs', String(hs));
  }
  window.addEventListener('resize', fit);
  function hsNow(grid) { return parseFloat(grid.style.getPropertyValue('--hs')) || 1; }

  // sisipkan lingkaran pusat + jalur cahaya (sekali)
  function buildStage(grid) {
    if (grid.classList.contains('hub-stage')) return;
    var s = svg('svg', { 'class': 'hub-lines', viewBox: '0 0 1100 760', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    Object.keys(PATHS).forEach(function (k, i) {
      var d = PATHS[k];
      s.appendChild(svg('path', { 'class': 'hl-base', d: d, 'data-k': k }));
      s.appendChild(svg('path', { 'class': 'hl-glow', d: d, pathLength: '1', 'data-k': k }));
      var dot = svg('circle', { 'class': 'hl-dot', r: '4.5' });
      var am = svg('animateMotion', { dur: (3.2 + i * 0.35) + 's', repeatCount: 'indefinite', path: d, begin: (i * 0.6) + 's', keyPoints: '0;1', keyTimes: '0;1', calcMode: 'linear' });
      dot.appendChild(am);
      s.appendChild(dot);
    });
    var core = document.createElement('div');
    core.className = 'hub-core'; core.setAttribute('aria-hidden', 'true'); core.innerHTML = '<div class="hc-disc"></div><div class="hc-ring"></div><div class="hc-in"></div><i></i>';
    grid.insertBefore(s, grid.firstChild);
    grid.insertBefore(core, s.nextSibling);
    [].forEach.call(grid.querySelectorAll('.hub-menu-card'), function (card) {
      if (card.querySelector('.hub-face')) return;
      var face = document.createElement('div'); face.className = 'hub-face';
      while (card.firstChild) face.appendChild(card.firstChild);
      var wrap = document.createElement('div'); wrap.className = 'hub-slabwrap'; wrap.innerHTML = '<div class="hub-slab"></div>';
      var deco = document.createElement('div'); deco.className = 'hub-deco'; deco.innerHTML = '<b class="o"></b><b></b><b class="o"></b>';
      card.appendChild(wrap); card.appendChild(deco); card.appendChild(face);
    });
    grid.classList.add('hub-stage');
    fit();
  }

  function play(hub, forceQuick) {
    if (current) current.finish();
    var grid = hub.querySelector('.hub-menu-grid');
    if (!grid || reduced()) return;
    buildStage(grid);
    var cards = [].slice.call(grid.querySelectorAll('.hub-menu-card'));
    var core = grid.querySelector('.hub-core'), lines = grid.querySelector('.hub-lines');
    var stage = shown(core);
    var full = !forceQuick && (ALWAYS_FULL || !played());
    var k = full ? 2 : 1;                       // faktor kecepatan
    var top = hub.querySelector('.hub-topbar');
    var anims = [], done = false, timers = [];

    function track(a) { anims.push(a); return a; }
    function hide(c) { c.style.opacity = '0'; }
    function release(c) { c.style.opacity = ''; }

    cards.forEach(hide);

    function finish() {
      if (done) return; done = true;
      timers.forEach(clearTimeout);
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      cards.forEach(release);
      hub.removeEventListener('pointerdown', skip, true);
      document.removeEventListener('keydown', skip, true);
      if (current && current.finish === finish) current = null;
    }
    function skip() { finish(); }
    hub.addEventListener('pointerdown', skip, true);
    document.addEventListener('keydown', skip, true);
    current = { finish: finish };
    if (full) markPlayed();

    if (top) track(top.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 700 * k, easing: EASE_OUT, fill: 'backwards' }));

    var gr = grid.getBoundingClientRect();
    var ox = stage ? (function () { var r = core.getBoundingClientRect(); return r.left + r.width / 2; })() : gr.left + gr.width / 2;
    var oy = stage ? (function () { var r = core.getBoundingClientRect(); return r.top + r.height / 2; })() : gr.top + Math.min(gr.height / 2, 260);

    if (stage) {
      track(core.animate([
        { opacity: 0, transform: 'translateY(40px) scale(.2)', offset: 0, easing: 'cubic-bezier(.25,.8,.35,1)' },
        { opacity: 1, transform: 'translateY(-10px) scale(1.16)', offset: 0.5, easing: 'ease-in-out' },
        { transform: 'translateY(4px) scale(.93)', offset: 0.72, easing: 'ease-in-out' },
        { transform: 'translateY(-2px) scale(1.04)', offset: 0.88, easing: 'ease-in-out' },
        { opacity: 1, transform: 'none', offset: 1 }
      ], { duration: 700 * k, fill: 'backwards' }));

      [].forEach.call(lines.querySelectorAll('.hl-base'), function (p, i) {
        track(p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 * k, delay: (450 + i * 130) * k, easing: 'ease-out', fill: 'backwards' }));
      });
      [].forEach.call(lines.querySelectorAll('.hl-glow'), function (p, i) {
        p.style.strokeDasharray = '1 1';
        track(p.animate([{ strokeDashoffset: 1, opacity: 0.2 }, { strokeDashoffset: 0, opacity: 1 }],
          { duration: 850 * k, delay: (450 + i * 130) * k, easing: 'cubic-bezier(.5,.1,.2,1)', fill: 'backwards' }));
      });
      [].forEach.call(lines.querySelectorAll('.hl-dot'), function (d, i) {
        track(d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: (1300 + i * 130) * k, fill: 'backwards' }));
      });
    }

    cards.forEach(function (card, i) {
      var delay = (stage ? 820 : 120) * k + i * 170 * k;
      var r = card.getBoundingClientRect();
      var zs = stage ? hsNow(grid) : 1;
      var dx = (ox - (r.left + r.width / 2)) / zs, dy = (oy - (r.top + r.height / 2)) / zs;
      timers.push(setTimeout(function () {
        if (done) return;
        var a = track(card.animate([
          { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.22)', offset: 0, easing: 'cubic-bezier(.2,.75,.3,1)' },
          { opacity: 1, transform: 'translate(' + dx * 0.03 + 'px,' + (dy * 0.03 - 34) + 'px) scale(1.09)', offset: 0.5, easing: 'cubic-bezier(.5,0,.8,.6)' },
          { transform: 'translate(0,14px) scale(.96,.94)', offset: 0.68, easing: 'ease-out' },
          { transform: 'translate(0,-9px) scale(1.02)', offset: 0.82, easing: 'ease-in' },
          { transform: 'translate(0,3px) scale(.995)', offset: 0.92, easing: 'ease-out' },
          { opacity: 1, transform: 'none', offset: 1 }
        ], { duration: 1000 * k, fill: 'both' }));
        release(card);
        a.onfinish = function () { try { a.cancel(); } catch (e) {} };
      }, delay));
    });
    var total = (stage ? 820 : 120) * k + cards.length * 170 * k + 1000 * k + 300;
    timers.push(setTimeout(finish, total));
  }

  function init() {
    var hub = document.getElementById('hubScreen');
    if (!hub) return;
    var grid = hub.querySelector('.hub-menu-grid');
    if (grid) buildStage(grid);
    var was = shown(hub);
    var mo = new MutationObserver(function () {
      var now = shown(hub);
      if (now && !was) requestAnimationFrame(function () { play(hub); });
      if (!now && was && current) current.finish();
      was = now;
    });
    mo.observe(hub, { attributes: true, attributeFilter: ['style', 'class'] });
    if (was) requestAnimationFrame(function () { play(hub); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
