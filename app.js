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
    if(json.khusus.tanggal_terakhir) STATE.tanggal_terakhir = json.khusus.tanggal_terakhir;
    updateDataPerBadge_();
  }catch(err){
    console.warn('Gagal memuat pohon akun (khusus) live, tetap pakai data snapshot:', err);
  }
}

// "Data per <tanggal>" -- badge di sebelah tombol Sync yang menunjukkan tanggal
// transaksi BKU TERAKHIR (bukan tanggal sync-nya) supaya pengguna tahu seberapa
// mutakhir data yang sedang ditampilkan, terlepas dari kapan terakhir tombol Sync
// diklik. Sumbernya STATE.tanggal_terakhir/STATE_P.tanggal_terakhir, diisi oleh
// loadKhususLive()/loadKhususLivePendapatan() di atas (dihitung backend dari kolom
// Tanggal di BKU Belanja/Pendapatan -- lihat getKhususDataAll_/getKhususDataPendapatanAll_
// di Code.gs). Formatnya "10 Agustus 2026", pakai MONTH_FULL_ yang sudah ada.
function formatTanggalPanjang_(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  const bulanAbbr = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][d.getMonth()];
  const bulanFull = MONTH_FULL_[bulanAbbr] || bulanAbbr;
  return `${d.getDate()} ${bulanFull} ${d.getFullYear()}`;
}
function updateDataPerBadge_(){
  const el = $('#dataPerBadge');
  if(el){
    const txt = formatTanggalPanjang_(STATE.tanggal_terakhir);
    el.textContent = txt ? `Data per ${txt}` : '';
    el.style.display = txt ? '' : 'none';
  }
  updateDataPerBadgeG_();
}
function updateDataPerBadgeP_(){
  const el = $('#dataPerBadgeP');
  if(el){
    const txt = formatTanggalPanjang_(STATE_P.tanggal_terakhir);
    el.textContent = txt ? `Data per ${txt}` : '';
    el.style.display = txt ? '' : 'none';
  }
  updateDataPerBadgeG_();
}
// Halaman Gabungan (Pendapatan & Belanja) tidak punya tanggal live sendiri --
// cuma menampilkan ULANG kedua tanggal (Belanja & Pendapatan) yang sudah dihitung
// oleh updateDataPerBadge_()/updateDataPerBadgeP_() di atas, supaya user yang
// buka halaman Gabungan bisa lihat status kemutakhiran kedua sumber sekaligus
// tanpa harus pindah ke halaman Belanja/Pendapatan satu-satu.
function updateDataPerBadgeG_(){
  const elB = $('#dataPerBadgeGBelanja');
  if(elB){
    const txt = formatTanggalPanjang_(STATE.tanggal_terakhir);
    elB.textContent = txt ? `Belanja per ${txt}` : '';
    elB.style.display = txt ? '' : 'none';
  }
  const elP = $('#dataPerBadgeGPendapatan');
  if(elP){
    const txt = formatTanggalPanjang_(STATE_P.tanggal_terakhir);
    elP.textContent = txt ? `Pendapatan per ${txt}` : '';
    elP.style.display = txt ? '' : 'none';
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
        if(String(r.kode) === '5') { byYear[y].total = rec; byYear[y].label_bulan = r.label_bulan || (STATE.ringkasan[y] ? STATE.ringkasan[y].label_bulan : ''); }
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
// Nama bulan lengkap untuk label header "— Desember 2024 / Desember 2025 / ...".
// Sebelumnya teks ini HARDCODE statis di index.html ("...Juli 2026") dan tidak
// pernah ikut ter-update meski data live sudah menunjukkan bulan lebih baru --
// beda dari kartu KPI di bawahnya yang sudah pakai d.label_bulan (live). Sekarang
// disamakan: dibangun ulang dari STATE.ringkasan[y].label_bulan tiap render,
// jadi otomatis ikut maju ke Sep/Okt/.../Des 2026 begitu data live bertambah,
// tanpa perlu ubah kode lagi.
const MONTH_FULL_ = {Jan:'Januari',Feb:'Februari',Mar:'Maret',Apr:'April',Mei:'Mei',Jun:'Juni',Jul:'Juli',Ags:'Agustus',Sep:'September',Okt:'Oktober',Nov:'November',Des:'Desember'};
function updateRingkasanPeriodeLabel_(){
  const el = document.getElementById('ringkasanPeriodeLabel');
  if(!el) return;
  const parts = ['2024','2025','2026'].map(y=>{
    const d = STATE.ringkasan[y];
    const lb = d && d.label_bulan;
    const full = lb ? (MONTH_FULL_[lb] || lb) : '';
    return full ? `${full} ${y}` : null;
  }).filter(Boolean);
  if(parts.length) el.textContent = '— ' + parts.join(' / ');
}

function renderRingkasan(){
  updateRingkasanPeriodeLabel_();
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

/* ---------------- Plugin label persentase naik/turun (dipakai grafik Tren & Filter) ---------------- */
// pctChangeLinePlugin: untuk grafik GARIS. Di tiap titik (kecuali titik pertama
// tiap dataset), hitung %perubahan vs titik SEBELUMNYA pada dataset yang sama,
// lalu tulis teksnya tepat di atas titik tsb (warna hijau kalau naik, merah
// kalau turun). Dipakai baik untuk 1 garis (mis. #filterChart) maupun 2 garis
// sekaligus (mis. #trenRangeChart, rentang A vs B) -- masing2 garis dihitung
// independen terhadap dirinya sendiri (bukan dibandingkan silang ke garis lain).
function pctChangeColor_(pct){
  return pct >= 0 ? '#1f9d55' : '#e0483e';
}
function pctChangeText_(pct){
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}
const pctChangeLinePlugin = {
  id: 'pctChangeLine',
  afterDatasetsDraw(chart){
    const {ctx} = chart;
    ctx.save();
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    chart.data.datasets.forEach((ds, dsIndex)=>{
      const meta = chart.getDatasetMeta(dsIndex);
      if(!meta || meta.hidden || !meta.data) return;
      const values = ds.data;
      meta.data.forEach((point, i)=>{
        if(i === 0) return;
        const prev = values[i-1], cur = values[i];
        if(prev === null || prev === undefined || cur === null || cur === undefined || prev === 0) return;
        const pct = (cur - prev) / Math.abs(prev) * 100;
        ctx.fillStyle = pctChangeColor_(pct);
        ctx.fillText(pctChangeText_(pct), point.x, point.y - 10);
      });
    });
    ctx.restore();
  }
};

// pctChangeBarPlugin: untuk grafik BATANG dengan 1 dataset (mis. perbandingan
// bulan yang sama antar tahun). Di antara SETIAP 2 bar yang berdekatan, hitung
// %perubahan bar kanan vs bar kiri, lalu tulis di titik tengah (x) pada
// ketinggian bar tertinggi di antara keduanya, dengan pil/background lembut
// supaya tetap terbaca di atas warna bar manapun.
const pctChangeBarPlugin = {
  id: 'pctChangeBar',
  afterDatasetsDraw(chart){
    const meta = chart.getDatasetMeta(0);
    if(!meta || !meta.data || meta.data.length < 2) return;
    const values = chart.data.datasets[0].data;
    const {ctx} = chart;
    ctx.save();
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for(let i = 1; i < meta.data.length; i++){
      const prev = values[i-1], cur = values[i];
      if(prev === null || prev === undefined || cur === null || cur === undefined || prev === 0) continue;
      const pct = (cur - prev) / Math.abs(prev) * 100;
      const text = pctChangeText_(pct);
      const p0 = meta.data[i-1], p1 = meta.data[i];
      const midX = (p0.x + p1.x) / 2;
      const topY = Math.min(p0.y, p1.y) - 16;
      const color = pctChangeColor_(pct);
      const w = ctx.measureText(text).width + 12;
      const h = 18;
      ctx.fillStyle = pct >= 0 ? 'rgba(31,157,85,0.14)' : 'rgba(224,72,62,0.14)';
      if(ctx.roundRect){
        ctx.beginPath();
        ctx.roundRect(midX - w/2, topY - h/2, w, h, 9);
        ctx.fill();
      } else {
        ctx.fillRect(midX - w/2, topY - h/2, w, h);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, midX, topY + 1);
    }
    ctx.restore();
  }
};

/* ---------------- Tren ---------------- */
let trenChart;

// Judul kartu ("— Januari 2024 s.d Juli 2026") dan catatan sumber data di footer
// SEBELUMNYA hardcode statis di index.html dan tidak pernah ikut maju walau data
// live sudah bertambah bulan (mis. sudah ada data Agustus, tapi teks masih bilang
// "s.d Juli"). Sekarang dihitung ulang dari STATE.tren setiap kali data berubah,
// jadi otomatis mengikuti bulan terakhir yang benar-benar ada datanya.
function periodeLabelFull_(p){
  const [y,m] = String(p).split('-');
  const short = MONTH_NAMES[parseInt(m,10)-1];
  return `${MONTH_FULL_[short]||short} ${y}`;
}
function periodeLabelShort_(p){
  const [y,m] = String(p).split('-');
  return `${MONTH_NAMES[parseInt(m,10)-1]} ${y}`;
}
function updateTrenMeta_(){
  if(!STATE.tren || !STATE.tren.length) return;
  const periods = STATE.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const first = periods[0], last = periods[periods.length-1];
  const h3span = $('#trenPeriodeLabel');
  if(h3span) h3span.textContent = `— ${periodeLabelFull_(first)} s.d ${periodeLabelFull_(last)}`;
  const footer = $('#footerDataSumber');
  if(footer) footer.textContent = `Data sumber: ${STATE.tren.length} laporan bulanan RSUD dr. R. Soeprapto Cepu, ${periodeLabelShort_(first)}–${periodeLabelShort_(last)}. Lihat catatan metodologi di file Rekap_Belanja_SPJ_2024_2025_2026_v2.xlsx.`;
}

function renderTren(){
  updateTrenMeta_();
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

/* ---- Tren: Perbandingan Rentang Bulan (line chart, mis. Jan-Jun 2024 vs Jan-Jun 2025) ---- */
let trenRangeChart;

function trenAvailableYears_(){
  const years = new Set();
  STATE.tren.forEach(r=>{ if(r.periode) years.add(String(r.periode).slice(0,4)); });
  return Array.from(years).sort();
}

function periodeInRange_(from, to){
  if(!from || !to) return [];
  return STATE.tren.filter(r=> r.periode >= from && r.periode <= to)
    .slice().sort((a,b)=> a.periode.localeCompare(b.periode));
}

function initTrenRangeCompare(){
  const years = trenAvailableYears_();
  const periods = STATE.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const minP = periods[0], maxP = periods[periods.length-1];
  ['trenRangeAFrom','trenRangeATo','trenRangeBFrom','trenRangeBTo'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    if(minP) el.min = minP;
    if(maxP) el.max = maxP;
    el.addEventListener('change', renderTrenRangeCompare);
  });
  // Default: Jan-Jun tahun kedua-terakhir vs Jan-Jun tahun terakhir yang ada datanya
  // (mengikuti contoh permintaan: Jan-Jun tahun lalu vs Jan-Jun tahun ini). Kalau
  // data cuma 1 tahun, kedua rentang default sama (user tinggal ganti manual).
  if(years.length >= 2){
    const yA = years[years.length-2], yB = years[years.length-1];
    $('#trenRangeAFrom').value = `${yA}-01`; $('#trenRangeATo').value = `${yA}-06`;
    $('#trenRangeBFrom').value = `${yB}-01`; $('#trenRangeBTo').value = `${yB}-06`;
  } else if(years.length === 1){
    $('#trenRangeAFrom').value = `${years[0]}-01`; $('#trenRangeATo').value = `${years[0]}-06`;
    $('#trenRangeBFrom').value = `${years[0]}-01`; $('#trenRangeBTo').value = `${years[0]}-06`;
  }
  renderTrenRangeCompare();
}

function renderTrenRangeCompare(){
  const canvas = $('#trenRangeChart');
  const summary = $('#trenRangeSummary');
  if(!canvas || !summary || typeof Chart === 'undefined') return;

  const fromA = $('#trenRangeAFrom').value, toA = $('#trenRangeATo').value;
  const fromB = $('#trenRangeBFrom').value, toB = $('#trenRangeBTo').value;
  const rowsA = periodeInRange_(fromA, toA);
  const rowsB = periodeInRange_(fromB, toB);

  if(!fromA || !toA || !fromB || !toB || fromA > toA || fromB > toB || (!rowsA.length && !rowsB.length)){
    summary.innerHTML = '<div class="filter-empty">Pilih rentang bulan yang valid untuk kedua sisi (A dan B).</div>';
    if(trenRangeChart){ trenRangeChart.destroy(); trenRangeChart = null; }
    return;
  }

  const len = Math.max(rowsA.length, rowsB.length);
  const labels = Array.from({length: len}, (_,i)=>{
    const src = rowsA[i] || rowsB[i];
    return src ? MONTH_NAMES[parseInt(String(src.periode).split('-')[1],10)-1] : ('Bulan ke-'+(i+1));
  });
  const dataA = Array.from({length: len}, (_,i)=> rowsA[i] ? rowsA[i].bulan_ini : null);
  const dataB = Array.from({length: len}, (_,i)=> rowsB[i] ? rowsB[i].bulan_ini : null);

  const totalA = rowsA.reduce((s,r)=>s+r.bulan_ini,0);
  const totalB = rowsB.reduce((s,r)=>s+r.bulan_ini,0);
  const diff = totalA ? ((totalB-totalA)/totalA*100) : null;
  const diffClass = diff===null ? '' : (diff>=0?'pos':'neg');
  const diffText = diff===null ? '-' : (diff>=0?'+':'') + diff.toFixed(1) + '%';

  const labelA = `${periodeLabelShort_(fromA)} – ${periodeLabelShort_(toA)}`;
  const labelB = `${periodeLabelShort_(fromB)} – ${periodeLabelShort_(toB)}`;

  summary.innerHTML = `
    <div class="range-stat"><div class="lbl"><span class="range-dot range-dot-a"></span>Total ${labelA}</div><div class="val">Rp ${fmt(totalA)}</div></div>
    <div class="range-stat"><div class="lbl"><span class="range-dot range-dot-b"></span>Total ${labelB}</div><div class="val">Rp ${fmt(totalB)}</div></div>
    <div class="range-stat diff"><div class="lbl">Selisih B vs A</div><div class="val ${diffClass}">${diffText}</div></div>
  `;

  const ctx = canvas.getContext('2d');
  if(trenRangeChart) trenRangeChart.destroy();
  trenRangeChart = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        {label: labelA, data:dataA, borderColor:'#5b8def', backgroundColor:'rgba(91,141,239,0.12)', tension:0, pointRadius:4, borderWidth:3, spanGaps:true},
        {label: labelB, data:dataB, borderColor:'#2fb8c4', backgroundColor:'rgba(47,184,196,0.12)', tension:0, pointRadius:4, borderWidth:3, spanGaps:true},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      layout:{padding:{top:22}},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[lineShadowPlugin, pctChangeLinePlugin]
  });
}

/* ---- Tren: Perbandingan Bulan yang Sama Antar Tahun (bar chart, mis. Juni 2025 vs Juni 2026) ---- */
let trenSameMonthChart;
let TREN_SAME_MONTH_YEARS_SEL_ = new Set();

function populateTrenSameMonth(){
  const years = trenAvailableYears_();
  const monthSel = $('#trenSameMonthSelect');
  if(!monthSel) return;
  monthSel.innerHTML = MONTH_NAMES.map((m,i)=>`<option value="${i}">${MONTH_FULL_[m]||m}</option>`).join('');

  const periods = STATE.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const lastPeriode = periods[periods.length-1];
  if(lastPeriode) monthSel.value = String(parseInt(String(lastPeriode).split('-')[1],10)-1);

  TREN_SAME_MONTH_YEARS_SEL_ = new Set(years);
  const yearsWrap = $('#trenSameMonthYears');
  yearsWrap.innerHTML = years.map(y=>`
    <label class="year-check-item checked" data-year="${y}">
      <input type="checkbox" value="${y}" checked> ${y}
    </label>
  `).join('');
  yearsWrap.querySelectorAll('.year-check-item').forEach(item=>{
    const cb = item.querySelector('input');
    cb.addEventListener('change', ()=>{
      const y = item.dataset.year;
      if(cb.checked){ TREN_SAME_MONTH_YEARS_SEL_.add(y); item.classList.add('checked'); }
      else{ TREN_SAME_MONTH_YEARS_SEL_.delete(y); item.classList.remove('checked'); }
      renderTrenSameMonthCompare();
    });
  });
  monthSel.addEventListener('change', renderTrenSameMonthCompare);
  renderTrenSameMonthCompare();
}

const TREN_SAME_MONTH_PALETTE_ = [
  {top:'#a9c4f5', bottom:'#7ba4ef'},
  {top:'#8fb3ff', bottom:'#5b8def'},
  {top:'#5b8def', bottom:'#3566d6'},
  {top:'#3566d6', bottom:'#1f3f9e'},
  {top:'#2fb8c4', bottom:'#1f8a93'},
];

function renderTrenSameMonthCompare(){
  const canvas = $('#trenSameMonthChart');
  const monthSel = $('#trenSameMonthSelect');
  if(!canvas || !monthSel || typeof Chart === 'undefined') return;
  const monthIdx = parseInt(monthSel.value, 10);
  const monthNum = String(monthIdx+1).padStart(2,'0');
  const years = trenAvailableYears_().filter(y=>TREN_SAME_MONTH_YEARS_SEL_.has(y));

  const values = years.map(y=>{
    const row = STATE.tren.find(r=>r.periode === `${y}-${monthNum}`);
    return row ? row.bulan_ini : null;
  });

  const ctx = canvas.getContext('2d');
  const backgrounds = years.map((y,i)=>{
    const g = ctx.createLinearGradient(0,0,0,230);
    const c = TREN_SAME_MONTH_PALETTE_[i % TREN_SAME_MONTH_PALETTE_.length];
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    return g;
  });

  if(trenSameMonthChart) trenSameMonthChart.destroy();
  trenSameMonthChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: years.map(y => MONTH_NAMES[monthIdx] + ' ' + y),
      datasets:[{
        data: values,
        backgroundColor: backgrounds,
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 80,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{padding:{top:26}},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=> c.parsed.y===null ? 'Tidak ada data' : 'Rp ' + fmt(c.parsed.y)}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[barShadowPlugin, pctChangeBarPlugin]
  });
}

