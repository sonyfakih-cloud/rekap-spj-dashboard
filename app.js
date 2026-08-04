/* Dashboard Rekap Belanja SPJ 2024-2025-2026 — RSUD dr. R. Soeprapto Cepu */

const fmt = n => (n===null||n===undefined||n==='') ? '-' : Number(n).toLocaleString('id-ID');
const fmtPct = n => (n===null||n===undefined||n==='') ? '-' : Number(n).toFixed(1)+'%';
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let STATE = {
  ringkasan: REKAP_DATA.ringkasan,
  tren: REKAP_DATA.tren,
  perbandingan: REKAP_DATA.perbandingan,
  khusus: REKAP_DATA.khusus,
  live: false,
  komponen: null,   // { '2024': {pegawai,barang_jasa,modal,lainnya,total}, ... } -- cuma ada kalau live
};

// Grafik donat Pegawai/Barang Jasa/Modal butuh rincian per transaksi BKU (kode
// rekening 6 segmen) yang TIDAK ada di snapshot data.js (data.js cuma simpan
// hasil rekap yang sudah diringkas). Jadi kalau situs sedang tidak tersambung
// live ke Google Sheet, grafik ini tidak bisa ditampilkan -- fallback ke tabel
// ringkas 2 kategori (Operasi/Modal) yang memang sudah ada di snapshot.
async function loadKomponenBelanja(){
  if(!window.APPS_SCRIPT_URL) { STATE.komponen = null; return; }
  try{
    const res = await fetch(`${APPS_SCRIPT_URL}?view=komponen`, {method:'GET'});
    if(!res.ok) throw new Error('bad status ' + res.status);
    const json = await res.json();
    if(json.komponen) STATE.komponen = json.komponen;
  }catch(err){
    console.warn('Gagal memuat komponen belanja (Pegawai/Barang Jasa/Modal):', err);
    STATE.komponen = null;
  }
}

// PENTING: sebelum fungsi ini ada, STATE.khusus (dipakai halaman Filter,
// Perbandingan, dan Khusus Tahun 2024/2025/2026) SELALU dari snapshot statis
// data.js -- tryLoadLive() di atas cuma meng-update STATE.ringkasan & STATE.tren,
// tidak pernah menyentuh STATE.khusus. Jadi 3 halaman itu tidak pernah ikut
// "Live dari Google Sheet" walau badge-nya bilang begitu. Fungsi ini menembak
// endpoint baru (?view=khusus) yang menghitung pohon akun berjenjang LANGSUNG
// dari transaksi BKU tiap tahun (lihat getKhususData_ di Code.gs) -- begitu
// sukses, STATE.khusus diganti dengan hasil live ini, dan STATE.perbandingan
// diturunkan ulang dari situ. Kalau gagal (mis. APPS_SCRIPT_URL kosong / offline),
// STATE.khusus/STATE.perbandingan dibiarkan apa adanya (tetap snapshot data.js),
// sama seperti pola fallback loadKomponenBelanja() di atas.
//
// Catatan penting soal cakupan: live tree ini HANYA memuat akun yang benar-benar
// punya transaksi BKU (total>0) tahun tsb -- berbeda dari snapshot lama yang juga
// menyertakan baris anggaran dengan realisasi Rp0 (baris "kosong"). Ini konsekuensi
// tak terhindarkan karena BKU cuma mencatat transaksi riil, bukan struktur pagu
// anggaran lengkap (yang cuma ada di file xlsx manual). Sudah diverifikasi: jumlah
// baris live = jumlah baris snapshot dikurangi baris ber-total 0 (cocok persis
// untuk 2024/2025/2026), jadi bukan data hilang -- cuma baris Rp0 yang tidak lagi
// ditampilkan.
async function loadKhususLive(){
  if(!window.APPS_SCRIPT_URL) return;
  try{
    const res = await fetch(`${APPS_SCRIPT_URL}?view=khusus`, {method:'GET'});
    if(!res.ok) throw new Error('bad status ' + res.status);
    const json = await res.json();
    if(!json.khusus) throw new Error('respons tidak berisi field khusus');
    let any = false;
    ['2024','2025','2026'].forEach(y=>{
      const d = json.khusus[y];
      if(d && d.rows && d.rows.length){
        STATE.khusus[y] = { bulan_label: d.bulan_label, rows: d.rows };
        any = true;
      }
    });
    if(any) STATE.perbandingan = buildPerbandinganFromKhusus_();
  }catch(err){
    console.warn('Gagal memuat pohon akun (khusus) live, tetap pakai data snapshot:', err);
  }
}

// Turunkan ulang daftar "Perbandingan" (flat, {kode,nama,depth,2024,2025,2026})
// dari STATE.khusus 3 tahun -- gabungan (union) semua kode yang muncul di tahun
// manapun, nilainya dari field "total" tiap tahun (null kalau kode itu tidak ada
// transaksinya tahun tsb). Ini menggantikan REKAP_DATA.perbandingan (snapshot)
// begitu live berhasil.
function buildPerbandinganFromKhusus_(){
  const map = {};
  ['2024','2025','2026'].forEach(y=>{
    const d = STATE.khusus[y];
    if(!d) return;
    d.rows.forEach(r=>{
      if(!map[r.kode]) map[r.kode] = { kode:r.kode, nama:r.nama, depth:r.depth, '2024':null, '2025':null, '2026':null };
      map[r.kode][y] = r.total;
      map[r.kode].nama = r.nama;
      map[r.kode].depth = r.depth;
    });
  });
  return Object.values(map).sort((a,b)=> a.kode.localeCompare(b.kode, undefined, {numeric:true}));
}

