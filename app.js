/* Dashboard Rekap Belanja SPJ 2024-2025-2026 — RSUD dr. R. Soeprapto Cepu */

const fmt = n => (n===null||n===undefined||n==='') ? '-' : Number(n).toLocaleString('id-ID');
const fmtPct = n => (n===null||n===undefined||n==='') ? '-' : Number(n).toFixed(1)+'%';
// % Realisasi 2026 di tabel "Perbandingan Belanja per Akun" -- dua digit desimal,
// format Indonesia (koma sbg pemisah desimal, mis. "66,26%"), beda dari fmtPct
// (1 desimal, titik) yg dipakai di tempat lain -- ini permintaan eksplisit user.
const fmtPersenID_ = n => (n===null||n===undefined||n==='') ? '-' : Number(n).toFixed(2).replace('.',',')+'%';
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
      if(!map[r.kode]) map[r.kode] = { kode:r.kode, nama:r.nama, depth:r.depth, '2024':null, '2025':null, '2026':null,
        pagu2024:null, pagu2025:null, pagu2026:null, persen2026:null };
      map[r.kode][y] = r.total;
      map[r.kode].nama = r.nama;
      map[r.kode].depth = r.depth;
      // Pagu Anggaran (2024/2025/2026): backend melampirkan field ini di SETIAP
      // baris getKhususData_ (lihat Code.gs getBelanjaPaguMap_), nilainya sama
      // berapa pun tahun sumber transaksinya -- jadi cukup timpa tiap kali ada,
      // & persen2026 cuma diisi backend saat memproses tahun 2026 (baris lain null).
      if(r.pagu2024 !== undefined) map[r.kode].pagu2024 = r.pagu2024;
      if(r.pagu2025 !== undefined) map[r.kode].pagu2025 = r.pagu2025;
      if(r.pagu2026 !== undefined) map[r.kode].pagu2026 = r.pagu2026;
      if(r.persen2026 !== undefined && r.persen2026 !== null) map[r.kode].persen2026 = r.persen2026;
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
  // PENTING (bug sama seperti Pendapatan sebelumnya: klik "Sync Google Sheet"
  // berkali-kali untuk Belanja tidak pernah benar-benar menarik data terbaru dari
  // Rekap_Belanja_SPJ_2024_2025_2026_v2.xlsx): ringkasan/tren di bawah ini HANYA
  // baca cache Rekap_SPJ_Dashboard_Live_Data (Code.gs readRows_), TIDAK PERNAH
  // menyentuh xlsx-nya sendiri. Cache itu sebelumnya cuma di-refresh oleh trigger
  // per-jam (syncFromXlsx di Sync_LiveData.gs). Baris ini memaksa Code.gs
  // menjalankan syncFromXlsx() DULU (via view=sync_belanja_cache) setiap kali
  // fungsi ini dipanggil, baru setelah itu baca ringkasan/tren -- jadi tombol Sync
  // Belanja sekarang benar-benar menarik data terbaru, bukan cuma mengandalkan
  // trigger per-jam yang belum tentu sudah jalan. Dibungkus try/catch terpisah &
  // tidak melempar error supaya kalau endpoint ini gagal (mis. timeout),
  // pembacaan ringkasan/tren di bawah tetap jalan pakai cache yang ada.
  try{
    await fetch(`${APPS_SCRIPT_URL}?view=sync_belanja_cache`, {method:'GET'});
  }catch(err){
    console.warn('Gagal memicu sync_belanja_cache (lanjut pakai cache terakhir):', err);
  }
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
      // refresh batas min/max picker Rentang A/B supaya ikut bulan terbaru yang baru masuk
      if(typeof updateTrenRangeBounds_ === 'function'){
        const clamped = updateTrenRangeBounds_();
        if((clamped || TREN_EXTRA_INITED_) && typeof renderTrenRangeCompare === 'function') renderTrenRangeCompare();
      }
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

// pctChangeRangeComparePlugin: khusus grafik garis "Perbandingan Rentang Bulan"
// (#trenRangeChart / #trenRangeChartP) yang selalu berisi TEPAT 2 dataset --
// rentang A (mis. Jan-Jun 2025) dan rentang B (mis. Jan-Jun 2026). Ada 2 jenis
// label persentase yang digambar terpisah supaya tidak tabrakan seperti versi
// sebelumnya (yang cuma 1 jenis, ditumpuk lurus di atas titik):
//   1) ANTAR BULAN, tahun/rentang SAMA -- persentase naik/turun dari bulan
//      sebelumnya ke bulan ini, DALAM garis yang sama (mis. Jan->Feb di garis A
//      saja, dan Jan->Feb di garis B saja). Ditulis di ATAS GARIS, tepat di
//      tengah-tengah horizontal antara 2 bulan tsb (bukan di atas salah satu
//      titik), dengan pil warna lembut spy tetap terbaca menimpa garis.
//   2) BULAN SAMA, tahun/rentang BERBEDA -- persentase B vs A pada bulan yang
//      sama (mis. Feb rentang A vs Feb rentang B). Ditulis TEPAT DI ATAS TITIK
//      bulan tsb (di atas titik yang lebih tinggi di antara A/B pada bulan itu).
// Penempatan anti-tabrakan generik: terima daftar label {x, y, w, h, ...} yang
// posisi-y AWALnya cuma "usulan" (preferred), lalu tiap label diperiksa
// terhadap semua label yang SUDAH ditempatkan sebelumnya -- kalau kotaknya
// beririsan (secara X maupun Y), digeser ke ATAS (nilai y dikurangi) sampai
// tidak beririsan lagi dengan siapa pun. Diproses dari kiri ke kanan supaya
// hasilnya stabil/tidak berubah-ubah posisi tiap render. Dipakai supaya label
// persentase yang kebetulan berdekatan (mis. 2 garis saling silang di bulan
// yang sama) otomatis saling menjauh, bukan malah numpuk.
function placeLabelsNoOverlap_(items){
  const placed = [];
  items.sort((a,b)=> a.x - b.x);
  items.forEach(item=>{
    let guard = 0;
    let moved = true;
    while(moved && guard < 60){
      moved = false;
      for(const p of placed){
        const overlapX = Math.abs(item.x - p.x) < (item.w + p.w) / 2 + 3;
        const overlapY = Math.abs(item.y - p.y) < (item.h + p.h) / 2 + 2;
        if(overlapX && overlapY){
          item.y = p.y - (item.h + p.h) / 2 - 3;
          moved = true;
        }
      }
      guard++;
    }
    placed.push(item);
  });
  return items;
}

