/* ============================================================================
 * hub_anim.js -- Animasi pembuka Menu Utama
 * Buku muncul di tengah -> sampul terbuka -> tiap lembar (= 1 modul) terbalik satu
 * per satu -> begitu terbalik, lembar itu "menyebar" jadi kartu modul di posisinya
 * -> buku memudar. Memakai Web Animations API (smooth, di-GPU: hanya transform/opacity).
 *
 * - Tampil penuh sekali per sesi tab; kunjungan berikutnya ke Menu Utama pakai versi
 *   singkat (kartu menyebar dari tengah) supaya tidak menunggu tiap kali.
 *   Ubah ALWAYS_BOOK = true untuk selalu memakai versi buku.
 * - Klik / tekan tombol apa pun = lewati animasi. Hormati "prefers-reduced-motion".
 * - Tidak mengubah app.js: memantau #hubScreen saat berubah dari tersembunyi -> tampil.
 * ============================================================================ */
(function () {
  'use strict';
  var ALWAYS_BOOK = false;
  var W = 210, H = 280;               // ukuran lembar buku (px)
  var EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
  var EASE_FLIP = 'cubic-bezier(.45,.05,.25,1)';
  var current = null;                  // animasi yang sedang berjalan

  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function played() { try { return sessionStorage.getItem('hubBookPlayed') === '1'; } catch (e) { return false; } }
  function markPlayed() { try { sessionStorage.setItem('hubBookPlayed', '1'); } catch (e) {} }
  function shown(n) { return !!n && getComputedStyle(n).display !== 'none'; }
  function mk(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  function buildBook(cards) {
    var book = mk('div', 'hub-book');
    book.setAttribute('aria-hidden', 'true');
    var inner = mk('div', 'hb-inner');
    inner.appendChild(mk('div', 'hb-shadow'));
    inner.appendChild(mk('div', 'hb-back'));

    var leaves = [];
    cards.forEach(function (card, i) {
      var ico = card.querySelector('.hub-menu-icon');
      var ttl = card.querySelector('h3');
      var leaf = mk('div', 'hb-leaf');
      leaf.style.zIndex = String(20 - i);                       // lembar pertama paling atas
      leaf.appendChild(mk('div', 'hb-face hb-front', '<span class="hb-pageno">' + (i + 1) + '</span>'));
      leaf.appendChild(mk('div', 'hb-face hb-face-back',
        '<div class="hb-ico">' + (ico ? ico.innerHTML : '') + '</div>' +
        '<div class="hb-ttl">' + (ttl ? ttl.textContent : '') + '</div>' +
        '<span class="hb-chip">Tersedia</span>'));
      inner.appendChild(leaf);
      leaves.push(leaf);
    });

    var cover = mk('div', 'hb-leaf');
    cover.style.zIndex = '40';
    cover.appendChild(mk('div', 'hb-face hb-cover-front',
      '<svg viewBox="0 0 400 400"><use href="#logoBadge"/></svg><b>Rekap Keuangan</b><i>RSUD dr. R. Soeprapto Cepu</i>'));
    cover.appendChild(mk('div', 'hb-face hb-cover-back'));
    inner.appendChild(cover);

    book.appendChild(inner);
    return { book: book, inner: inner, cover: cover, leaves: leaves };
  }

  function play(hub, forceQuick) {
    if (current) current.finish();
    var grid = hub.querySelector('.hub-menu-grid');
    var cards = grid ? [].slice.call(grid.querySelectorAll('.hub-menu-card')) : [];
    if (!cards.length || reduced()) return;

    var full = !forceQuick && (ALWAYS_BOOK || !played());
    var top = hub.querySelector('.hub-topbar');
    var anims = [], timers = [], parts = null, done = false;

    var gr = grid.getBoundingClientRect();
    var cx = gr.left + gr.width / 2;
    var cy = Math.max(190, Math.min(gr.top + gr.height / 2, window.innerHeight / 2 + 40));

    cards.forEach(function (c) { c.style.opacity = '0'; c.style.position = 'relative'; c.style.zIndex = '70'; });

    function track(a) { anims.push(a); return a; }
    function release(card) { card.style.opacity = ''; card.style.position = ''; card.style.zIndex = ''; }

    // kartu terbang dari titik (sx, sy) [koordinat viewport] ke posisinya
    function launch(card, sx, sy, scale, rot, dur) {
      var r = card.getBoundingClientRect();
      var dx = sx - (r.left + r.width / 2), dy = sy - (r.top + r.height / 2);
      var a = track(card.animate([
        { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ') rotate(' + rot + 'deg)', offset: 0 },
        { opacity: 1, transform: 'translate(' + dx * 0.38 + 'px,' + (dy * 0.38 - 46) + 'px) scale(' + (scale + (1 - scale) * 0.55) + ') rotate(' + (-rot * 0.35) + 'deg)', offset: 0.5 },
        { opacity: 1, transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 1 }
      ], { duration: dur, easing: EASE_OUT, fill: 'both' }));
      a.onfinish = function () { release(card); try { a.cancel(); } catch (e) {} };
    }

    function finish() {
      if (done) return; done = true;
      timers.forEach(clearTimeout);
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      cards.forEach(release);
      if (parts && parts.book.parentNode) parts.book.parentNode.removeChild(parts.book);
      hub.removeEventListener('pointerdown', skip, true);
      document.removeEventListener('keydown', skip, true);
      if (current && current.finish === finish) current = null;
    }
    function skip() { finish(); }
    hub.addEventListener('pointerdown', skip, true);
    document.addEventListener('keydown', skip, true);
    current = { finish: finish };

    if (top) track(top.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 700, easing: EASE_OUT, fill: 'backwards' }));

    /* ---------- versi singkat: kartu menyebar dari tengah ---------- */
    if (!full) {
      cards.forEach(function (card, i) {
        timers.push(setTimeout(function () { if (!done) launch(card, cx, cy, 0.35, (i % 2 ? 9 : -9), 760); }, 120 + i * 85));
      });
      timers.push(setTimeout(finish, 120 + cards.length * 85 + 900));
      return;
    }

    /* ---------- versi penuh: buku ---------- */
    markPlayed();
    parts = buildBook(cards);
    parts.book.style.left = cx + 'px';
    parts.book.style.top = cy + 'px';
    document.body.appendChild(parts.book);

    var T_OPEN = 520, OPEN_DUR = 820;                       // sampul
    var T_PAGE0 = T_OPEN + 760, PAGE_GAP = 340, PAGE_DUR = 640;

    track(parts.book.animate([
      { opacity: 0, transform: 'translateY(46px) scale(.7) rotateX(26deg)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 560, easing: EASE_OUT, fill: 'both' }));

    // geser buku ke kanan saat terbuka, supaya sepasang halaman terbuka tetap di tengah
    track(parts.inner.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (W / 2) + 'px)' }],
      { duration: OPEN_DUR, delay: T_OPEN, easing: EASE_FLIP, fill: 'both' }));

    track(parts.cover.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-178deg)' }],
      { duration: OPEN_DUR, delay: T_OPEN, easing: EASE_FLIP, fill: 'both' }));
    timers.push(setTimeout(function () { parts.cover.style.zIndex = '2'; }, T_OPEN + OPEN_DUR * 0.5));

    var lastEnd = 0;
    parts.leaves.forEach(function (leaf, i) {
      var delay = T_PAGE0 + i * PAGE_GAP;
      var a = track(leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(' + (-175 + i * 1.2) + 'deg)' }],
        { duration: PAGE_DUR, delay: delay, easing: EASE_FLIP, fill: 'both' }));
      timers.push(setTimeout(function () { leaf.style.zIndex = String(10 + i); }, delay + PAGE_DUR * 0.5));
      // begitu lembar mendarat di sisi kiri, kartu modulnya menyebar dari situ
      timers.push(setTimeout(function () {
        if (done) return;
        launch(cards[i], cx - W / 2 + 4, cy, 0.52, (i % 2 ? 7 : -7), 980);
      }, delay + PAGE_DUR * 0.72));
      lastEnd = delay + PAGE_DUR;
    });

    // buku memudar setelah semua lembar menyebar
    timers.push(setTimeout(function () {
      if (done) return;
      var a = track(parts.book.animate([
        { opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(22px) scale(.86)' }
      ], { duration: 420, easing: 'ease-in', fill: 'both' }));
      a.onfinish = finish;
    }, lastEnd + 60));
    timers.push(setTimeout(finish, lastEnd + 60 + 420 + 1100));   // pengaman
  }

  function init() {
    var hub = document.getElementById('hubScreen');
    if (!hub) return;
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