// Dropdown/checkbox rentang & bulan-sama cukup dibangun sekali (biar pilihan
// user tidak ke-reset tiap pindah halaman) -- dipanggil pertama kali halaman
// Tren dibuka. Setelah itu cukup panggil ulang fungsi render-nya saja.
let TREN_EXTRA_INITED_ = false;
function initTrenExtras_(){
  if(TREN_EXTRA_INITED_) return;
  TREN_EXTRA_INITED_ = true;
  initTrenRangeCompare();
  populateTrenSameMonth();
}

/* ---- Tren Pendapatan: Perbandingan Rentang Bulan (line chart) ---- */
let trenRangeChartP;

function trenAvailableYearsP_(){
  const years = new Set();
  STATE_P.tren.forEach(r=>{ if(r.periode) years.add(String(r.periode).slice(0,4)); });
  return Array.from(years).sort();
}

function periodeInRangeP_(from, to){
  if(!from || !to) return [];
  return STATE_P.tren.filter(r=> r.periode >= from && r.periode <= to)
    .slice().sort((a,b)=> a.periode.localeCompare(b.periode));
}

function initTrenRangeCompareP(){
  const years = trenAvailableYearsP_();
  const periods = STATE_P.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const minP = periods[0], maxP = periods[periods.length-1];
  ['trenRangeAFromP','trenRangeAToP','trenRangeBFromP','trenRangeBToP'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    if(minP) el.min = minP;
    if(maxP) el.max = maxP;
    el.addEventListener('change', renderTrenRangeCompareP);
  });
  if(years.length >= 2){
    const yA = years[years.length-2], yB = years[years.length-1];
    $('#trenRangeAFromP').value = `${yA}-01`; $('#trenRangeAToP').value = `${yA}-06`;
    $('#trenRangeBFromP').value = `${yB}-01`; $('#trenRangeBToP').value = `${yB}-06`;
  } else if(years.length === 1){
    $('#trenRangeAFromP').value = `${years[0]}-01`; $('#trenRangeAToP').value = `${years[0]}-06`;
    $('#trenRangeBFromP').value = `${years[0]}-01`; $('#trenRangeBToP').value = `${years[0]}-06`;
  }
  renderTrenRangeCompareP();
}