const pctChangeRangeComparePlugin = {
  id: 'pctChangeRangeCompare',
  afterDatasetsDraw(chart){
    const {ctx} = chart;
    const metaA = chart.getDatasetMeta(0);
    const metaB = chart.getDatasetMeta(1);
    if(!metaA || !metaA.data) return;
    const valuesA = chart.data.datasets[0] ? chart.data.datasets[0].data : [];
    const valuesB = chart.data.datasets[1] ? chart.data.datasets[1].data : [];
    const metaBActive = metaB && !metaB.hidden ? metaB : null;

    ctx.save();
    ctx.font = 'bold 10px Arial, sans-serif';
    const items = [];

    // -- 1) Antar bulan, dalam garis yang sama (pil di atas garis, di tengah 2 bulan) --
    [ [metaA, valuesA], [metaBActive, valuesB] ].forEach(([meta, values])=>{
      if(!meta || !meta.data) return;
      for(let i = 1; i < meta.data.length; i++){
        const prev = values[i-1], cur = values[i];
        if(prev === null || prev === undefined || cur === null || cur === undefined || prev === 0) continue;
        const pct = (cur - prev) / Math.abs(prev) * 100;
        const text = pctChangeText_(pct);
        const p0 = meta.data[i-1], p1 = meta.data[i];
        items.push({
          kind: 'pill', text, pct,
          x: (p0.x + p1.x) / 2,
          y: Math.min(p0.y, p1.y) - 14,
          w: ctx.measureText(text).width + 10,
          h: 15,
        });
      }
    });

    // -- 2) Bulan sama, rentang berbeda (B vs A) -- tepat di atas titik bulan tsb --
    if(metaBActive){
      const len = Math.min(metaA.data.length, metaBActive.data.length);
      for(let i = 0; i < len; i++){
        const a = valuesA[i], b = valuesB[i];
        if(a === null || a === undefined || b === null || b === undefined || a === 0) continue;
        const pct = (b - a) / Math.abs(a) * 100;
        const text = pctChangeText_(pct);
        const pA = metaA.data[i], pB = metaBActive.data[i];
        items.push({
          kind: 'text', text, pct,
          x: pA.x,
          y: Math.min(pA.y, pB.y) - 12,
          w: ctx.measureText(text).width + 6,
          h: 13,
        });
      }
    }

    placeLabelsNoOverlap_(items);

    items.forEach(item=>{
      const color = pctChangeColor_(item.pct);
      if(item.kind === 'pill'){
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = item.pct >= 0 ? 'rgba(31,157,85,0.16)' : 'rgba(224,72,62,0.16)';
        if(ctx.roundRect){
          ctx.beginPath();
          ctx.roundRect(item.x - item.w/2, item.y - item.h/2, item.w, item.h, 7);
          ctx.fill();
        } else {
          ctx.fillRect(item.x - item.w/2, item.y - item.h/2, item.w, item.h);
        }
        ctx.fillStyle = color;
        ctx.fillText(item.text, item.x, item.y + 1);
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = color;
        ctx.fillText(item.text, item.x, item.y + item.h);
      }
    });
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
  // jaring pengaman: tiap kali tab Tren dibuka, pastikan batas min/max picker
  // Rentang A/B (menu Perbandingan Rentang Bulan) sudah sinkron dengan bulan
  // terbaru di STATE.tren -- lihat komentar di updateTrenRangeBounds_().
  if(typeof TREN_EXTRA_INITED_ !== 'undefined' && TREN_EXTRA_INITED_ && typeof updateTrenRangeBounds_ === 'function'){
    const clamped = updateTrenRangeBounds_();
    if(clamped && typeof renderTrenRangeCompare === 'function') renderTrenRangeCompare();
  }
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

// PENTING (dinamis mengikuti bulan yang benar-benar sudah ter-update di
// Rekap_Belanja_SPJ_2024_2025_2026_v2.xlsx): sama seperti updateTrenRangeBoundsP_
// untuk Pendapatan -- dipisah dari initTrenRangeCompare() supaya bisa dipanggil
// ULANG tiap kali data live selesai dimuat (klik Sync / buka tab Tren), bukan
// cuma sekali saat init (kalau cuma sekali, picker Rentang A/B macet di bulan
// lama walau data baru sudah masuk, mis. macet di Juli padahal Agustus sudah ada).
function updateTrenRangeBounds_(){
  const periods = STATE.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const minP = periods[0], maxP = periods[periods.length-1];
  let clamped = false;
  ['trenRangeAFrom','trenRangeATo','trenRangeBFrom','trenRangeBTo'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    if(minP) el.min = minP;
    if(maxP) el.max = maxP;
    if(maxP && el.value && el.value > maxP){ el.value = maxP; clamped = true; }
    if(minP && el.value && el.value < minP){ el.value = minP; clamped = true; }
  });
  return clamped;
}

function initTrenRangeCompare(){
  const years = trenAvailableYears_();
  updateTrenRangeBounds_();
  ['trenRangeAFrom','trenRangeATo','trenRangeBFrom','trenRangeBTo'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
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
      layout:{padding:{top:58}},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[lineShadowPlugin, pctChangeRangeComparePlugin]
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

// PENTING (dinamis mengikuti bulan yang benar-benar sudah ter-update di
// Rekap_Pendapatan_2024_2025_2026.xlsx): batas min/max date-picker Rentang A & B
// TIDAK di-hardcode ke Desember, melainkan mengikuti bulan terakhir yang benar-benar
// ada datanya di STATE_P.tren (hasil sinkron dari xlsx). Fungsi ini dipisah dari
// initTrenRangeCompareP() supaya bisa dipanggil ULANG setiap kali data live selesai
// dimuat (mis. setelah klik Sync atau tiap kali tab Tren Pendapatan dibuka) -- kalau
// hanya dijalankan sekali saat init, picker akan macet di bulan lama walau xlsx sudah
// bertambah bulan barunya (mis. macet di Juli padahal data Agustus sudah masuk).
function updateTrenRangeBoundsP_(){
  const periods = STATE_P.tren.map(r=>r.periode).filter(Boolean).slice().sort();
  const minP = periods[0], maxP = periods[periods.length-1];
  let clamped = false;
  ['trenRangeAFromP','trenRangeAToP','trenRangeBFromP','trenRangeBToP'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    if(minP) el.min = minP;
    if(maxP) el.max = maxP;
    // kalau nilai yang sedang dipilih user ternyata di luar rentang data yang benar-benar
    // ada (mis. sempat pilih bulan yang lalu ternyata belum ke-update di xlsx), tarik ke batas terdekat
    if(maxP && el.value && el.value > maxP){ el.value = maxP; clamped = true; }
    if(minP && el.value && el.value < minP){ el.value = minP; clamped = true; }
  });
  return clamped;
}

function initTrenRangeCompareP(){
  const years = trenAvailableYearsP_();
  updateTrenRangeBoundsP_();
  ['trenRangeAFromP','trenRangeAToP','trenRangeBFromP','trenRangeBToP'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
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
      layout:{padding:{top:58}},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[lineShadowPlugin, pctChangeRangeComparePlugin]
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
    // % SPJ & Sisa Pagu HARUS dinamis mengikuti bulan yang dipilih -- dulu selalu
    // pakai r.persen2026 (persentase snapshot bulan TERAKHIR) walau user memilih
    // bulan lain, sehingga terlihat "salah" (nilainya sama terus). Sekarang dihitung
    // ulang setiap render: realisasi bulan terpilih (v26) dibagi Pagu 2026.
    const pagu26 = r.pagu2026;
    const persen = (pagu26 && v26 !== null && v26 !== undefined) ? (v26 / pagu26 * 100) : null;
    const sisa = (pagu26 !== undefined && pagu26 !== null && v26 !== null && v26 !== undefined) ? (pagu26 - v26) : null;
    return `<tr>
      <td class="lvl-${r.depth}">${r.kode}</td>
      <td class="lvl-${r.depth}">${r.nama}</td>
      <td class="col-pagu">${r.pagu2024 ? fmt(r.pagu2024) : '-'}</td>
      <td>${fmt(v24)}</td>
      <td class="col-pagu">${r.pagu2025 ? fmt(r.pagu2025) : '-'}</td>
      <td>${fmt(v25)}</td>
      <td class="col-pagu">${r.pagu2026 ? fmt(r.pagu2026) : '-'}</td>
      <td>${fmt(v26)}</td>
      <td class="col-persen">${fmtPersenID_(persen)}</td>
      <td class="col-pagu">${sisa !== null ? fmt(sisa) : '-'}</td>
    </tr>`;
  }).join('');
  $('#countPerbandingan').textContent = rows.length + ' akun';
  updatePerbandinganPill();
}

/* ---------------- Perbandingan Pendapatan (konsep sama dengan Perbandingan Belanja per Akun) ---------------- */
let PERBANDINGAN_BULAN_SEL_P = null;

function populatePerbandinganBulanP(){
  const sel = $('#filterBulanPerbandinganP');
  if(!sel) return;
  const opts = ['<option value="">Bulan Ini (terakhir)</option>']
    .concat(MONTH_NAMES.map((m,i)=>`<option value="${i}">${m}</option>`));
  sel.innerHTML = opts.join('');
}

function getPerbandinganBulanValueP(kode, year, bulanIdx){
  const data = STATE_P.khusus[year];
  if(!data) return null;
  const row = data.rows.find(x=>x.kode===kode);
  if(!row) return null;
  return (bulanIdx < row.bulanan.length) ? row.bulanan[bulanIdx] : null;
}

function updatePerbandinganPillP(){
  const pill = $('#pillPerbandinganP');
  if(!pill) return;
  if(PERBANDINGAN_BULAN_SEL_P === null){
    const labels = ['2024','2025','2026'].map(y=>{
      const d = STATE_P.ringkasan[y];
      return d && d.label_bulan ? `${d.label_bulan} ${y}` : y;
    });
    pill.textContent = labels.join(' · ');
  } else {
    const m = MONTH_NAMES[PERBANDINGAN_BULAN_SEL_P];
    pill.textContent = ['2024','2025','2026'].map(y=>`${m} ${y}`).join(' · ');
  }
}

function renderPerbandinganP(){
  const tbody = $('#tblPerbandinganP tbody');
  if(!tbody) return;
  const q = ($('#searchPerbandinganP').value||'').toLowerCase();
  const rows = STATE_P.perbandingan.filter(r => r.nama.toLowerCase().includes(q) || r.kode.includes(q));
  const bulanIdx = PERBANDINGAN_BULAN_SEL_P;
  tbody.innerHTML = rows.map(r=>{
    // PENTING: sejak baris digabung lewat peta Konversi, r.kode cuma 1 representasi
    // (diutamakan kode 2026) -- kalau dipakai langsung utk cari data bulanan tahun LAIN
    // (mis. 2024) yg kode mentahnya beda konvensi, pencarian akan gagal (row not found).
    // Makanya di sini WAJIB pakai kode ASLI per tahun dari r.kodeByYear (fallback r.kode
    // kalau kebetulan baris ini tidak digabung / tidak ada di peta Konversi).
    const kode24 = (r.kodeByYear && r.kodeByYear['2024']) || r.kode;
    const kode25 = (r.kodeByYear && r.kodeByYear['2025']) || r.kode;
    const kode26 = (r.kodeByYear && r.kodeByYear['2026']) || r.kode;
    const v24 = bulanIdx===null ? r['2024'] : getPerbandinganBulanValueP(kode24,'2024',bulanIdx);
    const v25 = bulanIdx===null ? r['2025'] : getPerbandinganBulanValueP(kode25,'2025',bulanIdx);
    const v26 = bulanIdx===null ? r['2026'] : getPerbandinganBulanValueP(kode26,'2026',bulanIdx);
    // % SPJ & Sisa Target dihitung ulang tiap render mengikuti bulan yang dipilih
    // (konsep sama dengan Perbandingan Belanja) -- realisasi bulan terpilih (v26)
    // dibagi/dikurangi Pagu (Target) 2026, bukan persentase snapshot bulan terakhir.
    const pagu26 = r.pagu2026;
    const persen = (pagu26 && v26 !== null && v26 !== undefined) ? (v26 / pagu26 * 100) : null;
    const sisa = (pagu26 !== undefined && pagu26 !== null && v26 !== null && v26 !== undefined) ? (pagu26 - v26) : null;
    return `<tr>
      <td class="lvl-${r.depth}">${r.kode}</td>
      <td class="lvl-${r.depth}">${r.nama}</td>
      <td class="col-pagu">${r.pagu2024 ? fmt(r.pagu2024) : '-'}</td>
      <td>${fmt(v24)}</td>
      <td class="col-pagu">${r.pagu2025 ? fmt(r.pagu2025) : '-'}</td>
      <td>${fmt(v25)}</td>
      <td class="col-pagu">${r.pagu2026 ? fmt(r.pagu2026) : '-'}</td>
      <td>${fmt(v26)}</td>
      <td class="col-persen">${fmtPersenID_(persen)}</td>
      <td class="col-pagu">${sisa !== null ? fmt(sisa) : '-'}</td>
    </tr>`;
  }).join('');
  $('#countPerbandinganP').textContent = rows.length + ' akun';
  updatePerbandinganPillP();
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
        tooltip: {callbacks: {
          label: c => 'Rp ' + fmt(c.parsed.y),
          afterLabel: c => {
            if(c.dataIndex === 0) return '';
            const prev = values[c.dataIndex - 1], cur = values[c.dataIndex];
            if(prev === null || prev === undefined || cur === null || cur === undefined || prev === 0) return '';
            const pct = (cur - prev) / Math.abs(prev) * 100;
            return 'vs ' + FILTER_YEARS[c.dataIndex - 1] + ': ' + pctChangeText_(pct);
          }
        }}
      },
      scales: {
        y: {ticks: {callback: v => (v/1e6).toFixed(0)+'jt'}, grid: {color:'#eef0fb'}},
        x: {grid: {display:false}}
      }
    },
    plugins: [barShadowPlugin, pctChangeBarPlugin]
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
  initFilterRangeCompare();

  $('#filterTahun').addEventListener('change', ()=>{
    const year = $('#filterTahun').value;
    const keepKode = $('#filterRekening').value;
    populateFilterBulan(year);
    populateFilterRekening(year, keepKode);
    renderFilterResult();
    renderFilterRangeCompare();
  });
  $('#filterBulan').addEventListener('change', renderFilterResult);
  $('#filterRekening').addEventListener('change', ()=>{
    renderFilterResult();
    renderFilterRangeCompare();
  });
}

/* ---- Filter: Perbandingan Rentang Bulan per Rekening (line chart, mis.
   Jan-Jul 2024 vs Jan-Jul 2026 utk 1 rekening yg dipilih di dropdown filter
   atas). Beda dari "Perbandingan Rentang Bulan" di tab Tren -- yang itu
   totalnya SELURUH Belanja (kode 5), ini KHUSUS 1 rekening (kode apa saja,
   sampai level paling detail), datanya diambil dari STATE.khusus[year].rows
   (yang sudah punya rincian bulanan per akun -- lihat getKhususData_ Code.gs)
   bukan dari STATE.tren (yang cuma total kode 5 per bulan). ---- */
function khususAvailableYears_(){
  return ['2024','2025','2026'].filter(y=> STATE.khusus[y] && STATE.khusus[y].bulan_label && STATE.khusus[y].bulan_label.length);
}