function normalizePeriode_(v){
  if(!v) return v;
  const s = String(v).trim();
  if(/^\d{4}-\d{2}$/.test(s)) return s; // sudah "yyyy-MM"
  const d = new Date(s);
  if(isNaN(d.getTime())) return s;
  return d.toISOString().slice(0,7);
}

async function tryLoadLive(){
  if(!window.APPS_SCRIPT_URL) return;
  try{
    const res = await fetch(APPS_SCRIPT_URL, {method:'GET'});
    if(!res.ok) throw new Error('bad status');
    const json = await res.json();
    if(json.ringkasan && json.ringkasan.length){
      const byYear = {};
      json.ringkasan.forEach(r=>{
        const y = r.periode;
        if(!byYear[y]) byYear[y] = {total:null, breakdown:[]};
        const rec = {kode:r.kode, nama:r.nama, pagu:+r.pagu, bulan_ini:+r.bulan_ini, sd_bulan_ini:+r.sd_bulan_ini, persen:+r.persen, sisa: +r.sisa_pagu};
        // PENTING (bug ditemukan saat verifikasi grafik donat): r.kode datang dari
        // JSON sebagai NUMBER (5), bukan string. "r.kode === '5'" (strict equality)
        // selalu false untuk number vs string, jadi "total" tidak pernah keset saat
        // fetch live betulan berhasil -- kartu Ringkasan jadi kosong total (bukan
        // fallback ke snapshot, karena STATE.live tetap diset true). Sebelumnya ini
        // "tersamar" karena situs kebetulan sering jatuh ke data snapshot. Pakai
        // String(r.kode) supaya konsisten apapun tipe aslinya dari Sheet.
        if(String(r.kode) === '5') { byYear[y].total = rec; byYear[y].label_bulan = STATE.ringkasan[y] ? STATE.ringkasan[y].label_bulan : ''; }
        else byYear[y].breakdown.push(rec);
      });
      STATE.ringkasan = byYear;
    }
    if(json.tren && json.tren.length){
      // PENTING (bug ditemukan saat verifikasi grafik tren pakai data live
      // sungguhan, bukan cuma cek JSON mentah): kolom periode di Sheet
      // tersimpan sebagai tanggal (Date), jadi lewat JSON jadi string ISO
      // penuh mis. "2024-01-01T08:00:00.000Z" -- bukan "2024-01" seperti di
      // snapshot data.js. Kalau dipakai langsung sebagai label sumbu-X,
      // labelnya jadi timestamp panjang yang tidak terbaca. Dinormalisasi ke
      // "yyyy-MM" dulu supaya konsisten dengan format snapshot.
      STATE.tren = json.tren.map(r=>({periode: normalizePeriode_(r.periode), bulan_ini:+r.bulan_ini, sd_bulan_ini:+r.sd_bulan_ini, pagu:+r.pagu}));
    }
    STATE.live = true;
  }catch(err){
    console.warn('Live fetch gagal, pakai data bawaan:', err);
    STATE.live = false;
  }
  updateLiveBadge();
}

function updateLiveBadge(){
  const el = $('#liveBadge');
  if(!el) return;
  if(STATE.live){
    el.innerHTML = '<span class="live-dot"></span>Live dari Google Sheet';
  } else {
    el.innerHTML = '<span class="live-dot off"></span>Data snapshot ('+REKAP_DATA.meta.generated+')';
  }
}

/* ---------------- Ringkasan ---------------- */
function renderRingkasan(){
  const wrap = $('#view-ringkasan .kpi-row');
  wrap.innerHTML = '';
  ['2024','2025','2026'].forEach(y=>{
    const d = STATE.ringkasan[y];
    if(!d || !d.total){ return; }
    const t = d.total;
    const pct = t.persen || 0;
    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.innerHTML = `
      <div class="kpi-year"><b>Tahun ${y}</b><small>s.d ${d.label_bulan||''}</small></div>
      <div class="kpi-ring" style="--pct:${Math.min(pct,100)}"><span>${pct.toFixed(1)}%</span></div>
      <div class="kpi-stats">
        <div><span>Pagu Anggaran</span><b>Rp ${fmt(t.pagu)}</b></div>
        <div><span>SPJ Bulan Ini</span><b>Rp ${fmt(t.bulan_ini)}</b></div>
        <div><span>SPJ s.d Bulan Ini</span><b>Rp ${fmt(t.sd_bulan_ini)}</b></div>
        <div><span>Sisa Pagu</span><b>Rp ${fmt(t.sisa)}</b></div>
      </div>
      ${renderKomponenBlock(y, d)}
    `;
    wrap.appendChild(card);
  });
}