function renderTrenRangeCompareP(){
  const canvas = $('#trenRangeChartP');
  const summary = $('#trenRangeSummaryP');
  if(!canvas || !summary || typeof Chart === 'undefined') return;

  const fromA = $('#trenRangeAFromP').value, toA = $('#trenRangeAToP').value;
  const fromB = $('#trenRangeBFromP').value, toB = $('#trenRangeBToP').value;
  const rowsA = periodeInRangeP_(fromA, toA);
  const rowsB = periodeInRangeP_(fromB, toB);

  if(!fromA || !toA || !fromB || !toB || fromA > toA || fromB > toB || (!rowsA.length && !rowsB.length)){
    summary.innerHTML = '<div class="filter-empty">Pilih rentang bulan yang valid untuk kedua sisi (A dan B).</div>';
    if(trenRangeChartP){ trenRangeChartP.destroy(); trenRangeChartP = null; }
    return;
  }

  const len = Math.max(rowsA.length, rowsB.length);
  const labels = Array.from({length: len}, (_,i)=>{
    const src = rowsA[i] || rowsB[i];
    return src ? MONTH_NAMES[parseInt(String(src.periode).split('-')[1],10)-1] : ('Bulan ke-'+(i+1));
  });
  const dataA = Array.from({length: len}, (_,i)=> rowsA[i] ? rowsA[i].bulan_ini : null);
  const dataB = Array.from({length: len}, (_,i)=> rowsB[i] ? rowsB[i].bulan_ini : null);

  const totalA = rowsA.reduce((s,r)=>s+r.bulan_ini,0);
  const totalB = rowsB.reduce((s,r)=>s+r.bulan_ini,0);
  const diff = totalA ? ((totalB-totalA)/totalA*100) : null;
  const diffClass = diff===null ? '' : (diff>=0?'pos':'neg');
  const diffText = diff===null ? '-' : (diff>=0?'+':'') + diff.toFixed(1) + '%';

  const labelA = `${periodeLabelShort_(fromA)} – ${periodeLabelShort_(toA)}`;
  const labelB = `${periodeLabelShort_(fromB)} – ${periodeLabelShort_(toB)}`;

  summary.innerHTML = `
    <div class="range-stat"><div class="lbl"><span class="range-dot range-dot-a"></span>Total ${labelA}</div><div class="val">Rp ${fmt(totalA)}</div></div>
    <div class="range-stat"><div class="lbl"><span class="range-dot range-dot-b"></span>Total ${labelB}</div><div class="val">Rp ${fmt(totalB)}</div></div>
    <div class="range-stat diff"><div class="lbl">Selisih B vs A</div><div class="val ${diffClass}">${diffText}</div></div>
  `;

  const ctx = canvas.getContext('2d');
  if(trenRangeChartP) trenRangeChartP.destroy();
  trenRangeChartP = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        {label: labelA, data:dataA, borderColor:'#5b8def', backgroundColor:'rgba(91,141,239,0.12)', tension:0, pointRadius:4, borderWidth:3, spanGaps:true},
        {label: labelB, data:dataB, borderColor:'#2fb8c4', backgroundColor:'rgba(47,184,196,0.12)', tension:0, pointRadius:4, borderWidth:3, spanGaps:true},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      layout:{padding:{top:22}},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[lineShadowPlugin, pctChangeLinePlugin]
  });
}

/* ---- Tren Pendapatan: Perbandingan Bulan yang Sama Antar Tahun (bar chart) ---- */
let trenSameMonthChartP;
let TREN_SAME_MONTH_YEARS_SEL_P_ = new Set();

function populateTrenSameMonthP(){
  const years = trenAvailableYearsP_();
  const monthSel = $('#trenSameMonthSelectP');
  if(!monthSel) return;
  monthSel.innerHTML = MONTH_NAMES.map((m,i)=>`<option value="${i}">${MONTH_FULL_[m]||m}</option>`).join('');

  const periods = STATE_P.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const lastPeriode = periods[periods.length-1];
  if(lastPeriode) monthSel.value = String(parseInt(String(lastPeriode).split('-')[1],10)-1);

  TREN_SAME_MONTH_YEARS_SEL_P_ = new Set(years);
  const yearsWrap = $('#trenSameMonthYearsP');
  yearsWrap.innerHTML = years.map(y=>`
    <label class="year-check-item checked" data-year="${y}">
      <input type="checkbox" value="${y}" checked> ${y}
    </label>
  `).join('');
  yearsWrap.querySelectorAll('.year-check-item').forEach(item=>{
    const cb = item.querySelector('input');
    cb.addEventListener('change', ()=>{
      const y = item.dataset.year;
      if(cb.checked){ TREN_SAME_MONTH_YEARS_SEL_P_.add(y); item.classList.add('checked'); }
      else{ TREN_SAME_MONTH_YEARS_SEL_P_.delete(y); item.classList.remove('checked'); }
      renderTrenSameMonthCompareP();
    });
  });
  monthSel.addEventListener('change', renderTrenSameMonthCompareP);
  renderTrenSameMonthCompareP();
}