// Kumpulkan {periode:'YYYY-MM', value} utk 1 kode, lintas SEMUA tahun yg ada
// datanya, dibatasi rentang [from,to] (format input type=month, "YYYY-MM").
function khususPeriodeInRange_(kode, from, to){
  if(!from || !to || !kode) return [];
  const out = [];
  ['2024','2025','2026'].forEach(year=>{
    const data = STATE.khusus[year];
    if(!data) return;
    const row = data.rows.find(r=>r.kode===kode);
    if(!row) return;
    data.bulan_label.forEach((m,i)=>{
      const monthNum = MONTH_NAMES.indexOf(m) + 1;
      if(monthNum < 1) return;
      const periode = `${year}-${String(monthNum).padStart(2,'0')}`;
      if(periode >= from && periode <= to){
        out.push({ periode, value: row.bulanan[i] });
      }
    });
  });
  return out.sort((a,b)=> a.periode.localeCompare(b.periode));
}

// Batas min/max picker Rentang A/B mengikuti cakupan bulan yang benar-benar ada
// di STATE.tren (sama dgn cakupan STATE.khusus, karena keduanya diturunkan dari
// BKU/laporan bulanan yang sama) -- dipanggil ulang tiap live-data refresh &
// tiap tab Filter dibuka, pola sama seperti updateTrenRangeBounds_.
function updateFilterRangeBounds_(){
  const periods = (STATE.tren||[]).map(r=>r.periode).filter(Boolean).slice().sort();
  const minP = periods[0], maxP = periods[periods.length-1];
  let clamped = false;
  ['filterRangeAFrom','filterRangeATo','filterRangeBFrom','filterRangeBTo'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    if(minP) el.min = minP;
    if(maxP) el.max = maxP;
    if(maxP && el.value && el.value > maxP){ el.value = maxP; clamped = true; }
    if(minP && el.value && el.value < minP){ el.value = minP; clamped = true; }
  });
  return clamped;
}

let FILTER_RANGE_INITED_ = false;
function initFilterRangeCompare(){
  const years = khususAvailableYears_();
  updateFilterRangeBounds_();
  ['filterRangeAFrom','filterRangeATo','filterRangeBFrom','filterRangeBTo'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', renderFilterRangeCompare);
  });
  // Default: Jan-Jul tahun pertama vs Jan-Jul tahun terakhir yang ada datanya
  // (contoh permintaan: rekening tagihan listrik 2024 Jan-Jul vs 2026 Jan-Jul --
  // beda dari default Tren yg pakai 2 tahun BERDEKATAN, di sini sengaja tahun
  // PALING AWAL vs PALING AKHIR supaya langsung kelihatan tren jangka panjangnya).
  if(years.length >= 2){
    const yA = years[0], yB = years[years.length-1];
    $('#filterRangeAFrom').value = `${yA}-01`; $('#filterRangeATo').value = `${yA}-07`;
    $('#filterRangeBFrom').value = `${yB}-01`; $('#filterRangeBTo').value = `${yB}-07`;
  } else if(years.length === 1){
    $('#filterRangeAFrom').value = `${years[0]}-01`; $('#filterRangeATo').value = `${years[0]}-07`;
    $('#filterRangeBFrom').value = `${years[0]}-01`; $('#filterRangeBTo').value = `${years[0]}-07`;
  }
  FILTER_RANGE_INITED_ = true;
  renderFilterRangeCompare();
}

let filterRangeChart;
function renderFilterRangeCompare(){
  const canvas = $('#filterRangeChart');
  const summary = $('#filterRangeSummary');
  const labelEl = $('#filterRangeKodeLabel');
  if(!canvas || !summary || typeof Chart === 'undefined') return;

  const kode = $('#filterRekening').value;
  const year = $('#filterTahun').value;
  const data = STATE.khusus[year];
  const row = data ? data.rows.find(r=>r.kode===kode) : null;
  if(labelEl) labelEl.textContent = row ? `${row.kode} — ${row.nama}` : '-';

  const fromA = $('#filterRangeAFrom').value, toA = $('#filterRangeATo').value;
  const fromB = $('#filterRangeBFrom').value, toB = $('#filterRangeBTo').value;
  const rowsA = khususPeriodeInRange_(kode, fromA, toA);
  const rowsB = khususPeriodeInRange_(kode, fromB, toB);

  if(!kode || !fromA || !toA || !fromB || !toB || fromA > toA || fromB > toB || (!rowsA.length && !rowsB.length)){
    summary.innerHTML = '<div class="filter-empty">Pilih rekening & rentang bulan yang valid untuk kedua sisi (A dan B).</div>';
    if(filterRangeChart){ filterRangeChart.destroy(); filterRangeChart = null; }
    return;
  }

  const len = Math.max(rowsA.length, rowsB.length);
  const labels = Array.from({length: len}, (_,i)=>{
    const src = rowsA[i] || rowsB[i];
    return src ? MONTH_NAMES[parseInt(String(src.periode).split('-')[1],10)-1] : ('Bulan ke-'+(i+1));
  });
  const dataA = Array.from({length: len}, (_,i)=> rowsA[i] ? rowsA[i].value : null);
  const dataB = Array.from({length: len}, (_,i)=> rowsB[i] ? rowsB[i].value : null);

  const totalA = rowsA.reduce((s,r)=>s+r.value,0);
  const totalB = rowsB.reduce((s,r)=>s+r.value,0);
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
  if(filterRangeChart) filterRangeChart.destroy();
  filterRangeChart = new Chart(ctx, {
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
      layout:{padding:{top:58}},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[lineShadowPlugin, pctChangeRangeComparePlugin]
  });
}

/* ---------------- Filter Pendapatan (Rekening / Bulan / Tahun) ----------------
   Duplikasi persis dari blok Filter Belanja di atas, tapi bersumber dari
   STATE_P.khusus (bentuk datanya identik: {bulan_label, rows:[{kode,nama,depth,
   bulanan,total}]}) -- lihat loadKhususLivePendapatan()/renderKhususPendapatan().
   Semua id elemen HTML terkait diberi akhiran P (lihat index.html #view-filter-p). */
const FILTER_YEARS_P = ['2024','2025','2026'];

function allAccountsForYearP_(year){
  const data = STATE_P.khusus[year];
  return data ? data.rows.slice().sort((a,b)=> a.kode.localeCompare(b.kode, undefined, {numeric:true})) : [];
}

function populateFilterTahunP(){
  const sel = $('#filterTahunP');
  sel.innerHTML = FILTER_YEARS_P.map(y=>`<option value="${y}">${y}</option>`).join('');
}

function populateFilterBulanP(year){
  const sel = $('#filterBulanP');
  const labels = (STATE_P.khusus[year] && STATE_P.khusus[year].bulan_label) || [];
  const opts = ['<option value="ALL">Semua Bulan (lihat tren setahun)</option>']
    .concat(labels.map((m,i)=>`<option value="${i}">${m} ${year}</option>`));
  sel.innerHTML = opts.join('');
}

function populateFilterRekeningP(year, keepKode){
  const sel = $('#filterRekeningP');
  const accounts = allAccountsForYearP_(year);
  sel.innerHTML = accounts.map(a=>`<option value="${a.kode}">${a.kode} — ${a.nama}</option>`).join('');
  if(keepKode && accounts.some(a=>a.kode===keepKode)) sel.value = keepKode;
}

