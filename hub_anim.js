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
  var PATHS = {           // koordinat viewBox 1060x580, pusat (530,290)
    belanja:    'M530 290 C 440 290, 420 125, 329 125',
    pendapatan: 'M530 290 C 620 290, 640 125, 731 125',
    gabungan:   'M530 290 C 440 290, 420 455, 329 455',
    klaim:      'M530 290 C 620 290, 640 455, 731 455'
  };
  var current = null;

  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function played() { try { return sessionStorage.getItem('hubIsoPlayed') === '1'; } catch (e) { return false; } }
  function markPlayed() { try { sessionStorage.setItem('hubIsoPlayed', '1'); } catch (e) {} }
  function shown(n) { return !!n && getComputedStyle(n).display !== 'none'; }
  function svg(tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }

  // sisipkan lingkaran pusat + jalur cahaya (sekali)
  function buildStage(grid) {
    if (grid.classList.contains('hub-stage')) return;
    var s = svg('svg', { 'class': 'hub-lines', viewBox: '0 0 1060 580', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
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
    core.className = 'hub-core'; core.setAttribute('aria-hidden', 'true'); core.innerHTML = '<i></i>';
    grid.insertBefore(s, grid.firstChild);
    grid.insertBefore(core, s.nextSibling);
    grid.classList.add('hub-stage');
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
    var k = full ? 1 : 0.55;                       // faktor kecepatan
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
        { opacity: 0, transform: 'translateY(30px) scale(.2)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 650 * k, easing: EASE_BACK, fill: 'backwards' }));

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
      var dx = ox - (r.left + r.width / 2), dy = oy - (r.top + r.height / 2);
      timers.push(setTimeout(function () {
        if (done) return;
        var a = track(card.animate([
          { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.22)', offset: 0 },
          { opacity: 1, transform: 'translate(' + dx * 0.12 + 'px,' + (dy * 0.12 - 18) + 'px) scale(1.04)', offset: 0.72 },
          { opacity: 1, transform: 'none', offset: 1 }
        ], { duration: 950 * k, easing: EASE_OUT, fill: 'both' }));
        release(card);
        a.onfinish = function () { try { a.cancel(); } catch (e) {} };
      }, delay));
    });
    var total = (stage ? 820 : 120) * k + cards.length * 170 * k + 950 * k + 300;
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