function renderTrenSameMonthCompareP(){
  const canvas = $('#trenSameMonthChartP');
  const monthSel = $('#trenSameMonthSelectP');
  if(!canvas || !monthSel || typeof Chart === 'undefined') return;
  const monthIdx = parseInt(monthSel.value, 10);
  const monthNum = String(monthIdx+1).padStart(2,'0');
  const years = trenAvailableYearsP_().filter(y=>TREN_SAME_MONTH_YEARS_SEL_P_.has(y));

  const values = years.map(y=>{
    const row = STATE_P.tren.find(r=>r.periode === `${y}-${monthNum}`);
    return row ? row.bulan_ini : null;
  });

  const ctx = canvas.getContext('2d');
  const backgrounds = years.map((y,i)=>{
    const g = ctx.createLinearGradient(0,0,0,230);
    const c = TREN_SAME_MONTH_PALETTE_[i % TREN_SAME_MONTH_PALETTE_.length];
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    return g;
  });

  if(trenSameMonthChartP) trenSameMonthChartP.destroy();
  trenSameMonthChartP = new Chart(ctx, {
    type:'bar',
    data:{
      labels: years.map(y => MONTH_NAMES[monthIdx] + ' ' + y),
      datasets:[{
        data: values,
        backgroundColor: backgrounds,
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 80,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{padding:{top:26}},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=> c.parsed.y===null ? 'Tidak ada data' : 'Rp ' + fmt(c.parsed.y)}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[barShadowPlugin, pctChangeBarPlugin]
  });
}

let TREN_EXTRA_INITED_P_ = false;
function initTrenExtrasP_(){
  if(TREN_EXTRA_INITED_P_) return;
  TREN_EXTRA_INITED_P_ = true;
  initTrenRangeCompareP();
  populateTrenSameMonthP();
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
      layout: {padding: {bottom: 12, right: 8, top: 22}},
      plugins: {
        legend: {display: false},
        tooltip: {callbacks: {label: c => 'Rp ' + fmt(c.parsed.y)}}
      },
      scales: {
        y: {ticks: {callback: v => (v/1e6).toFixed(0)+'jt'}, grid: {color:'#eef0fb'}},
        x: {grid: {display:false}}
      }
    },
    plugins: [ribbon3dPlugin, lineShadowPlugin, pctChangeLinePlugin]
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
    tr.addEventListener('click', ()=> openBkuModal(tr.dataset.year, tr.dataset.kode, tr.dataset.nama, 'belanja'));
  });
}

/* ---------------- Detail Transaksi BKU (drill-down) ---------------- */
// "modul" membedakan Belanja ('belanja', default -- endpoint ?view=bku, kolom
// Pengeluaran) dari Pendapatan ('pendapatan' -- endpoint ?view=bku_pendapatan,
// kolom Penerimaan). Modal & tabelnya SAMA PERSIS, cuma field & endpoint beda.
let BKU_STATE = { rows: [], year: null, kode: null, nama: null, modul: 'belanja' };

function openBkuModal(year, kode, nama, modul){
  modul = modul || 'belanja';
  BKU_STATE = { rows: [], year, kode, nama, modul };
  $('#bkuModalTitle').textContent = nama || kode;
  $('#bkuModalSub').textContent = `Kode Rekening ${kode} — BKU ${modul==='pendapatan'?'Pendapatan':''} Tahun ${year}`;
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
  fetchBkuTransaksi(year, kode, modul);
}

function closeBkuModal(){
  $('#bkuModal').classList.remove('active');
}