// Fallback lama (2 kategori, dari sheet ringkasan) dipakai kalau grafik donat
// 3-kategori belum bisa dihitung (butuh data live BKU, tidak ada di snapshot).
function renderKomponenFallbackTable(d){
  return `
    <table class="subtable">
      <thead><tr><th>Komponen</th><th>Bulan Ini</th><th>%</th></tr></thead>
      <tbody>
        ${(d.breakdown||[]).map(b=>`<tr><td>${b.nama}</td><td style="text-align:right">${fmt(b.bulan_ini)}</td><td style="text-align:right">${fmtPct(b.persen)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

const KOMPONEN_WARNA = {
  pegawai:     { color:'#5b8def', label:'Belanja Pegawai' },
  barang_jasa: { color:'#2fb8c4', label:'Belanja Barang & Jasa' },
  modal:       { color:'#f0a35b', label:'Belanja Modal' },
};

// PENTING: "Lainnya" (kode 2.1.1 dkk) BUKAN belanja -- itu pos Utang/Kewajiban
// (mis. utang PPh/PPN pihak ketiga) yang ikut tercatat di buku kas BKU yang
// sama. Sudah dicek langsung ke data mentah (lihat percakapan). Jadi sengaja
// TIDAK diikutkan di grafik ini -- persentase dihitung murni dari 3 kategori
// belanja (Pegawai + Barang Jasa + Modal) saja, bukan dari k.total (yang masih
// mengandung utang).
function renderKomponenBlock(year, d){
  const k = STATE.komponen && STATE.komponen[year];
  if(!k){
    return renderKomponenFallbackTable(d);
  }
  const belanjaTotal = (k.pegawai||0) + (k.barang_jasa||0) + (k.modal||0);
  if(!belanjaTotal){
    return renderKomponenFallbackTable(d);
  }
  const segments = ['pegawai','barang_jasa','modal']
    .map(key => ({ key, value: k[key]||0, ...KOMPONEN_WARNA[key] }))
    .filter(s => s.value > 0);
  const svg = buildDonutSVG(segments, belanjaTotal);
  const legend = segments.map(s => `
    <div class="komp-legend-item">
      <span class="komp-dot" style="background:${s.color}"></span>
      <span class="komp-legend-label">${s.label}</span>
      <span class="komp-legend-pct">${fmtPct(s.value/belanjaTotal*100)}</span>
    </div>
  `).join('');
  return `
    <div class="komp-donut-wrap">
      ${svg}
      <div class="komp-legend">${legend}</div>
    </div>
  `;
}

// Grafik donat gaya flat/clean, senada dengan kpi-ring yang sudah ada di
// dashboard ini (cincin tipis, warna solid, drop-shadow tipis) -- bukan gaya
// 3D "meledak" yang sebelumnya dicoba. Murni SVG, tanpa library chart baru.
function buildDonutSVG(segments, total){
  const size = 176, cx = size/2, cy = size/2;
  const outerR = 66, innerR = 44;

  function polar(r, angleDeg){
    const a = (angleDeg - 90) * Math.PI/180;
    return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
  }
  function wedgePath(a0, a1){
    const large = (a1 - a0) > 180 ? 1 : 0;
    const [x0,y0] = polar(outerR, a0), [x1,y1] = polar(outerR, a1);
    const [x2,y2] = polar(innerR, a1), [x3,y3] = polar(innerR, a0);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${outerR} ${outerR} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} `+
           `L ${x2.toFixed(2)} ${y2.toFixed(2)} A ${innerR} ${innerR} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
  }

  let angle = 0;
  const paths = segments.map(seg=>{
    const sweep = (seg.value/total)*360;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    return `<path d="${wedgePath(a0,a1)}" fill="${seg.color}" stroke="#ffffff" stroke-width="2"/>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="komp-donut-svg">
      ${paths}
    </svg>
  `;
}

/* ---------------- Tren ---------------- */
let trenChart;
function renderTren(){
  const ctx = $('#trenChart').getContext('2d');
  const labels = STATE.tren.map(r=>r.periode);
  const bulanIni = STATE.tren.map(r=>r.bulan_ini);
  const sd = STATE.tren.map(r=>r.sd_bulan_ini);
  if(trenChart) trenChart.destroy();
  trenChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {type:'bar', label:'SPJ Bulan Ini', data:bulanIni, backgroundColor:'rgba(91,141,239,0.55)', borderRadius:6, order:2},
        {type:'line', label:'SPJ s.d Bulan Ini (kumulatif)', data:sd, borderColor:'#2fb8c4', backgroundColor:'rgba(47,184,196,0.15)', tension:0, yAxisID:'y1', order:1, pointRadius:2},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{legend:{position:'top', labels:{boxWidth:12, font:{size:11}}}},
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        y1:{position:'right', grid:{drawOnChartArea:false}, ticks:{callback:v=>(v/1e9).toFixed(1)+'M'}},
        x:{ticks:{maxRotation:90,minRotation:60, font:{size:9}}}
      }
    },
    plugins:[lineShadowPlugin]
  });
}

/* ---------------- Perbandingan ---------------- */
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
// null = pakai nilai "Bulan Ini" bawaan (snapshot terakhir tiap tahun, seperti semula).
// angka 0-11 = bulan spesifik yang dipilih user, dicari dari data bulanan STATE.khusus
// (bukan dari STATE.perbandingan yang cuma simpan 1 nilai per tahun).
let PERBANDINGAN_BULAN_SEL = null;

