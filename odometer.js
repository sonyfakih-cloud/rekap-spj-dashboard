/* ============================================================================
   ODOMETER — animasi angka bergulir dari bawah ke atas (seperti angka di mesin
   pompa bensin) untuk SEMUA angka di SEMUA modul dashboard (Belanja, Pendapatan,
   Gabungan, Klaim BPJS) — terutama tabel.

   Cara kerja (tanpa mengubah fungsi render di app.js):
   - MutationObserver memantau DOM. Setiap kali app.js menulis ulang tabel/kartu
     (innerHTML / textContent), angka di dalamnya otomatis dibungkus menjadi
     "kolom digit" yang berputar.
   - Cakupan = SELURUH isi halaman modul (.main), kecuali yang dikecualikan (lihat
     SKIP): kode rekening, tahun, tanggal, nomor bukti, judul/label/header, isian
     form, modal detail transaksi BKU.
   - Angka baru dianimasikan dari 0. Angka yang berubah (ganti filter bulan, data
     live masuk) bergulir dari nilai lama ke nilai baru. Angka yang tampil ulang
     dengan nilai SAMA juga diputar ulang (mis. tombol Sync/Reload) — kecuali saat
     pengguna sedang mengetik/memilih di kotak filter (supaya tabel tidak "berputar"
     di setiap ketikan).
   - TABEL: satu BARIS dikonversi sekaligus begitu baris itu terlihat — semua kolom
     dalam baris (termasuk kolom yang tersembunyi di kanan karena tabel digeser)
     ikut jadi odometer, bukan hanya sel yang kebetulan terlihat.
   - Konversi malas (IntersectionObserver): hanya baris/kartu yang terlihat di
     layar yang dibuat, jadi tabel ratusan baris tetap ringan, dan animasi tampil
     tepat saat tab/halaman dibuka. Saat pindah tab, angka yang terlihat diputar ulang.
   - Teks asli tetap ada (span tersembunyi .odo-t) sehingga copy-paste & Ctrl+F
     tetap menemukan angka aslinya.
   - Menghormati pengaturan "kurangi gerakan" (prefers-reduced-motion).
   Gaya ada di style.css (bagian "ODOMETER").
   ========================================================================== */