async function fetchBkuTransaksi(year, kode, modul){
  if(!window.APPS_SCRIPT_URL){
    $('#bkuModalBody').innerHTML = '<div class="bku-status bku-error">Data live belum tersambung (APPS_SCRIPT_URL kosong di config.js). Rincian transaksi BKU memerlukan koneksi live ke Google Sheet — lihat PANDUAN_DEPLOY.md.</div>';
    return;
  }
  try{
    const view = modul === 'pendapatan' ? 'bku_pendapatan' : 'bku';
    const url = `${APPS_SCRIPT_URL}?view=${view}&tahun=${encodeURIComponent(year)}&kode=${encodeURIComponent(kode)}`;
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
  const isP = BKU_STATE.modul === 'pendapatan';
  const field = isP ? 'penerimaan' : 'pengeluaran';
  const label = isP ? 'Penerimaan' : 'Pengeluaran';

  if(!BKU_STATE.rows.length){
    $('#bkuModalBody').innerHTML = '<div class="bku-status">Tidak ada transaksi ditemukan untuk rekening ini di BKU '+BKU_STATE.year+'.</div>';
    return;
  }

  const total = rows.reduce((s,r)=>s+(r[field]||0), 0);

  $('#bkuModalBody').innerHTML = `
    <div class="bku-summary">${rows.length} dari ${BKU_STATE.rows.length} transaksi — Total ${label}: <b>Rp ${fmt(total)}</b></div>
    <div class="table-wrap bku-table-wrap">
      <table class="data">
        <thead><tr><th>No</th><th>No Bukti</th><th>Tanggal</th><th>Uraian</th><th>Kode Rekening</th><th>${label}</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr>
            <td>${r.no}</td>
            <td>${r.no_bukti}</td>
            <td>${r.tanggal}</td>
            <td>${r.uraian}</td>
            <td>${r.kode_rekening}</td>
            <td style="text-align:right">${fmt(r[field])}</td>
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

  const isP = BKU_STATE.modul === 'pendapatan';
  const field = isP ? 'penerimaan' : 'pengeluaran';
  const label = isP ? 'Penerimaan' : 'Pengeluaran';
  const judul = `${BKU_STATE.nama || BKU_STATE.kode} — Kode Rekening ${BKU_STATE.kode} — BKU ${isP?'Pendapatan ':''}Tahun ${BKU_STATE.year}`;
  const fromStr = $('#bkuFilterTanggalFrom').value;
  const toStr = $('#bkuFilterTanggalTo').value;
  const keteranganFilter = (fromStr || toStr)
    ? `Filter tanggal: ${fromStr || '...'} s.d. ${toStr || '...'}`
    : 'Tanpa filter tanggal (semua transaksi)';
  const total = rows.reduce((s,r)=>s+(r[field]||0), 0);

  const header = ['No','No Bukti','Tanggal','Uraian','Kode Rekening',label];
  const body = rows.map(r => [r.no, r.no_bukti, r.tanggal, r.uraian, r.kode_rekening, r[field]]);
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

/* ================= MODUL PENDAPATAN ================= */
// Struktur & pola SAMA PERSIS dengan modul Belanja di atas (STATE/renderRingkasan/
// renderTren/renderKhusus/tryLoadLive), tapi namespace terpisah (STATE_P, elemen
// id berakhiran "P") supaya tidak bentrok dengan punya Belanja -- keduanya bisa
// aktif independen. Sumber data: data_pendapatan.js (snapshot REKAP_DATA_PENDAPATAN)
// di-override live oleh endpoint ?view=ringkasan_pendapatan / tren_pendapatan /
// khusus_pendapatan begitu APPS_SCRIPT_URL tersambung.
let STATE_P = {
  ringkasan: (typeof REKAP_DATA_PENDAPATAN !== 'undefined') ? REKAP_DATA_PENDAPATAN.ringkasan : {},
  tren: (typeof REKAP_DATA_PENDAPATAN !== 'undefined') ? REKAP_DATA_PENDAPATAN.tren : [],
  khusus: (typeof REKAP_DATA_PENDAPATAN !== 'undefined') ? REKAP_DATA_PENDAPATAN.khusus : {},
  live: false,
};

function updateLiveBadgeP(){
  const el = $('#liveBadgeP');
  if(!el) return;
  if(STATE_P.live){
    el.innerHTML = '<span class="live-dot"></span>Live dari Google Sheet';
  } else {
    const gen = (typeof REKAP_DATA_PENDAPATAN !== 'undefined' && REKAP_DATA_PENDAPATAN.meta) ? REKAP_DATA_PENDAPATAN.meta.generated : '';
    el.innerHTML = '<span class="live-dot off"></span>Data snapshot ('+gen+')';
  }
}

async function tryLoadLivePendapatan(){
  if(!window.APPS_SCRIPT_URL) return;
  try{
    const res = await fetch(`${APPS_SCRIPT_URL}?view=ringkasan_pendapatan`, {method:'GET'});
    if(!res.ok) throw new Error('bad status ' + res.status);
    const json = await res.json();
    if(json.ringkasan_pendapatan && json.ringkasan_pendapatan.length){
      const byYear = {};
      json.ringkasan_pendapatan.forEach(r=>{
        const y = r.periode;
        if(!byYear[y]) byYear[y] = {breakdown:[]};
        const rec = {kode:String(r.kode), nama:r.nama, pagu:+r.pagu, bulan_ini:+r.bulan_ini, sd_bulan_ini:+r.sd_bulan_ini, persen:+r.persen, sisa_pagu:+r.sisa_pagu};
        if(String(r.kode) === '4') {
          Object.assign(byYear[y], rec);
          // PENTING: rec di atas TIDAK menyertakan label_bulan, jadi harus di-assign
          // terpisah dari r.label_bulan (nilai live) -- kalau tidak, nilai live selalu
          // kebuang dan fallback "pertahankan label lama" di bawah akan selalu jalan
          // (bug lama: header Pendapatan macet di "Juli 2026" walau data live sudah Ags).
          byYear[y].label_bulan = r.label_bulan || (STATE_P.ringkasan[y] ? STATE_P.ringkasan[y].label_bulan : '');
        }
        else byYear[y].breakdown.push(rec);
      });
      // pertahankan label_bulan yg sudah ada kalau live tidak mengirimkannya
      ['2024','2025','2026'].forEach(y=>{
        if(byYear[y] && !byYear[y].label_bulan && STATE_P.ringkasan[y]) byYear[y].label_bulan = STATE_P.ringkasan[y].label_bulan;
      });
      STATE_P.ringkasan = byYear;
    }
  }catch(err){
    console.warn('Live fetch ringkasan Pendapatan gagal, pakai data bawaan:', err);
  }
  try{
    const res2 = await fetch(`${APPS_SCRIPT_URL}?view=tren_pendapatan`, {method:'GET'});
    if(!res2.ok) throw new Error('bad status ' + res2.status);
    const json2 = await res2.json();
    if(json2.tren_pendapatan && json2.tren_pendapatan.length){
      STATE_P.tren = json2.tren_pendapatan.map(r=>({periode: normalizePeriode_(r.periode), bulan_ini:+r.bulan_ini, sd_bulan_ini:+r.sd_bulan_ini, pagu:+r.pagu}))
        .sort((a,b)=> a.periode.localeCompare(b.periode));
    }
    STATE_P.live = true;
  }catch(err){
    console.warn('Live fetch tren Pendapatan gagal, pakai data bawaan:', err);
    STATE_P.live = false;
  }
  updateLiveBadgeP();
}

async function loadKhususLivePendapatan(){
  if(!window.APPS_SCRIPT_URL) return;
  try{
    const res = await fetch(`${APPS_SCRIPT_URL}?view=khusus_pendapatan`, {method:'GET'});
    if(!res.ok) throw new Error('bad status ' + res.status);
    const json = await res.json();
    if(!json.khusus) throw new Error('respons tidak berisi field khusus');
    ['2024','2025','2026'].forEach(y=>{
      const d = json.khusus[y];
      if(d && d.rows && d.rows.length){
        STATE_P.khusus[y] = { bulan_label: d.bulan_label, rows: d.rows };
      }
    });
    if(json.khusus.tanggal_terakhir) STATE_P.tanggal_terakhir = json.khusus.tanggal_terakhir;
    updateDataPerBadgeP_();
  }catch(err){
    console.warn('Gagal memuat pohon akun Pendapatan (khusus) live, tetap pakai data snapshot:', err);
  }
}

function updateRingkasanPeriodeLabelP_(){
  const el = document.getElementById('ringkasanPeriodeLabelP');
  if(!el) return;
  const parts = ['2024','2025','2026'].map(y=>{
    const d = STATE_P.ringkasan[y];
    const lb = d && d.label_bulan;
    const full = lb ? (MONTH_FULL_[lb] || lb) : '';
    return full ? `${full} ${y}` : null;
  }).filter(Boolean);
  if(parts.length) el.textContent = '— ' + parts.join(' / ');
}

const KOMPONEN_WARNA_PENDAPATAN = {
  retribusi: { color:'#5b8def', label:'Retribusi Daerah' },
  blud:       { color:'#f0a35b', label:'Lain-lain PAD (BLUD, dst)' },
};

function renderRingkasanPendapatan(){
  updateRingkasanPeriodeLabelP_();
  const wrap = $('#kpiRowP');
  if(!wrap) return;
  wrap.innerHTML = '';
  ['2024','2025','2026'].forEach(y=>{
    const d = STATE_P.ringkasan[y];
    if(!d || d.pagu === undefined){ return; }
    const pct = d.persen || 0;
    const breakdown = d.breakdown || [];
    const segments = breakdown.map(b=>{
      const key = /4\.1\.02/.test(b.kode) ? 'retribusi' : 'blud';
      return { key, value: b.sd_bulan_ini||0, ...KOMPONEN_WARNA_PENDAPATAN[key] };
    }).filter(s=>s.value>0);
    const segTotal = segments.reduce((s,x)=>s+x.value,0);
    const donutHtml = segTotal ? `
      <div class="komp-donut-wrap">
        ${buildDonutSVG(segments, segTotal)}
        <div class="komp-legend">${segments.map(s=>`
          <div class="komp-legend-item">
            <span class="komp-dot" style="background:${s.color}"></span>
            <span class="komp-legend-label">${s.label}</span>
            <span class="komp-legend-pct">${fmtPct(s.value/segTotal*100)}</span>
          </div>`).join('')}</div>
      </div>` : `
      <table class="subtable">
        <thead><tr><th>Komponen</th><th>SD Bulan Ini</th><th>%</th></tr></thead>
        <tbody>${breakdown.map(b=>`<tr><td>${b.nama}</td><td style="text-align:right">${fmt(b.sd_bulan_ini)}</td><td style="text-align:right">${fmtPct(b.persen)}</td></tr>`).join('')}</tbody>
      </table>`;
    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.innerHTML = `
      <div class="kpi-year"><b>Tahun ${y}</b><small>s.d ${d.label_bulan||''}</small></div>
      <div class="kpi-ring" style="--pct:${Math.min(pct,100)}"><span>${pct.toFixed(1)}%</span></div>
      <div class="kpi-stats">
        <div><span>Target Pendapatan</span><b>Rp ${fmt(d.pagu)}</b></div>
        <div><span>Pendapatan Bulan Ini</span><b>Rp ${fmt(d.bulan_ini)}</b></div>
        <div><span>Pendapatan s.d Bulan Ini</span><b>Rp ${fmt(d.sd_bulan_ini)}</b></div>
        <div><span>Sisa Target</span><b>Rp ${fmt(d.sisa_pagu)}</b></div>
      </div>
      ${donutHtml}
    `;
    wrap.appendChild(card);
  });
}

let trenChartP;
function updateTrenMetaP_(){
  if(!STATE_P.tren || !STATE_P.tren.length) return;
  const periods = STATE_P.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const first = periods[0], last = periods[periods.length-1];
  const h3span = $('#trenPeriodeLabelP');
  if(h3span) h3span.textContent = `— ${periodeLabelFull_(first)} s.d ${periodeLabelFull_(last)}`;
  const footer = $('#footerDataSumberP');
  if(footer) footer.textContent = `Data sumber: ${STATE_P.tren.length} laporan bulanan Pendapatan RSUD dr. R. Soeprapto Cepu, ${periodeLabelShort_(first)}–${periodeLabelShort_(last)}. Lihat catatan metodologi di file Rekap_Pendapatan_2024_2025_2026.xlsx.`;
}

function renderTrenPendapatan(){
  updateTrenMetaP_();
  const canvas = $('#trenChartP');
  if(!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  const labels = STATE_P.tren.map(r=>r.periode);
  const bulanIni = STATE_P.tren.map(r=>r.bulan_ini);
  const sd = STATE_P.tren.map(r=>r.sd_bulan_ini);
  if(trenChartP) trenChartP.destroy();
  trenChartP = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {type:'bar', label:'Pendapatan Bulan Ini', data:bulanIni, backgroundColor:'rgba(240,163,91,0.55)', borderRadius:6, order:2},
        {type:'line', label:'Pendapatan s.d Bulan Ini (kumulatif)', data:sd, borderColor:'#5b8def', backgroundColor:'rgba(91,141,239,0.15)', tension:0, yAxisID:'y1', order:1, pointRadius:2},
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

function renderKhususPendapatan(year){
  const data = STATE_P.khusus[year];
  if(!data) return;
  const theadRow = $(`#tblKhusus${year}P thead tr`);
  theadRow.innerHTML = '<th>Kode</th><th>Nama Rekening</th>' + data.bulan_label.map(m=>`<th>${m}</th>`).join('') + '<th>Total</th>';
  const tbody = $(`#tblKhusus${year}P tbody`);
  const q = ($(`#searchKhusus${year}P`).value||'').toLowerCase();
  const rows = data.rows.filter(r=>r.nama.toLowerCase().includes(q) || r.kode.includes(q));
  tbody.innerHTML = rows.map(r=>`<tr data-kode="${r.kode}" data-nama="${r.nama.replace(/"/g,'&quot;')}" data-year="${year}" title="Klik untuk lihat rincian transaksi BKU Pendapatan ${year}">
      <td class="lvl-${r.depth}">${r.kode}</td>
      <td class="lvl-${r.depth}">${r.nama}</td>
      ${r.bulanan.map(v=>`<td>${fmt(v)}</td>`).join('')}
      <td><b>${fmt(r.total)}</b></td>
    </tr>`).join('');
  $(`#countKhusus${year}P`).textContent = rows.length + ' akun';
  tbody.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', ()=> openBkuModal(tr.dataset.year, tr.dataset.kode, tr.dataset.nama, 'pendapatan'));
  });
}

/* ---- Nav modul Pendapatan (paralel dgn showView/initNav Belanja) ---- */
const YEAR_VIEWS_P = ['2024-p','2025-p','2026-p'];

function showViewP(name){
  const root = $('#appRootPendapatan');
  if(!root) return;
  root.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const target = document.getElementById(`view-${name}`);
  if(target) target.classList.add('active');
  root.querySelectorAll('.nav-item[data-viewp]').forEach(n=>n.classList.toggle('active', n.dataset.viewp===name));
  $('#btnTahunKhususP')?.classList.toggle('active', YEAR_VIEWS_P.includes(name));
  root.querySelectorAll('.year-flyout-item').forEach(b=>b.classList.toggle('active', b.dataset.viewp===name));
  if(name==='tren-p') setTimeout(()=>{ renderTrenPendapatan(); initTrenExtrasP_(); }, 30);
}