function populatePerbandinganBulan(){
  const sel = $('#filterBulanPerbandingan');
  if(!sel) return;
  const opts = ['<option value="">Bulan Ini (terakhir)</option>']
    .concat(MONTH_NAMES.map((m,i)=>`<option value="${i}">${m}</option>`));
  sel.innerHTML = opts.join('');
}

// Cari nilai belanja akun tertentu di bulan spesifik, dari data khusus tahun
// tsb (yang punya rincian bulanan lengkap) -- bukan dari STATE.perbandingan
// yang cuma menyimpan 1 angka "bulan ini" per tahun.
function getPerbandinganBulanValue(kode, year, bulanIdx){
  const data = STATE.khusus[year];
  if(!data) return null;
  const row = data.rows.find(x=>x.kode===kode);
  if(!row) return null;
  return (bulanIdx < row.bulanan.length) ? row.bulanan[bulanIdx] : null;
}

function updatePerbandinganPill(){
  const pill = $('#pillPerbandingan');
  if(!pill) return;
  if(PERBANDINGAN_BULAN_SEL === null){
    const labels = ['2024','2025','2026'].map(y=>{
      const d = STATE.ringkasan[y];
      return d && d.label_bulan ? `${d.label_bulan} ${y}` : y;
    });
    pill.textContent = labels.join(' · ');
  } else {
    const m = MONTH_NAMES[PERBANDINGAN_BULAN_SEL];
    pill.textContent = ['2024','2025','2026'].map(y=>`${m} ${y}`).join(' · ');
  }
}

function renderPerbandingan(){
  const tbody = $('#tblPerbandingan tbody');
  const q = ($('#searchPerbandingan').value||'').toLowerCase();
  const rows = STATE.perbandingan.filter(r => r.nama.toLowerCase().includes(q) || r.kode.includes(q));
  const bulanIdx = PERBANDINGAN_BULAN_SEL;
  tbody.innerHTML = rows.map(r=>{
    const v24 = bulanIdx===null ? r['2024'] : getPerbandinganBulanValue(r.kode,'2024',bulanIdx);
    const v25 = bulanIdx===null ? r['2025'] : getPerbandinganBulanValue(r.kode,'2025',bulanIdx);
    const v26 = bulanIdx===null ? r['2026'] : getPerbandinganBulanValue(r.kode,'2026',bulanIdx);
    return `<tr>
      <td class="lvl-${r.depth}">${r.kode}</td>
      <td class="lvl-${r.depth}">${r.nama}</td>
      <td>${fmt(v24)}</td>
      <td>${fmt(v25)}</td>
      <td>${fmt(v26)}</td>
    </tr>`;
  }).join('');
  $('#countPerbandingan').textContent = rows.length + ' akun';
  updatePerbandinganPill();
}

/* ---------------- Filter (Rekening / Bulan / Tahun) ---------------- */
const FILTER_YEARS = ['2024','2025','2026'];

function allAccountsForYear(year){
  const data = STATE.khusus[year];
  return data ? data.rows.slice().sort((a,b)=> a.kode.localeCompare(b.kode, undefined, {numeric:true})) : [];
}

function populateFilterTahun(){
  const sel = $('#filterTahun');
  sel.innerHTML = FILTER_YEARS.map(y=>`<option value="${y}">${y}</option>`).join('');
}

function populateFilterBulan(year){
  const sel = $('#filterBulan');
  const labels = (STATE.khusus[year] && STATE.khusus[year].bulan_label) || [];
  const opts = ['<option value="ALL">Semua Bulan (lihat tren setahun)</option>']
    .concat(labels.map((m,i)=>`<option value="${i}">${m} ${year}</option>`));
  sel.innerHTML = opts.join('');
}

function populateFilterRekening(year, keepKode){
  const sel = $('#filterRekening');
  const accounts = allAccountsForYear(year);
  sel.innerHTML = accounts.map(a=>`<option value="${a.kode}">${a.kode} — ${a.nama}</option>`).join('');
  if(keepKode && accounts.some(a=>a.kode===keepKode)) sel.value = keepKode;
}