(function(){
  'use strict';
  if(window.__odoLoaded) return;
  window.__odoLoaded = true;

  var REDUCED = false;
  try{ REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  if(REDUCED || !('IntersectionObserver' in window) || !('MutationObserver' in window)) return;

  var LH = 1.25;          // tinggi satu digit (em) — harus sama dengan CSS .odo-d

  // Area dashboard yang angkanya dianimasikan: seluruh halaman tiap modul
  var SCOPES = '.app .main, #hubScreen';

  // Elemen yang TIDAK boleh disentuh (teks narasi, judul, label, kode, form, dsb.)
  var SKIP = [
    'th', 'h1', 'h2', 'label', 'select', 'option', 'input', 'textarea',
    'button', 'script', 'style', 'canvas', 'svg', 'a',
    '.odo', '.tip', '.kpi-year', '.status-card-title', '.status-card-jenis',
    '.range-detail-caption', '.range-label', '.card-desc', '.klik-hint', '.footer-note',
    '.title-block', '.toolbar', '.range-toolbar', '.year-checks', '.pill',
    '.marquee-bar', '.k-tabs', '.nav-item', '.hub-menu-card p',
    '.bku-modal-overlay', '.auth-overlay', '.intro-anim-screen',
    '[data-odo="off"]',
    'table.data tbody td:nth-child(-n+2)'     // kolom Kode & Nama Rekening
  ].join(',');

  var TOKEN = /\d+(?:[.,]\d+)*/g;
  var REG = new Map();    // key posisi -> teks angka terakhir yang ditampilkan

  // ---- validasi token: angka format Indonesia / persen, bukan tahun/kode/tanggal ----
  function okToken(t, txt, idx){
    var before = idx > 0 ? txt.charAt(idx - 1) : '';
    var after  = txt.charAt(idx + t.length);
    if(/[A-Za-z\/:]/.test(before) || after === '/' || after === ':') return false;
    if(/[A-Za-z]/.test(after) && /[\/\d]/.test(txt.charAt(idx + t.length + 1))) return false;   // 94B/TBP
    if(before === '-' && idx > 1 && /\d/.test(txt.charAt(idx - 2))) return false;   // 2026-10-01
    if(after === '-' && /\d/.test(txt.charAt(idx + t.length + 1))) return false;
    if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(t)) return true;   // 57.400.693.135 / 1.234,5
    if(/^\d+,\d+$/.test(t)) return true;                         // 12,5  0,35
    if(/^\d+\.\d{1,2}$/.test(t) && after === '%') return true;   // 12.3%
    if(/^\d{1,3}$/.test(t)) return true;                         // 7  42  120
    return false;                                                // tahun, kode rekening, dsb.
  }

  // ---- kunci posisi (supaya nilai lama pada slot yang sama bisa dibandingkan) ----
  function idxOf(el){
    var i = 0, s = el;
    while((s = s.previousElementSibling)) i++;
    return i;
  }
  function keyFor(host, ti){
    var parts = [ti], n = host;
    while(n && n !== document.body){
      if(n.id){ parts.push('#' + n.id); break; }
      if(n.tagName === 'TR'){
        var rowId = idxOf(n);
        if(n.closest('table.data') && n.cells && n.cells[0]) rowId = n.cells[0].textContent.trim();
        parts.push('tr:' + rowId);
      } else {
        parts.push(n.tagName + idxOf(n));
      }
      n = n.parentElement;
    }
    return parts.join('/');
  }

  // pengguna sedang mengetik / memilih di kotak filter?
  function userEditing(){
    var a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA'));
  }

  // ---- bangun elemen odometer untuk satu token ----
  function buildOdo(t, prev){
    var wrap = document.createElement('span');
    wrap.className = 'odo';
    var sr = document.createElement('span');
    sr.className = 'odo-t';
    sr.textContent = t;
    wrap.appendChild(sr);

    var pd = prev ? prev.replace(/\D/g, '') : '';
    var nodes = [], di = 0, k, ch;
    for(k = t.length - 1; k >= 0; k--){
      ch = t.charAt(k);
      if(ch >= '0' && ch <= '9'){
        var d = +ch;
        var od = pd.length > di ? +pd.charAt(pd.length - 1 - di) : 0;
        var turns = prev ? (di < 2 ? 1 : 0) : (di < 3 ? 2 : (di < 6 ? 1 : 0));
        var from = od;
        var to = od + ((d - od + 10) % 10) + 10 * turns;
        if(prev && d === od) to = from;                 // digit tidak berubah -> diam
        var cell = document.createElement('span');
        cell.className = 'odo-d';
        cell.setAttribute('aria-hidden', 'true');
        var col = document.createElement('span');
        col.className = 'odo-c';
        col.style.setProperty('--to', (-to * LH) + 'em');
        if(to !== from){
          col.style.setProperty('--from', (-from * LH) + 'em');
          col.style.setProperty('--dur', Math.max(650, 1150 - di * 45) + 'ms');
          col.className += ' go';
        }
        cell.appendChild(col);
        nodes.push(cell);
        di++;
      } else {
        var sep = document.createElement('span');
        sep.className = 'odo-s';
        sep.setAttribute('aria-hidden', 'true');
        sep.setAttribute('data-c', ch);                // dirender lewat CSS ::before (tidak mengotori textContent)
        nodes.push(sep);
      }
    }
    for(k = nodes.length - 1; k >= 0; k--) wrap.appendChild(nodes[k]);
    return wrap;
  }

  // ---- ubah teks angka di dalam satu elemen "host" ----
  function convertHost(host){
    if(!host.isConnected) return;
    var kids = Array.prototype.slice.call(host.childNodes), ti = 0;
    var editing = userEditing();
    for(var i = 0; i < kids.length; i++){
      var n = kids[i];
      if(n.nodeType !== 3) continue;
      var txt = n.nodeValue;
      if(!/\d/.test(txt)) continue;
      var frag = document.createDocumentFragment(), last = 0, changed = false, m;
      TOKEN.lastIndex = 0;
      while((m = TOKEN.exec(txt))){
        var t = m[0];
        if(!okToken(t, txt, m.index)) continue;
        var key = keyFor(host, ti++);
        var prev = REG.get(key);
        REG.set(key, t);
        if(prev === t){
          if(editing) continue;                        // sedang mengetik di filter -> jangan putar ulang
          prev = undefined;                            // tampil ulang dgn nilai sama -> putar dari 0 lagi
        }
        frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        frag.appendChild(buildOdo(t, prev));
        last = m.index + t.length;
        changed = true;
      }
      if(changed){
        frag.appendChild(document.createTextNode(txt.slice(last)));
        host.replaceChild(frag, n);
      }
    }
    if(REG.size > 60000) REG.clear();
  }

  // kumpulkan semua "host" (elemen yang punya teks angka langsung) di dalam sebuah unit
  function collectHosts(root){
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, set = [], seen = new Set();
    while((n = tw.nextNode())){
      if(!/\d/.test(n.nodeValue)) continue;
      var p = n.parentElement;
      if(!p || seen.has(p) || p.closest(SKIP)) continue;
      seen.add(p); set.push(p);
    }
    return set;
  }

  // unit yang diobservasi: BARIS tabel (supaya semua kolom dalam satu baris ikut
  // berubah, termasuk yang tersembunyi di kanan) atau elemen host itu sendiri
  function convertUnit(unit){
    if(!unit.isConnected) return;
    if(unit.tagName === 'TR'){
      var hosts = collectHosts(unit);
      for(var i = 0; i < hosts.length; i++) convertHost(hosts[i]);
    } else {
      convertHost(unit);
    }
  }

  // ---- konversi malas: hanya saat unit terlihat di layar ----
  var io = new IntersectionObserver(function(entries){
    var did = false;
    for(var i = 0; i < entries.length; i++){
      var e = entries[i];
      if(!e.isIntersecting && e.target.isConnected) continue;
      io.unobserve(e.target);
      e.target.__odoPending = false;
      if(e.target.isConnected){ convertUnit(e.target); did = true; }
    }
    if(did) mo.takeRecords();                          // buang catatan mutasi buatan sendiri
  }, { rootMargin: '120px 0px' });

  function queueUnit(unit){
    if(unit.__odoPending) return;
    unit.__odoPending = true;
    io.observe(unit);
  }

  function walk(root){
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while((n = tw.nextNode())){
      if(!/\d/.test(n.nodeValue)) continue;
      var p = n.parentElement;
      if(!p || p.closest(SKIP)) continue;
      var tr = p.closest('tr');
      var unit = tr || p;
      if(unit.__odoPending) continue;
      queueUnit(unit);
    }
  }

  function scanNode(node){
    var el = node.nodeType === 1 ? node : node.parentElement;
    if(!el || !el.isConnected) return;
    if(el.closest('.odo')) return;
    if(el.closest(SCOPES)){
      walk(el);
    } else if(el.querySelectorAll){
      var inner = el.querySelectorAll(SCOPES);
      for(var i = 0; i < inner.length; i++) walk(inner[i]);
    }
  }

  // ---- pantau perubahan DOM ----
  var pendingNodes = [], rafId = 0;
  function flush(){
    rafId = 0;
    var list = pendingNodes; pendingNodes = [];
    for(var i = 0; i < list.length; i++) scanNode(list[i]);
    mo.takeRecords();
  }
  var mo = new MutationObserver(function(records){
    for(var i = 0; i < records.length; i++){
      var r = records[i];
      if(r.type === 'attributes'){
        var t = r.target;
        if(t.classList && t.classList.contains('active') && t.classList.contains('view')) replay(t);
        continue;
      }
      for(var j = 0; j < r.addedNodes.length; j++){
        var a = r.addedNodes[j];
        if(a.nodeType === 1 && (a.classList.contains('odo') || a.closest('.odo'))) continue;
        pendingNodes.push(a);
      }
      if(r.type === 'characterData') pendingNodes.push(r.target);
    }
    if(pendingNodes.length && !rafId) rafId = requestAnimationFrame(flush);
  });

  // ---- putar ulang angka yang terlihat saat pindah tab/halaman ----
  var lastReplay = 0;
  function replay(section){
    var now = Date.now();
    if(now - lastReplay < 400) return;
    lastReplay = now;
    setTimeout(function(){
      var cols = section.querySelectorAll('.odo-c.go');
      var vis = [], vh = window.innerHeight || 800;
      for(var i = 0; i < cols.length && vis.length < 2500; i++){
        var r = cols[i].getBoundingClientRect();
        if(r.bottom > 0 && r.top < vh) vis.push(cols[i]);
      }
      for(i = 0; i < vis.length; i++) vis[i].classList.remove('go');
      void section.offsetWidth;                        // satu kali reflow untuk semua
      for(i = 0; i < vis.length; i++) vis[i].classList.add('go');
    }, 60);
  }

  function start(){
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    var views = document.querySelectorAll('section.view');
    for(var i = 0; i < views.length; i++){
      mo.observe(views[i], { attributes: true, attributeFilter: ['class'] });
    }
    scanNode(document.body);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Odometer = { scan: scanNode, replay: replay };
})();