function initNavP(){
  const root = $('#appRootPendapatan');
  if(!root) return;
  root.querySelectorAll('.nav-item[data-viewp]').forEach(item=>{
    item.addEventListener('click', ()=>showViewP(item.dataset.viewp));
  });
  root.querySelectorAll('.year-flyout-item').forEach(item=>{
    item.addEventListener('click', e=>{
      e.stopPropagation();
      showViewP(item.dataset.viewp);
      closeYearFlyoutP_();
    });
  });
  showViewP('ringkasan-p');
}

function closeYearFlyoutP_(){
  const flyout = $('#yearFlyoutP'), btn = $('#btnTahunKhususP'), root = $('#appRootPendapatan');
  flyout?.classList.remove('open'); btn?.classList.remove('flyout-open');
  root?.classList.remove('yearflyout-open');
}

function initYearMenuP(){
  const btn = $('#btnTahunKhususP');
  const flyout = $('#yearFlyoutP');
  if(!btn || !flyout) return;
  const root = $('#appRootPendapatan');
  const openFlyout = ()=>{ flyout.classList.add('open'); btn.classList.add('flyout-open'); root?.classList.add('yearflyout-open'); };
  btn.addEventListener('click', e=>{
    e.stopPropagation();
    flyout.classList.contains('open') ? closeYearFlyoutP_() : openFlyout();
  });
  document.addEventListener('click', e=>{ if(!btn.contains(e.target)) closeYearFlyoutP_(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeYearFlyoutP_(); });
}

function showPendapatanApp(){
  $('#hubScreen').style.display = 'none';
  $('#comingSoonScreen').style.display = 'none';
  $('#appRoot').style.display = 'none';
  $('#appRootPendapatan').style.display = 'flex';
  const rootG_ = $('#appRootGabungan'); if(rootG_) rootG_.style.display = 'none';
}

/* ---------------- Nav ---------------- */
const YEAR_VIEWS = ['2024','2025','2026'];

function showView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $$('.nav-item[data-view]').forEach(n=>n.classList.toggle('active', n.dataset.view===name));
  // Tombol "Tahun Khusus" (gabungan 24/25/26) aktif kalau view saat ini salah satu tahun
  $('#btnTahunKhusus')?.classList.toggle('active', YEAR_VIEWS.includes(name));
  $$('.year-flyout-item').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  location.hash = name;
  if(name==='tren') setTimeout(()=>{ renderTren(); initTrenExtras_(); }, 30);
}

function initNav(){
  $$('.nav-item[data-view]').forEach(item=>{
    item.addEventListener('click', ()=>showView(item.dataset.view));
  });
  const initial = (location.hash||'#ringkasan').slice(1);
  showView(['ringkasan','tren','perbandingan','filter',...YEAR_VIEWS].includes(initial) ? initial : 'ringkasan');
}

/* ---------------- Menu "Tahun Khusus" (flyout 2024/2025/2026) ---------------- */
function initYearMenu(){
  const btn = $('#btnTahunKhusus');
  const flyout = $('#yearFlyout');
  if(!btn || !flyout) return;

  const appRoot = $('.app');
  const closeFlyout = ()=>{
    flyout.classList.remove('open'); btn.classList.remove('flyout-open');
    appRoot?.classList.remove('yearflyout-open');
  };
  const openFlyout  = ()=>{
    flyout.classList.add('open'); btn.classList.add('flyout-open');
    appRoot?.classList.add('yearflyout-open');
  };

  btn.addEventListener('click', e=>{
    e.stopPropagation();
    flyout.classList.contains('open') ? closeFlyout() : openFlyout();
  });

  $$('.year-flyout-item').forEach(item=>{
    item.addEventListener('click', e=>{
      e.stopPropagation();
      showView(item.dataset.view);
      closeFlyout();
    });
  });

  document.addEventListener('click', e=>{ if(!btn.contains(e.target)) closeFlyout(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeFlyout(); });
}

/* ---------------- Menu Utama (Hub: Belanja / Pendapatan / Gabungan) ---------------- */
// Struktur halaman sekarang: authOverlay (gerbang password) -> hubScreen (menu
// pilihan modul) -> appRoot (dashboard Belanja yang sudah ada). Pendapatan dan
// gabungan Pendapatan+Belanja belum ada sumber datanya, jadi untuk saat ini
// keduanya mengarah ke comingSoonScreen ("Segera Hadir") yang sama, teksnya
// tinggal diganti sesuai modul yang diklik.
function showHub(){
  $('#hubScreen').style.display = 'flex';
  $('#comingSoonScreen').style.display = 'none';
  $('#appRoot').style.display = 'none';
  $('#appRootPendapatan').style.display = 'none';
  const rootG_ = $('#appRootGabungan'); if(rootG_) rootG_.style.display = 'none';
}

function showComingSoon(title, desc){
  $('#comingSoonTitle').textContent = title;
  $('#comingSoonDesc').textContent = desc;
  $('#hubScreen').style.display = 'none';
  $('#comingSoonScreen').style.display = 'flex';
  $('#appRoot').style.display = 'none';
  $('#appRootPendapatan').style.display = 'none';
  const rootG_ = $('#appRootGabungan'); if(rootG_) rootG_.style.display = 'none';
}

function showBelanjaApp(){
  $('#hubScreen').style.display = 'none';
  $('#comingSoonScreen').style.display = 'none';
  $('#appRoot').style.display = 'flex';
  $('#appRootPendapatan').style.display = 'none';
  const rootG_ = $('#appRootGabungan'); if(rootG_) rootG_.style.display = 'none';
}

// Modul Gabungan tidak punya sumber data sendiri -- cuma menggabungkan STATE.tren
// (Belanja) & STATE_P.tren (Pendapatan) yang sudah dimuat modul lain. Grafiknya
// baru di-render saat modul ini pertama kali dibuka (bukan dari main()) karena
// canvas Chart.js butuh ukuran non-nol saat dibuat -- kalau di-render lebih dulu
// sementara appRootGabungan masih display:none, grafiknya akan kosong/gepeng.
//
// PENTING (bug ditemukan setelah deploy): showView() milik modul Belanja pakai
// $$('.view') -- selector GLOBAL ke seluruh dokumen, bukan cuma di dalam
// #appRoot. Jadi begitu halaman dimuat (initNav() -> showView('ringkasan')),
// class "active" ikut DICABUT dari section #view-tren-g milik modul Gabungan
// ini (sama-sama pakai class .view), padahal section itu sudah di-hardcode
// class="view active" di HTML. Akibatnya section-nya ketutup CSS (.view tanpa
// .active = display:none) walau HTML & data-nya sudah benar -- makanya cuma
// judul & footer (di luar section) yang kelihatan, isi card & grafik kosong.
// Fix: pastikan class "active" ditambahkan ulang setiap kali modul ini dibuka.
function showGabunganApp(){
  $('#hubScreen').style.display = 'none';
  $('#comingSoonScreen').style.display = 'none';
  $('#appRoot').style.display = 'none';
  $('#appRootPendapatan').style.display = 'none';
  $('#appRootGabungan').style.display = 'flex';
  const secG = document.getElementById('view-tren-g');
  if(secG) secG.classList.add('active');
  setTimeout(()=>{ renderTrenGabungan(); initTrenExtrasG_(); }, 30);
}

function initHub(){
  $$('.hub-menu-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const target = card.dataset.hub;
      if(target === 'belanja'){
        showBelanjaApp();
      } else if(target === 'pendapatan'){
        showPendapatanApp();
      } else if(target === 'gabungan'){
        showGabunganApp();
      }
    });
  });
  const back = $('#comingSoonBack');
  if(back) back.addEventListener('click', showHub);
  const home = $('#btnHomeMenu');
  if(home) home.addEventListener('click', showHub);
  const homeP = $('#btnHomeMenuP');
  if(homeP) homeP.addEventListener('click', showHub);
  const homeG = $('#btnHomeMenuG');
  if(homeG) homeG.addEventListener('click', showHub);
}

/* ================================================================
   MODUL GABUNGAN: Pendapatan Vs Belanja
   Tidak punya sumber data sendiri -- murni menggabungkan STATE.tren
   (Belanja, sudah dimuat modul Belanja) & STATE_P.tren (Pendapatan,
   sudah dimuat modul Pendapatan). Warna konsisten dipakai di ketiga
   grafik: Belanja = biru (#5b8def), Pendapatan = oranye (#f0a35b) --
   sama dengan warna aksen utama tiap modul aslinya.
   ================================================================ */

/* ---- Gabungan: kumpulan periode & tahun (union dari kedua sumber) ---- */
function gabunganAllPeriods_(){
  const set = new Set();
  (STATE.tren||[]).forEach(r=>{ if(r.periode) set.add(r.periode); });
  (STATE_P.tren||[]).forEach(r=>{ if(r.periode) set.add(r.periode); });
  return Array.from(set).sort();
}