function renderFilterResult(){
  const year = $('#filterTahun').value;
  const bulanVal = $('#filterBulan').value;
  const kode = $('#filterRekening').value;
  const wrap = $('#filterResult');
  const data = STATE.khusus[year];
  const row = data ? data.rows.find(r=>r.kode===kode) : null;

  if(!row){
    wrap.innerHTML = '<div class="filter-empty">Data tidak ditemukan untuk kombinasi ini.</div>';
    return;
  }

  if(bulanVal === 'ALL'){
    const labels = data.bulan_label;
    wrap.innerHTML = `
      <div class="filter-stat">
        <div class="big-card">
          <div class="lbl">${row.kode} — ${row.nama}</div>
          <div class="val">Rp ${fmt(row.total)}</div>
          <div class="sub">Total SPJ Bulan Ini, akumulasi ${labels[0]}–${labels[labels.length-1]} ${year}</div>
        </div>
      </div>
      <div class="chart-wrap" style="height:240px;margin-top:14px;"><canvas id="filterChart"></canvas></div>
      <table class="subtable" style="margin-top:14px;">
        <thead><tr>${labels.map(m=>`<th>${m}</th>`).join('')}</tr></thead>
        <tbody><tr>${row.bulanan.map(v=>`<td>${fmt(v)}</td>`).join('')}</tr></tbody>
      </table>
    `;
    renderFilterChart(labels, row.bulanan);
    return;
  }

  const idx = parseInt(bulanVal, 10);
  const label = data.bulan_label[idx];
  const value = row.bulanan[idx];

  const compareValues = FILTER_YEARS.map(y=>{
    const yd = STATE.khusus[y];
    const yr = yd ? yd.rows.find(r=>r.kode===kode) : null;
    const yIdx = yd ? yd.bulan_label.indexOf(label) : -1;
    return (yr && yIdx > -1) ? yr.bulanan[yIdx] : null;
  });

  const compareHtml = FILTER_YEARS.map((y,i)=>{
    const v = compareValues[i];
    const has = v !== null;
    return `<div class="yr-box ${has?'':'dim'} ${y===year?'current':''}"><b>${label} ${y}</b><span>${has ? 'Rp '+fmt(v) : '-'}</span></div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="filter-stat">
      <div class="big-card">
        <div class="lbl">${row.kode} — ${row.nama}</div>
        <div class="val">Rp ${fmt(value)}</div>
        <div class="sub">Total SPJ Bulan Ini — ${label} ${year}</div>
      </div>
    </div>
    <div class="chart-wrap" style="height:230px;margin-top:14px;"><canvas id="filterCompareChart"></canvas></div>
    <div class="filter-compare">${compareHtml}</div>
  `;
  renderFilterCompareChart(label, year, compareValues);
}

let filterChartInstance;
const lineShadowPlugin = {
  id: 'lineShadow3d',
  beforeDatasetsDraw(chart){
    const {ctx} = chart;
    ctx.save();
    ctx.shadowColor = 'rgba(79,99,210,0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 10;
  },
  afterDatasetsDraw(chart){
    chart.ctx.restore();
  }
};

// Efek "3D": karena garis sekarang lurus per-segmen (tension:0, bukan melengkung),
// tiap segmen digambar sebagai dinding/pita (parallelogram) yang diekstrusi ke
// bawah-kanan (mirip grafik 3-D Line di Excel), lalu titik data dikasih highlight
// radial di sudut kiri-atas supaya terlihat seperti bulatan kaca/glossy 3D --
// bukan cuma titik datar. Ini dikombinasikan dgn lineShadowPlugin (drop-shadow
// di garis utama) supaya garis terasa "melayang" di atas pita ekstrusinya.
const ribbon3dPlugin = {
  id: 'ribbon3d',
  beforeDatasetsDraw(chart){
    const meta = chart.getDatasetMeta(0);
    if(!meta || !meta.data || meta.data.length < 2) return;
    const points = meta.data;
    const ds = chart.data.datasets[0];
    const base = (ds && ds.borderColor) || '#5b8def';
    const depthX = 7, depthY = 12;
    const {ctx} = chart;
    ctx.save();
    for(let i = 0; i < points.length - 1; i++){
      const p0 = points[i], p1 = points[i+1];
      const grad = ctx.createLinearGradient(p0.x, p0.y, p0.x, p0.y + depthY);
      grad.addColorStop(0, hexA(base, 0.55));
      grad.addColorStop(1, hexA(base, 0.08));
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x + depthX, p1.y + depthY);
      ctx.lineTo(p0.x + depthX, p0.y + depthY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  },
  afterDatasetsDraw(chart){
    const meta = chart.getDatasetMeta(0);
    if(!meta || !meta.data) return;
    const {ctx} = chart;
    ctx.save();
    meta.data.forEach(p=>{
      const r = (p.options && p.options.radius) || 4;
      const grad = ctx.createRadialGradient(p.x - r*0.35, p.y - r*0.35, 0.4, p.x, p.y, r*1.3);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.15)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, r*1.3, 0, Math.PI*2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    ctx.restore();
  }
};

function renderFilterChart(labels, values){
  const canvas = $('#filterChart');
  if(!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(91,141,239,0.48)');
  gradient.addColorStop(1, 'rgba(91,141,239,0.02)');
  if(filterChartInstance) filterChartInstance.destroy();
  filterChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#5b8def',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0,
        pointRadius: 4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#5b8def',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: {padding: {bottom: 12, right: 8}},
      plugins: {
        legend: {display: false},
        tooltip: {callbacks: {label: c => 'Rp ' + fmt(c.parsed.y)}}
      },
      scales: {
        y: {ticks: {callback: v => (v/1e6).toFixed(0)+'jt'}, grid: {color:'#eef0fb'}},
        x: {grid: {display:false}}
      }
    },
    plugins: [ribbon3dPlugin, lineShadowPlugin]
  });
}

let filterCompareChartInstance;
const barShadowPlugin = {
  id: 'barShadow3d',
  beforeDatasetsDraw(chart){
    const {ctx} = chart;
    ctx.save();
    ctx.shadowColor = 'rgba(31,41,71,0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 8;
  },
  afterDatasetsDraw(chart){
    chart.ctx.restore();
  }
};

function renderFilterCompareChart(label, currentYear, values){
  const canvas = $('#filterCompareChart');
  if(!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;

  const colors = [
    {top:'#a9c4f5', bottom:'#7ba4ef'}, // 2024 (biru muda)
    {top:'#8fb3ff', bottom:'#5b8def'}, // 2025 (biru sedang)
    {top:'#5b8def', bottom:'#3566d6'}, // 2026 (biru tua)
  ];
  const backgrounds = FILTER_YEARS.map((y,i)=>{
    const g = ctx.createLinearGradient(0, 0, 0, 230);
    const c = colors[i];
    const dim = y !== currentYear;
    g.addColorStop(0, dim ? hexA(c.top,0.35) : c.top);
    g.addColorStop(1, dim ? hexA(c.bottom,0.35) : c.bottom);
    return g;
  });

  if(filterCompareChartInstance) filterCompareChartInstance.destroy();
  filterCompareChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: FILTER_YEARS.map(y => label + ' ' + y),
      datasets: [{
        data: values,
        backgroundColor: backgrounds,
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 70,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {display:false},
        tooltip: {callbacks: {label: c => 'Rp ' + fmt(c.parsed.y)}}
      },
      scales: {
        y: {ticks: {callback: v => (v/1e6).toFixed(0)+'jt'}, grid: {color:'#eef0fb'}},
        x: {grid: {display:false}}
      }
    },
    plugins: [barShadowPlugin]
  });
}

function hexA(hex, alpha){
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function initFilter(){
  populateFilterTahun();
  $('#filterTahun').value = '2026';
  populateFilterBulan('2026');
  populateFilterRekening('2026');
  renderFilterResult();

  $('#filterTahun').addEventListener('change', ()=>{
    const year = $('#filterTahun').value;
    const keepKode = $('#filterRekening').value;
    populateFilterBulan(year);
    populateFilterRekening(year, keepKode);
    renderFilterResult();
  });
  $('#filterBulan').addEventListener('change', renderFilterResult);
  $('#filterRekening').addEventListener('change', renderFilterResult);
}

/* ---------------- Khusus per tahun ---------------- */
function renderKhusus(year){
  const data = STATE.khusus[year];
  const theadRow = $(`#tblKhusus${year} thead tr`);
  theadRow.innerHTML = '<th>Kode</th><th>Nama Rekening</th>' + data.bulan_label.map(m=>`<th>${m}</th>`).join('') + '<th>Total</th>';
  const tbody = $(`#tblKhusus${year} tbody`);
  const q = ($(`#searchKhusus${year}`).value||'').toLowerCase();
  const rows = data.rows.filter(r=>r.nama.toLowerCase().includes(q) || r.kode.includes(q));
  tbody.innerHTML = rows.map(r=>`<tr data-kode="${r.kode}" data-nama="${r.nama.replace(/"/g,'&quot;')}" data-year="${year}" title="Klik untuk lihat rincian transaksi BKU ${year}">
      <td class="lvl-${r.depth}">${r.kode}</td>
      <td class="lvl-${r.depth}">${r.nama}</td>
      ${r.bulanan.map(v=>`<td>${fmt(v)}</td>`).join('')}
      <td><b>${fmt(r.total)}</b></td>
    </tr>`).join('');
  $(`#countKhusus${year}`).textContent = rows.length + ' akun';
  tbody.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', ()=> openBkuModal(tr.dataset.year, tr.dataset.kode, tr.dataset.nama));
  });
}