function renderFilterResultP(){
  const year = $('#filterTahunP').value;
  const bulanVal = $('#filterBulanP').value;
  const kode = $('#filterRekeningP').value;
  const wrap = $('#filterResultP');
  const data = STATE_P.khusus[year];
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
          <div class="sub">Total Pendapatan Bulan Ini, akumulasi ${labels[0]}–${labels[labels.length-1]} ${year}</div>
        </div>
      </div>
      <div class="chart-wrap" style="height:240px;margin-top:14px;"><canvas id="filterChartP"></canvas></div>
      <table class="subtable" style="margin-top:14px;">
        <thead><tr>${labels.map(m=>`<th>${m}</th>`).join('')}</tr></thead>
        <tbody><tr>${row.bulanan.map(v=>`<td>${fmt(v)}</td>`).join('')}</tr></tbody>
      </table>
    `;
    renderFilterChartP(labels, row.bulanan);
    return;
  }

  const idx = parseInt(bulanVal, 10);
  const label = data.bulan_label[idx];
  const value = row.bulanan[idx];

  const compareValues = FILTER_YEARS_P.map(y=>{
    const yd = STATE_P.khusus[y];
    const yKode = resolveKonversiKodeP_(kode, y);
    const yr = yd ? yd.rows.find(r=>r.kode===yKode) : null;
    const yIdx = yd ? yd.bulan_label.indexOf(label) : -1;
    return (yr && yIdx > -1) ? yr.bulanan[yIdx] : null;
  });

  const compareHtml = FILTER_YEARS_P.map((y,i)=>{
    const v = compareValues[i];
    const has = v !== null;
    return `<div class="yr-box ${has?'':'dim'} ${y===year?'current':''}"><b>${label} ${y}</b><span>${has ? 'Rp '+fmt(v) : '-'}</span></div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="filter-stat">
      <div class="big-card">
        <div class="lbl">${row.kode} — ${row.nama}</div>
        <div class="val">Rp ${fmt(value)}</div>
        <div class="sub">Total Pendapatan Bulan Ini — ${label} ${year}</div>
      </div>
    </div>
    <div class="chart-wrap" style="height:230px;margin-top:14px;"><canvas id="filterCompareChartP"></canvas></div>
    <div class="filter-compare">${compareHtml}</div>
  `;
  renderFilterCompareChartP(label, year, compareValues);
}

let filterChartInstanceP;
function renderFilterChartP(labels, values){
  const canvas = $('#filterChartP');
  if(!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(91,141,239,0.48)');
  gradient.addColorStop(1, 'rgba(91,141,239,0.02)');
  if(filterChartInstanceP) filterChartInstanceP.destroy();
  filterChartInstanceP = new Chart(ctx, {
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

let filterCompareChartInstanceP;
function renderFilterCompareChartP(label, currentYear, values){
  const canvas = $('#filterCompareChartP');
  if(!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;

  const colors = [
    {top:'#a9c4f5', bottom:'#7ba4ef'}, // 2024 (biru muda)
    {top:'#8fb3ff', bottom:'#5b8def'}, // 2025 (biru sedang)
    {top:'#5b8def', bottom:'#3566d6'}, // 2026 (biru tua)
  ];
  const backgrounds = FILTER_YEARS_P.map((y,i)=>{
    const g = ctx.createLinearGradient(0, 0, 0, 230);
    const c = colors[i];
    const dim = y !== currentYear;
    g.addColorStop(0, dim ? hexA(c.top,0.35) : c.top);
    g.addColorStop(1, dim ? hexA(c.bottom,0.35) : c.bottom);
    return g;
  });

  if(filterCompareChartInstanceP) filterCompareChartInstanceP.destroy();
  filterCompareChartInstanceP = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: FILTER_YEARS_P.map(y => label + ' ' + y),
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
        tooltip: {callbacks: {
          label: c => 'Rp ' + fmt(c.parsed.y),
          afterLabel: c => {
            if(c.dataIndex === 0) return '';
            const prev = values[c.dataIndex - 1], cur = values[c.dataIndex];
            if(prev === null || prev === undefined || cur === null || cur === undefined || prev === 0) return '';
            const pct = (cur - prev) / Math.abs(prev) * 100;
            return 'vs ' + FILTER_YEARS_P[c.dataIndex - 1] + ': ' + pctChangeText_(pct);
          }
        }}
      },
      scales: {
        y: {ticks: {callback: v => (v/1e6).toFixed(0)+'jt'}, grid: {color:'#eef0fb'}},
        x: {grid: {display:false}}
      }
    },
    plugins: [barShadowPlugin, pctChangeBarPlugin]
  });
}

function initFilterP(){
  populateFilterTahunP();
  $('#filterTahunP').value = '2026';
  populateFilterBulanP('2026');
  populateFilterRekeningP('2026');
  renderFilterResultP();
  initFilterRangeCompareP();

  $('#filterTahunP').addEventListener('change', ()=>{
    const year = $('#filterTahunP').value;
    const keepKode = $('#filterRekeningP').value;
    populateFilterBulanP(year);
    populateFilterRekeningP(year, keepKode);
    renderFilterResultP();
    renderFilterRangeCompareP();
  });
  $('#filterBulanP').addEventListener('change', renderFilterResultP);
  $('#filterRekeningP').addEventListener('change', ()=>{
    renderFilterResultP();
    renderFilterRangeCompareP();
  });
}

function khususAvailableYearsP_(){
  return ['2024','2025','2026'].filter(y=> STATE_P.khusus[y] && STATE_P.khusus[y].bulan_label && STATE_P.khusus[y].bulan_label.length);
}

function khususPeriodeInRangeP_(kode, from, to){
  if(!from || !to || !kode) return [];
  const out = [];
  ['2024','2025','2026'].forEach(year=>{
    const data = STATE_P.khusus[year];
    if(!data) return;
    // Kode rekening Pendapatan bisa BEDA antar tahun meski maksudnya sama
    // (lihat sheet 'Konversi' di Rekap_Pendapatan xlsx) -- jadi cari dulu kode
    // PADANAN utk tahun ini via resolveKonversiKodeP_, baru cocokkan ke rows.
    const kodeTahunIni = resolveKonversiKodeP_(kode, year);
    const row = data.rows.find(r=>r.kode===kodeTahunIni);
    if(!row) return;
    data.bulan_label.forEach((m,i)=>{
      const monthNum = MONTH_NAMES.indexOf(m) + 1;
      if(monthNum < 1) return;
      const periode = `${year}-${String(monthNum).padStart(2,'0')}`;
      if(periode >= from && periode <= to){
        out.push({ periode, value: row.bulanan[i] });
      }
    });
  });
  return out.sort((a,b)=> a.periode.localeCompare(b.periode));
}

function updateFilterRangeBoundsP_(){
  const periods = (STATE_P.tren||[]).map(r=>r.periode).filter(Boolean).slice().sort();
  const minP = periods[0], maxP = periods[periods.length-1];
  let clamped = false;
  ['filterRangeAFromP','filterRangeAToP','filterRangeBFromP','filterRangeBToP'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    if(minP) el.min = minP;
    if(maxP) el.max = maxP;
    if(maxP && el.value && el.value > maxP){ el.value = maxP; clamped = true; }
    if(minP && el.value && el.value < minP){ el.value = minP; clamped = true; }
  });
  return clamped;
}

let FILTER_RANGE_INITED_P_ = false;
function initFilterRangeCompareP(){
  const years = khususAvailableYearsP_();
  updateFilterRangeBoundsP_();
  ['filterRangeAFromP','filterRangeAToP','filterRangeBFromP','filterRangeBToP'].forEach(id=>{
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', renderFilterRangeCompareP);
  });
  if(years.length >= 2){
    const yA = years[0], yB = years[years.length-1];
    $('#filterRangeAFromP').value = `${yA}-01`; $('#filterRangeAToP').value = `${yA}-07`;
    $('#filterRangeBFromP').value = `${yB}-01`; $('#filterRangeBToP').value = `${yB}-07`;
  } else if(years.length === 1){
    $('#filterRangeAFromP').value = `${years[0]}-01`; $('#filterRangeAToP').value = `${years[0]}-07`;
    $('#filterRangeBFromP').value = `${years[0]}-01`; $('#filterRangeBToP').value = `${years[0]}-07`;
  }
  FILTER_RANGE_INITED_P_ = true;
  renderFilterRangeCompareP();
}

let filterRangeChartP;
function renderFilterRangeCompareP(){
  const canvas = $('#filterRangeChartP');
  const summary = $('#filterRangeSummaryP');
  const labelEl = $('#filterRangeKodeLabelP');
  if(!canvas || !summary || typeof Chart === 'undefined') return;

  const kode = $('#filterRekeningP').value;
  const year = $('#filterTahunP').value;
  const data = STATE_P.khusus[year];
  const row = data ? data.rows.find(r=>r.kode===kode) : null;
  if(labelEl) labelEl.textContent = row ? `${row.kode} — ${row.nama}` : '-';

  const fromA = $('#filterRangeAFromP').value, toA = $('#filterRangeAToP').value;
  const fromB = $('#filterRangeBFromP').value, toB = $('#filterRangeBToP').value;
  const rowsA = khususPeriodeInRangeP_(kode, fromA, toA);
  const rowsB = khususPeriodeInRangeP_(kode, fromB, toB);

  if(!kode || !fromA || !toA || !fromB || !toB || fromA > toA || fromB > toB || (!rowsA.length && !rowsB.length)){
    summary.innerHTML = '<div class="filter-empty">Pilih rekening & rentang bulan yang valid untuk kedua sisi (A dan B).</div>';
    if(filterRangeChartP){ filterRangeChartP.destroy(); filterRangeChartP = null; }
    return;
  }

  const len = Math.max(rowsA.length, rowsB.length);
  const labels = Array.from({length: len}, (_,i)=>{
    const src = rowsA[i] || rowsB[i];
    return src ? MONTH_NAMES[parseInt(String(src.periode).split('-')[1],10)-1] : ('Bulan ke-'+(i+1));
  });
  const dataA = Array.from({length: len}, (_,i)=> rowsA[i] ? rowsA[i].value : null);
  const dataB = Array.from({length: len}, (_,i)=> rowsB[i] ? rowsB[i].value : null);

  const totalA = rowsA.reduce((s,r)=>s+r.value,0);
  const totalB = rowsB.reduce((s,r)=>s+r.value,0);
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
  if(filterRangeChartP) filterRangeChartP.destroy();
  filterRangeChartP = new Chart(ctx, {
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
      layout:{padding:{top:58}},
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    },
    plugins:[lineShadowPlugin, pctChangeRangeComparePlugin]
  });
}

/* ---------------- Khusus per tahun ---------------- */
function renderKhusus(year){
  const data = STATE.khusus[year];
  const theadRow = $(`#tblKhusus${year} thead tr`);
  theadRow.innerHTML = '<th>Kode</th><th>Nama Rekening</th><th>Pagu Belanja</th>' +
    data.bulan_label.map(m=>`<th>${m}</th>`).join('') +
    '<th>Total</th><th>% Realisasi SPJ</th><th>Sisa Anggaran</th>';
  const tbody = $(`#tblKhusus${year} tbody`);
  const q = ($(`#searchKhusus${year}`).value||'').toLowerCase();
  const rows = data.rows.filter(r=>r.nama.toLowerCase().includes(q) || r.kode.includes(q));
  tbody.innerHTML = rows.map(r=>{
    // Pagu Belanja/% Realisasi/Sisa Anggaran: pagu{tahun} sudah melekat di SETIAP
    // baris apapun tahun sumber transaksinya (lihat getBelanjaPaguMap_ di Code.gs,
    // di-key pakai kode ternormalisasi jadi nilainya sama utk 2024/2025/2026) --
    // jadi persen & sisa dihitung di sini (client-side) generik utk halaman Khusus
    // tahun manapun (2024/2025/2026), bukan cuma 2026 seperti r.persen2026 bawaan
    // backend (yang emang cuma diisi backend saat kolom sumbernya tahun 2026).
    const pagu = r['pagu' + year];
    const persen = pagu ? (r.total / pagu * 100) : null;
    const sisa = (pagu !== undefined && pagu !== null) ? (pagu - r.total) : null;
    return `<tr data-kode="${r.kode}" data-nama="${r.nama.replace(/"/g,'&quot;')}" data-year="${year}" title="Klik untuk lihat rincian transaksi BKU ${year}">
      <td class="lvl-${r.depth}">${r.kode}</td>
      <td class="lvl-${r.depth}">${r.nama}</td>
      <td class="col-pagu">${pagu ? fmt(pagu) : '-'}</td>
      ${r.bulanan.map(v=>`<td>${fmt(v)}</td>`).join('')}
      <td><b>${fmt(r.total)}</b></td>
      <td class="col-persen">${fmtPersenID_(persen)}</td>
      <td class="col-pagu">${sisa !== null ? fmt(sisa) : '-'}</td>
    </tr>`;
  }).join('');
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
  perbandingan: [], // tidak ada snapshot statis -- baru terisi setelah khusus_pendapatan live berhasil (lihat buildPerbandinganFromKhususP_)
  khusus: (typeof REKAP_DATA_PENDAPATAN !== 'undefined') ? REKAP_DATA_PENDAPATAN.khusus : {},
  live: false,
};