function gabunganAvailableYears_(){
  const years = new Set();
  (STATE.tren||[]).forEach(r=>{ if(r.periode) years.add(String(r.periode).slice(0,4)); });
  (STATE_P.tren||[]).forEach(r=>{ if(r.periode) years.add(String(r.periode).slice(0,4)); });
  return Array.from(years).sort();
}

function updateTrenMetaG_(){
  const periods = gabunganAllPeriods_();
  if(!periods.length) return;
  const first = periods[0], last = periods[periods.length-1];
  const h3span = $('#trenPeriodeLabelG');
  if(h3span) h3span.textContent = `— ${periodeLabelFull_(first)} s.d ${periodeLabelFull_(last)}`;
  const footer = $('#footerDataSumberG');
  if(footer) footer.textContent = `Data gabungan Pendapatan & Belanja RSUD dr. R. Soeprapto Cepu, ${periodeLabelShort_(first)}–${periodeLabelShort_(last)}.`;
}

/* ---- Card 1: Tren Total SPJ Bulanan Pendapatan Vs Belanja (line chart, 2 series) ---- */
let trenChartG;

function renderTrenGabungan(){
  updateTrenMetaG_();
  const canvas = $('#trenChartG');
  if(!canvas || typeof Chart === 'undefined') return;

  const periods = gabunganAllPeriods_();
  const belanjaMap = {}; (STATE.tren||[]).forEach(r=>{ belanjaMap[r.periode] = r.bulan_ini; });
  const pendapatanMap = {}; (STATE_P.tren||[]).forEach(r=>{ pendapatanMap[r.periode] = r.bulan_ini; });
  const dataBelanja = periods.map(p=> p in belanjaMap ? belanjaMap[p] : null);
  const dataPendapatan = periods.map(p=> p in pendapatanMap ? pendapatanMap[p] : null);

  const ctx = canvas.getContext('2d');
  if(trenChartG) trenChartG.destroy();
  trenChartG = new Chart(ctx, {
    type:'line',
    data:{
      labels: periods,
      datasets:[
        {label:'Belanja', data:dataBelanja, borderColor:'#5b8def', backgroundColor:'rgba(91,141,239,0.12)', tension:0, pointRadius:2, borderWidth:2.5, spanGaps:true},
        {label:'Pendapatan', data:dataPendapatan, borderColor:'#f0a35b', backgroundColor:'rgba(240,163,91,0.12)', tension:0, pointRadius:2, borderWidth:2.5, spanGaps:true},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{ticks:{maxRotation:90,minRotation:60, font:{size:9}}}
      }
    },
    plugins:[lineShadowPlugin]
  });
}

/* ---- Card 2: Perbandingan Rentang Bulan (1 rentang, 2 garis Belanja vs Pendapatan) ---- */
let trenRangeChartG;

function initTrenRangeCompareG(){
  const periods = gabunganAllPeriods_();
  const minP = periods[0], maxP = periods[periods.length-1];
  ['trenRangeFromG','trenRangeToG'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    if(minP) el.min = minP;
    if(maxP) el.max = maxP;
    el.addEventListener('change', renderTrenRangeCompareG);
  });
  // Default: Januari s.d bulan terakhir yang ada datanya (tahun terbaru)
  if(maxP){
    const yLast = maxP.slice(0,4);
    const fromEl = $('#trenRangeFromG'), toEl = $('#trenRangeToG');
    if(fromEl) fromEl.value = `${yLast}-01`;
    if(toEl) toEl.value = maxP;
  }
  renderTrenRangeCompareG();
}

function renderTrenRangeCompareG(){
  const canvas = $('#trenRangeChartG');
  const summary = $('#trenRangeSummaryG');
  if(!canvas || !summary || typeof Chart === 'undefined') return;

  const fromEl = $('#trenRangeFromG'), toEl = $('#trenRangeToG');
  const from = fromEl ? fromEl.value : '', to = toEl ? toEl.value : '';

  if(!from || !to || from > to){
    summary.innerHTML = '<div class="filter-empty">Pilih rentang bulan yang valid.</div>';
    if(trenRangeChartG){ trenRangeChartG.destroy(); trenRangeChartG = null; }
    return;
  }

  const rowsBelanja = (STATE.tren||[]).filter(r=> r.periode>=from && r.periode<=to).slice().sort((a,b)=>a.periode.localeCompare(b.periode));
  const rowsPendapatan = (STATE_P.tren||[]).filter(r=> r.periode>=from && r.periode<=to).slice().sort((a,b)=>a.periode.localeCompare(b.periode));

  if(!rowsBelanja.length && !rowsPendapatan.length){
    summary.innerHTML = '<div class="filter-empty">Tidak ada data pada rentang ini.</div>';
    if(trenRangeChartG){ trenRangeChartG.destroy(); trenRangeChartG = null; }
    return;
  }

  const periodSet = new Set([...rowsBelanja.map(r=>r.periode), ...rowsPendapatan.map(r=>r.periode)]);
  const periods = Array.from(periodSet).sort();
  const belanjaMap = {}; rowsBelanja.forEach(r=>{ belanjaMap[r.periode]=r.bulan_ini; });
  const pendapatanMap = {}; rowsPendapatan.forEach(r=>{ pendapatanMap[r.periode]=r.bulan_ini; });
  const labels = periods.map(p=> MONTH_NAMES[parseInt(p.split('-')[1],10)-1] + ' ' + p.slice(0,4));
  const dataBelanja = periods.map(p=> p in belanjaMap ? belanjaMap[p] : null);
  const dataPendapatan = periods.map(p=> p in pendapatanMap ? pendapatanMap[p] : null);

  const totalBelanja = rowsBelanja.reduce((s,r)=>s+r.bulan_ini,0);
  const totalPendapatan = rowsPendapatan.reduce((s,r)=>s+r.bulan_ini,0);
  const selisih = totalPendapatan - totalBelanja;
  const selisihClass = selisih>=0 ? 'pos' : 'neg';
  const selisihLabel = selisih>=0 ? 'Surplus' : 'Defisit';
  const selisihText = (selisih>=0?'+':'-') + 'Rp ' + fmt(Math.abs(selisih));
  const rangeLabel = `${periodeLabelShort_(from)} – ${periodeLabelShort_(to)}`;

  summary.innerHTML = `
    <div class="range-stat"><div class="lbl"><span class="range-dot" style="background:#5b8def"></span>Total Belanja ${rangeLabel}</div><div class="val">Rp ${fmt(totalBelanja)}</div></div>
    <div class="range-stat"><div class="lbl"><span class="range-dot" style="background:#f0a35b"></span>Total Pendapatan ${rangeLabel}</div><div class="val">Rp ${fmt(totalPendapatan)}</div></div>
    <div class="range-stat diff"><div class="lbl">${selisihLabel} (Pendapatan − Belanja)</div><div class="val ${selisihClass}">${selisihText}</div></div>
  `;

  const ctx = canvas.getContext('2d');
  if(trenRangeChartG) trenRangeChartG.destroy();
  trenRangeChartG = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Belanja', data:dataBelanja, borderColor:'#5b8def', backgroundColor:'rgba(91,141,239,0.12)', tension:0, pointRadius:4, borderWidth:3, spanGaps:true},
        {label:'Pendapatan', data:dataPendapatan, borderColor:'#f0a35b', backgroundColor:'rgba(240,163,91,0.12)', tension:0, pointRadius:4, borderWidth:3, spanGaps:true},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[lineShadowPlugin]
  });
}

/* ---- Card 3: Perbandingan Bulan yang Sama Antar Tahun (grouped bar: Belanja vs Pendapatan) ---- */
let trenSameMonthChartG;
let TREN_SAME_MONTH_YEARS_SEL_G_ = new Set();

function populateTrenSameMonthG(){
  const years = gabunganAvailableYears_();
  const monthSel = $('#trenSameMonthSelectG');
  if(!monthSel) return;
  monthSel.innerHTML = MONTH_NAMES.map((m,i)=>`<option value="${i}">${MONTH_FULL_[m]||m}</option>`).join('');

  const periods = gabunganAllPeriods_();
  const lastPeriode = periods[periods.length-1];
  if(lastPeriode) monthSel.value = String(parseInt(String(lastPeriode).split('-')[1],10)-1);

  TREN_SAME_MONTH_YEARS_SEL_G_ = new Set(years);
  const yearsWrap = $('#trenSameMonthYearsG');
  yearsWrap.innerHTML = years.map(y=>`
    <label class="year-check-item checked" data-year="${y}">
      <input type="checkbox" value="${y}" checked> ${y}
    </label>
  `).join('');
  yearsWrap.querySelectorAll('.year-check-item').forEach(item=>{
    const cb = item.querySelector('input');
    cb.addEventListener('change', ()=>{
      const y = item.dataset.year;
      if(cb.checked){ TREN_SAME_MONTH_YEARS_SEL_G_.add(y); item.classList.add('checked'); }
      else{ TREN_SAME_MONTH_YEARS_SEL_G_.delete(y); item.classList.remove('checked'); }
      renderTrenSameMonthCompareG();
    });
  });
  monthSel.addEventListener('change', renderTrenSameMonthCompareG);
  renderTrenSameMonthCompareG();
}