/* ---------------- Detail Transaksi BKU (drill-down) ---------------- */
let BKU_STATE = { rows: [], year: null, kode: null, nama: null };

function openBkuModal(year, kode, nama){
  BKU_STATE = { rows: [], year, kode, nama };
  $('#bkuModalTitle').textContent = nama || kode;
  $('#bkuModalSub').textContent = `Kode Rekening ${kode} — BKU Tahun ${year}`;
  $('#bkuFilterTanggalFrom').value = '';
  $('#bkuFilterTanggalTo').value = '';
  // PENTING: kunci rentang date-picker ke tahun BKU yang sedang dibuka. Tanpa ini,
  // browser date-picker default membuka bulan berjalan (tahun sekarang) -- kalau
  // BKU yang dibuka tahun 2024 tapi user pilih tanggal di kalender yang defaultnya
  // nongol tahun 2026, hasilnya selalu "0 dari N transaksi" dan kelihatan seperti
  // filter tanggal rusak/tidak berefek, padahal filternya benar, cuma rentang
  // tanggalnya di luar tahun datanya. Ini akar masalah "0 dari 277 transaksi" yang
  // pernah dilaporkan.
  $('#bkuFilterTanggalFrom').min = `${year}-01-01`;
  $('#bkuFilterTanggalFrom').max = `${year}-12-31`;
  $('#bkuFilterTanggalTo').min = `${year}-01-01`;
  $('#bkuFilterTanggalTo').max = `${year}-12-31`;
  $('#bkuModalBody').innerHTML = '<div class="bku-status">Memuat data transaksi dari BKU '+year+'...</div>';
  $('#bkuModal').classList.add('active');
  fetchBkuTransaksi(year, kode);
}

function closeBkuModal(){
  $('#bkuModal').classList.remove('active');
}

