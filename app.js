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
};

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
        if(r.kode === '5') { byYear[y].total = rec; byYear[y].label_bulan = STATE.ringkasan[y] ? STATE.ringkasan[y].label_bulan : ''; }
        else byYear[y].breakdown.push(rec);
      });
      STATE.ringkasan = byYear;
    }
    if(json.tren && json.tren.length){
      STATE.tren = json.tren.map(r=>({periode:r.periode, bulan_ini:+r.bulan_ini, sd_bulan_ini:+r.sd_bulan_ini, pagu:+r.pagu}));
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
      <table class="subtable">
        <thead><tr><th>Komponen</th><th>Bulan Ini</th><th>%</th></tr></thead>
        <tbody>
          ${(d.breakdown||[]).map(b=>`<tr><td>${b.nama}</td><td style="text-align:right">${fmt(b.bulan_ini)}</td><td style="text-align:right">${fmtPct(b.persen)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
    wrap.appendChild(card);
  });
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
        {type:'line', label:'SPJ s.d Bulan Ini (kumulatif)', data:sd, borderColor:'#2fb8c4', backgroundColor:'rgba(47,184,196,0.15)', tension:.3, yAxisID:'y1', order:1, pointRadius:2},
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
function renderPerbandingan(){
  const tbody = $('#tblPerbandingan tbody');
  const q = ($('#searchPerbandingan').value||'').toLowerCase();
  const rows = STATE.perbandingan.filter(r => r.nama.toLowerCase().includes(q) || r.kode.includes(q));
  tbody.innerHTML = rows.map(r=>{
    const trend = (r['2026']||r['2025']||0) - (r['2025']||r['2024']||0);
    return `<tr>
      <td class="lvl-${r.depth}">${r.kode}</td>
      <td class="lvl-${r.depth}">${r.nama}</td>
      <td>${fmt(r['2024'])}</td>
      <td>${fmt(r['2025'])}</td>
      <td>${fmt(r['2026'])}</td>
    </tr>`;
  }).join('');
  $('#countPerbandingan').textContent = rows.length + ' akun';
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
        tension: .35,
        pointRadius: 4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#5b8def',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {display: false},
        tooltip: {callbacks: {label: c => 'Rp ' + fmt(c.parsed.y)}}
      },
      scales: {
        y: {ticks: {callback: v => (v/1e6).toFixed(0)+'jt'}, grid: {color:'#eef0fb'}},
        x: {grid: {display:false}}
      }
    },
    plugins: [lineShadowPlugin]
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
  $('#bkuFilterNoBukti').value = '';
  $('#bkuFilterTanggal').value = '';
  $('#bkuFilterKode').value = '';
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

function renderBkuTable(){
  const qNoBukti = ($('#bkuFilterNoBukti').value||'').toLowerCase().trim();
  const qTanggal = ($('#bkuFilterTanggal').value||'').toLowerCase().trim();
  const qKode = ($('#bkuFilterKode').value||'').toLowerCase().trim();

  const rows = BKU_STATE.rows.filter(r=>
    (!qNoBukti || r.no_bukti.toLowerCase().includes(qNoBukti)) &&
    (!qTanggal || r.tanggal.toLowerCase().includes(qTanggal)) &&
    (!qKode || r.kode_rekening.toLowerCase().includes(qKode))
  );

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

function initBkuModal(){
  $('#bkuModalClose').addEventListener('click', closeBkuModal);
  $('#bkuModal').addEventListener('click', (e)=>{ if(e.target.id === 'bkuModal') closeBkuModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeBkuModal(); });
  $('#bkuFilterNoBukti').addEventListener('input', renderBkuTable);
  $('#bkuFilterTanggal').addEventListener('input', renderBkuTable);
  $('#bkuFilterKode').addEventListener('input', renderBkuTable);
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
  renderPerbandingan();
  ['2024','2025','2026'].forEach(renderKhusus);
  initFilter();
  initNav();
  initBkuModal();
  $('#searchPerbandingan').addEventListener('input', renderPerbandingan);
  ['2024','2025','2026'].forEach(y=>{
    $(`#searchKhusus${y}`).addEventListener('input', ()=>renderKhusus(y));
  });
  $('#btnRefresh').addEventListener('click', async ()=>{
    await tryLoadLive();
    renderRingkasan();
    if($('#view-tren').classList.contains('active')) renderTren();
  });
  await tryLoadLive();
  renderRingkasan();
}

document.addEventListener('DOMContentLoaded', main);