// Versi Pendapatan dari buildPerbandinganFromKhusus_() (Belanja) -- BEDA dari Belanja
// dalam 1 hal (atas permintaan eksplisit user): baris dari kode 2024/2025 digabung
// OTOMATIS dengan padanan kode 2026-nya lewat peta Konversi (PENDAPATAN_KONVERSI_MAP_,
// sumbernya sheet "Konversi" -- sama seperti yang dipakai fitur "Perbandingan Rentang
// Bulan per Rekening" di halaman Filter). Kode akun HIERARKI (bukan level akun/leaf,
// mis. "4", "4.1", "4.1.02" dst) TETAP digabung apa adanya lewat kode mentah seperti
// biasa -- itu memang identik persis antar tahun sampai level "4.1.02" (lihat komentar
// di resolveKonversiKodeP_). KETERBATASAN yang perlu diketahui: peta Konversi cuma
// mencakup 42 akun level LEAF (paling detail), jadi kode level MENENGAH (antara "4.1.02"
// dan leaf) yang konvensinya beda 2024/2025 vs 2026 TIDAK ada di peta ini -- baris level
// menengah itu tetap tampil terpisah per konvensi (sama seperti sebelumnya), sampai peta
// Konversi diperluas mencakup semua level.
function buildPerbandinganFromKhususP_(){
  const map = {};
  ['2024','2025','2026'].forEach(y=>{
    const d = STATE_P.khusus[y];
    if(!d) return;
    d.rows.forEach(r=>{
      const konv = PENDAPATAN_KONVERSI_MAP_[r.kode];
      // Kunci gabungan: kalau kode ini ada di peta Konversi (akun leaf), pakai kunci
      // stabil berbasis padanan (kode2026 diutamakan, lalu 2025, lalu 2024) supaya baris
      // 2024/2025/2026 akun yang SAMA (mis. "Rawat Jalan") jatuh ke 1 baris yang sama.
      // Kalau tidak ada di peta (kode hierarki/level menengah), fallback ke kode mentah
      // seperti semula -- baris cuma gabung kalau kode mentahnya memang identik.
      const key = konv ? ('KV#' + (konv.kode2026 || konv.kode2025 || konv.kode2024)) : r.kode;
      if(!map[key]) map[key] = { kode:r.kode, kodeByYear:{}, nama:r.nama, depth:r.depth, '2024':null, '2025':null, '2026':null,
        pagu2024:null, pagu2025:null, pagu2026:null, persen2026:null };
      map[key][y] = r.total;
      map[key].kodeByYear[y] = r.kode;
      // Kode yg ditampilkan: utamakan kode 2026 (konvensi aktif sekarang) begitu ketemu,
      // supaya user melihat kode yg sedang berlaku -- fallback ke kode tahun manapun yg
      // pertama ditemukan kalau baris ini belum/tidak punya data 2026.
      if(y === '2026' || !map[key].kode) map[key].kode = r.kode;
      // Nama: pakai nama standar dari tabel Konversi kalau ada (konsisten antar tahun),
      // fallback ke nama baris itu sendiri.
      map[key].nama = (konv && konv.nama) ? konv.nama : r.nama;
      map[key].depth = r.depth;
      // PENTING (fix bug clobber): pagu2024/2025/2026 sumbernya baris SD Bulan Ini yg
      // keyed per kode mentah spesifik-tahun -- baris kode 2024/2025 cuma bawa pagu2024 &
      // pagu2025 (pagu2026-nya 0 krn lookup pakai kode lama), baris kode 2026 cuma bawa
      // pagu2026 (pagu2024/2025-nya 0). Kalau overwrite tanpa syarat, nilai yg sudah benar
      // dari 1 baris akan ketiban 0 dari baris satunya begitu digabung -- jadi HANYA
      // overwrite kalau nilai barunya truthy (bukan 0/null), supaya nilai yg sudah terisi
      // benar dari baris lain tidak pernah tertimpa 0.
      if(r.pagu2024) map[key].pagu2024 = r.pagu2024;
      if(r.pagu2025) map[key].pagu2025 = r.pagu2025;
      if(r.pagu2026) map[key].pagu2026 = r.pagu2026;
      if(r.persen2026 !== undefined && r.persen2026 !== null) map[key].persen2026 = r.persen2026;
    });
  });
  return Object.values(map).sort((a,b)=> a.kode.localeCompare(b.kode, undefined, {numeric:true}));
}

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
  // PENTING (fix bug: klik "Sync Google Sheet" berkali-kali tidak mengubah apa-apa
  // meski file Rekap_Pendapatan_2024_2025_2026.xlsx sudah diedit): ringkasan_pendapatan
  // & tren_pendapatan di bawah ini HANYA baca cache di Rekap_SPJ_Dashboard_Live_Data
  // (Code.gs readRows_), TIDAK PERNAH menyentuh xlsx-nya sendiri. Cache itu sebelumnya
  // cuma di-refresh oleh trigger per-jam (syncPendapatanFromXlsx di Sync_Pendapatan.gs),
  // jadi kalau xlsx baru diedit dan trigger jam berikutnya belum jalan, tombol Sync di
  // dashboard percuma diklik berapa kali pun. Baris ini memaksa Code.gs menjalankan
  // syncPendapatanFromXlsx() DULU (via view=sync_pendapatan_cache) setiap kali fungsi
  // ini dipanggil, baru setelah itu baca ringkasan/tren -- jadi tombol Sync sekarang
  // benar-benar menarik data terbaru, bukan cuma mengulang baca cache lama. Dibungkus
  // try/catch terpisah & tidak melempar error supaya kalau endpoint ini gagal (mis.
  // timeout), pembacaan ringkasan/tren di bawah tetap jalan pakai cache yang ada.
  try{
    await fetch(`${APPS_SCRIPT_URL}?view=sync_pendapatan_cache`, {method:'GET'});
  }catch(err){
    console.warn('Gagal memicu sync_pendapatan_cache (lanjut pakai cache terakhir):', err);
  }
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
      // refresh batas min/max picker Rentang A/B supaya ikut bulan terbaru yang baru masuk
      if(typeof updateTrenRangeBoundsP_ === 'function'){
        const clamped = updateTrenRangeBoundsP_();
        if((clamped || TREN_EXTRA_INITED_P_) && typeof renderTrenRangeCompareP === 'function') renderTrenRangeCompareP();
      }
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
    let any = false;
    ['2024','2025','2026'].forEach(y=>{
      const d = json.khusus[y];
      if(d && d.rows && d.rows.length){
        STATE_P.khusus[y] = { bulan_label: d.bulan_label, rows: d.rows };
        any = true;
      }
    });
    // PENTING (urutan): peta Konversi HARUS sudah terisi SEBELUM buildPerbandinganFromKhususP_()
    // dipanggil, karena fungsi itu sekarang pakai PENDAPATAN_KONVERSI_MAP_ utk menggabungkan
    // baris kode 2024/2025 dgn padanan 2026-nya -- kalau dibalik, penggabungan gagal total di
    // load pertama (peta masih kosong) & baru bekerja setelah refresh kedua.
    if(json.konversi_pendapatan) setPendapatanKonversiMap_(json.konversi_pendapatan);
    if(any) STATE_P.perbandingan = buildPerbandinganFromKhususP_();
    if(json.khusus.tanggal_terakhir) STATE_P.tanggal_terakhir = json.khusus.tanggal_terakhir;
    updateDataPerBadgeP_();
  }catch(err){
    console.warn('Gagal memuat pohon akun Pendapatan (khusus) live, tetap pakai data snapshot:', err);
  }
}

// ---- Peta konversi kode rekening Pendapatan lintas tahun ----
// Sumbernya sheet 'Konversi' di Rekap_Pendapatan_2024_2025_2026.xlsx (backend
// Code.gs -> getPendapatanKonversiList_()), dipakai supaya fitur "Perbandingan
// Rentang Bulan per Rekening" bisa menarik data tahun lain pakai kode PADANAN
// (bukan asumsi kode sama persis) -- lihat resolveKonversiKodeP_ di bawah.
// Map dibangun 1x per kode: kode2024/2025/2026 (kalau ada) semuanya menunjuk ke
// row yang sama, jadi lookup dari kode tahun manapun langsung ketemu row-nya.
let PENDAPATAN_KONVERSI_LIST_ = [];
let PENDAPATAN_KONVERSI_MAP_ = {};
function setPendapatanKonversiMap_(list){
  PENDAPATAN_KONVERSI_LIST_ = list || [];
  const map = {};
  PENDAPATAN_KONVERSI_LIST_.forEach(row=>{
    ['kode2024','kode2025','kode2026'].forEach(k=>{
      if(row[k]) map[row[k]] = row;
    });
  });
  PENDAPATAN_KONVERSI_MAP_ = map;
}