async function fetchBkuTransaksi(year, kode){
  if(!window.APPS_SCRIPT_URL){
    $('#bkuModalBody').innerHTML = '<div class="bku-status bku-error">Data live belum tersambung (APPS_SCRIPT_URL kosong di config.js). Rincian transaksi BKU memerlukan koneksi live ke Google Sheet — lihat PANDUAN_DEPLOY.md.</div>';
    return;
  }
  try{
    const url = `${APPS_SCRIPT_URL}?view=bku&tahun=${encodeURIComponent(year)}&kode=${encodeURIComponent(kode)}`;
    const res = await fetch(url, {method:'GET'});
    if(!res.ok) throw new Error('bad status ' + res.status);
    const json = await res.json();
    if(json.error) throw new Error(json.error);
    BKU_STATE.rows = json.rows || [];
    renderBkuTable();
  }catch(err){
    console.warn('Gagal memuat transaksi BKU:', err);
    $('#bkuModalBody').innerHTML = '<div class="bku-status bku-error">Gagal memuat data transaksi. Periksa koneksi internet atau coba lagi.<br><small>'+(err.message||err)+'</small></div>';
  }
}

// Parse tanggal format "dd/MM/yyyy" (dari BKU) jadi objek Date, biar bisa
// dibandingkan dengan filter rentang tanggal. Balikin null kalau formatnya
// tidak dikenali (baris tetap disembunyikan kalau filter tanggal aktif).
function parseTanggalDMY(str){
  if(!str) return null;
  const m = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(!m) return null;
  const d = parseInt(m[1],10), mo = parseInt(m[2],10)-1, y = parseInt(m[3],10);
  const dt = new Date(y, mo, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// Dipakai bareng oleh renderBkuTable() dan export Excel, supaya hasil export
// SELALU sama persis dengan yang lagi ditampilkan di tabel (menghormati
// filter tanggal yang lagi aktif) -- bukan hasil ngambil ulang logika terpisah
// yang bisa gampang kebablasan beda kalau salah satunya diubah belakangan.
function getFilteredBkuRows(){
  const fromStr = $('#bkuFilterTanggalFrom').value; // format yyyy-mm-dd dari <input type=date>
  const toStr = $('#bkuFilterTanggalTo').value;
  const dateFrom = fromStr ? new Date(fromStr+'T00:00:00') : null;
  const dateTo = toStr ? new Date(toStr+'T23:59:59') : null;

  return BKU_STATE.rows.filter(r=>{
    if(dateFrom || dateTo){
      const d = parseTanggalDMY(r.tanggal);
      if(!d) return false;
      if(dateFrom && d < dateFrom) return false;
      if(dateTo && d > dateTo) return false;
    }
    return true;
  });
}

function renderBkuTable(){
  const rows = getFilteredBkuRows();

  if(!BKU_STATE.rows.length){
    $('#bkuModalBody').innerHTML = '<div class="bku-status">Tidak ada transaksi ditemukan untuk rekening ini di BKU '+BKU_STATE.year+'.</div>';
    return;
  }

  const total = rows.reduce((s,r)=>s+(r.pengeluaran||0), 0);

  $('#bkuModalBody').innerHTML = `
    <div class="bku-summary">${rows.length} dari ${BKU_STATE.rows.length} transaksi — Total Pengeluaran: <b>Rp ${fmt(total)}</b></div>
    <div class="table-wrap bku-table-wrap">
      <table class="data">
        <thead><tr><th>No</th><th>No Bukti</th><th>Tanggal</th><th>Uraian</th><th>Kode Rekening</th><th>Pengeluaran</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr>
            <td>${r.no}</td>
            <td>${r.no_bukti}</td>
            <td>${r.tanggal}</td>
            <td>${r.uraian}</td>
            <td>${r.kode_rekening}</td>
            <td style="text-align:right">${fmt(r.pengeluaran)}</td>
          </tr>`).join('') || '<tr><td colspan="6" style="text-align:center">Tidak ada hasil untuk filter ini.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// Export hasil transaksi BKU (yang lagi ditampilkan, jadi menghormati filter
// tanggal aktif) ke file .xlsx. Ukuran kertas diset Folio/F4 (8.5" x 13" --
// kode paperSize=14 di standar OOXML, paling dekat dengan F4 215x330mm yang
// umum dipakai di Indonesia), orientasi landscape supaya kolom "Uraian" yang
// panjang tetap muat dibaca.
function exportBkuToExcel(){
  if(typeof XLSX === 'undefined'){
    alert('Library export Excel gagal dimuat. Coba muat ulang halaman.');
    return;
  }
  const rows = getFilteredBkuRows();
  if(!rows.length){
    alert('Tidak ada data untuk diexport (cek filter tanggal).');
    return;
  }

  const judul = `${BKU_STATE.nama || BKU_STATE.kode} — Kode Rekening ${BKU_STATE.kode} — BKU Tahun ${BKU_STATE.year}`;
  const fromStr = $('#bkuFilterTanggalFrom').value;
  const toStr = $('#bkuFilterTanggalTo').value;
  const keteranganFilter = (fromStr || toStr)
    ? `Filter tanggal: ${fromStr || '...'} s.d. ${toStr || '...'}`
    : 'Tanpa filter tanggal (semua transaksi)';
  const total = rows.reduce((s,r)=>s+(r.pengeluaran||0), 0);

  const header = ['No','No Bukti','Tanggal','Uraian','Kode Rekening','Pengeluaran'];
  const body = rows.map(r => [r.no, r.no_bukti, r.tanggal, r.uraian, r.kode_rekening, r.pengeluaran]);
  const aoa = [
    [judul], [keteranganFilter], [],
    header,
    ...body,
    [], ['', '', '', '', 'Total', total],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    {wch:6}, {wch:20}, {wch:12}, {wch:55}, {wch:20}, {wch:18},
  ];
  ws['!merges'] = [
    {s:{r:0,c:0}, e:{r:0,c:5}},
    {s:{r:1,c:0}, e:{r:1,c:5}},
  ];
  // Format kolom Pengeluaran (kolom ke-6 / index 5) sebagai angka ribuan.
  for(let i = 0; i < body.length; i++){
    const cellRef = XLSX.utils.encode_cell({r: 4 + i, c: 5});
    if(ws[cellRef]) ws[cellRef].z = '#,##0';
  }
  const totalCellRef = XLSX.utils.encode_cell({r: 4 + body.length + 1, c: 5});
  if(ws[totalCellRef]) ws[totalCellRef].z = '#,##0';

  // Ukuran kertas Folio/F4 + landscape, supaya kalau dicetak langsung pas.
  ws['!pageSetup'] = { paperSize: 14, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
  ws['!margins'] = { left:0.4, right:0.4, top:0.5, bottom:0.5, header:0.2, footer:0.2 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BKU ' + BKU_STATE.year);

  const namaFile = `BKU_${BKU_STATE.year}_${(BKU_STATE.kode||'').replace(/\./g,'-')}.xlsx`;
  XLSX.writeFile(wb, namaFile);
}

function initBkuModal(){
  $('#bkuModalClose').addEventListener('click', closeBkuModal);
  $('#bkuModal').addEventListener('click', (e)=>{ if(e.target.id === 'bkuModal') closeBkuModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeBkuModal(); });
  $('#bkuFilterTanggalFrom').addEventListener('input', renderBkuTable);
  $('#bkuFilterTanggalFrom').addEventListener('change', renderBkuTable);
  $('#bkuFilterTanggalTo').addEventListener('input', renderBkuTable);
  $('#bkuFilterTanggalTo').addEventListener('change', renderBkuTable);
  $('#bkuFilterTanggalClear').addEventListener('click', ()=>{
    $('#bkuFilterTanggalFrom').value = '';
    $('#bkuFilterTanggalTo').value = '';
    renderBkuTable();
  });
  $('#bkuExportExcel').addEventListener('click', exportBkuToExcel);
}

/* ---------------- Nav ---------------- */
function showView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $$('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.view===name));
  location.hash = name;
  if(name==='tren') setTimeout(renderTren, 30);
}

function initNav(){
  $$('.nav-item').forEach(item=>{
    item.addEventListener('click', ()=>showView(item.dataset.view));
  });
  const initial = (location.hash||'#ringkasan').slice(1);
  showView(['ringkasan','tren','perbandingan','filter','2024','2025','2026'].includes(initial) ? initial : 'ringkasan');
}

async function main(){
  updateLiveBadge();
  renderRingkasan();
  populatePerbandinganBulan();
  renderPerbandingan();
  ['2024','2025','2026'].forEach(renderKhusus);
  initFilter();
  initNav();
  initBkuModal();
  $('#searchPerbandingan').addEventListener('input', renderPerbandingan);
  $('#filterBulanPerbandingan').addEventListener('change', (e)=>{
    const v = e.target.value;
    PERBANDINGAN_BULAN_SEL = v === '' ? null : parseInt(v, 10);
    renderPerbandingan();
  });
  ['2024','2025','2026'].forEach(y=>{
    $(`#searchKhusus${y}`).addEventListener('input', ()=>renderKhusus(y));
  });
  $('#btnRefresh').addEventListener('click', async ()=>{
    await tryLoadLive();
    renderRingkasan();
    if($('#view-tren').classList.contains('active')) renderTren();
    await loadKomponenBelanja();
    renderRingkasan();
    await loadKhususLive();
    refreshKhususDependentViews_();
  });
  await tryLoadLive();
  renderRingkasan();
  // Dimuat terpisah (bukan diblok bareng ringkasan/tren) supaya kartu ringkasan
  // sudah kelihatan duluan; grafik donat menyusul begitu datanya siap.
  loadKomponenBelanja().then(renderRingkasan);
  // Sama halnya: Filter/Perbandingan/Khusus Tahun sudah tampil duluan dari
  // snapshot data.js, lalu diam-diam diganti live begitu ?view=khusus selesai
  // dimuat -- tidak memblokir tampilan awal.
  loadKhususLive().then(refreshKhususDependentViews_);
}

// Re-render 3 halaman yang bergantung pada STATE.khusus/STATE.perbandingan,
// dipanggil setelah loadKhususLive() selesai (baik dari main() maupun tombol
// refresh). Dropdown bulan & rekening di halaman Filter juga di-refresh (bukan
// cuma tabelnya) karena cakupan bulan/akun live bisa beda dari snapshot --
// tapi pilihan tahun & rekening yang sedang aktif tetap dipertahankan kalau
// masih valid.
function refreshKhususDependentViews_(){
  renderPerbandingan();
  ['2024','2025','2026'].forEach(renderKhusus);
  const curYear = $('#filterTahun').value || '2026';
  const curKode = $('#filterRekening').value;
  populateFilterBulan(curYear);
  populateFilterRekening(curYear, curKode);
  renderFilterResult();
}

document.addEventListener('DOMContentLoaded', main);