function renderTrenSameMonthCompareG(){
  const canvas = $('#trenSameMonthChartG');
  const monthSel = $('#trenSameMonthSelectG');
  if(!canvas || !monthSel || typeof Chart === 'undefined') return;
  const monthIdx = parseInt(monthSel.value, 10);
  const monthNum = String(monthIdx+1).padStart(2,'0');
  const years = gabunganAvailableYears_().filter(y=>TREN_SAME_MONTH_YEARS_SEL_G_.has(y));

  const belanjaValues = years.map(y=>{
    const row = (STATE.tren||[]).find(r=>r.periode === `${y}-${monthNum}`);
    return row ? row.bulan_ini : null;
  });
  const pendapatanValues = years.map(y=>{
    const row = (STATE_P.tren||[]).find(r=>r.periode === `${y}-${monthNum}`);
    return row ? row.bulan_ini : null;
  });

  const ctx = canvas.getContext('2d');
  if(trenSameMonthChartG) trenSameMonthChartG.destroy();
  trenSameMonthChartG = new Chart(ctx, {
    type:'bar',
    data:{
      labels: years,
      datasets:[
        {label:'Belanja', data:belanjaValues, backgroundColor:'#5b8def', borderRadius:8, borderSkipped:false, maxBarThickness:60},
        {label:'Pendapatan', data:pendapatanValues, backgroundColor:'#f0a35b', borderRadius:8, borderSkipped:false, maxBarThickness:60},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'Tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[barShadowPlugin]
  });
}

let TREN_EXTRA_INITED_G_ = false;
function initTrenExtrasG_(){
  if(TREN_EXTRA_INITED_G_) return;
  TREN_EXTRA_INITED_G_ = true;
  initTrenRangeCompareG();
  populateTrenSameMonthG();
}

// Dipanggil dari tombol refresh modul Belanja/Pendapatan -- kalau modul Gabungan
// kebetulan sedang terbuka saat itu, ikut di-render ulang supaya datanya tetap
// sinkron (Gabungan tidak fetch sendiri, cuma menggabungkan STATE/STATE_P).
function refreshGabunganIfVisible_(){
  const root = $('#appRootGabungan');
  if(!root || root.style.display !== 'flex') return;
  renderTrenGabungan();
  if(TREN_EXTRA_INITED_G_){ renderTrenRangeCompareG(); renderTrenSameMonthCompareG(); }
}

// ---- Sinkronisasi manual (Belanja & Pendapatan) ----
// Sebelumnya main() otomatis menembak Apps Script (tryLoadLive/tryLoadLivePendapatan
// dkk) SETIAP kali halaman dibuka -- artinya "sync" jalan sendiri tanpa diminta.
// Sekarang diganti manual sepenuhnya: main() cuma menampilkan data snapshot (data.js /
// data_pendapatan.js), dan fetch ke Google Sheet BARU jalan kalau tombol Sync (fab ⟳
// lama, atau tombol berlabel baru #btnSyncBelanja/#btnSyncPendapatan di topbar) diklik.
// Kedua tombol per modul dihubungkan ke fungsi sync yang sama supaya perilakunya identik.
async function syncBelanja_(){
  const btns = [$('#btnRefresh'), $('#btnSyncBelanja')].filter(Boolean);
  btns.forEach(b=>{
    b.disabled = true;
    if(b.id === 'btnSyncBelanja'){ b.dataset.origText = b.dataset.origText || b.textContent; b.textContent = 'Menyinkron...'; }
  });
  try{
    await tryLoadLive();
    renderRingkasan();
    updateTrenMeta_();
    if($('#view-tren').classList.contains('active')){
      renderTren();
      if(TREN_EXTRA_INITED_){ renderTrenRangeCompare(); populateTrenSameMonth(); }
      else initTrenExtras_();
    }
    await loadKomponenBelanja();
    renderRingkasan();
    await loadKhususLive();
    refreshKhususDependentViews_();
    refreshGabunganIfVisible_();
  } finally {
    btns.forEach(b=>{
      b.disabled = false;
      if(b.id === 'btnSyncBelanja') b.textContent = b.dataset.origText;
    });
  }
}

async function syncPendapatan_(){
  const btns = [$('#btnRefreshP'), $('#btnSyncPendapatan')].filter(Boolean);
  btns.forEach(b=>{
    b.disabled = true;
    if(b.id === 'btnSyncPendapatan'){ b.dataset.origText = b.dataset.origText || b.textContent; b.textContent = 'Menyinkron...'; }
  });
  try{
    await tryLoadLivePendapatan();
    renderRingkasanPendapatan();
    updateTrenMetaP_();
    if($('#view-tren-p').classList.contains('active')) renderTrenPendapatan();
    await loadKhususLivePendapatan();
    ['2024','2025','2026'].forEach(renderKhususPendapatan);
    refreshGabunganIfVisible_();
  } finally {
    btns.forEach(b=>{
      b.disabled = false;
      if(b.id === 'btnSyncPendapatan') b.textContent = b.dataset.origText;
    });
  }
}

// Modul Gabungan tidak punya sumber datanya sendiri (cuma turunan STATE/STATE_P
// milik Belanja & Pendapatan) -- renderGabunganViews_() dipakai tombol reload lama
// (cuma render ulang dari data yang sudah ada di memori, tanpa fetch), sedangkan
// syncGabungan_() dipakai tombol Sync baru: menyinkron KEDUA sumber (Belanja &
// Pendapatan) ke Google Sheet dulu lewat fungsi yang sudah ada, baru render ulang.
function renderGabunganViews_(){
  renderTrenGabungan();
  renderTrenRangeCompareG();
  renderTrenSameMonthCompareG();
}

async function syncGabungan_(){
  const btn = $('#btnSyncGabungan');
  if(btn){ btn.disabled = true; btn.dataset.origText = btn.dataset.origText || btn.textContent; btn.textContent = 'Menyinkron...'; }
  try{
    await Promise.all([syncBelanja_(), syncPendapatan_()]);
    renderGabunganViews_();
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = btn.dataset.origText; }
  }
}

async function main(){
  initHub();
  updateLiveBadge();
  renderRingkasan();
  populatePerbandinganBulan();
  renderPerbandingan();
  ['2024','2025','2026'].forEach(renderKhusus);
  initFilter();
  initNav();
  initYearMenu();
  initBkuModal();

  // ---- Modul Pendapatan (independen dari Belanja di atas) ----
  updateLiveBadgeP();
  renderRingkasanPendapatan();
  ['2024','2025','2026'].forEach(renderKhususPendapatan);
  initNavP();
  initYearMenuP();
  ['2024','2025','2026'].forEach(y=>{
    $(`#searchKhusus${y}P`)?.addEventListener('input', ()=>renderKhususPendapatan(y));
  });
  $('#btnRefreshP')?.addEventListener('click', syncPendapatan_);
  $('#btnSyncPendapatan')?.addEventListener('click', syncPendapatan_);

  // ---- Modul Gabungan (Pendapatan Vs Belanja) -- cuma turunan dari STATE/STATE_P,
  // render pertamanya dipicu showGabunganApp() saat kartu diklik (bukan di sini,
  // supaya canvas Chart.js tidak dibuat saat masih display:none). Refresh tinggal
  // render ulang dari data STATE/STATE_P yang sudah ter-update oleh modul lain.
  $('#btnRefreshG')?.addEventListener('click', renderGabunganViews_);
  $('#btnSyncGabungan')?.addEventListener('click', syncGabungan_);

  $('#searchPerbandingan').addEventListener('input', renderPerbandingan);
  $('#filterBulanPerbandingan').addEventListener('change', (e)=>{
    const v = e.target.value;
    PERBANDINGAN_BULAN_SEL = v === '' ? null : parseInt(v, 10);
    renderPerbandingan();
  });
  ['2024','2025','2026'].forEach(y=>{
    $(`#searchKhusus${y}`).addEventListener('input', ()=>renderKhusus(y));
  });
  $('#btnRefresh').addEventListener('click', syncBelanja_);
  $('#btnSyncBelanja')?.addEventListener('click', syncBelanja_);

  // ---- Auto-sync di background tiap halaman dibuka ----
  // Sempat dihapus total (murni manual, tombol Sync saja) supaya Google Sheet tidak
  // ditembak diam-diam tiap kali dibuka. Tapi akibatnya kalau tidak diklik manual,
  // yang tampil TERUS snapshot data.js/data_pendapatan.js (dibuat saat terakhir kali
  // file itu di-generate) -- makanya label bulan kelihatan "macet" di bulan lama
  // (mis. Juli) walau Google Sheet sudah lebih baru. Sekarang dikembalikan sebagai
  // auto-sync SEKALI di background tiap halaman dibuka/direfresh -- snapshot tetap
  // tampil duluan (biar cepat), lalu diam-diam diganti live begitu fetch ini selesai.
  // Tombol Sync manual tetap ada untuk refresh kapan saja tanpa reload halaman.
  syncBelanja_();
  syncPendapatan_();
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