// Diberi 1 kode (dari tahun manapun) + tahun tujuan, kembalikan kode yang
// SEHARUSNYA dipakai di tahun tujuan itu (kode padanan dari sheet Konversi).
// Kalau kodenya tidak terdaftar di peta (mis. bukan rekening Pendapatan yang
// ada di sheet Konversi -- jarang terjadi tapi mungkin ada rekening baru yang
// belum sempat dipetakan manual), fallback ke kode aslinya apa adanya supaya
// perilaku lama (asumsi kode sama) tetap jalan alih-alih data hilang total.
function resolveKonversiKodeP_(kode, targetYear){
  const row = PENDAPATAN_KONVERSI_MAP_[kode];
  if(!row) return kode;
  const target = row['kode' + targetYear];
  return target || kode;
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
  // jaring pengaman: tiap kali tab Tren Pendapatan dibuka, pastikan batas min/max
  // picker Rentang A/B (menu Perbandingan Rentang Bulan) sudah sinkron dengan bulan
  // terbaru di STATE_P.tren -- lihat komentar di updateTrenRangeBoundsP_().
  if(typeof TREN_EXTRA_INITED_P_ !== 'undefined' && TREN_EXTRA_INITED_P_ && typeof updateTrenRangeBoundsP_ === 'function'){
    const clamped = updateTrenRangeBoundsP_();
    if(clamped && typeof renderTrenRangeCompareP === 'function') renderTrenRangeCompareP();
  }
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
  if(name==='filter-p') setTimeout(()=>{
    if(typeof updateFilterRangeBoundsP_ === 'function'){
      const clamped = updateFilterRangeBoundsP_();
      if((clamped || FILTER_RANGE_INITED_P_) && typeof renderFilterRangeCompareP === 'function') renderFilterRangeCompareP();
    }
  }, 30);
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
  // Jaring pengaman sama seperti Tren: pastikan batas min/max picker Rentang
  // A/B (Perbandingan Rentang Bulan per Rekening) sudah sinkron dgn bulan
  // terbaru tiap kali tab Filter dibuka.
  if(name==='filter') setTimeout(()=>{
    if(typeof updateFilterRangeBounds_ === 'function'){
      const clamped = updateFilterRangeBounds_();
      if((clamped || FILTER_RANGE_INITED_) && typeof renderFilterRangeCompare === 'function') renderFilterRangeCompare();
    }
  }, 30);
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
// PENTING (bug ditemukan setelah deploy, sekarang jadi acuan pola AMAN): showView()
// milik modul Belanja pakai $$('.view') -- selector GLOBAL ke seluruh dokumen,
// bukan cuma di dalam #appRoot -- yang dulu pernah mencabut class "active" dari
// section Gabungan tanpa sengaja (sama-sama pakai class .view). showViewG() di
// bawah ini SENGAJA meniru pola AMAN showViewP() (Pendapatan): semua query
// di-scope ke `#appRootGabungan` saja, tidak pernah ke $$('.view') global.
// PENTING (bug baru ditemukan setelah deploy, pola SAMA dgn bug lama yg
// didokumentasikan di atas): initNav() milik modul Belanja MEMANGGIL
// showView('ringkasan') SEKALI saat main() -- dan showView() pakai $$('.view')
// GLOBAL, jadi class "active" tercabut dari SEMUA elemen .view di seluruh
// dokumen, termasuk #view-ringkasan-g/#view-tren-g milik Gabungan (walau
// sudah di-hardcode "view active" di HTML). Modul Pendapatan tidak kena krn
// initNavP() langsung showViewP('ringkasan-p') balik SETELAH initNav()
// Belanja jalan (main() panggil initNav() dulu baru initNavP()) -- jadi
// Pendapatan menimpa ulang tepat waktu. Gabungan SENGAJA tidak dibuat begitu
// (supaya canvas trenYearlyChartG tidak dibuat saat masih display:none), jadi
// section-nya kosong terus sampai showGabunganApp() dipanggil. Fix:
// showGabunganApp() SELALU memanggil showViewG() (bukan cuma baca DOM)
// supaya class "active" yg benar ditulis ulang setiap modul dibuka, apapun
// kondisinya sebelum itu.
let GABUNGAN_LAST_VIEW_ = 'ringkasan-g';

function showGabunganApp(){
  $('#hubScreen').style.display = 'none';
  $('#comingSoonScreen').style.display = 'none';
  $('#appRoot').style.display = 'none';
  $('#appRootPendapatan').style.display = 'none';
  $('#appRootGabungan').style.display = 'flex';
  showViewG(GABUNGAN_LAST_VIEW_);
}

// Ringkasan Eksekutif (KPI besar + status kategori + tren tahunan + anomali)
// jadi view DEFAULT modul Gabungan (lihat class="view active" di HTML pada
// #view-ringkasan-g) -- "Pendapatan Vs Belanja" (tren bulanan detail, kode
// rekening dsb) sekarang jadi menu ke-2, "mode detail" utk staf keuangan.
function showViewG(name){
  const root = $('#appRootGabungan');
  if(!root) return;
  root.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const target = document.getElementById(`view-${name}`);
  if(target) target.classList.add('active');
  root.querySelectorAll('.nav-item[data-viewg]').forEach(n=>n.classList.toggle('active', n.dataset.viewg===name));
  GABUNGAN_LAST_VIEW_ = name;
  if(name==='tren-g') setTimeout(()=>{
    // alreadyInited: kalau extras (Rentang Bulan/Bulan Sama) sudah pernah
    // di-setup sebelumnya (bukan kunjungan pertama ke tab ini), render ulang
    // KEDUANYA scr eksplisit -- supaya tombol refresh/sync juga menyegarkan
    // 2 chart itu, sama seperti perilaku refreshGabunganIfVisible_() semula.
    const alreadyInited = TREN_EXTRA_INITED_G_;
    renderTrenGabungan();
    initTrenExtrasG_();
    if(alreadyInited){ renderTrenRangeCompareG(); renderTrenSameMonthCompareG(); }
  }, 30);
  if(name==='ringkasan-g') setTimeout(renderRingkasanEksekutifG_, 30);
}

function initNavG(){
  const root = $('#appRootGabungan');
  if(!root) return;
  root.querySelectorAll('.nav-item[data-viewg]').forEach(item=>{
    item.addEventListener('click', ()=>showViewG(item.dataset.viewg));
  });
  // TIDAK memanggil showViewG() di sini seperti initNavP() -- beda dari modul
  // Pendapatan, view default Gabungan (ringkasan-g) PUNYA canvas Chart.js
  // (trenYearlyChartG). Kalau dipanggil di sini (saat main() jalan,
  // #appRootGabungan masih display:none), grafiknya akan dibuat dgn ukuran
  // 0x0. Render pertama cukup dipicu showGabunganApp() saat kartu diklik --
  // showGabunganApp() sekarang SELALU memanggil showViewG() (lihat komentar
  // panjang di atasnya), jadi class "active" tetap ditulis ulang dgn benar.
}

// Render ulang view Gabungan yang SEDANG aktif -- dipakai tombol refresh/sync
// (yang tidak tahu/tidak perlu tahu sub-view mana yg sedang dilihat). Pakai
// GABUNGAN_LAST_VIEW_ (bukan baca ulang class "active" di DOM), krn class itu
// bisa saja sudah tercabut oleh bug global showView() milik Belanja di atas.
function renderActiveGabunganView_(){
  const root = $('#appRootGabungan');
  if(!root) return;
  showViewG(GABUNGAN_LAST_VIEW_);
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

/* ================================================================
   RINGKASAN EKSEKUTIF & DETEKSI ANOMALI (untuk manajemen/dewan
   pengawas -- 6 KPI besar, status warna per kategori, tren tahunan
   sederhana, panel "Perlu Perhatian"). Tanpa kode rekening sama
   sekali -- menu Perbandingan/Filter/Khusus Tahun tetap ada terpisah
   sebagai "mode detail" untuk staf keuangan.
   ================================================================ */

// Tahun anggaran yang dianggap "berjalan" utk KPI & anomali -- 2026 (tahun
// sistem saat fitur ini dibuat), dgn fallback ke tahun lain kalau STATE.ringkasan
// 2026 kebetulan belum terisi (mis. live fetch gagal & snapshot lama belum
// mencakup 2026). TIDAK menebak kode rekening root ('5'/'4') sama sekali --
// KPI di bawah murni pakai STATE.ringkasan/STATE_P.ringkasan yang sudah
// terbukti benar (dipakai juga oleh halaman Ringkasan Bulan Ini per modul).
function execTahunAktifG_(){
  const cand = ['2026','2025','2024'];
  for(const y of cand){
    if((STATE.ringkasan[y] && STATE.ringkasan[y].total) || STATE_P.ringkasan[y]) return y;
  }
  return '2026';
}

function renderExecKpiRowG_(){
  const wrap = $('#execKpiRow');
  if(!wrap) return;
  const year = execTahunAktifG_();
  const b = STATE.ringkasan[year] && STATE.ringkasan[year].total;
  const p = STATE_P.ringkasan[year];

  const labelEl = $('#execKpiPeriodeLabel');
  if(labelEl){
    const lb = (b && b.label_bulan) || (p && p.label_bulan) || '';
    labelEl.textContent = `— Tahun Anggaran ${year}` + (lb ? ` (s.d ${MONTH_FULL_[lb] || lb})` : '');
  }

  if(!b && !p){
    wrap.innerHTML = '<div class="anomaly-empty">Data ringkasan belum tersedia.</div>';
    return;
  }

  const selisih = (p && b) ? (p.sd_bulan_ini - b.sd_bulan_ini) : null;
  const cards = [
    { label:'Total Pendapatan (s.d bulan ini)', value: p ? 'Rp '+fmt(p.sd_bulan_ini) : '-', sub: p ? `dari target Rp ${fmt(p.pagu)}` : 'data belum tersedia' },
    { label:'% Realisasi Pendapatan', value: p ? (p.persen||0).toFixed(1)+'%' : '-', sub: p ? `sisa target Rp ${fmt(p.sisa_pagu)}` : '' },
    { label:'Total Belanja (s.d bulan ini)', value: b ? 'Rp '+fmt(b.sd_bulan_ini) : '-', sub: b ? `dari pagu Rp ${fmt(b.pagu)}` : 'data belum tersedia' },
    { label:'% Realisasi Belanja', value: b ? (b.persen||0).toFixed(1)+'%' : '-', sub: b ? `sisa pagu Rp ${fmt(b.sisa)}` : '' },
    { label:'Sisa Anggaran Belanja', value: b ? 'Rp '+fmt(b.sisa) : '-', sub: 'pagu dikurangi realisasi SPJ berjalan' },
    { label:'Selisih Pendapatan – Belanja', value: selisih!==null ? (selisih>=0?'Rp ':'-Rp ')+fmt(Math.abs(selisih)) : '-',
      sub: selisih!==null ? (selisih>=0?'surplus s.d bulan ini':'defisit s.d bulan ini') : '',
      cls: selisih!==null ? (selisih>=0?'positive':'negative') : '' },
  ];
  wrap.innerHTML = cards.map(c=>`
    <div class="exec-kpi-card ${c.cls||''}">
      <div class="exec-kpi-label">${c.label}</div>
      <div class="exec-kpi-value">${c.value}</div>
      <div class="exec-kpi-sub">${c.sub}</div>
    </div>
  `).join('');
}

// Status warna per kategori besar (depth===1 di pohon STATE.khusus/STATE_P.khusus,
// mis. "Belanja Operasi", "Belanja Modal", "PENDAPATAN ASLI DAERAH (PAD)") --
// dibanding target PROPORSIONAL (yearFraction = bulan berjalan/12), bukan cuma
// dibanding 100%, supaya adil dibandingkan di pertengahan tahun.
function yearFractionDariBulanLabel_(bulanLabel){
  return (bulanLabel && bulanLabel.length) ? bulanLabel.length/12 : 0;
}

function statusWarnaKategoriG_(persen, yearFraction, isPendapatan){
  const expected = yearFraction*100;
  if(isPendapatan){
    // Pendapatan: makin tinggi makin baik. Merah kalau jauh di bawah pace,
    // kuning kalau agak di bawah, hijau kalau on-pace atau lebih (surplus
    // pendapatan bukan masalah).
    if(persen >= expected*0.75 || persen >= 90) return 'green';
    if(persen >= expected*0.5) return 'yellow';
    return 'red';
  }
  // Belanja: merah kalau nyaris habis/lewat pagu, ATAU jauh lebih cepat dari
  // pace (risiko pagu habis sebelum tahun berakhir), ATAU (di paruh kedua
  // tahun) jauh di bawah pace (risiko SILPA/anggaran tidak terserap).
  if(persen > 100 || (persen - expected) > 25) return 'red';
  if(yearFraction > 0.5 && persen < expected*0.5) return 'red';
  if((persen - expected) > 10 || (yearFraction > 0.5 && persen < expected*0.75)) return 'yellow';
  return 'green';
}

function renderExecStatusGridG_(){
  const wrap = $('#execStatusGrid');
  if(!wrap) return;
  const year = execTahunAktifG_();
  const kb = STATE.khusus[year], kp = STATE_P.khusus[year];
  const items = [];
  if(kb && kb.rows && kb.rows.length){
    const yf = yearFractionDariBulanLabel_(kb.bulan_label);
    kb.rows.filter(r=>r.depth===1).forEach(r=>{
      const pagu = r['pagu'+year];
      if(!pagu) return;
      const persen = r.total/pagu*100;
      items.push({ jenis:'Belanja', nama:r.nama, persen, sisa: pagu-r.total, status: statusWarnaKategoriG_(persen, yf, false) });
    });
  }
  if(kp && kp.rows && kp.rows.length){
    const yf = yearFractionDariBulanLabel_(kp.bulan_label);
    kp.rows.filter(r=>r.depth===1).forEach(r=>{
      const pagu = r['pagu'+year];
      if(!pagu) return;
      const persen = r.total/pagu*100;
      items.push({ jenis:'Pendapatan', nama:r.nama, persen, sisa: pagu-r.total, status: statusWarnaKategoriG_(persen, yf, true) });
    });
  }
  if(!items.length){
    wrap.innerHTML = '<div class="anomaly-empty">Data kategori per tahun (Khusus Tahun) belum tersedia.</div>';
    return;
  }
  wrap.innerHTML = items.map(it=>`
    <div class="status-card st-${it.status}">
      <div class="status-card-head">
        <span class="status-dot dot-${it.status}"></span>
        <span class="status-card-title">${it.nama}</span>
      </div>
      <div class="status-card-jenis">${it.jenis}</div>
      <div class="status-card-pct">${it.persen.toFixed(1)}% terealisasi</div>
      <div class="status-card-sub">${it.jenis==='Belanja' ? 'Sisa pagu' : 'Sisa target'} Rp ${fmt(it.sisa)}</div>
      <div class="status-card-bar"><div class="status-card-bar-fill" style="width:${Math.min(Math.max(it.persen,0),100)}%"></div></div>
    </div>
  `).join('');
}

// Tren tahunan sederhana: total realisasi Pendapatan vs Belanja PER TAHUN
// (2024/2025/2026), dari STATE.ringkasan/STATE_P.ringkasan yang sudah
// terbukti benar (sama seperti KPI di atas) -- bukan dari pohon akun, jadi
// tanpa kode rekening & tanpa perlu tebak kode root.
let trenYearlyChartG;
function renderTrenYearlyG_(){
  const canvas = $('#trenYearlyChartG');
  if(!canvas || typeof Chart === 'undefined') return;
  const years = ['2024','2025','2026'];
  const belanja = years.map(y => (STATE.ringkasan[y] && STATE.ringkasan[y].total) ? STATE.ringkasan[y].total.sd_bulan_ini : null);
  const pendapatan = years.map(y => STATE_P.ringkasan[y] ? STATE_P.ringkasan[y].sd_bulan_ini : null);

  const ctx = canvas.getContext('2d');
  if(trenYearlyChartG) trenYearlyChartG.destroy();
  trenYearlyChartG = new Chart(ctx, {
    type:'bar',
    data:{
      labels: years,
      datasets:[
        {label:'Pendapatan', data:pendapatan, backgroundColor:'#f0a35b', borderRadius:6, maxBarThickness:70},
        {label:'Belanja', data:belanja, backgroundColor:'#5b8def', borderRadius:6, maxBarThickness:70},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'top', labels:{boxWidth:12, font:{size:11}}},
        tooltip:{callbacks:{label:c=> c.dataset.label + ': ' + (c.parsed.y===null ? 'tidak ada data' : 'Rp ' + fmt(c.parsed.y))}}
      },
      scales:{
        y:{ticks:{callback:v=>(v/1e6).toFixed(0)+'jt'}, grid:{color:'#eef0fb'}},
        x:{grid:{display:false}}
      }
    }
  });
  const lbl = $('#execTrenYearlyLabel');
  if(lbl) lbl.textContent = '— total realisasi s.d bulan terakhir tiap tahun (2024 & 2025 satu tahun penuh, 2026 masih berjalan)';
}

// Baris "leaf" (rekening paling detail, bukan kategori/subtotal) di satu
// tahun Khusus Tahun. PENTING (bug ditemukan saat verifikasi live sebelum
// fitur ini diserahkan): sebelumnya dipakai "r.depth >= 2" utk menandai leaf
// -- ternyata SALAH, karena kedalaman pohon Belanja (maks depth 5) dan
// Pendapatan (maks depth 7) TERNYATA BEDA (dicek langsung dari data live: 147
// baris Belanja depth 0-5, 49 baris Pendapatan depth 0-7). Akibatnya baris
// kategori besar spt "Belanja Pegawai" (depth 2, cuma 5 baris di Belanja) dan
// kategori Pendapatan yg masih depth 2-6 (belum leaf) ikut kehitung sbg
// "rekening", bikin panel anomali kebanjiran (78 vs seharusnya cuma leaf asli)
// dan narasi menyebut nama kategori besar seolah itu 1 rekening. Definisi
// leaf yg benar (dipakai sekarang): baris yg TIDAK punya baris lain dgn kode
// berawalan "kode-nya sendiri + '.'" (tidak punya anak) -- brlaku apapun
// angka depth-nya, otomatis benar utk pohon Belanja & Pendapatan yg beda dalam.
function filterLeafRowsG_(rows){
  if(!rows || !rows.length) return [];
  const kodes = rows.map(r=>String(r.kode));
  return rows.filter(r=>{
    const k = String(r.kode);
    return !kodes.some(other => other!==k && other.startsWith(k+'.'));
  });
}

// ---- Deteksi anomali otomatis (panel "Perlu Perhatian") ----
// 4 kriteria: (1) realisasi 0% padahal sudah pertengahan tahun, (2) lonjakan
// bulanan >50% dari bulan sebelumnya, (3) realisasi sudah >90% pagu padahal
// baru < separuh tahun anggaran berjalan, (4) TOTAL realisasi Belanja/
// Pendapatan di bawah target proporsional bulan berjalan (mis. bulan Juni,
// realisasi/SPJ Belanja seharusnya minimal ~50% dari pagu, Pendapatan minimal
// ~50% dari target -- sesuai arahan user). Kriteria (1)-(3) dijalankan per
// akun GRANULAR (leaf, lihat filterLeafRowsG_ di atas -- bukan kategori/
// subtotal); kriteria (4) di level TOTAL keseluruhan Belanja/Pendapatan (bukan
// per rekening -- kategori besar sudah ada indikator warnanya sendiri di
// panel "Status Realisasi per Kategori" di atas, supaya tidak dobel).
// r.bulanan[] dipakai kriteria (1)-(3) berisi angka BULANAN (bukan kumulatif)
// -- sudah diverifikasi dari data live (naik-turun antar bulan, bukan monoton
// naik spt angka kumulatif).
function bulanFull_(abbr){ return MONTH_FULL_[abbr] || abbr || ''; }

// Toleransi kriteria (4): TIDAK memakai "persen < target" mentah (selisih
// tipis krn pembulatan bulan/tanggal berjalan bukan anomali sungguhan -- mis.
// Belanja 66,26% vs target proporsional 66,67% di tgl 17 Agustus itu hampir
// pas, bukan "kurang"). Baru dianggap kuning kalau selisih >5 poin, merah
// kalau >20 poin di bawah target.
function severitasKekuranganTarget_(shortfall){
  if(shortfall > 20) return 'red';
  if(shortfall > 5) return 'yellow';
  return null;
}

function scanAnomaliJenisG_(khususState, year, jenisLabel, totalPersen, isPendapatan){
  const data = khususState[year];
  if(!data || !data.rows || !data.rows.length) return [];
  const bulanLabel = data.bulan_label || [];
  const monthsElapsed = bulanLabel.length;
  const yearFraction = monthsElapsed ? monthsElapsed/12 : 0;
  const items = [];

  // Kriteria 4: TOTAL Belanja/Pendapatan di bawah target proporsional
  if(totalPersen !== null && totalPersen !== undefined && yearFraction > 0){
    const expected = yearFraction*100;
    const shortfall = expected - totalPersen;
    const sev = severitasKekuranganTarget_(shortfall);
    if(sev){
      const kata = isPendapatan ? 'target' : 'pagu';
      items.push({
        jenis: jenisLabel, severity: sev, kode:'', nama:`Total ${jenisLabel}`,
        desc: `Realisasi ${jenisLabel} baru ${totalPersen.toFixed(1)}%, padahal seharusnya minimal ~${Math.round(expected)}% dari ${kata} di bulan ke-${monthsElapsed} tahun anggaran ${year} (kurang ${shortfall.toFixed(1)} poin).`
      });
    }
  }

  filterLeafRowsG_(data.rows).forEach(r=>{
    const pagu = r['pagu'+year];
    const total = r.total || 0;
    const bulanan = r.bulanan || [];

    // Kriteria 1: 0% padahal sudah >= separuh tahun anggaran berjalan
    if(pagu && pagu > 0 && total === 0 && yearFraction >= 0.5){
      items.push({
        jenis: jenisLabel, severity:'red', kode:r.kode, nama:r.nama,
        desc: `Realisasi masih Rp0 padahal sudah ${monthsElapsed} dari 12 bulan tahun anggaran ${year} berjalan (pagu Rp ${fmt(pagu)}).`
      });
    }

    // Kriteria 2: lonjakan bulanan >50% vs bulan sebelumnya (ambil yg terbesar
    // per akun, supaya 1 akun tidak membanjiri daftar dgn banyak entri).
    // Catatan: lonjakan dari basis Rp0 (prev<=0) SENGAJA tidak dihitung --
    // realisasi baru muncul dari nihil itu wajar (transaksi pertama tahun
    // berjalan), bukan lonjakan yang perlu diwaspadai.
    let spike = null;
    for(let i=1; i<bulanan.length; i++){
      const prev = bulanan[i-1], cur = bulanan[i];
      if(prev === null || prev === undefined || cur === null || cur === undefined || prev <= 0) continue;
      const pct = (cur-prev)/prev*100;
      if(pct > 50 && (!spike || pct > spike.pct)) spike = {pct, i, prev, cur};
    }
    if(spike){
      items.push({
        jenis: jenisLabel, severity:'yellow', kode:r.kode, nama:r.nama,
        desc: `Lonjakan ${pctChangeText_(spike.pct)} di bulan ${bulanFull_(bulanLabel[spike.i])} ${year} dibanding bulan sebelumnya (Rp ${fmt(spike.prev)} → Rp ${fmt(spike.cur)}).`
      });
    }

    // Kriteria 3: sudah >90% pagu padahal baru < separuh tahun anggaran berjalan
    if(pagu && pagu > 0 && yearFraction > 0 && yearFraction < 0.5){
      const persen = total/pagu*100;
      if(persen > 90){
        items.push({
          jenis: jenisLabel, severity:'red', kode:r.kode, nama:r.nama,
          desc: `Realisasi sudah ${persen.toFixed(1)}% dari pagu, padahal baru ${monthsElapsed} dari 12 bulan (${Math.round(yearFraction*100)}%) tahun anggaran ${year} berjalan.`
        });
      }
    }
  });
  return items;
}

function renderAnomaliG_(){
  const wrap = $('#anomaliListG');
  if(!wrap) return;
  const year = execTahunAktifG_();
  const persenB = STATE.ringkasan[year] && STATE.ringkasan[year].total ? STATE.ringkasan[year].total.persen : null;
  const persenP = STATE_P.ringkasan[year] ? STATE_P.ringkasan[year].persen : null;
  const itemsB = scanAnomaliJenisG_(STATE.khusus, year, 'Belanja', persenB, false);
  const itemsP = scanAnomaliJenisG_(STATE_P.khusus, year, 'Pendapatan', persenP, true);
  const all = itemsB.concat(itemsP);
  const redItems = all.filter(i=>i.severity==='red');
  const yellowItems = all.filter(i=>i.severity==='yellow');

  const countLbl = $('#anomaliCountLabel');
  if(countLbl) countLbl.textContent = `— deteksi otomatis, bukan hasil cari manual (${all.length} ditemukan)`;

  const summaryWrap = $('#anomaliSummaryRow');
  if(summaryWrap){
    summaryWrap.innerHTML = `
      <div class="anomaly-summary-pill"><span class="status-dot dot-red"></span>${redItems.length} perlu perhatian segera</div>
      <div class="anomaly-summary-pill"><span class="status-dot dot-yellow"></span>${yellowItems.length} perlu dipantau</div>
    `;
  }

  if(!all.length){
    wrap.innerHTML = '<div class="anomaly-empty">Tidak ada anomali terdeteksi untuk periode berjalan.</div>';
    return;
  }

  const renderGroup = (title, list) => !list.length ? '' : `<div class="anomaly-group-title">${title}</div>` + list.map(it=>`
    <div class="anomaly-item">
      <span class="anomaly-badge b-${it.severity}">${it.severity==='red'?'Segera':'Pantau'}</span>
      <div class="anomaly-body">
        <div class="anomaly-title"><span class="anomaly-jenis">${it.jenis}</span>${it.nama}</div>
        <div class="anomaly-desc">${it.desc}</div>
      </div>
    </div>
  `).join('');

  wrap.innerHTML = renderGroup('Perlu Perhatian Segera', redItems) + renderGroup('Perlu Dipantau', yellowItems);
}

// ---- Narasi otomatis ----
// Kalimat ringkas ala "Realisasi Belanja Agustus 2026 mencapai 66,3% dari
// pagu, turun 2 poin dibanding periode sama tahun lalu. 3 rekening melebihi
// pagu bulanan." -- dibangun dari field yg SAMA dgn kartu KPI & panel anomali
// di atas/bawahnya (STATE.ringkasan/STATE_P.ringkasan utk angka bulan
// berjalan, scanAnomaliJenisG_ utk jumlah anomali), bukan hitungan terpisah,
// supaya angka yg disebut di kalimat tidak pernah beda dgn angka di kartu.
function poinPersen_(cur, prev){
  if(cur===null || cur===undefined || prev===null || prev===undefined) return null;
  return cur - prev;
}

function frasaPoinDibandingTahunLalu_(diff){
  if(diff === null) return '';
  const bulat = Math.abs(diff).toFixed(1).replace('.', ',');
  if(Math.abs(diff) < 0.05) return 'setara dengan periode sama tahun lalu';
  return (diff>0 ? 'naik' : 'turun') + ' ' + bulat + ' poin dibanding periode sama tahun lalu';
}

// Baris "total" (akar) sebuah tahun di pohon Khusus Tahun -- diambil dari
// depth PALING KECIL yg ada di array itu (bukan menebak kode rekening
// tertentu spt '5'/'4', krn itu tidak bisa diverifikasi live saat fitur ini
// ditulis -- depth adalah field asli dari backend, bukan asumsi).
function cariRootRowKhususG_(khususYearData){
  if(!khususYearData || !khususYearData.rows || !khususYearData.rows.length) return null;
  return khususYearData.rows.reduce((min,r)=> (r.depth < min.depth ? r : min), khususYearData.rows[0]);
}

// % realisasi KUMULATIF suatu tahun s.d bulan ke-(monthIdx+1), dihitung dari
// bulanan[] baris root -- dipakai utk bandingkan "periode sama" antar tahun
// (mis. s.d Agustus 2026 vs s.d Agustus 2025), bukan cuma total 1 tahun penuh
// (yg utk tahun yg sudah lewat = angka bulan Desember, bukan Agustus).
function persenSdBulanKeG_(khususYearData, year, monthIdx){
  const root = cariRootRowKhususG_(khususYearData);
  if(!root || monthIdx < 0) return null;
  const pagu = root['pagu'+year];
  if(!pagu) return null;
  const bulanan = root.bulanan || [];
  if(bulanan.length <= monthIdx) return null;
  const kumulatif = bulanan.slice(0, monthIdx+1).reduce((s,v)=> s + (v||0), 0);
  return kumulatif / pagu * 100;
}

function renderNarasiEksekutifG_(){
  const wrap = $('#execNarasiG');
  if(!wrap) return;
  const year = execTahunAktifG_();
  const prevYear = String(parseInt(year,10) - 1);

  const kb = STATE.khusus[year], kp = STATE_P.khusus[year];
  const kbPrev = STATE.khusus[prevYear], kpPrev = STATE_P.khusus[prevYear];
  const b = STATE.ringkasan[year] && STATE.ringkasan[year].total;
  const p = STATE_P.ringkasan[year];

  const monthsElapsed = (kb && kb.bulan_label && kb.bulan_label.length) || (kp && kp.bulan_label && kp.bulan_label.length) || 0;
  const monthIdx = monthsElapsed - 1;
  const labelBulan = (b && b.label_bulan) || (p && p.label_bulan) || '';
  const namaBulanPenuh = MONTH_FULL_[labelBulan] || labelBulan;

  if(!monthsElapsed || (!b && !p)){
    wrap.innerHTML = '<p class="exec-narasi-empty">Narasi otomatis belum bisa dibuat — data ringkasan tahun berjalan belum tersedia.</p>';
    return;
  }

  const kalimat = [];

  if(b){
    const persenPrev = persenSdBulanKeG_(kbPrev, prevYear, monthIdx);
    const diff = poinPersen_(b.persen, persenPrev);
    kalimat.push(`Realisasi Belanja ${namaBulanPenuh} ${year} mencapai ${fmtPersenID_(b.persen)} dari pagu (Rp ${fmt(b.sd_bulan_ini)} dari Rp ${fmt(b.pagu)})${diff!==null ? ', ' + frasaPoinDibandingTahunLalu_(diff) : ''}.`);
  }

  if(p){
    const persenPrev = persenSdBulanKeG_(kpPrev, prevYear, monthIdx);
    const diff = poinPersen_(p.persen, persenPrev);
    kalimat.push(`Realisasi Pendapatan ${namaBulanPenuh} ${year} mencapai ${fmtPersenID_(p.persen)} dari target (Rp ${fmt(p.sd_bulan_ini)} dari Rp ${fmt(p.pagu)})${diff!==null ? ', ' + frasaPoinDibandingTahunLalu_(diff) : ''}.`);
  }

  if(b && p){
    const selisih = p.sd_bulan_ini - b.sd_bulan_ini;
    kalimat.push(selisih>=0
      ? `Posisi Pendapatan vs Belanja s.d ${namaBulanPenuh} ${year} masih surplus Rp ${fmt(Math.abs(selisih))}.`
      : `Posisi Pendapatan vs Belanja s.d ${namaBulanPenuh} ${year} defisit Rp ${fmt(Math.abs(selisih))} — realisasi belanja melebihi pendapatan yang sudah masuk.`);
  }

  // Rekening yg realisasi BULAN INI-nya melebihi rata-rata pagu bulanan (pagu
  // setahun ÷ 12) -- sinyal cepat "belanja bulan ini lebih besar dari
  // biasanya" per akun, beda dari 3 kriteria panel Perlu Perhatian di bawah
  // (yg fokus ke lonjakan bulan-ke-bulan & 0%/>90% pagu thd tahun berjalan).
  if(kb && kb.rows && monthIdx>=0){
    const leafOver = filterLeafRowsG_(kb.rows).filter(r=>{
      const pagu = r['pagu'+year];
      const bulanan = r.bulanan || [];
      if(!pagu || bulanan.length <= monthIdx) return false;
      return (bulanan[monthIdx]||0) > (pagu/12);
    });
    if(leafOver.length){
      kalimat.push(`${leafOver.length} rekening Belanja melebihi rata-rata pagu bulanan (pagu setahun ÷ 12) pada bulan ${namaBulanPenuh}.`);
    }
  }

  // Ringkasan jumlah anomali -- angka SAMA dgn panel "Perlu Perhatian" di
  // bawah (dipakai ulang dari scanAnomaliJenisG_, bukan dihitung ulang dgn
  // kriteria berbeda) supaya narasi & panel tidak pernah kontradiksi.
  const itemsB = scanAnomaliJenisG_(STATE.khusus, year, 'Belanja', b ? b.persen : null, false);
  const itemsP = scanAnomaliJenisG_(STATE_P.khusus, year, 'Pendapatan', p ? p.persen : null, true);
  const semuaAnomali = itemsB.concat(itemsP);
  const totalRed = semuaAnomali.filter(i=>i.severity==='red').length;
  kalimat.push(semuaAnomali.length
    ? `Sistem mendeteksi ${semuaAnomali.length} akun perlu perhatian (${totalRed} di antaranya perlu perhatian segera) — lihat rincian di panel "Perlu Perhatian" di bawah.`
    : 'Tidak ada akun yang terdeteksi anomali pada periode berjalan.');

  wrap.innerHTML = '<p>' + kalimat.join(' ') + '</p>';
}

function renderRingkasanEksekutifG_(){
  renderExecKpiRowG_();
  renderNarasiEksekutifG_();
  renderExecStatusGridG_();
  renderTrenYearlyG_();
  renderAnomaliG_();
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
  renderActiveGabunganView_();
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
    refreshKhususDependentViewsP_();
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
  renderActiveGabunganView_();
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
  populatePerbandinganBulanP();
  renderPerbandinganP();
  ['2024','2025','2026'].forEach(renderKhususPendapatan);
  initFilterP();
  initNavP();
  initYearMenuP();
  $('#searchPerbandinganP')?.addEventListener('input', renderPerbandinganP);
  $('#filterBulanPerbandinganP')?.addEventListener('change', (e)=>{
    const v = e.target.value;
    PERBANDINGAN_BULAN_SEL_P = v === '' ? null : parseInt(v, 10);
    renderPerbandinganP();
  });
  ['2024','2025','2026'].forEach(y=>{
    $(`#searchKhusus${y}P`)?.addEventListener('input', ()=>renderKhususPendapatan(y));
  });
  $('#btnRefreshP')?.addEventListener('click', syncPendapatan_);
  $('#btnSyncPendapatan')?.addEventListener('click', syncPendapatan_);

  // ---- Modul Gabungan (Pendapatan Vs Belanja) -- cuma turunan dari STATE/STATE_P,
  // render pertamanya dipicu showGabunganApp() saat kartu diklik (bukan di sini,
  // supaya canvas Chart.js tidak dibuat saat masih display:none). Refresh tinggal
  // render ulang dari data STATE/STATE_P yang sudah ter-update oleh modul lain.
  initNavG();
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
  // Perbandingan Rentang Bulan per Rekening: bulan/tahun cakupannya bisa
  // bertambah stlh live refresh (sama spt Tren), jadi batas picker & chart-nya
  // ikut disegarkan di sini juga -- bukan cuma saat tab Filter dibuka manual.
  if(typeof updateFilterRangeBounds_ === 'function'){
    updateFilterRangeBounds_();
    if(typeof renderFilterRangeCompare === 'function') renderFilterRangeCompare();
  }
}

// Versi Pendapatan dari refreshKhususDependentViews_() -- sekarang JUGA me-render
// ulang "Perbandingan per Akun" Pendapatan (halaman baru, konsep sama dgn Belanja),
// selain Khusus 2024/2025/2026-P & halaman Filter-P (dropdown + hasil + chart rentang),
// setelah loadKhususLivePendapatan() selesai.
function refreshKhususDependentViewsP_(){
  renderPerbandinganP();
  ['2024','2025','2026'].forEach(renderKhususPendapatan);
  const curYear = $('#filterTahunP').value || '2026';
  const curKode = $('#filterRekeningP').value;
  populateFilterBulanP(curYear);
  populateFilterRekeningP(curYear, curKode);
  renderFilterResultP();
  if(typeof updateFilterRangeBoundsP_ === 'function'){
    updateFilterRangeBoundsP_();
    if(typeof renderFilterRangeCompareP === 'function') renderFilterRangeCompareP();
  }
}

document.addEventListener('DOMContentLoaded', main);
