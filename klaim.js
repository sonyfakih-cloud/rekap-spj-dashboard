/* BPJS 2025-2026 — modul MonEv P3A (pending + klaim, banding bulan). Data: klaim_data.js. Hak cipta © 2026, Sony Fakih */
(function(){
"use strict";
const D=window.PK_DATA;
const reduceMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = new Intl.NumberFormat('id-ID');
const dec = (n,d=1)=>n.toLocaleString('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function rp(n,full){const a=Math.abs(n),s=n<0?'−':'';if(full)return s+'Rp '+nf.format(Math.round(a));if(a>=1e9)return s+'Rp '+dec(a/1e9,2)+' M';if(a>=1e6)return s+'Rp '+dec(a/1e6,1)+' jt';return s+'Rp '+nf.format(Math.round(a));}
const rpAx = n=>{const a=Math.abs(n);return a>=1e9?dec(n/1e9,1)+' M':a>=1e6?dec(n/1e6,0)+' jt':nf.format(n)};
const pct = (x,d=1)=>dec(x*100,d)+'%';
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const sum=a=>a.reduce((x,y)=>x+y,0);
/* ---------- tooltip ---------- */
const tip=document.createElement('div');tip.className='k-tip';document.body.appendChild(tip);
document.addEventListener('mousemove',e=>{
  const t=e.target.closest&&e.target.closest('[data-ktip]');
  if(!t){tip.style.display='none';return}
  tip.innerHTML=t.getAttribute('data-ktip'); tip.style.display='block';
  let x=e.clientX+14,y=e.clientY+14; const w=tip.offsetWidth,h=tip.offsetHeight;
  if(x+w>innerWidth-8)x=e.clientX-w-14; if(y+h>innerHeight-8)y=e.clientY-h-14;
  tip.style.left=Math.max(4,x)+'px'; tip.style.top=Math.max(4,y)+'px';
});
document.addEventListener('scroll',()=>{tip.style.display='none'},true);

/* ---------- chart primitives ---------- */
const W=el=>Math.max(280,Math.floor(el.clientWidth));
const niceMax=v=>{if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p};
const toks=q=>String(q||'').toLowerCase().split(/\s+/).filter(Boolean);
const matchAll=(s,q)=>{const t=toks(q);return t.every(x=>s.includes(x))};
const hl=(text,q)=>{const low=text.toLowerCase(),m=new Array(text.length).fill(0);toks(q).forEach(t=>{let i=low.indexOf(t);while(i>=0){for(let k=i;k<i+t.length;k++)m[k]=1;i=low.indexOf(t,i+1)}});let out='',inM=false;for(let i=0;i<text.length;i++){if(m[i]&&!inM){out+='<mark>';inM=true}if(!m[i]&&inM){out+='</mark>';inM=false}out+=esc(text[i])}if(inM)out+='</mark>';return out};
function combo(el,o){
  el.classList.add('kcombo');
  el.innerHTML=`<input type="text" class="kcin" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${esc(o.ph)}" aria-label="${esc(o.ph)}"><button type="button" class="kcx" aria-label="Hapus pencarian" hidden>×</button><div class="kclist" role="listbox" hidden></div>`;
  const inp=el.querySelector('input'),list=el.querySelector('.kclist'),x=el.querySelector('.kcx');
  let act=-1,shown=[],picked=null;
  const close=()=>{list.hidden=true;inp.setAttribute('aria-expanded','false');act=-1};
  const open=()=>{list.hidden=false;inp.setAttribute('aria-expanded','true')};
  const draw=()=>{
    const q=inp.value; x.hidden=!q;
    const all=o.items.filter(it=>matchAll(it.s,q));
    shown=all.slice(0,12);
    if(!shown.length){list.innerHTML='<div class="kcempty">Tidak ada yang cocok dengan “'+esc(q)+'”</div>';open();return}
    list.innerHTML=`<div class="kchead">${all.length} hasil${all.length>shown.length?' · tampil '+shown.length+' teratas, ketik lebih spesifik':''}</div>`+
      shown.map((it,i)=>`<div class="kcitem" role="option" data-i="${i}"><div class="kct">${hl(it.text,q)}</div><div class="kcs">${esc(it.sub||'')}</div></div>`).join('');
    open();
  };
  const mark=()=>list.querySelectorAll('.kcitem').forEach((e,i)=>{e.classList.toggle('on',i===act);if(i===act)e.scrollIntoView({block:'nearest'})});
  const pick=it=>{picked=it;inp.value=it.text;x.hidden=false;close();o.onPick(it)};
  const clear=()=>{picked=null;inp.value='';x.hidden=true;close();o.onPick(null);o.onType('')};
  inp.addEventListener('input',()=>{picked=null;o.onPick(null);o.onType(inp.value);draw()});
  inp.addEventListener('focus',()=>{if(!picked)draw()});
  inp.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)draw();act=Math.min(act+1,shown.length-1);mark()}
    else if(e.key==='ArrowUp'){e.preventDefault();act=Math.max(act-1,0);mark()}
    else if(e.key==='Enter'){if(act>=0&&shown[act]){e.preventDefault();pick(shown[act])}}
    else if(e.key==='Escape'){close()}
  });
  list.addEventListener('mousedown',e=>{const it=e.target.closest('.kcitem');if(it){e.preventDefault();pick(shown[+it.dataset.i])}});
  x.addEventListener('click',()=>{clear();inp.focus()});
  document.addEventListener('mousedown',e=>{if(!el.contains(e.target))close()});
}

/* ---------- table ---------- */
window.KPG=window.KPG||{size:10};
function table(el,cols,rows,o={}){
  let sk=o.sort||cols[0].k,asc=!!o.asc,q='',only=null,page=1;
  let pg=el.nextElementSibling;
  if(!(pg&&pg.classList&&pg.classList.contains('kpager'))){pg=document.createElement('div');pg.className='kpager';el.insertAdjacentElement('afterend',pg)}
  const SIZES=[10,100,500];
  const draw=(scroll)=>{
    let rs=rows.filter(r=>(!q||matchAll(r._s||'',q))&&(!only||only(r)));
    const c=cols.find(c=>c.k===sk);
    rs=rs.slice().sort((x,y)=>{const a=c.v(x),b=c.v(y);const d=(typeof a==='string')?a.localeCompare(b,'id'):(a-b);return asc?d:-d});
    const size=window.KPG.size,pages=Math.max(1,Math.ceil(rs.length/size));
    if(page>pages)page=pages;
    const st=(page-1)*size,sl=rs.slice(st,st+size);
    el.querySelector('tbody').innerHTML=sl.map(r=>'<tr>'+cols.map(c=>`<td class="${c.cls||'num'}">${c.f(r)}</td>`).join('')+'</tr>').join('')+(rs.length?'':`<tr><td class="l" colspan="${cols.length}">Tidak ada baris yang cocok.</td></tr>`);
    el.querySelectorAll('th').forEach(th=>{const on=th.dataset.k===sk;th.classList.toggle('sorted',on);th.classList.toggle('asc',on&&asc)});
    if(o.count) o.count.textContent=nf.format(rs.length)+' baris';
    /* pager: pilihan jumlah baris per halaman + nomor halaman */
    if(rs.length<=SIZES[0]){pg.innerHTML='';pg.hidden=true}
    else{
      pg.hidden=false;
      const nums=[];const add=n=>{if(n>=1&&n<=pages&&!nums.includes(n))nums.push(n)};
      add(1);for(let i=page-2;i<=page+2;i++)add(i);add(pages);nums.sort((a,b)=>a-b);
      let btns='',prev=0;
      nums.forEach(n=>{if(prev&&n-prev>1)btns+='<span class="kpg-gap" aria-hidden="true">…</span>';btns+=`<button type="button" class="kpg-btn${n===page?' on':''}" data-pg="${n}" aria-label="Halaman ${n}"${n===page?' aria-current="page"':''}>${n}</button>`;prev=n});
      pg.innerHTML=`<div class="kpg-top"><span class="kpg-lbl">Tampilkan</span><span class="kseg kpg-sz" role="group" aria-label="Jumlah baris per halaman">${SIZES.map(s=>`<button type="button" aria-pressed="${s===size}" data-sz="${s}">${s}</button>`).join('')}</span><span class="kpg-lbl">baris &middot; menampilkan ${nf.format(st+1)}&ndash;${nf.format(Math.min(st+size,rs.length))} dari ${nf.format(rs.length)}</span></div>`+
        (pages>1?`<div class="kpg-nav" role="navigation" aria-label="Halaman tabel"><button type="button" class="kpg-btn" data-pg="${page-1}" aria-label="Halaman sebelumnya"${page===1?' disabled':''}>&lsaquo;</button>${btns}<button type="button" class="kpg-btn" data-pg="${page+1}" aria-label="Halaman berikutnya"${page===pages?' disabled':''}>&rsaquo;</button></div>`:'');
    }
    if(scroll&&el.getBoundingClientRect().top<70)el.scrollIntoView({block:'start'});
  };
  pg.onclick=e=>{
    const s=e.target.closest('[data-sz]');
    if(s){window.KPG.size=+s.dataset.sz;page=1;draw(true);return}
    const b=e.target.closest('[data-pg]');
    if(b&&!b.disabled){page=+b.dataset.pg;draw(true)}
  };
  el.innerHTML=`<table><thead><tr>${cols.map(c=>`<th tabindex="0" data-k="${c.k}" class="${c.cls==='l'?'l':'num'}">${c.h}</th>`).join('')}</tr></thead><tbody></tbody></table>`;
  el.querySelectorAll('th').forEach(th=>{const f=()=>{const k=th.dataset.k;if(sk===k)asc=!asc;else{sk=k;asc=cols.find(c=>c.k===k).cls==='l'}page=1;draw()};th.onclick=f;th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}}});
  draw();
  return {search:v=>{q=v;page=1;draw()},only:f=>{only=f;page=1;draw()}};
}

function seg(id,opts,cur,cb){
  const el=document.getElementById('k-'+id);
  const paint=()=>{el.innerHTML=opts.map(o=>`<button type="button" aria-pressed="${o[0]===cur}" data-v="${o[0]}">${o[1]}</button>`).join('')};
  paint();
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;cur=b.dataset.v;paint();cb(cur)};
}

const KC=[];
function odo(e,txt){
  const ch=[...txt],nd=ch.filter(c=>c>='0'&&c<='9').length;let pos=0,html='';
  ch.forEach(c=>{
    if(c>='0'&&c<='9'){const rank=nd-1-pos,end=(+c)+10*(rank<3?2:1);let strip='';for(let k=0;k<30;k++)strip+='<i>'+(k%10)+'</i>';
      html+=`<span class="od" aria-hidden="true"><span class="odc" style="--end:${end};--dl:${(pos*0.06).toFixed(2)}s">${strip}</span></span>`;pos++}
    else html+=`<span class="oc" aria-hidden="true">${esc(c)}</span>`;
  });
  e.setAttribute('aria-label',txt);e.innerHTML=html;e.classList.remove('go');
  requestAnimationFrame(()=>requestAnimationFrame(()=>e.classList.add('go')));
}
function countUp(root){
  if(reduceMotion())return;
  root.querySelectorAll('[data-cu]').forEach(e=>{const [v,f]=KC[+e.dataset.cu];odo(e,f(v))});
}

/* ---------- grafik multi-bulan (N seri) ---------- */
let KG=0;
const COL=['#84AAF3','#F4BA84','#6FC28F','#DC8077','#B79BE8','#E3B360','#6CC3CF','#F29BC0','#9FBE8A','#8E9AD9','#D9A38E','#7FB7A4'];
function gdefs(u,cols){
  return '<defs>'+cols.map((c,i)=>
    `<linearGradient id="gv${u}_${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".6"/><stop offset="1" stop-color="${c}"/></linearGradient>`+
    `<linearGradient id="gh${u}_${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity=".6"/><stop offset="1" stop-color="${c}"/></linearGradient>`+
    `<linearGradient id="ga${u}_${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`).join('')+'</defs>';
}
const legendHtml=ser=>'<div class="klgd">'+ser.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')+'</div>';
function rbar(x,y,w,h,u,i,dir,idx){
  if(!(w>0)||!(h>0)) return '';
  const rx=Math.min(7,w/2,h/2);
  return `<g class="bar ${dir}" style="--i:${idx}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" style="fill:url(#g${dir==='bv'?'v':'h'}${u}_${i})"/></g>`;
}
const tipN=(label,ser,vals,fmt)=>`<b>${esc(label)}</b>`+ser.map((s,i)=>`<br><span class="m" style="color:${s.color}">●</span> <span class="m">${esc(s.name)}: ${vals[i]==null?'–':fmt(vals[i])}</span>`).join('');
/* batang vertikal berkelompok: labels = kategori (sumbu x), ser = bulan (warna) */
function vbarsN(el,labels,ser,o={}){
  const u=++KG,w=W(el),h=(o.h||250),fmt=o.fmt||nf.format,ax=o.ax||fmt;
  const all=ser.flatMap(s=>s.vals.filter(v=>v!=null));const mx=niceMax(Math.max(...all,1));
  const l=Math.max(42,String(ax(mx)).length*7+12),r=10,t=14,b=30,pw=w-l-r,ph=h-t-b,n=labels.length,gw=pw/n,k=ser.length;
  const bw=Math.max(5,Math.min(34,(gw*.78)/k-2));
  let s=`<svg width="${w}" height="${h}" role="img" aria-label="${esc(o.title||'Grafik batang')}">${gdefs(u,ser.map(x=>x.color))}`;
  for(let i=0;i<=4;i++){const y=t+ph-ph*i/4;s+=`<line class="kgrid" x1="${l}" x2="${w-r}" y1="${y}" y2="${y}"/><text x="${l-6}" y="${y+4}" text-anchor="end">${ax(mx*i/4)}</text>`}
  s+=`<line class="axis" x1="${l}" x2="${w-r}" y1="${t+ph}" y2="${t+ph}"/>`;
  labels.forEach((lb,gi)=>{
    const cx=l+gw*gi+gw/2,x0=cx-(k*(bw+2))/2;
    s+=`<g data-ktip="${esc(tipN(lb,ser,ser.map(q=>q.vals[gi]),fmt))}"><rect x="${l+gw*gi}" y="${t-6}" width="${gw}" height="${ph+6}" fill="transparent"/>`;
    ser.forEach((q,i)=>{const v=q.vals[gi];if(v==null)return;const bh=Math.max(v/mx*ph,v>0?2:0);
      s+=rbar(x0+i*(bw+2),t+ph-bh,bw,bh,u,i,'bv',gi*k+i);
      if(k<=4&&String(fmt(v)).length*5.8<=(k===1?gw-4:(bw+2)*1.6)) s+=`<text class="kv" x="${x0+i*(bw+2)+bw/2}" y="${t+ph-bh-5}" text-anchor="middle" font-size="10">${fmt(v)}</text>`});
    s+=`<text class="klbl" x="${cx}" y="${h-10}" text-anchor="middle">${esc(trunc(lb,Math.max(8,Math.floor(gw/6.4))))}</text></g>`;
  });
  el.innerHTML=legendHtml(ser)+s+'</svg>';
}
/* batang horizontal berkelompok: rows = kategori (baris), ser = bulan */
function hbarsN(el,rows,ser,o={}){
  const u=++KG,w=W(el),fmt=o.fmt||nf.format,k=ser.length,lw=o.lw||Math.min(Math.floor(w*.38),250),vp=k<=3?86:12;
  const bh=k<=2?11:k<=4?9:k<=7?7:5,gap=3,rh=k*(bh+gap)+14;
  const max=Math.max(...rows.flatMap(r=>r.vals.map(v=>v||0)),1),sc=(w-lw-vp-6)/max;
  let s=`<svg width="${w}" height="${rows.length*rh+6}" role="img" aria-label="${esc(o.title||'Grafik batang')}">${gdefs(u,ser.map(x=>x.color))}`;
  rows.forEach((r,ri)=>{
    const y=ri*rh+4;
    s+=`<g data-ktip="${esc(tipN(r.label,ser,r.vals,fmt))}"><rect x="0" y="${y-3}" width="${w}" height="${rh-1}" fill="transparent"/>`+
       `<text class="klbl v" x="0" y="${y+(k*(bh+gap))/2+3}">${esc(trunc(r.label,Math.floor(lw/6.3)))}</text>`;
    ser.forEach((q,i)=>{const v=r.vals[i];if(v==null)return;const bw=Math.max(v*sc,v>0?2:0),yy=y+i*(bh+gap);
      s+=rbar(lw,yy,bw,bh,u,i,'bh',ri*k+i)+(k<=3?`<text class="kv" x="${lw+bw+6}" y="${yy+bh-1}">${fmt(v)}</text>`:'')});
    s+='</g>';
  });
  el.innerHTML=legendHtml(ser)+s+'</svg>';
}
/* batang 100% bertumpuk: setiap baris satu bulan */
function stack100(el,rows,segs,o={}){
  const w=W(el),lw=70,rh=34,u=++KG;
  let s=`<svg width="${w}" height="${rows.length*rh+4}" role="img" aria-label="${esc(o.title||'Komposisi')}">`;
  rows.forEach((r,i)=>{
    const tot=r.vals.reduce((a,b)=>a+b,0)||1,y=i*rh+4;let x=lw;const bw=w-lw-6;
    s+=`<text class="klbl v" x="0" y="${y+14}">${esc(r.label)}</text><g data-ktip="${esc('<b>'+esc(r.label)+'</b>'+segs.map((g,j)=>`<br><span class="m" style="color:${g.color}">●</span> <span class="m">${esc(g.name)}: ${nf.format(r.vals[j])} (${dec(r.vals[j]/tot*100,1)}%)</span>`).join(''))}">`;
    segs.forEach((g,j)=>{const sw=r.vals[j]/tot*bw;if(sw<=0)return;
      s+=`<rect class="sk" x="${x}" y="${y}" width="${sw}" height="20" style="fill:${g.color}" ${j===0?'rx="6"':''}/>`;
      if(sw>34) s+=`<text x="${x+sw/2}" y="${y+14}" text-anchor="middle" style="fill:#1b1f3b;font-size:10.5px;font-weight:700">${dec(r.vals[j]/tot*100,0)}%</text>`;
      x+=sw});
    s+='</g>';
  });
  el.innerHTML='<div class="klgd">'+segs.map(g=>`<span><i style="background:${g.color}"></i>${esc(g.name)}</span>`).join('')+'</div>'+s+'</svg>';
}
/* garis tren seluruh bulan; bulan terpilih diberi pita sorot; bulan tanpa berkas ditandai lingkaran kosong */
function trendN(el,cats,ser,o={}){
  const u=++KG,w=W(el),h=o.h||270,fmt=o.fmt||nf.format,ax=o.ax||fmt,t=22,b=30,r=14;
  const mx=niceMax(Math.max(...ser.flatMap(s=>s.vals.filter(v=>v!=null)),1)),l=Math.max(42,String(ax(mx)).length*7+12);
  const pw=w-l-r,ph=h-t-b,X=i=>l+pw*(i/(cats.length-1)),Y=v=>t+ph-ph*v/mx,cl=y=>Math.min(t+ph,Math.max(t,y));
  let s=`<svg width="${w}" height="${h}" role="img" aria-label="${esc(o.title||'Tren bulanan')}">${gdefs(u,ser.map(x=>x.color))}`;
  for(let i=0;i<=4;i++){const y=t+ph-ph*i/4;s+=`<line class="kgrid" x1="${l}" x2="${w-r}" y1="${y}" y2="${y}"/><text x="${l-6}" y="${y+4}" text-anchor="end">${ax(mx*i/4)}</text>`}
  cats.forEach((c,i)=>{ if(c.sel) s+=`<rect class="selband" x="${X(i)-pw/cats.length/2}" y="${t}" width="${pw/cats.length}" height="${ph}" rx="8"/>`;
    s+=`<text x="${X(i)}" y="${h-10}" text-anchor="middle" ${c.sel?'style="font-weight:700;fill:var(--navy)"':''}>${esc(c.label)}</text>` });
  s+=`<line class="axis" x1="${l}" x2="${w-r}" y1="${t+ph}" y2="${t+ph}"/>`;
  ser.forEach((se,k)=>{
    let run=[];const runs=[];se.vals.forEach((v,i)=>{if(v==null){if(run.length)runs.push(run);run=[]}else run.push([X(i),Y(v)])});if(run.length)runs.push(run);
    runs.forEach(P=>{ if(P.length<2) return;
      let path='M'+P[0][0].toFixed(1)+' '+P[0][1].toFixed(1);
      for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;
        path+=`C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)} ${cl(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)} ${cl(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}
      if(k===0) s+=`<path class="larea" d="${path}L${P[P.length-1][0].toFixed(1)} ${t+ph}L${P[0][0].toFixed(1)} ${t+ph}Z" fill="url(#ga${u}_${k})"/>`;
      s+=`<path class="lsh" d="${path}" transform="translate(0 6)" pathLength="1" style="stroke:${se.color}"/><path class="lmain" d="${path}" pathLength="1" stroke-linecap="round" style="stroke:${se.color};fill:none"/>`});
  });
  cats.forEach((c,i)=>{
    const miss=ser[0].vals[i]==null;
    const tp=`<b>${esc(c.full)}</b>`+(miss?'<br><span class="m">'+esc(c.note||'Tidak ada berkas')+'</span>':ser.map(se=>`<br><span class="m" style="color:${se.color}">●</span> <span class="m">${esc(se.name)}: ${se.vals[i]==null?'–':fmt(se.vals[i])}</span>`).join(''));
    s+=`<g class="col" data-ktip="${esc(tp)}"><rect class="hit" x="${X(i)-pw/cats.length/2}" y="${t}" width="${pw/cats.length}" height="${ph}"/><line class="xh" x1="${X(i)}" x2="${X(i)}" y1="${t}" y2="${t+ph}"/>`+
      (miss?`<circle cx="${X(i)}" cy="${t+ph}" r="4.5" fill="none" stroke="var(--muted)" stroke-dasharray="2 2"/>`:
        ser.map(se=>se.vals[i]==null?'':`<circle class="dot" style="fill:${se.color};animation-delay:${.9}s" cx="${X(i)}" cy="${Y(se.vals[i])}" r="${c.sel?4.6:3.2}"/>`).join(''))+'</g>';
  });
  el.innerHTML=legendHtml(ser)+s+'</svg>';
}

/* ================= Data & status bulan ================= */
const MN=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const MF=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const mlab=k=>MN[+k.slice(5)-1]+' '+k.slice(2,4);
const mfull=k=>MF[+k.slice(5)-1]+' '+k.slice(0,4);
const TL=[];[2025,2026].forEach(y=>{for(let m=1;m<=12;m++){const k=y+'-'+String(m).padStart(2,'0');if(k<='2026-09')TL.push(k)}});
/* data klaim diturunkan dari agregat per bulan (window.KLAIM_AGG) */
(function(){
  const KA=window.KLAIM_AGG;D.klaim={};if(!KA)return;
  const norm=s=>String(s).toUpperCase().replace(/[\s.,]+/g,' ').trim();
  const pickK=k=>({n:k.n,tot:k.tot,rs:k.rs,sel:k.sel,pat:k.pat,los:k.los,def_n:k.def_n,def_amt:k.def_amt,sur_amt:k.sur_amt,idrg:k.idrg,n_idrg:k.n_idrg});
  Object.keys(KA.months).forEach(k=>{
    const m=KA.months[k],o={RI:pickK(m.kpi.RI),RJ:pickK(m.kpi.RJ),ALL:pickK(m.kpi.ALL),inacbg:{},dpjp:{}},disp={};
    ['RI','RJ'].forEach(j=>{const jl=j.toLowerCase();
      Object.entries(m.inacbg[j]).forEach(([c,v])=>{(o.inacbg[c]=o.inacbg[c]||{})[jl]={n:v[0],tot:v[1],rs:v[2]}});
      Object.entries(m.dpjp[j]).forEach(([nm,v])=>{const key=norm(nm);if(!disp[key]||(/[a-z]/.test(nm)&&!/[a-z]/.test(disp[key])))disp[key]=nm;
        const e=o.dpjp[key]=o.dpjp[key]||{n:0,tot:0,rs:0,ri:0,rj:0};e.n+=v[0];e.tot+=v[1];e.rs+=v[2];e[jl]+=v[0]})});
    const dp={};Object.entries(o.dpjp).forEach(([key,v])=>dp[disp[key]]=v);o.dpjp=dp;
    D.klaim[k]=o});
  D.desc=Object.assign({},D.desc||{},KA.desc);
})();
const hasP=k=>!!D.months[k], hasK=k=>!!D.klaim[k];
const PM=k=>D.months[k], KQ=(k,j)=>D.klaim[k][j||'ALL'];
const MISS={
  '2026-09':'Berkas pending September 2026 belum tersedia; hanya data klaim.'
};
const MAXSEL=12;
const unent=s=>String(s).replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
const nk=s=>String(s).toUpperCase().replace(/[\s.,]+/g,' ').trim();
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const $=id=>document.getElementById(id);

/* ================= State pilihan bulan ================= */
let SEL=[];
try{const s=JSON.parse(store.get('pk_sel')||'null');if(Array.isArray(s))SEL=s.filter(k=>TL.includes(k)&&(hasP(k)||hasK(k)))}catch(e){}
if(!SEL.length) SEL=TL.filter(k=>k>='2026-01'&&(hasP(k)||hasK(k)));
SEL=[...new Set(SEL)].sort().slice(0,MAXSEL);
const selP=()=>SEL.filter(hasP), selK=()=>SEL.filter(hasK);
const colOf=k=>COL[SEL.indexOf(k)%COL.length];
const serOf=(ks,fn,name)=>ks.map(k=>({name:name?name(k):mlab(k),color:colOf(k),vals:fn(k)}));

function toast(msg){
  let t=$('pk-toast');if(!t){t=document.createElement('div');t.id='pk-toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),4200);
}
function chipTitle(k){
  const p=hasP(k)?'Pending: ada':'Pending: –',q=hasK(k)?'Klaim: ada':'Klaim: –';
  return mfull(k)+' — '+p+' · '+q+(MISS[k]?'. '+MISS[k]:'');
}
function renderPicker(){
  let h='';
  [2025,2026].forEach(y=>{
    h+=`<div class="pk-row"><span class="pk-y">${y}</span><div class="pk-grid">`;
    for(let m=1;m<=12;m++){
      const k=y+'-'+String(m).padStart(2,'0'),ok=hasP(k)||hasK(k),on=SEL.includes(k),inTL=TL.includes(k);
      h+=`<button type="button" class="pk-chip${on?' on':''}${ok?'':' off'}${MISS[k]&&!ok?' warn':''}" data-k="${k}" aria-pressed="${on}" title="${esc(inTL?chipTitle(k):mfull(k)+' — belum ada data')}" style="--c:${on?colOf(k):'transparent'}"><span>${MN[m-1]}</span><span class="pk-dots" aria-hidden="true"><i class="${hasP(k)?'p':''}"></i><i class="${hasK(k)?'k':''}"></i></span></button>`;
    }
    h+='</div></div>';
  });
  const ps=selP(),ks=selK();
  const noP=SEL.filter(k=>!hasP(k)),noK=SEL.filter(k=>!hasK(k));
  const leg=SEL.map(k=>`<span class="pk-l"><i style="background:${colOf(k)}"></i>${mlab(k)}</span>`).join('');
  $('pk').innerHTML=`<div class="pk-head"><h2>Pilih bulan yang dibandingkan</h2><p class="knote">Ketuk bulan untuk menambah atau melepas (maksimal ${MAXSEL}). Titik <i class="pdot p"></i> = ada data pending, titik <i class="pdot k"></i> = ada data klaim. Bulan yang tidak punya titik tidak dapat dipilih.</p></div>`+h+
   `<div class="pk-pre"><span class="pl">Pilihan cepat</span><button type="button" data-p="y2025">Semua 2025</button><button type="button" data-p="y2026">Semua 2026</button><button type="button" data-p="last6">6 bulan data terakhir</button><button type="button" data-p="augsep">Agu–Sep 2026</button><button type="button" data-p="agu2">Agu 2025 vs Agu 2026</button><button type="button" data-p="yoy">Jan–Mar 2025 vs 2026</button><button type="button" data-p="clear" class="ghost">Kosongkan</button></div>`+
   `<div class="pk-sum"><b>${SEL.length}</b> bulan dipilih · pending <b>${ps.length}</b> bulan · klaim <b>${ks.length}</b> bulan${leg?'<span class="pk-legs">'+leg+'</span>':''}</div>`+
   (LV==='lanjut'?'':SEL.length===2?(modeOf()==='multi'?'<div class="pk-warn">Mode 2 bulan (A vs B) butuh dua bulan yang sama-sama punya data pending atau sama-sama punya data klaim. Saat ini ditampilkan mode multi-bulan.</div>':'<div class="pk-mode">Mode 2 bulan aktif: tampilan perbandingan A vs B untuk '+(modeOf()==='duoK'?'klaim':'pending')+'.</div>'):'<div class="pk-hint">Pilih tepat 2 bulan untuk tampilan perbandingan A vs B (seperti Agustus vs September). Pilih lebih dari 2 untuk perbandingan multi-bulan.</div>')+(SEL.length&&(noP.length||noK.length)?`<div class="pk-warn">${noP.length?'Tanpa data pending: '+noP.map(mlab).join(', ')+'. ':''}${noK.length?'Tanpa data klaim: '+noK.map(mlab).join(', ')+' (data klaim tidak tersedia).':''}</div>`:'');
}
function setSel(a){SEL=[...new Set(a)].filter(k=>hasP(k)||hasK(k)).sort().slice(0,MAXSEL);store.set('pk_sel',JSON.stringify(SEL));renderPicker();rerender()}
$('pk').addEventListener('click',e=>{
  const c=e.target.closest('.pk-chip');
  if(c){const k=c.dataset.k;
    if(!(hasP(k)||hasK(k))){toast(MISS[k]||(mfull(k)+': belum ada data.'));return}
    if(SEL.includes(k)) setSel(SEL.filter(x=>x!==k));
    else if(SEL.length>=MAXSEL) toast('Maksimal '+MAXSEL+' bulan agar grafik tetap terbaca. Lepas satu bulan dulu.');
    else setSel(SEL.concat(k));
    return}
  const b=e.target.closest('[data-p]');if(!b)return;const p=b.dataset.p,av=TL.filter(k=>hasP(k)||hasK(k));
  if(p==='y2025')setSel(av.filter(k=>k.startsWith('2025')));
  else if(p==='y2026')setSel(av.filter(k=>k.startsWith('2026')));
  else if(p==='last6')setSel(av.slice(-6));
  else if(p==='augsep')setSel(['2026-08','2026-09']);
  else if(p==='agu2')setSel(['2025-08','2026-08']);
  else if(p==='yoy')setSel(['2025-01','2025-02','2025-03','2026-01','2026-02','2026-03']);
  else setSel([]);
});

/* ================= Helper tampilan ================= */
function chg(a,b,good){ /* good: true naik baik, false naik buruk, null netral */
  if(!a) return '';
  const r=(b-a)/a,up=r>0.0005,dn=r<-0.0005;let c='flat';
  if(good!==null){if(up)c=good?'good':'bad';if(dn)c=good?'bad':'good'}
  return `<span class="kchip ${c}">${up?'▲':dn?'▼':'■'} ${dec(Math.abs(r)*100,1)}%</span>`;
}
function kcard(lab,v,f,hint,chip){
  return `<div class="kpi-card k-kpi"><div class="klab">${lab}</div><div class="kval" data-cu="${KC.push([v,f])-1}">${f(v)}</div>${chip?`<div class="krow">${chip}</div>`:''}${hint?`<div class="khint">${hint}</div>`:''}</div>`;
}
const empty=msg=>`<div class="card"><p class="knote" style="margin:0">${msg}</p></div>`;
const caveat=h=>`<div class="kcaveat">${h}</div>`;
const fm=(k,fn)=>hasP(k)?fn(PM(k)):null;
const sumP=(ks,fn)=>sum(ks.map(k=>fn(PM(k))));
function trendCats(ks){
  return TL.map((k,i)=>({label:i%3===0?mlab(k):'',full:mfull(k),sel:ks.includes(k),note:MISS[k]}));
}
function seriesFor(label,color,fn){return {name:label,color,vals:TL.map(k=>hasP(k)?fn(PM(k)):null)}}

/* ================= Tab ================= */
const TABS=[['ringkasan','Ringkasan'],['pending','Pending: volume & nilai'],['sebab','Penyebab pending'],['kasus','INA-CBG & DPJP'],['klaim','Klaim'],['data','Kualitas data']];
const rendered={},R={};let curTab='ringkasan';
const nav=$('k-tabs');
nav.innerHTML=TABS.map(t=>`<button type="button" role="tab" data-t="${t[0]}" aria-selected="false">${t[1]}</button>`).join('');
function show(id){
  if(!TABS.some(t=>t[0]===id))id='ringkasan';
  curTab=id;
  nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===id));
  document.querySelectorAll('#appRootKlaim .kview').forEach(s=>s.classList.toggle('active',s.id==='kview-'+id));
  if(!rendered[id]){KC.length=0;R[id]();rendered[id]=1}
}
nav.onclick=e=>{const b=e.target.closest('button');if(b)show(b.dataset.t)};
let DUO=store.get('pk_duo')||'K';
/* Dasar kategori penyebab: grp = jenis pending BPJS (7 kelompok, utama); jn = 15 jenis; kw = kata kunci pada teks alasan */
const CATM=['grp','jn','kw'];let catMode=CATM.includes(store.get('pk_catmode'))?store.get('pk_catmode'):'grp';
const catBasis=()=>catMode==='kw'?'Kategori penyebab pada tampilan ini <b>klasifikasi kata kunci</b> pada teks alasan (heuristik buatan analisis ini, bukan kategori BPJS), dua tahap: tahap 1 kata kunci, tahap 2 hanya memecah SEP yang tidak cocok pada tahap 1.':'Kategori penyebab pada tampilan ini mengikuti <b>jenis pending (JNSPENDING) BPJS</b>'+(catMode==='grp'?', dikelompokkan menjadi 7':' (15 jenis, tanpa pengelompokan)')+'. Bulan yang berkasnya tidak memuat kolom itu memakai isian perkiraan (lihat peringatan di bawah).';
function applyCat(){Object.values(D.months).forEach(m=>{m.cat=m['cat_'+catMode]||m.cat_grp||m.cat})}
function setCatMode(v){if(!CATM.includes(v)||v===catMode)return;catMode=v;store.set('pk_catmode',v);applyCat();rerender()}
applyCat();
let LV=store.get('pk_lv')==='lanjut'?'lanjut':'main';
function renderLV(){const b=$('lvBar');if(!b)return;
  b.innerHTML=`<span class="duo-sw" role="group" aria-label="Pilih tampilan"><button type="button" data-lv="main" aria-pressed="${LV==='main'}">Perbandingan bulan</button><button type="button" data-lv="lanjut" aria-pressed="${LV==='lanjut'}">Analisis lanjutan</button></span><span class="ksmall">${LV==='lanjut'?'LOS per kode, DPJP &amp; case-mix, SLA finalisasi, dan pending vs klaim per kode — memakai bulan yang dipilih di atas.':''}</span>`}
function duoAvail(){
  if(SEL.length!==2)return [];
  const [a,b]=SEL,r=[];
  if(hasK(a)&&hasK(b))r.push('K');
  if(hasP(a)&&hasP(b))r.push('P');
  return r;
}
function modeOf(){
  const av=duoAvail();
  if(!av.length)return 'multi';
  return (av.includes(DUO)?DUO:av[0])==='K'?'duoK':'duoP';
}
function applyMode(){
  const m=modeOf(),L=LV==='lanjut';
  ['multi','duoK','duoP'].forEach(id=>{$(id).hidden=L||id!==m});
  $('lanjut').hidden=!L;
  const h=$('ttl'),bar=$('duoBar'),sub=$('sub');
  if(L){
    h.textContent='BPJS 2025-2026 — Analisis lanjutan';
    sub.textContent='RSUD dr. R. Soeprapto Cepu — LOS per kode, DPJP disesuaikan case-mix, SLA finalisasi klaim, dan pending vs klaim per kode.';
    bar.hidden=true;
  } else if(m==='multi'){
    h.textContent='BPJS 2025-2026 — Pending & Klaim';
    sub.textContent='RSUD dr. R. Soeprapto Cepu — pending verifikasi 2025–2026 dan klaim INA-CBG. Pilih bulan mana saja untuk dibandingkan.';
    bar.hidden=true;
  } else {
    const [a,b]=SEL;
    h.textContent=(m==='duoK'?'Klaim BPJS':'Pending BPJS')+' — '+mfull(a)+' vs '+mfull(b);
    sub.textContent=m==='duoK'?'RSUD dr. R. Soeprapto Cepu — BLUD, klaim INA-CBG rawat inap & rawat jalan (Kode RS 3316025, Tarif RS Kelas C Pemerintah)':'RSUD dr. R. Soeprapto Cepu — SEP pending verifikasi BPJS, rawat inap & rawat jalan, periode tanggal pulang';
    bar.hidden=false;
    const av=duoAvail();
    bar.innerHTML=`<span class="k-legend"><span><i class="i-agu"></i>${mfull(a)}</span><span><i class="i-sep"></i>${mfull(b)}</span></span>`+
      (av.length>1?`<span class="duo-sw" role="group" aria-label="Jenis data yang dibandingkan"><button type="button" data-duo="K" aria-pressed="${m==='duoK'}">Klaim</button><button type="button" data-duo="P" aria-pressed="${m==='duoP'}">Pending</button></span>`:'')+
      `<span class="ksmall">Mode perbandingan 2 bulan aktif. Pilih jumlah bulan selain dua untuk kembali ke mode multi-bulan.</span>`;
  }
  return m;
}
function rerender(){
  const m=applyMode();
  renderLV();
  if(LV==='lanjut'){renderLanjut();return}
  if(m==='multi'){Object.keys(rendered).forEach(k=>delete rendered[k]);show(curTab)}
  else if(m==='duoK'){if(window.DUOK)window.DUOK.show(SEL[0],SEL[1]);else window.addEventListener('load',()=>{if(window.DUOK&&modeOf()==='duoK')window.DUOK.show(SEL[0],SEL[1])},{once:true})}
  else pRerender();
}
$('lvBar').addEventListener('click',e=>{const b=e.target.closest('[data-lv]');if(!b||b.dataset.lv===LV)return;LV=b.dataset.lv;store.set('pk_lv',LV);renderPicker();rerender();if(LV==='lanjut'){const t=$('lvBar');if(t&&t.getBoundingClientRect().top<0)t.scrollIntoView({block:'start'})}});
$('duoBar').addEventListener('click',e=>{const b=e.target.closest('[data-duo]');if(!b)return;DUO=b.dataset.duo;store.set('pk_duo',DUO);renderPicker();rerender()});
const visible=()=>{const r=$('appRootKlaim');return r&&r.style.display!=='none'};
let rz,lastW=window.innerWidth;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(!visible()||window.innerWidth===lastW)return;lastW=window.innerWidth;rerender()},180)});

/* ================= Ringkasan ================= */
R.ringkasan=()=>{
  const el=$('kview-ringkasan'),ps=selP(),ks=selK();
  if(!SEL.length){el.innerHTML=empty('Belum ada bulan yang dipilih. Pilih satu bulan atau lebih di atas untuk melihat perbandingan.');return}
  let h='';
  /* KPI pending */
  if(ps.length){
    const n=sumP(ps,m=>m.n),amt=sumP(ps,m=>m.amt),riA=sumP(ps,m=>m.ri.amt),riN=sumP(ps,m=>m.ri.n);
    const f=ps[0],l=ps[ps.length-1],two=ps.length>1;
    const ch=(fn,good)=>two?chg(fn(PM(f)),fn(PM(l)),good)+`<span class="ksmall">${mlab(f)} → ${mlab(l)}</span>`:'';
    h+=`<h3 class="ksect">Pending verifikasi · ${ps.length} bulan terpilih</h3><div class="kgrid kkpis">`+
      kcard('SEP pending (total)',n,nf.format,`Rata-rata ${nf.format(Math.round(n/ps.length))} SEP per bulan`,ch(m=>m.n,false))+
      kcard('Nilai pending (total)',amt,rp,`Rata-rata ${rp(amt/ps.length)} per bulan`,ch(m=>m.amt,false))+
      kcard('Nilai per SEP pending',amt/n,rp,'Total nilai dibagi total SEP',ch(m=>m.amt/m.n,null))+
      kcard('Porsi nilai rawat inap',riA/amt,x=>pct(x),`Rawat inap hanya ${pct(riN/n)} dari jumlah SEP`,ch(m=>m.ri.amt/m.amt,null))+
      '</div>';
  } else h+=caveat('<b>Tidak ada data pending pada bulan terpilih.</b> Pilih bulan yang bertanda titik biru untuk melihat pending.');
  /* KPI klaim */
  if(ks.length){
    const f=ks[0],l=ks[ks.length-1],two=ks.length>1,a=KQ(f),b=KQ(l);
    const ch=(fn,good)=>two?chg(fn(a),fn(b),good)+`<span class="ksmall">${mlab(f)} → ${mlab(l)}</span>`:'';
    h+=`<h3 class="ksect">Klaim INA-CBG · ${ks.length} bulan terpilih</h3><div class="kgrid kkpis">`+
      kcard('Jumlah klaim (total)',sum(ks.map(k=>KQ(k).n)),nf.format,two?'Dijumlahkan seluruh bulan terpilih':'Rawat inap + rawat jalan',ch(x=>x.n,true))+
      kcard('Pendapatan klaim INA-CBG',sum(ks.map(k=>KQ(k).tot)),rp,'Total tarif INA-CBG yang diajukan',ch(x=>x.tot,true))+
      kcard('Defisit klaim vs Tarif RS',-sum(ks.map(k=>KQ(k).sel)),rp,'Tarif RS dikurangi klaim',ch(x=>-x.sel,false))+
      kcard('Rasio klaim / Tarif RS',sum(ks.map(k=>KQ(k).tot))/sum(ks.map(k=>KQ(k).rs)),x=>pct(x),'Makin rendah, makin besar selisih tarif',two?chg(a.tot/a.rs,b.tot/b.rs,true):'')+
      '</div>';
  }
  /* tren seluruh bulan */
  h+=`<h3 class="ksect">Tren pending seluruh bulan (bulan terpilih diberi sorotan)</h3><div class="kgrid kg2"><div class="card"><h2>Nilai pending per bulan</h2><p class="knote">Lingkaran putus-putus = tidak ada berkas pending yang dapat dihitung (arahkan kursor untuk alasannya).</p><div id="r-tr1"></div></div><div class="card"><h2>Jumlah SEP pending per bulan</h2><p class="knote">Satu baris = satu SEP (nomor SEP unik, bukan jumlah alasan).</p><div id="r-tr2"></div></div></div>
  <div class="kgrid kg2" style="margin-top:14px"><div class="card"><h2>Pendapatan klaim INA-CBG per bulan</h2><p class="knote">Total tarif INA-CBG yang diajukan (rawat inap + rawat jalan), seluruh bulan data klaim.</p><div id="r-tr4"></div></div><div class="card"><h2>Nilai pending sebagai persen pendapatan klaim</h2><p class="knote">Hanya untuk bulan yang punya data pending dan klaim. Indikatif: laporan pending berasal dari tanggal tarik yang berbeda dari berkas klaim, dan nilai pending belum tentu dibayar atau ditolak.</p><div id="r-tr3"></div></div></div>`;
  /* tabel perbandingan */
  h+=`<h3 class="ksect">Perbandingan bulan terpilih</h3><div class="card"><div class="ktoolbar"><span class="kl" id="r-cnt"></span></div><div class="ktbl" id="r-tbl"></div><p class="knote" style="margin:10px 0 0">Δ dihitung terhadap bulan terpilih sebelumnya yang punya data pending (bukan selalu bulan kalender sebelumnya). Tanda “–” berarti data tidak tersedia, bukan nol.</p></div>`;
  /* temuan otomatis */
  h+=`<h3 class="ksect">Temuan otomatis dari bulan terpilih</h3><div class="card"><ul class="kfind" id="r-ins"></ul></div>`;
  el.innerHTML=h;
  countUp(el);
  if(ps.length){
    const c=trendCats(SEL);
    trendN($('r-tr1'),c,[seriesFor('Nilai pending','#84AAF3',m=>m.amt)],{fmt:rp,ax:rpAx,title:'Nilai pending per bulan'});
    trendN($('r-tr2'),c,[seriesFor('SEP pending','#F4BA84',m=>m.n)],{title:'Jumlah SEP pending per bulan'});
  } else { $('r-tr1').innerHTML=$('r-tr2').innerHTML='<p class="knote">Tidak ada data.</p>' }
  { const c=trendCats(SEL);
    trendN($('r-tr4'),c,[{name:'Pendapatan klaim',color:'#1F9D8B',vals:TL.map(k=>hasK(k)?KQ(k).tot:null)}],{fmt:rp,ax:rpAx,title:'Pendapatan klaim per bulan'});
    trendN($('r-tr3'),c,[{name:'Pending ÷ klaim',color:'#D9534F',vals:TL.map(k=>hasP(k)&&hasK(k)?PM(k).amt/KQ(k).tot*100:null)}],{fmt:x=>dec(x,1)+'%',ax:x=>dec(x,0)+'%',title:'Pending terhadap klaim'}); }
  /* tabel */
  let prev=null;
  const rows=SEL.map(k=>{
    const p=hasP(k)?PM(k):null,q=hasK(k)?KQ(k):null;
    const cau=D.meta.caution||{};
    const r={k,p,q,dp:p&&prev?chg(prev.amt,p.amt,false)+((cau[k]||cau[prev.k])?'<span class="kchip warn" title="Perubahan ini dipengaruhi berkas yang kemungkinan tidak lengkap (lihat peringatan data)">⚠</span>':''):'',_s:mfull(k)};
    if(p)prev={amt:p.amt,k};return r});
  const cols=[
    {k:'k',h:'Bulan',cls:'l',v:r=>r.k,f:r=>`<b>${mfull(r.k)}</b>`},
    {k:'pn',h:'SEP pending',v:r=>r.p?r.p.n:-1,f:r=>r.p?nf.format(r.p.n):'–'},
    {k:'pa',h:'Nilai pending',v:r=>r.p?r.p.amt:-1,f:r=>r.p?rp(r.p.amt):'–'},
    {k:'pd',h:'Δ nilai',v:r=>r.p?r.p.amt:-1,f:r=>r.dp||'<span class="ksmall">–</span>'},
    {k:'pri',h:'Pending RI',v:r=>r.p?r.p.ri.amt:-1,f:r=>r.p?rp(r.p.ri.amt):'–'},
    {k:'prj',h:'Pending RJ',v:r=>r.p?r.p.rj.amt:-1,f:r=>r.p?rp(r.p.rj.amt):'–'},
    {k:'kn',h:'Klaim (jumlah)',v:r=>r.q?r.q.n:-1,f:r=>r.q?nf.format(r.q.n):'–'},
    {k:'kt',h:'Pendapatan INA-CBG',v:r=>r.q?r.q.tot:-1,f:r=>r.q?rp(r.q.tot):'–'},
    {k:'kd',h:'Defisit vs Tarif RS',v:r=>r.q?-r.q.sel:-1,f:r=>r.q?rp(-r.q.sel):'–'},
    {k:'pk',h:'Pending ÷ klaim',v:r=>r.p&&r.q?r.p.amt/r.q.tot:-1,f:r=>r.p&&r.q?pct(r.p.amt/r.q.tot):'–'}
  ];
  table($('r-tbl'),cols,rows,{sort:'k',asc:true,count:$('r-cnt')});
  /* temuan */
  const L=[];
  if(ps.length>=2){
    const by=ps.slice().sort((a,b)=>PM(b).amt-PM(a).amt),hi=by[0],lo=by[by.length-1];
    L.push(`<li class="w"><b>Rentang nilai pending:</b> tertinggi ${mfull(hi)} (${rp(PM(hi).amt)}, ${nf.format(PM(hi).n)} SEP), terendah ${mfull(lo)} (${rp(PM(lo).amt)}, ${nf.format(PM(lo).n)} SEP); selisihnya ${dec(PM(hi).amt/PM(lo).amt,1)}× lipat. Fluktuasi sebesar ini menandakan arus kas yang tertahan tidak stabil antarbulan, sehingga proyeksi penerimaan BPJS sebaiknya memakai rentang, bukan satu angka.</li>`);
  }
  if(ps.length>=4){
    const h2=Math.floor(ps.length/2),A=ps.slice(0,h2),B=ps.slice(-h2),aA=sumP(A,m=>m.amt)/A.length,aB=sumP(B,m=>m.amt)/B.length,d=(aB-aA)/aA;
    const cls=d>0.1?'r':d<-0.1?'g':'w';
    L.push(`<li class="${cls}"><b>Arah pada periode terpilih:</b> rata-rata nilai pending ${A.length} bulan awal (${A.map(mlab).join(', ')}) ${rp(aA)} → ${B.length} bulan akhir (${B.map(mlab).join(', ')}) ${rp(aB)}, ${d>=0?'naik':'turun'} ${dec(Math.abs(d)*100,1)}%. Dengan hanya ${ps.length} titik data, ini gambaran arah, bukan bukti tren.</li>`);
  }
  if(ps.length){
    const n=sumP(ps,m=>m.n),amt=sumP(ps,m=>m.amt),riN=sumP(ps,m=>m.ri.n),riA=sumP(ps,m=>m.ri.amt),rjN=sumP(ps,m=>m.rj.n),rjA=sumP(ps,m=>m.rj.amt);
    if(riN&&rjN) L.push(`<li class="${riA/amt>0.6?'r':'w'}"><b>Konsentrasi nilai di rawat inap:</b> rawat inap hanya ${pct(riN/n)} dari SEP tetapi ${pct(riA/amt)} dari nilai pending. Rata-rata nilai per SEP rawat inap ${rp(riA/riN)} berbanding rawat jalan ${rp(rjA/rjN)} (${dec((riA/riN)/(rjA/rjN),1)}×). Tim yang menindaklanjuti pending sebaiknya diprioritaskan menurut nilai (kasus rawat inap lebih dulu), bukan menurut jumlah berkas.</li>`);
    /* kategori */
    const cat={};ps.forEach(k=>{Object.entries(PM(k).cat).forEach(([c,v])=>{const o=cat[c]=cat[c]||{n:0,amt:0};o.n+=v.n;o.amt+=v.amt})});
    const top=Object.entries(cat).sort((a,b)=>b[1].amt-a[1].amt)[0];
    if(top) L.push(`<li><b>Kategori penyebab terbesar menurut nilai:</b> ${esc(top[0])} (${pct(top[1].amt/amt)} dari nilai, ${nf.format(top[1].n)} SEP). Dasar kategori: ${catMode==='kw'?'kata kunci pada teks alasan (heuristik)':'jenis pending BPJS (bulan 2025, Juli, dan Agustus 2026 memakai isian perkiraan, bukan nilai asli BPJS)'}; dipakai sebagai petunjuk arah, bukan angka baku.</li>`);
    if(cat['Lainnya']&&cat['Lainnya'].n/n>0.25) L.push(`<li class="w"><b>Kategori “Lainnya” besar (${pct(cat['Lainnya'].n/n)} SEP):</b> aturan kata kunci belum menangkap sebagian alasan. Uraiannya menurut keputusan pengelola RS (klinis DPJP, dokumen medis, koding, administrasi, kebijakan BPJS) ada di tab Penyebab pending, bagian “Uraian kategori Lainnya”.</li>`);
    /* sikap RS */
    const sv=ps.filter(k=>sikapOK(PM(k))),nsv=ps.filter(k=>!sikapOK(PM(k)));
    if(sv.length){
      const tn=sum(sv.map(k=>PM(k).n)),rn=sum(sv.map(k=>PM(k).n-((PM(k).sikap[SKB]||{n:0}).n)));
      const cv_=sv.map(k=>skRec(PM(k))),lo=Math.min(...cv_),hi=Math.max(...cv_);
      L.push(`<li class="w"><b>Jawaban RS yang tercatat di berkas pending:</b> ${nf.format(rn)} dari ${nf.format(tn)} SEP (${pct(rn/tn)}) pada ${sv.length} bulan yang berkasnya memuat kolom jawaban; cakupan per bulan ${pct(lo)} sampai ${pct(hi)}. SEP tanpa jawaban tercatat <i>tidak</i> berarti belum dijawab: jawaban dikirim lewat e-klaim dan tidak selalu dicatat ke berkas rekap, sehingga tingkat penyelesaian pending tidak dapat dinilai dari berkas ini.</li>`);
    }
    if(nsv.length) L.push(`<li class="w"><b>${nsv.map(mlab).join(', ')}</b>: berkas pending tidak memuat jawaban RS (kolom tidak ada, kosong, atau berformat ekspor). Status jawaban tidak dapat dinilai untuk bulan tersebut; ini keterbatasan berkas, bukan tanda pending belum dijawab.</li>`);
  }
  if(ks.length){
    const t=sum(ks.map(k=>KQ(k).tot)),r=sum(ks.map(k=>KQ(k).rs));
    L.push(`<li><b>Klaim INA-CBG terpilih:</b> ${nf.format(sum(ks.map(k=>KQ(k).n)))} klaim, ${rp(t)}; tarif INA-CBG hanya ${pct(t/r)} dari Tarif RS atas layanan yang sama (defisit tarif ${rp(r-t)}). Ini selisih tarif, bukan kerugian riil (butuh unit cost).</li>`);
  }
  const bothK=SEL.filter(k=>hasP(k)&&hasK(k));
  if(bothK.length){
    const rt=k=>PM(k).amt/KQ(k).tot,by=bothK.slice().sort((x,y)=>rt(y)-rt(x)),hi=by[0],lo=by[by.length-1],cw=bothK.filter(k=>D.meta.caution&&D.meta.caution[k]);
    L.push(`<li class="${rt(hi)>0.3?'r':'w'}"><b>Pending terhadap pendapatan klaim:</b> ${bothK.length===1?mfull(hi)+' '+pct(rt(hi)):'tertinggi '+mfull(hi)+' ('+pct(rt(hi))+'), terendah '+mfull(lo)+' ('+pct(rt(lo))+')'}. Rasio ini menunjukkan seberapa besar nilai ajuan yang tertahan pada saat laporan pending ditarik, bukan klaim yang pasti ditolak.${cw.length?' Bulan '+cw.map(mlab).join(', ')+' berberkas pending yang kemungkinan tidak lengkap, sehingga rasionya terlalu rendah.':''}</li>`);
  }
  if(ps.length&&ks.length&&!bothK.length) L.push(`<li class="w"><b>Pending dan klaim belum dapat disandingkan per bulan:</b> bulan terpilih yang punya data pending tidak punya data klaim, dan sebaliknya. Karena itu rasio pending terhadap klaim sengaja tidak dihitung agar tidak membandingkan bulan yang berbeda. Pilih bulan yang punya titik biru dan titik hijau sekaligus.</li>`);
  const cs=SEL.filter(k=>D.meta.caution&&D.meta.caution[k]);
  cs.forEach(k=>L.push(`<li class="r"><b>Peringatan data ${mfull(k)}:</b> ${esc(D.meta.caution[k])}. Nilai bulan ini kemungkinan terlalu rendah; jangan dipakai sebagai bukti perbaikan.</li>`));
  if(SEL.some(k=>['2025-01','2025-02','2025-03'].includes(k))) L.push(`<li class="w"><b>Pola angka bulat:</b> jumlah SEP rawat jalan tepat 100, 100, dan 120 pada Januari–Maret 2025. Pola sebulat itu jarang terjadi wajar; mohon cek apakah berkas Januari–Maret 2025 terpotong (batas ekspor) sebelum membandingkannya dengan bulan lain.</li>`);
  if(!L.length) L.push('<li>Pilih bulan untuk menampilkan temuan.</li>');
  $('r-ins').innerHTML=L.join('');
};

/* ================= Pending: volume & nilai ================= */
R.pending=()=>{
  const el=$('kview-pending'),ps=selP();
  if(!ps.length){el.innerHTML=empty('Tidak ada data pending pada bulan terpilih. Pilih bulan yang bertanda titik biru.');return}
  const RIC='#84AAF3',RJC='#F4BA84',lab=ps.map(mlab);
  el.innerHTML=`<div class="kgrid kg2"><div class="card"><h2>Nilai pending: rawat inap vs rawat jalan</h2><p class="knote">Nilai ajuan (Rp) dari SEP yang masih pending, per jenis pelayanan.</p><div id="p-c1"></div></div>
  <div class="card"><h2>Jumlah SEP pending: rawat inap vs rawat jalan</h2><p class="knote">SEP unik per jenis pelayanan.</p><div id="p-c2"></div></div>
  <div class="card"><h2>Nilai rata-rata per SEP pending</h2><p class="knote">Nilai dibagi jumlah SEP, per jenis pelayanan.</p><div id="p-c3"></div></div>
  <div class="card"><h2>Lama rawat rata-rata SEP rawat inap pending (hari)</h2><p class="knote">Selisih tanggal pulang dan tanggal masuk; hanya rawat inap.</p><div id="p-c4"></div></div></div>
  <h3 class="ksect">Indikator per bulan</h3><div class="card"><div class="ktoolbar"><span class="kl" id="p-cnt"></span></div><div class="ktbl" id="p-tbl"></div>
  <p class="knote" style="margin:10px 0 0"><b>Pasien unik</b> dihitung per bulan (pasien yang sama bisa muncul di bulan lain). <b>Pasien ≥2 SEP</b> = pasien dengan lebih dari satu SEP pending dalam bulan itu. <b>SEP multi-alasan</b> = SEP yang memiliki lebih dari satu alasan pending (di berkas muncul sebagai beberapa baris; dashboard menghitungnya sekali). <b>Masuk bulan lalu</b> = SEP rawat inap yang tanggal masuknya sebelum bulan berkas.</p></div>`;
  vbarsN($('p-c1'),lab,[{name:'Rawat inap',color:RIC,vals:ps.map(k=>PM(k).ri.amt)},{name:'Rawat jalan',color:RJC,vals:ps.map(k=>PM(k).rj.amt)}],{fmt:rp,ax:rpAx,title:'Nilai pending RI dan RJ'});
  vbarsN($('p-c2'),lab,[{name:'Rawat inap',color:RIC,vals:ps.map(k=>PM(k).ri.n)},{name:'Rawat jalan',color:RJC,vals:ps.map(k=>PM(k).rj.n)}],{title:'SEP pending RI dan RJ'});
  vbarsN($('p-c3'),lab,[{name:'Rawat inap',color:RIC,vals:ps.map(k=>PM(k).ri.n?PM(k).ri.amt/PM(k).ri.n:null)},{name:'Rawat jalan',color:RJC,vals:ps.map(k=>PM(k).rj.n?PM(k).rj.amt/PM(k).rj.n:null)}],{fmt:rp,ax:rpAx,title:'Nilai rata-rata per SEP'});
  vbarsN($('p-c4'),lab,[{name:'Lama rawat RI (hari)',color:'#6FC28F',vals:ps.map(k=>PM(k).los_ri||null)}],{fmt:x=>dec(x,2),ax:x=>dec(x,1),title:'Lama rawat rata-rata'});
  const rows=ps.map(k=>({k,m:PM(k),_s:mfull(k)}));
  const cols=[
    {k:'k',h:'Bulan',cls:'l',v:r=>r.k,f:r=>`<b>${mfull(r.k)}</b>`},
    {k:'n',h:'SEP',v:r=>r.m.n,f:r=>nf.format(r.m.n)},
    {k:'a',h:'Nilai',v:r=>r.m.amt,f:r=>rp(r.m.amt,true)},
    {k:'ri',h:'SEP RI',v:r=>r.m.ri.n,f:r=>nf.format(r.m.ri.n)},
    {k:'rj',h:'SEP RJ',v:r=>r.m.rj.n,f:r=>nf.format(r.m.rj.n)},
    {k:'pa',h:'Pasien unik',v:r=>r.m.patients,f:r=>nf.format(r.m.patients)},
    {k:'rp',h:'Pasien ≥2 SEP',v:r=>r.m.repeat_patients,f:r=>nf.format(r.m.repeat_patients)},
    {k:'mr',h:'SEP multi-alasan',v:r=>r.m.multi_reason_sep,f:r=>nf.format(r.m.multi_reason_sep)},
    {k:'ca',h:'Masuk bulan lalu',v:r=>r.m.carry,f:r=>nf.format(r.m.carry)},
    {k:'lo',h:'LOS RI (hari)',v:r=>r.m.los_ri||0,f:r=>r.m.los_ri?dec(r.m.los_ri,2):'–'}
  ];
  table($('p-tbl'),cols,rows,{sort:'k',asc:true,count:$('p-cnt')});
};

/* ================= Mode 2 bulan: pending A vs B (konsep sama dengan Agustus vs September) ================= */
let DS=['A','B'],DLN=['A','B'],KG2=1000;
const sgn=(n,f)=>(n>0?'+':n<0?'−':'')+f(Math.abs(n));
const tipCmp=(label,a,s,fmt)=>`<b>${esc(label)}</b><br><span class="m">${esc(DS[0])} ${fmt(a)}</span><br><span class="m">${esc(DS[1])} ${fmt(s)}</span>`+(a?`<br>Δ <span class="m">${sgn(s-a,x=>fmt(x))} (${dec((s-a)/a*100,1)}%)</span>`:'');
const GLOSS=u=>{const C={fa:'--k-agu',fs:'--k-sep',fp:'--k-pos',fn:'--k-neg'};let d='<defs>';
  Object.keys(C).forEach(k=>{
    d+=`<linearGradient id="kb-${k}-v${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(${C[k]})" stop-opacity=".62"/><stop offset="1" style="stop-color:var(${C[k]})" stop-opacity="1"/></linearGradient>`+
       `<linearGradient id="kb-${k}-h${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(${C[k]})" stop-opacity=".62"/><stop offset="1" style="stop-color:var(${C[k]})" stop-opacity="1"/></linearGradient>`});
  return d+'</defs>'};
function bar3(x,y,w,h,cls,d,dir,i){
  if(!(h>0)||!(w>0))return '';
  const rx=Math.min(7,w/2,h/2);
  return `<g class="bar ${dir}" style="--i:${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" style="fill:url(#kb-${cls}-${dir==='bv'?'v':'h'}${d})"/></g>`;
}
const legendSvg=w=>{const cx=w/2,a=DLN[0],b=DLN[1],wa=a.length*6.2+22;return `<g class="klg"><rect x="${cx-wa-6}" y="4" width="10" height="10" rx="2" style="fill:var(--k-agu)"/><text x="${cx-wa+8}" y="13">${esc(a)}</text><rect x="${cx+8}" y="4" width="10" height="10" rx="2" style="fill:var(--k-sep)"/><text x="${cx+22}" y="13">${esc(b)}</text></g>`};
function pill(cx,y,a,s,tone){
  if(!(a>0))return '';
  const p=(s-a)/a*100;if(!isFinite(p))return '';
  const txt=Math.abs(p)<0.05?'0%':(p>0?'+':'')+dec(p,1)+'%',wd=txt.length*6+14;
  const c=tone==='flat'||Math.abs(p)<0.05?'f':((p>0)===(tone!=='bad')?'g':'r');
  return `<g class="kpill ${c}"><rect x="${cx-wd/2}" y="${y}" width="${wd}" height="16" rx="8"/><text x="${cx}" y="${y+11.5}" text-anchor="middle">${txt}</text></g>`;
}
function hbars2(el,rows,o={}){
  const u=++KG2,w=W(el),fmt=o.fmt||nf.format,lw=Math.min(o.lw||250,Math.floor(w*(w<520?.3:.42))),vp=w<520?120:158,rh=38,bh=11,oy=26;
  const max=Math.max(...rows.flatMap(r=>[r.a,r.s]),1),sc=Math.max(10,w-lw-vp)/max;
  let s=`<svg width="${w}" height="${rows.length*rh+oy+6}" role="img" aria-label="${esc(o.title||'Grafik batang')}">${GLOSS(u)}${legendSvg(w)}`;
  rows.forEach((r,i)=>{
    const y=i*rh+oy,wa=r.a*sc,ws=r.s*sc;
    s+=`<g data-ktip="${esc(tipCmp(r.label,r.a,r.s,fmt))}"><rect x="0" y="${y-4}" width="${w}" height="${rh-2}" fill="transparent"/>`+
       `<text class="klbl v" x="0" y="${y+bh+5}">${esc(trunc(r.label,Math.floor(lw/6.3)))}</text>`+
       bar3(lw,y,Math.max(wa,r.a>0?2:0),bh,'fa',u,'bh',i*2)+`<text class="kv" x="${lw+wa+6}" y="${y+bh-1}">${fmt(r.a)}</text>`+
       bar3(lw,y+bh+4,Math.max(ws,r.s>0?2:0),bh,'fs',u,'bh',i*2+1)+`<text class="kv" x="${lw+ws+6}" y="${y+2*bh+3}">${fmt(r.s)}</text>`+
       pill(w-30,y+bh-8,r.a,r.s,o.tone)+`</g>`;
  });
  el.innerHTML=s+'</svg>';
}
function vbars2(el,labels,a,sv,o={}){
  const u=++KG2,w=W(el),h=(o.h||240)+16,fmt=o.fmt||nf.format,ax=o.ax||fmt,l=Math.max(40,String(ax(Math.max(...a,...sv,1))).length*7+10),r=10,t=52,b=26;
  const mx=niceMax(Math.max(...a,...sv,1)),pw=w-l-r,ph=h-t-b,n=labels.length,gw=pw/n,bw=Math.min(34,gw*.3);
  let s=`<svg width="${w}" height="${h}" role="img" aria-label="${esc(o.title||'Grafik batang')}">${GLOSS(u)}${legendSvg(w)}`;
  for(let i=0;i<=4;i++){const y=t+ph-ph*i/4;s+=`<line class="kgrid" x1="${l}" x2="${w-r}" y1="${y}" y2="${y}"/><text x="${l-6}" y="${y+4}" text-anchor="end">${ax(mx*i/4)}</text>`}
  s+=`<line class="axis" x1="${l}" x2="${w-r}" y1="${t+ph}" y2="${t+ph}"/>`;
  labels.forEach((lb,i)=>{
    const cx=l+gw*i+gw/2,ha=a[i]/mx*ph,hs=sv[i]/mx*ph,top=t+ph-Math.max(ha,hs);
    s+=`<g data-ktip="${esc(tipCmp(lb,a[i],sv[i],fmt))}"><rect x="${l+gw*i}" y="${t-8}" width="${gw}" height="${ph+8}" fill="transparent"/>`+
       bar3(cx-bw-2,t+ph-Math.max(ha,a[i]>0?2:0),bw,Math.max(ha,a[i]>0?2:0),'fa',u,'bv',i*2)+
       bar3(cx+2,t+ph-Math.max(hs,sv[i]>0?2:0),bw,Math.max(hs,sv[i]>0?2:0),'fs',u,'bv',i*2+1);
    if(gw>=86)s+=`<text class="kv" x="${cx-bw/2-2}" y="${t+ph-ha-5}" text-anchor="middle" font-size="10">${fmt(a[i])}</text><text class="kv" x="${cx+bw/2+2}" y="${t+ph-hs-5}" text-anchor="middle" font-size="10">${fmt(sv[i])}</text>`;
    if(gw>=46)s+=pill(cx,Math.max(24,top-(gw>=86?34:22)),a[i],sv[i],o.tone);
    s+=`<text class="klbl" x="${cx}" y="${h-8}" text-anchor="middle">${esc(trunc(lb,Math.floor(gw/6.2)+2))}</text></g>`;
  });
  el.innerHTML=s+'</svg>';
}
function diverge2(el,rows,o={}){
  const u=++KG2,w=W(el),fmt=o.fmt||nf.format,lw=o.lw||Math.min(Math.floor(w*.42),250),rh=30,p0=lw+92,p1=w-96,bh=13;
  const mn=Math.min(0,...rows.map(r=>r.v)),mx=Math.max(0,...rows.map(r=>r.v)),sc=Math.max(10,p1-p0)/((mx-mn)||1),z=p0+(-mn)*sc;
  const goodUp=o.goodUp!==false;
  let s=`<svg width="${w}" height="${rows.length*rh+10}" role="img" aria-label="${esc(o.title||'Perubahan')}">${GLOSS(u)}`;
  rows.forEach((r,i)=>{
    const y=i*rh+10,bw=Math.abs(r.v)*sc,x=r.v>=0?z:z-bw,cls=(r.v>=0)===goodUp?'fp':'fn';
    s+=`<g data-ktip="${esc(r.tip||('<b>'+esc(r.label)+'</b><br><span class=m>'+sgn(r.v,fmt)+'</span>'))}"><rect x="0" y="${y-9}" width="${w}" height="${rh-1}" fill="transparent"/>`+
       `<text class="klbl v" x="0" y="${y+bh-2}">${esc(trunc(r.label,Math.floor(lw/6.3)))}</text>`+
       bar3(x,y,Math.max(bw,r.v?2:0),bh,cls,u,'bh',i)+
       `<text class="kv" x="${r.v>=0?x+bw+6:x-6}" y="${y+bh-2}" text-anchor="${r.v>=0?'start':'end'}">${sgn(r.v,fmt)}</text></g>`;
  });
  s+=`<line class="axis" x1="${z}" x2="${z}" y1="0" y2="${rows.length*rh+8}"/>`;
  el.innerHTML=s+'</svg>';
}
const chgPP=(a,b,good)=>{const d=(b-a)*100,up=d>0.05,dn=d<-0.05;let c='flat';if(good!==null){if(up)c=good?'good':'bad';if(dn)c=good?'bad':'good'}return `<span class="kchip ${c}">${up?'▲':dn?'▼':'■'} ${dec(Math.abs(d),1)} pp</span>`};

/* ----- mesin tab 2 bulan pending ----- */
const PT=[['ringkasan','Ringkasan'],['ri','Rawat inap'],['rj','Rawat jalan'],['sebab','Penyebab pending'],['kasus','INA-CBG'],['dpjp','DPJP'],['data','Kualitas data']];
const pRendered={},PR={};let pCur='ringkasan';
const pnav=$('dp-tabs');
pnav.innerHTML=PT.map(t=>`<button type="button" role="tab" data-t="${t[0]}" aria-selected="false">${t[1]}</button>`).join('');
function pShow(id){
  if(!PT.some(t=>t[0]===id))id='ringkasan';
  pCur=id;
  pnav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===id));
  document.querySelectorAll('#duoP .dpview').forEach(s=>s.classList.toggle('active',s.id==='dpview-'+id));
  if(!pRendered[id]){KC.length=0;PR[id]();pRendered[id]=1}
}
pnav.onclick=e=>{const b=e.target.closest('button');if(b)pShow(b.dataset.t)};
function pRerender(){
  const [A,B]=SEL;DS=[mlab(A),mlab(B)];DLN=[mfull(A),mfull(B)];
  Object.keys(pRendered).forEach(k=>delete pRendered[k]);pShow(pCur);
}
const J=(m,j)=>j==='RI'?m.ri:j==='RJ'?m.rj:{n:m.n,amt:m.amt};
const JNm={ALL:'Semua',RI:'Rawat inap',RJ:'Rawat jalan'};
function pCards(j){
  const [A,B]=SEL,a=PM(A),b=PM(B),ja=J(a,j),jb=J(b,j);
  const card=(lab,va,vs,f,ch,hint)=>`<div class="kpi-card k-kpi"><div class="klab">${lab}</div><div class="kval" data-cu="${KC.push([vs,f])-1}">${f(vs)}</div><div class="krow"><span class="a">${esc(DS[0])} <b>${f(va)}</b></span><span class="s">${esc(DS[1])} ${ch}</span></div>${hint?`<div class="khint">${hint}</div>`:''}</div>`;
  let h='<div class="kgrid kkpis">'+
    card('SEP pending',ja.n,jb.n,nf.format,chg(ja.n,jb.n,false))+
    card('Nilai pending',ja.amt,jb.amt,rp,chg(ja.amt,jb.amt,false),'Nilai ajuan SEP yang masih pending')+
    card('Nilai rata-rata per SEP',ja.n?ja.amt/ja.n:0,jb.n?jb.amt/jb.n:0,rp,chg(ja.n?ja.amt/ja.n:0,jb.n?jb.amt/jb.n:0,null))+
    (j==='ALL'?card('Porsi nilai rawat inap',a.ri.amt/a.amt,b.ri.amt/b.amt,x=>pct(x),chgPP(a.ri.amt/a.amt,b.ri.amt/b.amt,null),'Makin tinggi, makin terkonsentrasi di rawat inap')+
      card('Pasien unik',a.patients,b.patients,nf.format,chg(a.patients,b.patients,false))+
      card('SEP multi-alasan',a.multi_reason_sep,b.multi_reason_sep,nf.format,chg(a.multi_reason_sep,b.multi_reason_sep,false),'SEP dengan lebih dari satu alasan'):'')+
    (j==='RI'?card('Lama rawat rata-rata (hari)',a.los_ri,b.los_ri,x=>dec(x,2),chg(a.los_ri,b.los_ri,null))+card('Masuk bulan sebelumnya',a.carry,b.carry,nf.format,chg(a.carry,b.carry,null),'SEP rawat inap lintas bulan'):'')+
  '</div>';
  return h;
}
/* Status jawaban RS: kolom jawaban di berkas pending hanya CATATAN. SEP tanpa jawaban tercatat BUKAN berarti belum dijawab (jawaban dikirim lewat e-klaim). */
const SKB='Belum ada jawaban RS',SK_LAB={'Belum ada jawaban RS':'Jawaban tidak tercatat di berkas'};
const skRec=m=>m.n?1-((m.sikap[SKB]||{n:0}).n/m.n):0;   // porsi SEP dengan jawaban tercatat
const sikapOK=m=>m.fmt!=='ekspor'&&skRec(m)>0;          // berkas memuat jawaban RS (kolom ada dan terisi)
const skWhy=m=>m.fmt==='ekspor'?'berformat ekspor tanpa kolom jawaban':'kolom jawaban tidak ada atau kosong di berkas';
const catsU=(a,b)=>[...new Set(Object.keys(a.cat).concat(Object.keys(b.cat)))];
const cv=(m,c,k)=>((m.cat[c]||{})[k])||0;

PR.ringkasan=()=>{
  const el=$('dpview-ringkasan'),[A,B]=SEL,a=PM(A),b=PM(B);
  const dAmt=b.amt-a.amt,dN=b.n-a.n;
  const catA=Object.entries(a.cat),catB=Object.entries(b.cat);
  const dcat=catsU(a,b).map(c=>({c,d:cv(b,c,'amt')-cv(a,c,'amt'),a:cv(a,c,'amt'),b:cv(b,c,'amt')})).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
  const up=dcat.filter(x=>x.d>0)[0],dn=dcat.filter(x=>x.d<0)[0];
  const L=[];
  L.push(`<li class="${dAmt>0?'r':'g'}"><b>Nilai pending ${dAmt>=0?'naik':'turun'} ${rp(Math.abs(dAmt))} (${sgn(dAmt/a.amt*100,x=>dec(x,1))}%)</b>, dari ${rp(a.amt)} (${mfull(A)}) ke ${rp(b.amt)} (${mfull(B)}), dengan jumlah SEP ${nf.format(a.n)} → ${nf.format(b.n)} (${sgn(dN/a.n*100,x=>dec(x,1))}%). Nilai per SEP bergerak dari ${rp(a.amt/a.n)} ke ${rp(b.amt/b.n)}.</li>`);
  const vol=(x,y)=>x.n?(y.n-x.n)*(x.amt/x.n):0,mix=(x,y)=>y.n&&x.n?y.amt-y.n*(x.amt/x.n):0;
  const vri=vol(a.ri,b.ri),mri=mix(a.ri,b.ri),vrj=vol(a.rj,b.rj),mrj=mix(a.rj,b.rj);
  const big=[['rawat inap · volume',vri],['rawat inap · nilai per SEP',mri],['rawat jalan · volume',vrj],['rawat jalan · nilai per SEP',mrj]].sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]))[0];
  L.push(`<li><b>Penggerak utama perubahan:</b> ${big[0]} (${sgn(big[1],rp)}). Rawat inap memegang ${pct(a.ri.amt/a.amt)} nilai pending pada ${mlab(A)} dan ${pct(b.ri.amt/b.amt)} pada ${mlab(B)}, sehingga selisih nilai paling ditentukan oleh jumlah dan bobot kasus rawat inap.</li>`);
  if(up)L.push(`<li class="r"><b>Kategori penyebab yang paling menambah nilai pending:</b> ${esc(up.c)} (${sgn(up.d,rp)}; ${rp(up.a)} → ${rp(up.b)}). Dasar kategori: ${catMode==='kw'?'kata kunci (heuristik)':'jenis pending BPJS (2025, Juli, dan Agustus 2026 = isian perkiraan)'}.</li>`);
  if(dn)L.push(`<li class="g"><b>Kategori yang paling mengurangi nilai pending:</b> ${esc(dn.c)} (${sgn(dn.d,rp)}; ${rp(dn.a)} → ${rp(dn.b)}).</li>`);
  if(sikapOK(a)&&sikapOK(b)){
    L.push(`<li class="w"><b>Jawaban RS yang tercatat di berkas pending:</b> ${pct(skRec(a))} SEP pada ${mlab(A)} dan ${pct(skRec(b))} pada ${mlab(B)}. SEP lainnya hanya <i>tidak tercatat</i> jawabannya di berkas; itu bukan berarti belum dijawab, karena jawaban pending dikirim lewat e-klaim dan tidak selalu dicatat ke berkas rekap. Tingkat penyelesaian pending yang sebenarnya tidak dapat dinilai dari berkas ini.</li>`);
  } else L.push(`<li class="w"><b>Status jawaban RS tidak dapat dibandingkan:</b> berkas ${[A,B].filter(k=>!sikapOK(PM(k))).map(k=>mlab(k)+' ('+skWhy(PM(k))+')').join('; ')}. Ini keterbatasan berkas, <b>bukan</b> tanda pending belum dijawab.</li>`);
  [A,B].forEach(k=>{if(D.meta.caution&&D.meta.caution[k])L.push(`<li class="r"><b>Peringatan data ${mfull(k)}:</b> ${esc(D.meta.caution[k])}. Perbandingan yang melibatkan bulan ini bisa menyesatkan.</li>`)});
  if(['2025-01','2025-02','2025-03'].some(k=>k===A||k===B))L.push(`<li class="w"><b>Pola angka bulat:</b> SEP rawat jalan Januari–Maret 2025 tepat 100, 100, dan 120; periksa kemungkinan berkas terpotong sebelum menyimpulkan.</li>`);
  L.push(`<li class="w"><b>Satu bulan melawan satu bulan.</b> Selisih dua bulan bukan tren: jumlah hari kerja, jumlah verifikator, dan waktu penarikan berkas memengaruhi angka. Gunakan mode multi-bulan (pilih lebih dari dua bulan) untuk melihat pola.</li>`);
  el.innerHTML=`<div class="ktoolbar"><span class="kl">Tampilkan KPI untuk</span><div class="kseg" id="k-pdj"></div></div>
  <div id="pd-kpis"></div>
  <h3 class="ksect">Temuan utama</h3><div class="card"><ul class="kfind">${L.join('')}</ul></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Dari mana perubahan nilai pending berasal</h2><p class="knote">Dekomposisi per jenis layanan: efek volume (jumlah SEP berubah pada nilai per SEP bulan pertama) dan efek nilai per SEP (bobot kasus berubah). Hijau = pending berkurang, merah = bertambah.</p><div id="pd-pvm"></div><div class="ksmall" style="margin-top:8px">Total perubahan ${sgn(dAmt,rp)}.</div></div>
   <div class="card"><h2>Pending per jenis layanan</h2><p class="knote">Nilai (Rp) dan jumlah SEP, rawat inap dan rawat jalan, ${esc(DS[0])} dibanding ${esc(DS[1])}.</p><div id="pd-jn"></div><div id="pd-jn2" style="margin-top:6px"></div></div>
  </div>
  <h3 class="ksect">Implikasi dan tindak lanjut</h3><div class="card"><ul class="kfind">
   <li><b>Prioritaskan tindak lanjut menurut nilai, bukan jumlah berkas.</b> Rawat inap hanya ${pct(b.ri.n/b.n)} dari SEP ${mlab(B)} tetapi ${pct(b.ri.amt/b.amt)} dari nilainya.</li>
   <li><b>Catat jawaban dan tanggal jawab pending pada berkas rekap.</b> Berkas pending ${mlab(B)} ${sikapOK(b)?'mencatat jawaban untuk '+pct(skRec(b))+' SEP':'tidak memuat jawaban RS'}. Jawaban yang dikirim lewat e-klaim tidak otomatis masuk ke rekap, sehingga tanpa kolom jawaban dan tanggal jawab dashboard tidak dapat mengukur berapa pending yang selesai dan berapa lama.</li>
   <li><b>Telaah kategori penyebab terbesar</b> pada tab Penyebab pending untuk menentukan apakah masalahnya kodefikasi, administrasi, atau indikasi pelayanan, lalu perbaiki di sumbernya (SIMRS dan dokumentasi klinis).</li>
   <li><b>Cek ulang kelengkapan berkas</b> bulan yang bertanda peringatan sebelum dipakai sebagai dasar proyeksi arus kas.</li>
  </ul></div>`;
  const draw=j=>{const e=$('pd-kpis');e.innerHTML=pCards(j);countUp(e)};
  seg('pdj',[['ALL','Semua'],['RI','Rawat inap'],['RJ','Rawat jalan']],'ALL',draw);draw('ALL');
  diverge2($('pd-pvm'),[
    {label:'Rawat inap · volume',v:vri},{label:'Rawat inap · nilai/SEP',v:mri},
    {label:'Rawat jalan · volume',v:vrj},{label:'Rawat jalan · nilai/SEP',v:mrj},
    {label:'Total perubahan',v:dAmt}],{fmt:x=>rp(x),lw:170,goodUp:false,title:'Dekomposisi perubahan nilai pending'});
  hbars2($('pd-jn'),[
    {label:'Rawat inap · nilai',a:a.ri.amt,s:b.ri.amt},{label:'Rawat jalan · nilai',a:a.rj.amt,s:b.rj.amt}],{fmt:rp,lw:130,tone:'bad',title:'Nilai pending per jenis layanan'});
  hbars2($('pd-jn2'),[
    {label:'Rawat inap · SEP',a:a.ri.n,s:b.ri.n},{label:'Rawat jalan · SEP',a:a.rj.n,s:b.rj.n}],{fmt:nf.format,lw:130,tone:'bad',title:'SEP pending per jenis layanan'});
};

function jenisP(j){
  const el=$('dpview-'+j.toLowerCase()),[A,B]=SEL,a=PM(A),b=PM(B),k=j.toLowerCase();
  const cats=catsU(a,b).map(c=>({label:c,a:cv(a,c,k),s:cv(b,c,k)})).filter(r=>r.a||r.s).sort((x,y)=>Math.max(y.a,y.s)-Math.max(x.a,x.s)).slice(0,10);
  const codes=Object.keys(Object.assign({},a.inacbg,b.inacbg)).map(c=>({label:c+(D.desc[c]?' · '+D.desc[c]:''),a:(a.inacbg[c]||{})[k]||0,s:(b.inacbg[c]||{})[k]||0})).filter(r=>r.a||r.s).sort((x,y)=>Math.max(y.a,y.s)-Math.max(x.a,x.s)).slice(0,10);
  el.innerHTML=`<div id="pd-k${k}"></div>
  <div class="card"><h2>Penyebab pending ${JNm[j].toLowerCase()} (jumlah SEP)</h2><p class="knote">Dasar kategori: ${catMode==='kw'?'kata kunci (heuristik)':'jenis pending BPJS'}. Pill menunjukkan perubahan ${esc(DS[0])} → ${esc(DS[1])}; merah = pending bertambah.</p><div id="pd-c${k}"></div></div>
  <div class="card"><h2>Kode INA-CBG ${JNm[j].toLowerCase()} dengan SEP pending terbanyak</h2><p class="knote">Jumlah SEP per kode. Deskripsi tersedia hanya untuk kode yang dikenal dari data klaim.</p><div id="pd-g${k}"></div></div>`;
  const e=$('pd-k'+k);e.innerHTML=pCards(j);countUp(e);
  hbars2($('pd-c'+k),cats,{lw:170,tone:'bad',title:'Penyebab pending '+JNm[j]});
  hbars2($('pd-g'+k),codes,{lw:Math.min(Math.floor(W($('pd-g'+k))*.46),300),tone:'bad',title:'INA-CBG pending '+JNm[j]});
}
PR.ri=()=>jenisP('RI');PR.rj=()=>jenisP('RJ');

let pdMet='n';
PR.sebab=()=>{
  const el=$('dpview-sebab'),[A,B]=SEL,a=PM(A),b=PM(B),met=pdMet,mf=met==='n'?nf.format:rp;
  const rows=catsU(a,b).map(c=>({label:c,a:cv(a,c,met),s:cv(b,c,met)})).sort((x,y)=>Math.max(y.a,y.s)-Math.max(x.a,x.s));
  const dl=rows.map(r=>({label:r.label,v:r.s-r.a,tip:tipCmp(r.label,r.a,r.s,mf)})).sort((x,y)=>Math.abs(y.v)-Math.abs(x.v)).slice(0,8);
  const ok=sikapOK(a)&&sikapOK(b);
  el.innerHTML=`<div class="ktoolbar"><span class="kl">Ukuran</span><div class="kseg" id="k-pdm"></div><span class="kl">Dasar kategori</span><div class="kseg ksegw" id="k-pdc"></div></div>
  ${caveat('<b>Cara membaca.</b> '+catBasis()+' Status jawaban RS adalah klasifikasi kata kunci atas kolom jawaban (heuristik). Satu SEP dihitung sekali.')}
  ${kelasWarn([A,B].filter(k=>PM(k)))}
  <div class="card"><h2>Kategori penyebab: ${esc(DS[0])} vs ${esc(DS[1])}</h2><p class="knote">Diurutkan dari yang terbesar. Pill merah = bertambah, hijau = berkurang.</p><div id="pd-sc"></div></div>
  <div class="kgrid kg2"><div class="card"><h2>Perubahan terbesar per kategori</h2><p class="knote">Selisih ${esc(DS[1])} dikurangi ${esc(DS[0])}; hijau = pending berkurang.</p><div id="pd-sd"></div></div>
  <div class="card"><h2>Status jawaban RS (100%)</h2><p class="knote">${ok?'Klasifikasi kata kunci atas kolom jawaban yang tercatat. “Jawaban tidak tercatat di berkas” bukan berarti belum dijawab.':'Tidak dapat ditampilkan: salah satu bulan berkasnya tidak memuat jawaban RS (kolom tidak ada, kosong, atau format ekspor).'}</p><div id="pd-ss"></div></div></div>
  ${lainSection('pln')}
  <h3 class="ksect">Teks alasan dari verifikator</h3><div class="card"><div class="ktoolbar"><span class="kl">Sumber</span><div class="kseg" id="k-pdt"></div><input type="search" id="pd-q" placeholder="Cari kata dalam alasan…" aria-label="Cari alasan"><span class="kl" id="pd-cnt"></span></div><div class="ktbl" id="pd-tbl"></div><p class="knote" style="margin:10px 0 0" id="pd-note"></p></div>`;
  seg('pdc',[['grp','JN 7 kelompok'],['jn','JN 15 jenis'],['kw','Kata kunci']],catMode,v=>setCatMode(v));
  seg('pdm',[['n','Jumlah SEP'],['amt','Nilai (Rp)']],met,v=>{pdMet=v;pRendered.sebab=0;KC.length=0;PR.sebab();pRendered.sebab=1});
  hbars2($('pd-sc'),rows,{fmt:mf,tone:'bad',lw:190,title:'Kategori penyebab'});
  lainDraw([A,B].filter(k=>PM(k)),met,'pln');
  diverge2($('pd-sd'),dl,{fmt:mf,goodUp:false,lw:150,title:'Perubahan per kategori'});
  if(ok){const ks=Object.keys(SK_COL);stack100($('pd-ss'),[A,B].map(k=>({label:mlab(k),vals:ks.map(s=>((PM(k).sikap[s]||{})[met])||0)})),ks.map(s=>({name:SK_LAB[s]||s,color:SK_COL[s]})),{title:'Status jawaban RS'})}
  else $('pd-ss').innerHTML='<p class="knote">Tidak ada data.</p>';
  let src='topik',tb=null;
  const draw=()=>{
    const m={};
    [[A,0],[B,1]].forEach(([k,i])=>Object.entries(PM(k)[src]||{}).forEach(([t,c])=>{const key=unent(t).trim();const o=m[key]=m[key]||{t:key,v:[0,0]};o.v[i]+=c}));
    const rs=Object.values(m).map(o=>({...o,_s:o.t.toLowerCase()}));
    $('pd-note').textContent=src==='topik'?'Topik filtrasi: 15 topik teratas per bulan, per SEP. Bulan berformat ekspor tidak memiliki kolom ini.':'Teks alasan: 12 teratas per bulan, per baris (satu SEP dapat terhitung lebih dari sekali). Angka 0 berarti tidak termasuk teratas bulan itu, belum tentu tidak muncul.';
    const cols=[{k:'t',h:'Teks',cls:'l',v:r=>r.t,f:r=>esc(r.t)},{k:'a',h:DS[0],v:r=>r.v[0],f:r=>nf.format(r.v[0])},{k:'b',h:DS[1],v:r=>r.v[1],f:r=>nf.format(r.v[1])},{k:'d',h:'Δ',v:r=>r.v[1]-r.v[0],f:r=>sgn(r.v[1]-r.v[0],nf.format)||'0'}];
    tb=table($('pd-tbl'),cols,rs,{sort:'b',asc:false,limit:40,count:$('pd-cnt')});
    $('pd-q').oninput=e=>tb.search(e.target.value);tb.search($('pd-q').value);
  };
  seg('pdt',[['topik','Topik filtrasi (per SEP)'],['alasan','Teks alasan (per baris)']],'topik',v=>{src=v;draw()});
  draw();
};

PR.kasus=()=>{
  const el=$('dpview-kasus'),[A,B]=SEL,a=PM(A),b=PM(B);
  const codes=[...new Set(Object.keys(a.inacbg).concat(Object.keys(b.inacbg)))].map(c=>{
    const x=a.inacbg[c]||{n:0,amt:0},y=b.inacbg[c]||{n:0,amt:0},d=D.desc[c]||'';
    return {code:c,desc:d,an:x.n,bn:y.n,aa:x.amt,ba:y.amt,_s:(c+' '+d).toLowerCase()};
  });
  const dd=codes.map(r=>({label:r.code+(r.desc?' · '+r.desc:''),v:r.ba-r.aa,tip:tipCmp(r.code+(r.desc?' · '+r.desc:''),r.aa,r.ba,rp)}));
  const ups=dd.filter(x=>x.v>0).sort((x,y)=>y.v-x.v).slice(0,6),dns=dd.filter(x=>x.v<0).sort((x,y)=>x.v-y.v).slice(0,6);
  el.innerHTML=`<div class="card"><h2>Kode INA-CBG dengan perubahan nilai pending terbesar</h2><p class="knote">Enam kenaikan dan enam penurunan terbesar nilai pending per kode; hijau = berkurang, merah = bertambah. Satu SEP dihitung pada satu kode.</p><div id="pd-kd"></div></div>
  <h3 class="ksect">Cari kode INA-CBG pending</h3><div class="card"><div class="ktoolbar"><div id="pd-combo"></div><span class="kl" id="pd-kc"></span></div><div class="ktbl" id="pd-kt"></div>
  <p class="knote" style="margin:10px 0 0">Deskripsi tersedia hanya untuk kode yang dikenal dari data klaim 2025–Sep 2026. “Nilai” adalah nilai ajuan SEP pending pada kode tersebut.</p></div>`;
  diverge2($('pd-kd'),ups.concat(dns),{fmt:x=>rp(x),goodUp:false,lw:Math.min(Math.floor(W($('pd-kd'))*.46),300),title:'Perubahan nilai pending per kode'});
  const cols=[
    {k:'code',h:'Kode',cls:'l',v:r=>r.code,f:r=>`<b>${esc(r.code)}</b>`},
    {k:'desc',h:'Deskripsi',cls:'l',v:r=>r.desc,f:r=>r.desc?esc(r.desc):'<span class="ksmall">belum ada deskripsi</span>'},
    {k:'an',h:'SEP '+DS[0],v:r=>r.an,f:r=>nf.format(r.an)},{k:'bn',h:'SEP '+DS[1],v:r=>r.bn,f:r=>nf.format(r.bn)},
    {k:'aa',h:'Nilai '+DS[0],v:r=>r.aa,f:r=>rp(r.aa)},{k:'ba',h:'Nilai '+DS[1],v:r=>r.ba,f:r=>rp(r.ba)},
    {k:'d',h:'Δ nilai',v:r=>r.ba-r.aa,f:r=>`<span class="kchip ${r.ba>r.aa?'bad':r.ba<r.aa?'good':'flat'}">${sgn(r.ba-r.aa,rp)||'0'}</span>`}
  ];
  const tb=table($('pd-kt'),cols,codes,{sort:'ba',asc:false,limit:40,count:$('pd-kc')});
  combo($('pd-combo'),{ph:'Cari kode atau nama diagnosis…',items:codes.slice().sort((x,y)=>Math.max(y.aa,y.ba)-Math.max(x.aa,x.ba)).map(r=>({s:r._s,text:r.code+(r.desc?' · '+r.desc:''),sub:DS[0]+' '+nf.format(r.an)+' SEP · '+DS[1]+' '+nf.format(r.bn)+' SEP',code:r.code})),onPick:it=>tb.only(it?(r=>r.code===it.code):null),onType:v=>tb.search(v)});
};

PR.dpjp=()=>{
  const el=$('dpview-dpjp'),[A,B]=SEL,a=PM(A),b=PM(B);
  if(!a.dpjp&&!b.dpjp){el.innerHTML=empty('Kedua bulan terpilih tidak memiliki data DPJP pending, sehingga perbandingan per DPJP belum dapat dibuat. Data DPJP tersedia untuk Januari 2025–Agustus 2026.');return}
  if(!(a.dpjp&&b.dpjp)){
    const k=a.dpjp?A:B;
    el.innerHTML=empty(`Hanya <b>${mfull(k)}</b> yang memiliki data DPJP; bulan pasangannya tidak. Perbandingan antar-DPJP tidak dapat dibuat, jadi hanya bulan ini yang ditampilkan di bawah.`)+`<div class="card"><div class="ktoolbar"><div id="pd-dc"></div><span class="kl" id="pd-dn"></span></div><div class="ktbl" id="pd-dt"></div></div>`;
    const rows=Object.entries(PM(k).dpjp).map(([name,v])=>({name,...v,_s:name.toLowerCase()}));
    const cols=[{k:'name',h:'DPJP',cls:'l',v:r=>r.name,f:r=>esc(r.name)},{k:'n',h:'SEP',v:r=>r.n,f:r=>nf.format(r.n)},{k:'ri',h:'RI',v:r=>r.ri,f:r=>nf.format(r.ri)},{k:'rj',h:'RJ',v:r=>r.rj,f:r=>nf.format(r.rj)},{k:'amt',h:'Nilai pending',v:r=>r.amt,f:r=>rp(r.amt)}];
    const t=table($('pd-dt'),cols,rows,{sort:'amt',asc:false,limit:40,count:$('pd-dn')});
    combo($('pd-dc'),{ph:'Cari nama DPJP…',items:rows.map(r=>({s:r._s,text:r.name,sub:nf.format(r.n)+' SEP · '+rp(r.amt),name:r.name})),onPick:it=>t.only(it?(r=>r.name===it.name):null),onType:v=>t.search(v)});
    return;
  }
  /* kedua bulan punya DPJP: bandingkan A vs B */
  const M={};
  [[A,0],[B,1]].forEach(([k,i])=>Object.entries(PM(k).dpjp).forEach(([name,v])=>{const key=nk(name),o=M[key]=M[key]||{name,n:[0,0],amt:[0,0]};o.n[i]+=v.n;o.amt[i]+=v.amt}));
  const rows=Object.values(M).map(o=>({name:o.name,na:o.n[0],nb:o.n[1],dn:o.n[1]-o.n[0],aa:o.amt[0],ab:o.amt[1],da:o.amt[1]-o.amt[0],_s:o.name.toLowerCase()}));
  const bars=rows.slice().sort((x,y)=>Math.max(y.aa,y.ab)-Math.max(x.aa,x.ab)).slice(0,10).map(r=>({label:r.name,a:r.aa,s:r.ab,tip:tipCmp(r.name,r.aa,r.ab,rp)}));
  const dl=rows.slice().sort((x,y)=>Math.abs(y.da)-Math.abs(x.da)).slice(0,8).map(r=>({label:r.name,v:r.da,tip:tipCmp(r.name,r.aa,r.ab,rp)}));
  const src=[A,B].map(k=>mlab(k)+' = '+(PM(k).dpjp_src||'berkas pending')).join('; ');
  el.innerHTML=`${caveat('<b>Cara membaca.</b> Nilai dan jumlah SEP pending per DPJP. Pending tidak berarti DPJP salah; ini peta konsentrasi tindak lanjut. <b>Sumber nama DPJP:</b> '+esc(src)+'. DPJP dari TXT e-klaim adalah DPJP pada klaim SEP tersebut, bukan keterangan verifikator.')}
  <div class="card"><h2>DPJP dengan nilai pending terbesar: ${esc(DS[0])} vs ${esc(DS[1])}</h2><p class="knote">10 DPJP teratas menurut nilai pending tertinggi pada salah satu bulan.</p><div id="pd-db"></div></div>
  <div class="kgrid kg2"><div class="card"><h2>Perubahan terbesar per DPJP</h2><p class="knote">Selisih nilai ${esc(DS[1])} dikurangi ${esc(DS[0])}; hijau = pending berkurang.</p><div id="pd-dd"></div></div>
  <div class="card"><div class="ktoolbar"><div id="pd-dc"></div><span class="kl" id="pd-dn"></span></div><div class="ktbl" id="pd-dt"></div></div></div>`;
  hbars2($('pd-db'),bars,{fmt:rp,tone:'bad',lw:190,title:'Nilai pending per DPJP'});
  diverge2($('pd-dd'),dl,{fmt:rp,goodUp:false,lw:150,title:'Perubahan nilai pending per DPJP'});
  const cols=[{k:'name',h:'DPJP',cls:'l',v:r=>r.name,f:r=>esc(r.name)},
    {k:'na',h:'SEP '+mlab(A),v:r=>r.na,f:r=>nf.format(r.na)},{k:'nb',h:'SEP '+mlab(B),v:r=>r.nb,f:r=>nf.format(r.nb)},
    {k:'aa',h:'Nilai '+mlab(A),v:r=>r.aa,f:r=>rp(r.aa)},{k:'ab',h:'Nilai '+mlab(B),v:r=>r.ab,f:r=>rp(r.ab)},
    {k:'da',h:'Selisih nilai',v:r=>r.da,f:r=>sgn(r.da,rp)}];
  const t=table($('pd-dt'),cols,rows,{sort:'ab',asc:false,limit:40,count:$('pd-dn')});
  combo($('pd-dc'),{ph:'Cari nama DPJP…',items:rows.slice().sort((x,y)=>Math.max(y.aa,y.ab)-Math.max(x.aa,x.ab)).map(r=>({s:r._s,text:r.name,sub:nf.format(r.na)+' → '+nf.format(r.nb)+' SEP',name:r.name})),onPick:it=>t.only(it?(r=>r.name===it.name):null),onType:v=>t.search(v)});
};

PR.data=()=>{
  const el=$('dpview-data'),[A,B]=SEL,a=PM(A),b=PM(B);
  const rows=[
    ['Berkas sumber',a.file,b.file],['Format berkas',a.fmt,b.fmt],['Baris di berkas',nf.format(a.rows),nf.format(b.rows)],
    ['SEP unik (dihitung)',nf.format(a.n),nf.format(b.n)],['Baris per SEP',dec(a.rows/a.n,2),dec(b.rows/b.n,2)],
    ['SEP multi-alasan',nf.format(a.multi_reason_sep),nf.format(b.multi_reason_sep)],
    ['Baris persis kembar',a.dup_rows,b.dup_rows],['Tanggal pulang di luar bulan berkas / kosong',a.month_mismatch,b.month_mismatch],
    ['SEP juga muncul di bulan sebelumnya',a.sep_seen_before,b.sep_seen_before],
    ['Catatan',(D.meta.caution&&D.meta.caution[A])||'–',(D.meta.caution&&D.meta.caution[B])||'–']];
  el.innerHTML=`<div class="card"><h2>Kualitas data kedua bulan</h2><div class="ktbl"><table><thead><tr><th class="l">Indikator</th><th>${esc(mfull(A))}</th><th>${esc(mfull(B))}</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="l">${esc(r[0])}</td><td class="l" style="text-align:right">${esc(r[1])}</td><td class="l" style="text-align:right">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></div>
  <h3 class="ksect">Keterbatasan analisis</h3><div class="card"><ul class="kfind">
   <li><b>Pending bukan penolakan.</b> Pending adalah klaim yang menunggu konfirmasi atau perbaikan; nilainya adalah risiko arus kas, bukan kerugian.</li>
   <li><b>Nilai pending adalah nilai ajuan</b> (BYPENGAJUAN) per SEP unik; periode mengikuti tanggal pulang.</li>
   <li><b>Kategori penyebab</b> mengikuti jenis pending BPJS (bulan 2025, Juli, dan Agustus 2026: isian perkiraan Claude, belum diverifikasi tim casemix); <b>status jawaban RS</b> adalah heuristik kata kunci.</li>
   <li><b>Tidak ada data harian untuk pending</b>, sehingga tab tren harian dan efek hari kerja tidak tersedia pada mode pending.</li>
   <li><b>Satu bulan melawan satu bulan.</b> Selisih dua bulan bukan tren; musim penyakit, hari kerja, dan kelengkapan berkas memengaruhi angka.</li>
   <li><b>Data pasien tidak ditampilkan.</b> Hanya agregat; nama, nomor kartu, NIK, nomor RM, dan nomor SEP tidak dimasukkan.</li>
  </ul></div>`;
};

/* ================= Analisis lanjutan =================
   1) LOS per kode INA-CBG   2) DPJP disesuaikan case-mix (O/E)   3) SLA finalisasi klaim   4) Pending vs klaim per kode
   Data: KLAIM_AGG (per bulan), DPX_DATA (DPJP x kode, acuan 21 bulan), PK_DATA (pending). Semua agregat, tanpa data pasien. */
const KAm=(window.KLAIM_AGG||{}).months||{}, DX=window.DPX_DATA||null, DC=window.DPC_DATA||null;
const clean=s=>String(s).replace(/^"+|"+$/g,'').trim();
const LJ={};
const LTABS=[['los','LOS per kode'],['dpjp','DPJP & case-mix'],['sla','SLA finalisasi'],['pvk','Pending vs klaim per kode'],['bavk','Hasil verifikasi (BAVK)']];
let ljTab=store.get('pk_ljt')||'los',ljR={},dpJ='RI',dcSel=null,slaD=+store.get('pk_sla_d')||7,slaP=+store.get('pk_sla_p')||80;
const MINN=30;
const devChip=(ratio,ok,badUp)=>{
  if(!ok||!isFinite(ratio))return '<span class="ksmall">n kecil</span>';
  const d=ratio-1,up=d>0.15,dn=d<-0.15;let c='flat';
  if(up)c=badUp===false?'good':'bad';if(dn)c=badUp===false?'bad':'good';
  return `<span class="kchip ${c}">${d>=0?'+':'−'}${dec(Math.abs(d)*100,0)}%</span>`;
};
function ljBuild(){
  const el=$('lanjut');if(el.dataset.built)return;el.dataset.built='1';
  el.innerHTML=`<nav class="k-tabs" id="lj-tabs" role="tablist" aria-label="Analisis lanjutan">${LTABS.map(t=>`<button type="button" role="tab" data-t="${t[0]}" aria-selected="false">${t[1]}</button>`).join('')}</nav>`+
    LTABS.map(t=>`<section class="ljview" id="lj-${t[0]}"></section>`).join('');
  $('lj-tabs').onclick=e=>{const b=e.target.closest('button');if(b)ljShow(b.dataset.t)};
}
function ljShow(id){
  if(!LTABS.some(t=>t[0]===id))id='los';
  ljTab=id;store.set('pk_ljt',id);
  $('lj-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===id));
  document.querySelectorAll('#lanjut .ljview').forEach(s=>s.classList.toggle('active',s.id==='lj-'+id));
  if(!ljR[id]){KC.length=0;LJ[id]();ljR[id]=1}
}
function renderLanjut(){ljBuild();ljR={};ljShow(ljTab)}
const noKlaim=()=>{const av=TL.filter(hasK);return empty(`Tidak ada data klaim pada bulan terpilih. Data klaim tersedia untuk <b>${av.length} bulan</b> (${mfull(av[0])} sampai ${mfull(av[av.length-1])}).`)};

/* ---------- 1. LOS per kode ---------- */
LJ.los=()=>{
  const el=$('lj-los'),ks=selK();
  if(!ks.length){el.innerHTML=noKlaim();return}
  const mk=()=>({n:0,los:0,tot:0,rs:0,per:{}});
  const ag={},rf={};
  const add=(M,c,v,k)=>{const o=M[c]=M[c]||Object.assign(mk(),{code:c});o.n+=v[0];o.los+=v[0]*v[3];o.tot+=v[1];o.rs+=v[2];if(k)o.per[k]={n:v[0],a:v[3]}};
  ks.forEach(k=>Object.entries(KAm[k].inacbg.RI).forEach(([c,v])=>add(ag,c,v,k)));
  Object.keys(KAm).forEach(k=>Object.entries(KAm[k].inacbg.RI).forEach(([c,v])=>add(rf,c,v)));
  const sK=fn=>sum(ks.map(k=>fn(KAm[k].kpi.RI)));
  const n=sK(x=>x.n),los=sK(x=>x.los),tot=sK(x=>x.tot);
  const allK=Object.keys(KAm),nA=sum(allK.map(k=>KAm[k].kpi.RI.n)),lA=sum(allK.map(k=>KAm[k].kpi.RI.los));
  const alos=los/n,alosA=lA/nA;
  const rows=Object.values(ag).map(o=>{const r=rf[o.code];return {code:o.code,desc:D.desc[o.code]||'',n:o.n,los:o.los,alos:o.los/o.n,rn:r.n,ralos:r.los/r.n,tpk:o.tot/o.n,tph:o.los?o.tot/o.los:0,per:o.per,_s:(o.code+' '+(D.desc[o.code]||'')).toLowerCase()}});
  const showM=ks.length>=2&&ks.length<=4;
  el.innerHTML=`<div class="card"><h2>Lama rawat (LOS) per kode INA-CBG — rawat inap</h2><p class="knote">ALOS = rata-rata hari rawat per klaim. Dihitung untuk <b>rawat inap saja</b> (rawat jalan tidak punya lama rawat bermakna). Pembanding "ALOS acuan" = rata-rata kode yang sama pada seluruh 21 bulan data klaim. Selisih hanya ditandai bila klaim ≥ 10 pada bulan terpilih dan acuan ≥ 20.</p><div id="ljl-k"></div></div>
  <div class="kgrid kg2"><div class="card"><h2>ALOS rawat inap per bulan</h2><p class="knote">Seluruh bulan yang punya data klaim; bulan terpilih diberi sorotan.</p><div id="ljl-c1"></div></div>
  <div class="card"><h2>Kode dengan total hari rawat terbanyak</h2><p class="knote">Hari rawat = klaim × ALOS. Kode di sini paling banyak memakai tempat tidur pada bulan terpilih.</p><div id="ljl-c2"></div></div></div>
  <h3 class="ksect">Semua kode rawat inap</h3><div class="card"><div class="ktoolbar"><div id="ljl-combo"></div><span class="kl" id="ljl-cnt"></span></div><div class="ktbl" id="ljl-tbl"></div>
  <p class="knote" style="margin:10px 0 0">LOS per kode tersimpan sebagai rata-rata yang dibulatkan 2 desimal, sehingga total hari rawat per kode bisa berbeda ±0,5% dari total berkas. ALOS tinggi belum berarti pelayanan tidak efisien: tingkat keparahan, komplikasi, dan rujukan memengaruhi lama rawat.</p></div>`;
  $('ljl-k').innerHTML='<div class="kgrid kkpis">'+
    kcard('ALOS rawat inap',alos,x=>dec(x,2)+' hari','Acuan 21 bulan: '+dec(alosA,2)+' hari',chg(alosA,alos,null))+
    kcard('Total hari rawat',los,nf.format,'Pada bulan terpilih')+
    kcard('Klaim rawat inap',n,nf.format,'Pada bulan terpilih')+
    kcard('Tarif INA-CBG per hari rawat',los?tot/los:0,rp,'Total tarif RI ÷ total hari rawat')+'</div>';
  countUp($('ljl-k'));
  const cats=allK.sort().map(k=>({label:mlab(k),sel:ks.includes(k)}));
  trendN($('ljl-c1'),cats,[{name:'ALOS RI (hari)',color:COL[0],vals:allK.map(k=>KAm[k].kpi.RI.los/KAm[k].kpi.RI.n)}],{fmt:x=>dec(x,2),ax:x=>dec(x,1),title:'ALOS rawat inap per bulan'});
  hbarsN($('ljl-c2'),rows.slice().sort((a,b)=>b.los-a.los).slice(0,10).map(r=>({label:r.code+(r.desc?' · '+r.desc:''),vals:[Math.round(r.los)]})),[{name:'Hari rawat',color:COL[0],vals:null}],{fmt:nf.format,lw:Math.min(Math.floor(W($('ljl-c2'))*.5),260),title:'Hari rawat terbanyak'});
  const cols=[
    {k:'code',h:'Kode',cls:'l',v:r=>r.code,f:r=>`<b>${esc(r.code)}</b>`},
    {k:'desc',h:'Deskripsi',cls:'l',v:r=>r.desc,f:r=>r.desc?esc(r.desc):'<span class="ksmall">belum ada deskripsi</span>'},
    {k:'n',h:'Klaim',v:r=>r.n,f:r=>nf.format(r.n)},
    {k:'los',h:'Hari rawat',v:r=>r.los,f:r=>nf.format(Math.round(r.los))},
    {k:'alos',h:'ALOS',v:r=>r.alos,f:r=>`<b>${dec(r.alos,2)}</b>`}]
    .concat(showM?ks.map(k=>({k:'a'+k,h:'ALOS '+mlab(k),v:r=>r.per[k]?r.per[k].a:-1,f:r=>r.per[k]?dec(r.per[k].a,2):'–'})):[],[
    {k:'ralos',h:'ALOS acuan',v:r=>r.ralos,f:r=>dec(r.ralos,2)},
    {k:'dev',h:'Selisih thd acuan',v:r=>r.alos/r.ralos,f:r=>devChip(r.alos/r.ralos,r.n>=10&&r.rn>=20,true)},
    {k:'tpk',h:'Tarif / klaim',v:r=>r.tpk,f:r=>rp(r.tpk)},
    {k:'tph',h:'Tarif / hari rawat',v:r=>r.tph,f:r=>rp(r.tph)}]);
  const tb=table($('ljl-tbl'),cols,rows,{sort:'los',asc:false,count:$('ljl-cnt')});
  combo($('ljl-combo'),{ph:'Cari kode atau nama diagnosis…',items:rows.slice().sort((a,b)=>b.los-a.los).map(r=>({s:r._s,text:r.code+(r.desc?' · '+r.desc:''),sub:nf.format(r.n)+' klaim · ALOS '+dec(r.alos,2),code:r.code})),onPick:it=>tb.only(it?(r=>r.code===it.code):null),onType:v=>tb.search(v)});
};

/* ---------- 2. DPJP disesuaikan case-mix ---------- */
LJ.dpjp=()=>{
  const el=$('lj-dpjp'),ks=selK().filter(k=>DX&&DX.months[k]);
  if(!DX||!ks.length){el.innerHTML=!DX?empty('Data DPJP × kode belum tersedia pada paket data ini.'):noKlaim();return}
  const j=dpJ,RIm=j==='RI';
  const ag={};
  ks.forEach(k=>Object.entries(DX.months[k][j]||{}).forEach(([i,v])=>{const o=ag[i]=ag[i]||[0,0,0,0,0,0,0,0];for(let t=0;t<8;t++)o[t]+=(v[t]||0)}));
  const T=Object.values(ag).reduce((a,v)=>({n:a.n+v[0],tot:a.tot+v[5],los:a.los+v[1],rs:a.rs+v[3]}),{n:0,tot:0,los:0,rs:0});
  const hAvg=T.tot/T.n;
  const ADJ=RIm&&!!(DX.meta||{}).adj&&Object.values(ag).every(v=>v[7]>0),AJ=(DX.meta||{}).adj||{};
  const rows=Object.entries(ag).map(([i,v])=>({name:clean(DX.names[i]),n:v[0],cmi:(v[5]/v[0])/hAvg,alos:v[1]/v[0],elos:(ADJ?v[7]:v[2])/v[0],elos0:v[2]/v[0],oeL:(ADJ?v[7]:v[2])>0?v[1]/(ADJ?v[7]:v[2]):NaN,oeL0:v[2]>0?v[1]/v[2]:NaN,rsC:v[3]/v[0],eRs:v[4]/v[0],oeR:v[4]>0?v[3]/v[4]:NaN,ratio:v[3]?v[5]/v[3]:0,fb:v[6]/v[0],_s:clean(DX.names[i]).toLowerCase()}));
  const big=rows.filter(r=>r.n>=MINN);
  const cov=DX.meta.cov[j];
  el.innerHTML=`<div class="ktoolbar"><span class="kl">Jenis pelayanan</span><div class="kseg" id="k-ljJ"></div></div>
  <div class="card"><h2>DPJP disesuaikan case-mix</h2><p class="knote">Membandingkan <b>hasil nyata</b> tiap DPJP dengan <b>nilai yang diharapkan</b> bila kasusnya (kode INA-CBG${RIm?' dan kelas rawat':''}) dirawat dengan rata-rata RS.${ADJ?' Khusus LOS, harapan juga <b>disesuaikan dengan kelompok usia pasien dan status meninggal</b> (lihat catatan di bawah).':''} O/E = observed ÷ expected: 1,00 sama dengan rata-rata RS untuk kasus yang sama; 1,20 berarti 20% di atas. Acuan: rata-rata RS seluruh 21 bulan (Jan 2025–Sep 2026), per kode${RIm?' dan kelas':''}; bila kode punya &lt; 10 klaim, acuan jatuh ke kelompok dasar lalu rata-rata jenis layanan. ${nf.format(Math.round((cov.rs_level['0']+cov.rs_level['1'])*100))}% klaim ${RIm?'rawat inap':'rawat jalan'} memakai acuan tingkat kode. DPJP dengan klaim &lt; ${MINN} pada bulan terpilih tidak dinilai (n kecil).</p><div id="ljd-dk"></div></div>
  <div class="kgrid ${RIm?'kg2':''}">${RIm?`<div class="card"><h2>LOS: selisih terhadap harapan</h2><p class="knote">O/E LOS${ADJ?' (disesuaikan usia dan status meninggal)':''} − 1. Kanan (merah) = rawat lebih lama dari yang diharapkan untuk kasus yang sama; kiri = lebih singkat. Bukan penilaian mutu: lebih singkat tidak otomatis lebih baik.</p><div id="ljd-c1"></div></div>`:''}
  <div class="card"><h2>Tarif RS (intensitas layanan): selisih terhadap harapan</h2><p class="knote">O/E Tarif RS − 1. Tarif RS = tarif rumah sakit atas layanan yang dipakai pasien (obat, penunjang, tindakan, kamar). Dipakai sebagai <b>indikator intensitas layanan</b>, bukan biaya produksi (unit cost).</p><div id="ljd-c2"></div></div></div>
  <div class="card"><h3 class="ksect" style="margin-top:0">Temuan otomatis</h3><ul class="kfind" id="ljd-find"></ul></div>
  <h3 class="ksect">Semua DPJP (${j==='RI'?'rawat inap':'rawat jalan'})</h3><div class="card"><div class="ktoolbar"><div id="ljd-combo"></div><span class="kl" id="ljd-cnt"></span></div><div class="ktbl" id="ljd-tbl"></div><span id="lj-dtbl" hidden></span>
  <p class="knote" style="margin:10px 0 0">CMI = rata-rata tarif INA-CBG per klaim DPJP ÷ rata-rata RS pada bulan terpilih (&gt; 1,00 = kasus lebih berat/mahal dari rata-rata). "Tanpa acuan kode" = porsi klaim yang acuannya bukan tingkat kode. Hanya kasus yang tercatat DPJP-nya (${nf.format(T.n)} klaim). ${ADJ?'LOS harapan sudah memperhitungkan usia dan status meninggal, tetapi belum memperhitungkan komorbid/diagnosis sekunder, ICU, rujukan, dan faktor lain yang tidak tertangkap data ini; ':'Perbedaan DPJP bisa berasal dari komorbid, usia, rujukan, dan faktor lain yang tidak tertangkap kode INA-CBG; '}gunakan sebagai bahan diskusi, bukan penilaian individu.</p></div>${RIm&&DC&&ADJ?'<h3 class="ksect">Rincian: kode penyumbang selisih hari rawat</h3><div id="ljd-dc"></div>':''}`;
  if(ADJ){const dt=document.createElement('details');dt.className='kdet';const fa=AJ.age||{},fd=AJ.dead||{},bd=AJ.banding||{};
    dt.innerHTML=`<summary>Cara penyesuaian LOS untuk tingkat keparahan dalam satu kode</summary><p class="knote" style="margin-top:8px">Dalam satu kode INA-CBG, pasien bisa berbeda. Harapan LOS dihitung dari kode (atau kelompok dasar/jenis bila kode jarang) <b>dikali faktor</b> kelompok usia dan status pulang meninggal, diestimasi bersama pada ${nf.format(20360)} klaim rawat inap 21 bulan (model multiplikatif). Faktor usia: &lt; 1 th ${dec(fa['<1'],2)}; 1–17 th ${dec(fa['1-17'],2)}; 18–59 th ${dec(fa['18-59'],2)}; ≥ 60 th ${dec(fa['60+'],2)}. Meninggal ${dec(fd.ya,2)} (LOS lebih pendek karena pasien tidak lanjut dirawat), lainnya ${dec(fd.tidak,2)}.</p><p class="knote"><b>Hasil pemeriksaan:</b> penyesuaian ini mengubah gambaran hanya sedikit. Dari ${bd.dpjp_n} DPJP dengan klaim ≥ ${MINN} (21 bulan), urutan O/E sebelum dan sesudah sangat mirip (korelasi peringkat ${dec(bd.rank_corr,2)}), selisih O/E terbesar ${dec(bd.max_selisih_oe,2)} dan rata-rata ${dec(bd.rata_selisih_oe,3)}. Tidak ada DPJP di luar ±15% sebelum maupun sesudah penyesuaian. Artinya perbedaan LOS antar-DPJP bukan terutama karena komposisi usia/meninggal.</p><p class="knote"><b>Sengaja tidak dipakai:</b> (1) ICU: menaikkan LOS sekitar ${dec(1.44,2)} kali, tetapi sebagian merupakan keputusan pelayanan, sehingga menyesuaikannya dapat menutupi perbedaan praktik. (2) Status pulang "lain-lain": muncul sejak Jul 2025 dan mencapai 28–36% pada Okt–Nov 2025, jadi lebih mirip artefak pencatatan daripada ciri pasien. (3) Diagnosis sekunder/komorbid: bergantung pada kelengkapan pengkodean, bukan murni kondisi pasien. Karena itu keparahan <b>tidak sepenuhnya</b> tertangkap; selisih yang tersisa tetap bahan diskusi, bukan penilaian individu.</p>`;
    $('lj-dtbl').parentElement.appendChild(dt)}
  {const G=((window.KLAIM_AGG||{}).meta_x||{}).dpjp_groups||[];
    if(G.length){const dt=document.createElement('details');dt.className='kdet';dt.innerHTML=`<summary>Penyatuan nama DPJP: ${G.length} kelompok penulisan digabung. Mohon dikonfirmasi.</summary><p class="knote" style="margin-top:8px">Penulisan yang jelas merujuk orang yang sama (huruf besar/kecil, titik, nama belakang disingkat, gelar tidak lengkap) disatukan agar tiap DPJP tampil sebagai satu baris pada semua bulan. Nama di kiri adalah nama yang dipakai; di kanan penulisan lain yang digabung.</p><ul class="kfind">`+G.map(g=>`<li><b>${esc(g[0])}</b> ← ${g[1].map(esc).join('; ')}</li>`).join('')+'</ul>';
      $('lj-dtbl').parentElement.appendChild(dt)}}
  seg('ljJ',[['RI','Rawat inap'],['RJ','Rawat jalan']],j,v=>{dpJ=v;ljR.dpjp=0;KC.length=0;LJ.dpjp();ljR.dpjp=1});
  const kpis=[kcard('DPJP dinilai',big.length,nf.format,'Klaim ≥ '+MINN+' pada bulan terpilih (dari '+rows.length+' DPJP)'),
    kcard('Klaim tercakup',T.n,nf.format,RIm?'Rawat inap':'Rawat jalan')];
  if(RIm)kpis.push(kcard('ALOS RS',T.los/T.n,x=>dec(x,2)+' hari','Rata-rata semua DPJP pada bulan terpilih'));
  kpis.push(kcard('Rata-rata tarif INA-CBG',hAvg,rp,'Per klaim, semua DPJP'));
  $('ljd-dk').innerHTML='<div class="kgrid kkpis">'+kpis.join('')+'</div>';countUp($('ljd-dk'));
  const dv=(arr,key)=>{const s=arr.filter(r=>isFinite(r[key])).sort((a,b)=>b[key]-a[key]);const sel=s.length>16?s.slice(0,8).concat(s.slice(-8)):s;return sel.map(r=>({label:r.name+' ('+nf.format(r.n)+')',v:(r[key]-1)*100,tip:`<b>${esc(r.name)}</b><br><span class="m">${nf.format(r.n)} klaim</span><br><span class="m">O/E ${dec(r[key],2)}</span>`}))};
  const fmtP=x=>dec(x,0)+'%',lw=Math.min(Math.floor(W($('ljd-c2'))*.5),250);
  if(!big.length){['ljd-c1','ljd-c2'].forEach(id=>{const e=$(id);if(e)e.innerHTML='<p class="knote">Belum ada DPJP dengan klaim ≥ '+MINN+' pada bulan terpilih. Pilih lebih banyak bulan.</p>'})}
  else{
    if(RIm)diverge2($('ljd-c1'),dv(big,'oeL'),{fmt:fmtP,goodUp:false,lw,title:'LOS terhadap harapan'});
    diverge2($('ljd-c2'),dv(big,'oeR'),{fmt:fmtP,goodUp:false,lw,title:'Tarif RS terhadap harapan'});
  }
  const F=[];
  if(big.length>=2){
    const bl=big.filter(r=>isFinite(r.oeR)).sort((a,b)=>b.oeR-a.oeR);
    if(RIm){const bo=big.filter(r=>isFinite(r.oeL)).sort((a,b)=>b.oeL-a.oeL),hi=bo[0],lo=bo[bo.length-1];
      F.push(`<li><b>LOS:</b> paling jauh di atas harapan <b>${esc(hi.name)}</b> (O/E ${dec(hi.oeL,2)}; ALOS ${dec(hi.alos,2)} vs harapan ${dec(hi.elos,2)} hari, ${nf.format(hi.n)} klaim); paling di bawah <b>${esc(lo.name)}</b> (O/E ${dec(lo.oeL,2)}).</li>`);
      const nHi=bo.filter(r=>r.oeL>1.15).length,nLo=bo.filter(r=>r.oeL<0.85).length;
      F.push(`<li class="${nHi?'w':''}">${nHi} dari ${bo.length} DPJP dinilai berada lebih dari 15% di atas harapan LOS${ADJ?' (disesuaikan usia dan meninggal)':''}, dan ${nLo} lebih dari 15% di bawahnya. Selisih ±15% dipakai sebagai batas awal untuk ditelaah, bukan batas mutu.</li>`);
      if(ADJ){const b0=bo.filter(r=>isFinite(r.oeL0)),d=b0.map(r=>Math.abs(r.oeL-r.oeL0)),mx=Math.max(...d,0),mr=b0.find(r=>Math.abs(r.oeL-r.oeL0)===mx);
        if(mr)F.push(`<li>Pengaruh penyesuaian usia dan meninggal pada bulan terpilih: selisih O/E terbesar ${dec(mx,2)}${mx>0.03?' ('+esc(mr.name)+', '+nf.format(mr.n)+' klaim)':''}. ${mx<0.05?'Kecil: urutan DPJP hampir tidak berubah.':'Cukup terasa pada DPJP dengan klaim sedikit; baca bersama jumlah klaim.'}</li>`)}}
    const hi=bl[0],lo=bl[bl.length-1];
    F.push(`<li><b>Intensitas layanan (Tarif RS):</b> tertinggi <b>${esc(hi.name)}</b> (O/E ${dec(hi.oeR,2)}, ${rp(hi.rsC)} per klaim vs harapan ${rp(hi.eRs)}); terendah <b>${esc(lo.name)}</b> (O/E ${dec(lo.oeR,2)}).</li>`);
    const hc=big.slice().sort((a,b)=>b.cmi-a.cmi)[0],lc=big.slice().sort((a,b)=>a.cmi-b.cmi)[0];
    F.push(`<li><b>Case-mix:</b> kasus terberat/termahal ada pada <b>${esc(hc.name)}</b> (CMI ${dec(hc.cmi,2)}), teringan pada <b>${esc(lc.name)}</b> (CMI ${dec(lc.cmi,2)}). Perbandingan antar-DPJP tanpa penyesuaian akan menyesatkan karena rentang CMI ini.</li>`);
    const fbHi=big.filter(r=>r.fb>0.2);
    if(fbHi.length)F.push(`<li class="w">${fbHi.length} DPJP punya &gt; 20% klaim dengan acuan di luar tingkat kode (kode jarang); O/E mereka kurang andal.</li>`);
  } else F.push('<li>Bulan terpilih belum cukup untuk membandingkan DPJP. Pilih lebih banyak bulan (disarankan ≥ 3).</li>');
  $('ljd-find').innerHTML=F.join('');
  const cols=[
    {k:'name',h:'DPJP',cls:'l',v:r=>r.name,f:r=>esc(r.name)},
    {k:'n',h:'Klaim',v:r=>r.n,f:r=>nf.format(r.n)},
    {k:'cmi',h:'CMI',v:r=>r.cmi,f:r=>dec(r.cmi,2)}]
    .concat(RIm?[
    {k:'alos',h:'ALOS',v:r=>r.alos,f:r=>dec(r.alos,2)},
    {k:'elos',h:ADJ?'ALOS harapan (disesuaikan)':'ALOS harapan',v:r=>r.elos,f:r=>dec(r.elos,2)},
    {k:'oeL',h:ADJ?'O/E LOS (disesuaikan)':'O/E LOS',v:r=>isFinite(r.oeL)?r.oeL:0,f:r=>(isFinite(r.oeL)?'<b>'+dec(r.oeL,2)+'</b> ':'')+devChip(r.oeL,r.n>=MINN,true)}].concat(ADJ?[{k:'oeL0',h:'O/E LOS (tanpa penyesuaian)',v:r=>isFinite(r.oeL0)?r.oeL0:0,f:r=>isFinite(r.oeL0)?dec(r.oeL0,2):'–'}]:[]):[],[
    {k:'rsC',h:'Tarif RS / klaim',v:r=>r.rsC,f:r=>rp(r.rsC)},
    {k:'eRs',h:'Tarif RS harapan',v:r=>r.eRs,f:r=>rp(r.eRs)},
    {k:'oeR',h:'O/E Tarif RS',v:r=>isFinite(r.oeR)?r.oeR:0,f:r=>(isFinite(r.oeR)?'<b>'+dec(r.oeR,2)+'</b> ':'')+devChip(r.oeR,r.n>=MINN,true)},
    {k:'ratio',h:'Klaim ÷ Tarif RS',v:r=>r.ratio,f:r=>pct(r.ratio)},
    {k:'fb',h:'Tanpa acuan kode',v:r=>r.fb,f:r=>pct(r.fb,0)}]);
  const tb=table($('ljd-tbl'),cols,rows,{sort:'n',asc:false,count:$('ljd-cnt')});
  combo($('ljd-combo'),{ph:'Cari nama DPJP…',items:rows.slice().sort((a,b)=>b.n-a.n).map(r=>({s:r._s,text:r.name,sub:nf.format(r.n)+' klaim',name:r.name})),onPick:it=>tb.only(it?(r=>r.name===it.name):null),onType:v=>tb.search(v)});
  if(RIm&&DC&&ADJ)dcDraw(ks,rows);
};


/* ---------- 2b. Rincian DPJP x kode: kontribusi selisih hari rawat ---------- */
const REFL={C:'kode',B:'kelompok dasar',J:'rata-rata jenis'};
function dcDraw(ks,rows){
  const box=$('ljd-dc');if(!box)return;
  const ag={};
  ks.forEach(k=>Object.entries((DC.months||{})[k]||{}).forEach(([i,f])=>{const o=ag[i]=ag[i]||{};for(let q=0;q<f.length;q+=4){const e=o[f[q]]=o[f[q]]||[0,0,0];e[0]+=f[q+1];e[1]+=f[q+2];e[2]+=f[q+3]}}));
  const P=Object.entries(ag).map(([i,o])=>{
    const cs=Object.entries(o).map(([ci,e])=>{const inf=DC.codes[+ci],code=inf[0],n=e[0],d=e[1]-e[2],se=inf[1]*Math.sqrt(n),z=se>0?d/se:0;
      const ds=clean(D.desc[code]||'');return {code,desc:ds,n,los:e[1],e:e[2],alos:e[1]/n,ealos:e[2]/n,d,se,z,ref:inf[2],flag:(n>=5&&Math.abs(z)>=2)?(d>0?1:-1):0,_s:(code+' '+ds).toLowerCase()}});
    return {i,name:clean(DX.names[+i]),n:sum(cs.map(c=>c.n)),los:sum(cs.map(c=>c.los)),e:sum(cs.map(c=>c.e)),net:sum(cs.map(c=>c.d)),cs}});
  if(!P.length){box.innerHTML=empty('Belum ada data rincian kode pada bulan terpilih.');return}
  const big=P.filter(p=>p.n>=MINN).sort((a,b)=>b.net-a.net);
  const fd=x=>nf.format(Math.round(x)),hari=x=>sgn(x,v=>dec(v,0))+' hari';
  const lw=Math.min(Math.floor(W(box)*.4),250);
  box.innerHTML=`<div class="card"><h2>Selisih hari rawat per DPJP</h2><p class="knote">Selisih = hari rawat nyata − hari rawat yang diharapkan (disesuaikan kode, usia, dan status meninggal), dijumlahkan semua kasus DPJP. Persen pada grafik di atas menunjukkan <b>seberapa menyimpang</b>; grafik ini menunjukkan <b>seberapa besar dampaknya dalam hari rawat</b>. Persen kecil pada DPJP dengan banyak klaim bisa berarti ratusan hari. Kanan (merah) = lebih banyak hari dari harapan.</p><div id="dc-c1"></div></div>
  <div class="card"><h2>Rincian satu DPJP</h2><div class="ktoolbar"><span class="kl">DPJP</span><select class="ksel" id="dc-sel" aria-label="Pilih DPJP"></select></div><div id="dc-body"></div></div>`;
  const dv=big.map(p=>({label:p.name+' ('+nf.format(p.n)+')',v:p.net,tip:`<b>${esc(p.name)}</b><br><span class="m">${nf.format(p.n)} klaim</span><br><span class="m">Nyata ${fd(p.los)} hari vs harapan ${fd(p.e)} hari</span><br><span class="m">Selisih ${hari(p.net)}</span>`}));
  if(dv.length)diverge2($('dc-c1'),dv,{fmt:x=>dec(x,0),goodUp:false,lw,title:'Selisih hari rawat per DPJP'});else $('dc-c1').innerHTML='<p class="knote">Belum ada DPJP dengan klaim ≥ '+MINN+' pada bulan terpilih. Pilih lebih banyak bulan.</p>';
  const all=P.slice().sort((a,b)=>b.n-a.n);
  if(!dcSel||!all.some(p=>p.name===dcSel))dcSel=(big.length?big.slice().sort((a,b)=>Math.abs(b.net)-Math.abs(a.net))[0]:all[0]).name;
  const sel=$('dc-sel');
  sel.innerHTML=all.map(p=>`<option value="${esc(p.name)}">${esc(p.name)} (${nf.format(p.n)} klaim${p.n<MINN?', n kecil':''})</option>`).join('');
  sel.value=dcSel;
  const draw=()=>{
    const p=all.find(q=>q.name===dcSel);if(!p)return;
    const pos=p.cs.filter(c=>c.d>0),neg=p.cs.filter(c=>c.d<0),gp=sum(pos.map(c=>c.d)),gn=sum(neg.map(c=>c.d));
    const elig=p.cs.filter(c=>c.n>=5),fl=p.cs.filter(c=>c.flag!==0);
    const row=rows.find(r=>r.name===p.name),chk=row?Math.abs((row.alos-row.elos)*row.n-p.net):0;
    const topP=pos.slice().sort((a,b)=>b.d-a.d),topN=neg.slice().sort((a,b)=>a.d-b.d);
    const cd=c=>`<b>${esc(c.code)}</b>${c.desc?' · '+esc(c.desc):''}`;
    const fchip=c=>c.n<5?'<span class="ksmall">n kecil</span>':c.flag>0?'<span class="kchip bad">di atas batas wajar</span>':c.flag<0?'<span class="kchip good">di bawah batas wajar</span>':'<span class="kchip flat">dalam batas wajar</span>';
    const F=[];
    if(p.n<MINN)F.push(`<li class="w">DPJP ini hanya punya ${nf.format(p.n)} klaim pada bulan terpilih (&lt; ${MINN}); rincian per kode sangat tidak stabil. Pilih lebih banyak bulan.</li>`);
    F.push(`<li><b>Total:</b> ${nf.format(p.n)} klaim, ${fd(p.los)} hari nyata vs ${fd(p.e)} hari diharapkan: selisih bersih <b>${hari(p.net)}</b>. Kode yang melebihi harapan menambah ${hari(gp)} (${pos.length} kode), kode yang di bawah harapan mengurangi ${hari(gn)} (${neg.length} kode). Selisih bersih kecil bisa menyembunyikan penyimpangan besar yang saling meniadakan.</li>`);
    if(topP.length){const t3=topP.slice(0,3),sh=gp>0?sum(t3.map(c=>c.d))/gp:0;
      F.push(`<li><b>Penyumbang kelebihan terbesar:</b> ${t3.map(c=>cd(c)+' ('+hari(c.d)+', '+nf.format(c.n)+' klaim, ALOS '+dec(c.alos,1)+' vs '+dec(c.ealos,1)+')').join('; ')}. Tiga kode ini = ${dec(sh*100,0)}% dari seluruh kelebihan.</li>`)}
    if(topN.length){const t3=topN.slice(0,3);
      F.push(`<li><b>Penyumbang kekurangan terbesar:</b> ${t3.map(c=>cd(c)+' ('+hari(c.d)+', '+nf.format(c.n)+' klaim, ALOS '+dec(c.alos,1)+' vs '+dec(c.ealos,1)+')').join('; ')}.</li>`)}
    F.push(`<li class="${fl.length?'w':''}">Dari ${elig.length} kode dengan ≥ 5 klaim, <b>${fl.length}</b> melewati batas wajar (±2 galat baku). Bila tidak ada perbedaan sama sekali, secara kebetulan diperkirakan sekitar ${dec(elig.length*0.05,1)} kode tetap melewati batas ini. Jadi tandanya petunjuk untuk menelaah berkas, bukan bukti.</li>`);
    const fb=sum(p.cs.filter(c=>c.ref!=='C').map(c=>c.n));
    if(fb>0)F.push(`<li>${dec(fb/p.n*100,0)}% klaim DPJP ini memakai acuan kelompok dasar atau rata-rata jenis (kode jarang, &lt; 10 klaim RS); selisih pada kode tersebut kurang andal.</li>`);
    if(chk>1)F.push(`<li class="w">Peringatan data: jumlah semua kode (${hari(p.net)}) berbeda ${dec(chk,1)} hari dari tabel DPJP di atas. Mohon dilaporkan.</li>`);
    const kp=[kcard('Klaim rawat inap',p.n,nf.format,'Pada bulan terpilih'),
      kcard('ALOS nyata',p.los/p.n,x=>dec(x,2)+' hari','Harapan: '+dec(p.e/p.n,2)+' hari'),
      kcard('Selisih bersih',p.net,x=>sgn(Math.round(x),nf.format)+' hari','Nyata − harapan'),
      kcard('Kelebihan kotor',gp,x=>'+'+nf.format(Math.round(x))+' hari','Jumlah kode di atas harapan'),
      kcard('Kekurangan kotor',-gn,x=>'−'+nf.format(Math.round(x))+' hari','Jumlah kode di bawah harapan')];
    $('dc-body').innerHTML=`<div class="kgrid kkpis" id="dc-k">${kp.join('')}</div>
    <h3 class="ksect">Temuan otomatis</h3><ul class="kfind">${F.join('')}</ul>
    <h3 class="ksect">Kode dengan selisih terbesar</h3><div id="dc-c2"></div>
    <h3 class="ksect">Semua kode DPJP ini</h3><div class="ktoolbar"><div id="dc-combo"></div><span class="kl" id="dc-cnt"></span></div><div class="ktbl" id="dc-tbl"></div>
    <details class="kdet"><summary>Cara membaca dan batasnya</summary><p class="knote" style="margin-top:8px"><b>Selisih hari</b> per kode = hari rawat nyata − (klaim × ALOS harapan). ALOS harapan = rata-rata RS untuk kode yang sama selama 21 bulan, dikalikan faktor usia dan status meninggal (sama dengan O/E di atas). Jumlah selisih semua kode sama dengan selisih bersih DPJP.</p><p class="knote"><b>Batas wajar:</b> galat baku = simpangan baku lama rawat per klaim pada kelompok acuan yang sama × akar jumlah klaim. Selisih lebih dari 2 galat baku ditandai. Ini perkiraan kasar: lama rawat condong ke kanan sehingga pada klaim sedikit galat ditaksir terlalu kecil, dan tidak ada koreksi untuk banyaknya kode yang diperiksa sekaligus. Kode dengan &lt; 5 klaim tidak dinilai.</p><p class="knote"><b>Uji kalibrasi</b> (21 bulan penuh, 542 kombinasi DPJP-kode dengan ≥ 5 klaim): 6,8% melewati batas ±2 galat baku, sedangkan bila murni kebetulan sekitar 4,6%. Pada kombinasi dengan ≥ 30 klaim angkanya 15,4% (hanya 2,7% pada 10–29 klaim). Artinya pada sel besar selisihnya cenderung bukan kebetulan, tetapi data ini tidak bisa membedakan apakah sebabnya keparahan kasus, praktik, atau pengkodean.</p><p class="knote"><b>Yang tidak ditunjukkan:</b> penyebab. Selisih per kode bisa berasal dari tingkat keparahan, komorbid, ICU, rujukan, atau praktik DPJP yang tidak tertangkap data klaim. DPJP yang sering memegang kasus berat dalam satu kode akan tampak di atas harapan. Tingkat keparahan (I/II/III) pada kode INA-CBG ditentukan lewat pengkodean; selisih berlawanan pada kode berdasar sama (mis. -II positif dan -III negatif) mungkin mencerminkan pergeseran pengkodean keparahan, bukan lama rawat. Gunakan sebagai daftar berkas yang layak ditelaah bersama DPJP, bukan penilaian individu. DPJP di sini adalah DPJP yang tercatat pada e-klaim.</p></details>`;
    countUp($('dc-k'));
    const pick=topP.slice(0,8).concat(topN.slice(0,8)).filter((c,i,a)=>a.indexOf(c)===i).sort((a,b)=>b.d-a.d);
    const cw=Math.min(Math.floor(W($('dc-c2'))*.5),260);
    if(pick.length)diverge2($('dc-c2'),pick.map(c=>({label:c.code+(c.desc?' · '+c.desc:'')+' ('+nf.format(c.n)+')',v:c.d,tip:`<b>${esc(c.code)}</b>${c.desc?'<br>'+esc(c.desc):''}<br><span class="m">${nf.format(c.n)} klaim · ALOS ${dec(c.alos,2)} vs harapan ${dec(c.ealos,2)} hari</span><br><span class="m">Selisih ${hari(c.d)} (±2 galat baku = ${dec(2*c.se,0)} hari)</span>`})),{fmt:x=>dec(x,0),goodUp:false,lw:cw,title:'Selisih hari rawat per kode'});
    else $('dc-c2').innerHTML='<p class="knote">Tidak ada selisih per kode.</p>';
    const cols=[
      {k:'code',h:'Kode',cls:'l',v:c=>c.code,f:c=>`<b>${esc(c.code)}</b>`},
      {k:'desc',h:'Deskripsi',cls:'l',v:c=>c.desc,f:c=>c.desc?esc(c.desc):'<span class="ksmall">belum ada deskripsi</span>'},
      {k:'n',h:'Klaim',v:c=>c.n,f:c=>nf.format(c.n)},
      {k:'alos',h:'ALOS',v:c=>c.alos,f:c=>dec(c.alos,2)},
      {k:'ealos',h:'ALOS harapan',v:c=>c.ealos,f:c=>dec(c.ealos,2)},
      {k:'d',h:'Selisih hari',v:c=>c.d,f:c=>`<b>${sgn(c.d,v=>dec(v,1))}</b>`},
      {k:'z',h:'Penilaian',v:c=>c.n>=5?c.z:0,f:fchip},
      {k:'ref',h:'Acuan',cls:'l',v:c=>c.ref,f:c=>REFL[c.ref]||c.ref}];
    const tb=table($('dc-tbl'),cols,p.cs,{sort:'d',asc:false,count:$('dc-cnt')});
    combo($('dc-combo'),{ph:'Cari kode atau diagnosis…',items:p.cs.slice().sort((a,b)=>b.d-a.d).map(c=>({s:c._s,text:c.code+(c.desc?' · '+c.desc:''),sub:nf.format(c.n)+' klaim · '+sgn(c.d,v=>dec(v,1))+' hari',code:c.code})),onPick:it=>tb.only(it?(c=>c.code===it.code):null),onType:v=>tb.search(v)});
  };
  sel.onchange=()=>{dcSel=sel.value;draw()};
  draw();
}

/* ---------- 3. SLA finalisasi ---------- */
const BIN=['≤ 3 hari','4–7 hari','8–14 hari','> 14 hari'];
const pullOf=k=>{const p=((KAm[k].checks||{}).pull||[])[0];return p?new Date(+p.slice(0,4),+p.slice(4,6)-1,+p.slice(6,8)):null};
const dmy=d=>d?String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear():'–';
LJ.sla=()=>{
  const el=$('lj-sla'),ks=selK();
  if(!ks.length){el.innerHTML=noKlaim();return}
  const cum=(b,days)=>{const N=sum(b);if(!N)return NaN;const c=days===3?b[0]:days===7?b[0]+b[1]:b[0]+b[1]+b[2];return c/N};
  const rows=[];
  ks.forEach(k=>['RI','RJ'].forEach(j=>{const b=KAm[k].lag[j],N=sum(b),pl=pullOf(k),y=+k.slice(0,4),m=+k.slice(5),end=new Date(y,m,0);
    rows.push({k,j,N,n:KAm[k].kpi[j].n,mean:KAm[k].lag_mean[j],med:KAm[k].lag_med[j],b,p3:cum(b,3),p7:cum(b,7),p14:cum(b,14),o14:N?b[3]/N:NaN,pull:pl,gap:pl?Math.round((pl-end)/864e5):null,_s:(k+' '+j).toLowerCase()});}));
  const pT=r=>slaD===3?r.p3:slaD===7?r.p7:r.p14;
  const agg=j=>{const rs=rows.filter(r=>r.j===j&&r.N);const N=sum(rs.map(r=>r.N)),b=[0,1,2,3].map(i=>sum(rs.map(r=>r.b[i])));return {N,p:N?cum(b,slaD):NaN,mean:N?sum(rs.map(r=>r.mean*r.N))/N:NaN,ok:rs.filter(r=>pT(r)>=slaP/100).length,m:rs.length}};
  const aRI=agg('RI'),aRJ=agg('RJ');
  el.innerHTML=`<div class="card"><h2>Kecepatan finalisasi klaim (tanggal pulang → finalisasi)</h2><p class="knote">Jarak hari antara <b>tanggal pulang</b> pasien dan <b>waktu finalisasi klaim</b> di e-klaim. Semakin cepat klaim difinalisasi, semakin cepat bisa diajukan dan semakin cepat kas masuk. <b>Target di bawah adalah contoh simulasi</b>; tetapkan sesuai kebijakan manajemen. Pilihan batas hari mengikuti kelompok hari yang tersimpan di data (3, 7, 14 hari).</p>
  <div class="ktoolbar"><span class="kl">Target selesai dalam</span><div class="kseg" id="k-slaD"></div><span class="kl">Target kepatuhan</span><div class="kseg" id="k-slaP"></div></div><div id="ljs-k"></div></div>
  <div class="kgrid kg2"><div class="card"><h2>% klaim selesai dalam ≤ ${slaD} hari</h2><p class="knote">Batang per bulan terpilih; target kepatuhan contoh ${slaP}% (lihat kartu di atas).</p><div id="ljs-c1"></div></div>
  <div class="card"><h2>Sebaran hari finalisasi</h2><p class="knote">Jumlah klaim per kelompok hari, seluruh bulan terpilih.</p><div id="ljs-c2"></div></div></div>
  <div class="card"><h3 class="ksect" style="margin-top:0">Temuan otomatis</h3><ul class="kfind" id="ljs-find"></ul></div>
  <h3 class="ksect">Rincian per bulan dan jenis pelayanan</h3><div class="card"><div class="ktbl" id="ljs-tbl"></div>
  ${caveat('<b>Batas data SLA.</b> Hanya klaim yang <b>sudah difinalisasi saat berkas ditarik</b> yang tercatat, dan berkas ditarik beberapa hari setelah akhir bulan. Klaim yang difinalisasi lebih lambat dari tanggal tarik tidak ikut terhitung, sehingga kelompok "&gt; 14 hari" dan rata-rata hari <b>cenderung terlihat lebih pendek dari yang sebenarnya</b>, terutama untuk pasien yang pulang di akhir bulan. Bandingkan bulan dengan selisih tanggal tarik yang mirip (kolom "Tarik berkas"). Waktu finalisasi diambil dari cap waktu pada berkas e-klaim; ini bukan waktu pembayaran BPJS.')}</div>`;
  seg('slaD',[['3','≤ 3 hari'],['7','≤ 7 hari'],['14','≤ 14 hari']],String(slaD),v=>{slaD=+v;store.set('pk_sla_d',v);ljR.sla=0;KC.length=0;LJ.sla();ljR.sla=1});
  seg('slaP',[['70','70%'],['80','80%'],['90','90%']],String(slaP),v=>{slaP=+v;store.set('pk_sla_p',v);ljR.sla=0;KC.length=0;LJ.sla();ljR.sla=1});
  const okc=a=>a.m?`${a.ok} dari ${a.m} bulan memenuhi`:'';
  $('ljs-k').innerHTML='<div class="kgrid kkpis">'+
    kcard('Rawat inap ≤ '+slaD+' hari',aRI.p*100,x=>dec(x,1)+'%',okc(aRI)+' (target '+slaP+'%)')+
    kcard('Rawat jalan ≤ '+slaD+' hari',aRJ.p*100,x=>dec(x,1)+'%',okc(aRJ)+' (target '+slaP+'%)')+
    kcard('Rata-rata hari RI',aRI.mean,x=>dec(x,1)+' hari','Tertimbang jumlah klaim')+
    kcard('Rata-rata hari RJ',aRJ.mean,x=>dec(x,1)+' hari','Tertimbang jumlah klaim')+'</div>';
  countUp($('ljs-k'));
  const lab=ks.map(mlab);
  vbarsN($('ljs-c1'),lab,[{name:'Rawat inap',color:COL[0],vals:ks.map(k=>{const r=rows.find(x=>x.k===k&&x.j==='RI');return isFinite(pT(r))?pT(r)*100:null})},{name:'Rawat jalan',color:COL[1],vals:ks.map(k=>{const r=rows.find(x=>x.k===k&&x.j==='RJ');return isFinite(pT(r))?pT(r)*100:null})}],{fmt:x=>dec(x,1)+'%',ax:x=>dec(x,0)+'%',title:'Persen klaim selesai dalam target'});
  const sb=j=>[0,1,2,3].map(i=>sum(rows.filter(r=>r.j===j).map(r=>r.b[i])));
  vbarsN($('ljs-c2'),BIN,[{name:'Rawat inap',color:COL[0],vals:sb('RI')},{name:'Rawat jalan',color:COL[1],vals:sb('RJ')}],{title:'Sebaran hari finalisasi'});
  const F=[],worst=rows.filter(r=>r.N&&isFinite(pT(r))).sort((a,b)=>pT(a)-pT(b))[0],best=rows.filter(r=>r.N&&isFinite(pT(r))).sort((a,b)=>pT(b)-pT(a))[0];
  if(worst)F.push(`<li><b>Terlambat:</b> ${worst.j==='RI'?'rawat inap':'rawat jalan'} ${mfull(worst.k)} hanya ${pct(pT(worst))} selesai ≤ ${slaD} hari (rata-rata ${dec(worst.mean,1)} hari, median ${dec(worst.med,0)}). <b>Tercepat:</b> ${best.j==='RI'?'rawat inap':'rawat jalan'} ${mfull(best.k)} ${pct(pT(best))}.</li>`);
  F.push(`<li class="${aRI.p<slaP/100?'w':''}">Rawat inap: ${pct(aRI.p)} klaim selesai ≤ ${slaD} hari (${okc(aRI)}). Rawat jalan: ${pct(aRJ.p)} (${okc(aRJ)}). Target ${slaP}% adalah contoh simulasi.</li>`);
  const ri14=aRI.N?sum(rows.filter(r=>r.j==='RI').map(r=>r.b[3]))/aRI.N:NaN,rj14=aRJ.N?sum(rows.filter(r=>r.j==='RJ').map(r=>r.b[3]))/aRJ.N:NaN;
  F.push(`<li>Klaim yang butuh &gt; 14 hari: ${pct(ri14)} untuk rawat inap, ${pct(rj14)} untuk rawat jalan (batas bawah, lihat catatan batas data).</li>`);
  $('ljs-find').innerHTML=F.join('');
  const cols=[
    {k:'k',h:'Bulan',cls:'l',v:r=>r.k,f:r=>`<b>${mfull(r.k)}</b>`},
    {k:'j',h:'Jenis',cls:'l',v:r=>r.j,f:r=>r.j==='RI'?'Rawat inap':'Rawat jalan'},
    {k:'N',h:'Klaim dengan waktu finalisasi',v:r=>r.N,f:r=>nf.format(r.N)+(r.N<r.n?` <span class="ksmall">dari ${nf.format(r.n)}</span>`:'')},
    {k:'mean',h:'Rata-rata (hari)',v:r=>r.mean||0,f:r=>r.mean==null?'–':dec(r.mean,1)},
    {k:'med',h:'Median (hari)',v:r=>r.med||0,f:r=>r.med==null?'–':dec(r.med,0)},
    {k:'p3',h:'≤ 3 hari',v:r=>r.p3,f:r=>pct(r.p3)},{k:'p7',h:'≤ 7 hari',v:r=>r.p7,f:r=>pct(r.p7)},{k:'p14',h:'≤ 14 hari',v:r=>r.p14,f:r=>pct(r.p14)},{k:'o14',h:'> 14 hari',v:r=>r.o14,f:r=>pct(r.o14)},
    {k:'st',h:'Target ≤ '+slaD+' hari / '+slaP+'%',v:r=>pT(r),f:r=>isFinite(pT(r))?`<span class="kchip ${pT(r)>=slaP/100?'good':'bad'}">${pT(r)>=slaP/100?'memenuhi':'belum'} · ${pct(pT(r))}</span>`:'–'},
    {k:'pull',h:'Tarik berkas',v:r=>r.pull?+r.pull:0,f:r=>dmy(r.pull)+(r.gap!=null?` <span class="ksmall">(+${r.gap} hari)</span>`:'')}];
  table($('ljs-tbl'),cols,rows,{sort:'k',asc:true});
};

/* ---------- 4. Pending vs klaim per kode ---------- */
LJ.pvk=()=>{
  const el=$('lj-pvk'),both=SEL.filter(k=>hasP(k)&&hasK(k)),skip=SEL.filter(k=>!(hasP(k)&&hasK(k)));
  if(!both.length){el.innerHTML=empty(`Perbandingan ini butuh bulan yang punya <b>data pending dan data klaim sekaligus</b>. Bulan terpilih belum memenuhi${skip.length?' (' +skip.map(mlab).join(', ')+')':''}. Bulan dengan keduanya: ${TL.filter(k=>hasP(k)&&hasK(k)).map(mlab).join(', ')}.`);return}
  const ag={};let over=0;
  both.forEach(k=>{
    const kc={};Object.entries(D.klaim[k].inacbg).forEach(([c,v])=>{kc[c]={n:(v.ri?v.ri.n:0)+(v.rj?v.rj.n:0),tot:(v.ri?v.ri.tot:0)+(v.rj?v.rj.tot:0)}});
    Object.entries(kc).forEach(([c,v])=>{const o=ag[c]=ag[c]||{code:c,kn:0,kt:0,pn:0,pa:0,pm:0,pri:0};o.kn+=v.n;o.kt+=v.tot});
    Object.entries(PM(k).inacbg).forEach(([c,v])=>{const o=ag[c]=ag[c]||{code:c,kn:0,kt:0,pn:0,pa:0,pm:0,pri:0};o.pn+=v.n;o.pa+=v.amt;o.pm++;o.pri+=v.ri;if(v.n>((kc[c]||{n:0}).n))over+=v.n-((kc[c]||{n:0}).n)});
  });
  const all=Object.values(ag),rows=all.filter(r=>r.pn>0).map(r=>({...r,desc:D.desc[r.code]||'',rate:r.kn?r.pn/r.kn:NaN,vrate:r.kt?r.pa/r.kt:NaN,avg:r.pa/r.pn,_s:(r.code+' '+(D.desc[r.code]||'')).toLowerCase()}));
  const PN=sum(all.map(r=>r.pn)),PA=sum(all.map(r=>r.pa)),KN=sum(all.map(r=>r.kn)),KT=sum(all.map(r=>r.kt));
  const byAmt=rows.slice().sort((a,b)=>b.pa-a.pa),top10=sum(byAmt.slice(0,10).map(r=>r.pa));
  const rate0=PN/KN;
  const flagged=rows.filter(r=>r.kn>=30&&r.pn>=3&&r.rate>=Math.max(2*rate0,0.05));
  el.innerHTML=`<div class="card"><h2>Pending dibanding klaim per kode INA-CBG</h2><p class="knote">Menggabungkan jumlah dan nilai <b>SEP pending</b> dengan <b>klaim yang diajukan</b> pada kode yang sama, untuk bulan yang punya kedua data (${both.map(mlab).join(', ')}).${skip.length?` Bulan terpilih tanpa pasangan data tidak ikut: ${skip.map(mlab).join(', ')}.`:''} Rasio = pending ÷ klaim kode tersebut. Kode dengan rasio tinggi adalah kode yang paling sering tersangkut di verifikasi: sasaran utama perbaikan kelengkapan berkas dan kodefikasi.</p><div id="ljp-k"></div></div>
  <div class="kgrid kg2"><div class="card"><h2>Kode dengan rasio pending tertinggi</h2><p class="knote">Hanya kode dengan klaim ≥ 30 dan pending ≥ 3 SEP (agar tidak menyesatkan karena angka kecil). Rata-rata RS: ${pct(rate0)}.</p><div id="ljp-c1"></div></div>
  <div class="card"><h2>Kode dengan nilai pending terbesar</h2><p class="knote">Nilai ajuan SEP pending per kode; sumber risiko arus kas terbesar.</p><div id="ljp-c2"></div></div></div>
  <div class="card"><h3 class="ksect" style="margin-top:0">Temuan otomatis</h3><ul class="kfind" id="ljp-find"></ul></div>
  <h3 class="ksect">Semua kode yang punya pending</h3><div class="card"><div class="ktoolbar"><div id="ljp-combo"></div><span class="kl" id="ljp-cnt"></span></div><div class="ktbl" id="ljp-tbl"></div>
  ${caveat('<b>Cara membaca.</b> Pending bukan klaim ditolak: SEP menunggu konfirmasi atau perbaikan dari verifikator. Jumlah SEP pending per kode ' + (over?`hampir selalu tidak melebihi klaim kode yang sama pada bulan yang sama (kecuali ${over} SEP)`:'tidak pernah melebihi klaim kode yang sama pada bulan yang sama')+', konsisten dengan pending sebagai bagian dari klaim yang diajukan, tetapi hal ini tidak dapat dipastikan dari data. Rasio kode berklaim sedikit mudah berayun; perhatikan kolom Klaim.')}</div>`;
  $('ljp-k').innerHTML='<div class="kgrid kkpis">'+
    kcard('SEP pending / klaim',PN/KN*100,x=>dec(x,2)+'%',nf.format(PN)+' SEP pending dari '+nf.format(KN)+' klaim')+
    kcard('Nilai pending / pendapatan klaim',PA/KT*100,x=>dec(x,2)+'%',rp(PA)+' dari '+rp(KT))+
    kcard('Kode yang punya pending',rows.length,nf.format,'Dari '+nf.format(all.filter(r=>r.kn>0).length)+' kode berklaim')+
    kcard('10 kode terbesar',PA?top10/PA*100:0,x=>dec(x,1)+'%','Porsi nilai pending (konsentrasi risiko)')+'</div>';
  countUp($('ljp-k'));
  const rr=rows.filter(r=>r.kn>=30&&r.pn>=3).sort((a,b)=>b.rate-a.rate).slice(0,10);
  const lw=Math.min(Math.floor(W($('ljp-c1'))*.5),260);
  if(rr.length)hbarsN($('ljp-c1'),rr.map(r=>({label:r.code+(r.desc?' · '+r.desc:''),vals:[r.rate*100]})),[{name:'% SEP pending',color:COL[3],vals:null}],{fmt:x=>dec(x,1)+'%',lw,title:'Rasio pending tertinggi'});
  else $('ljp-c1').innerHTML='<p class="knote">Tidak ada kode yang memenuhi syarat angka minimum pada bulan terpilih.</p>';
  hbarsN($('ljp-c2'),byAmt.slice(0,10).map(r=>({label:r.code+(r.desc?' · '+r.desc:''),vals:[r.pa]})),[{name:'Nilai pending',color:COL[1],vals:null}],{fmt:rp,lw,title:'Nilai pending terbesar'});
  const F=[];
  F.push(`<li><b>Konsentrasi:</b> 10 kode menyumbang ${pct(PA?top10/PA:0)} nilai pending dari ${rows.length} kode; yang terbesar <b>${esc(byAmt[0].code)}</b>${byAmt[0].desc?' ('+esc(byAmt[0].desc)+')':''} dengan ${rp(byAmt[0].pa)} (${nf.format(byAmt[0].pn)} SEP).</li>`);
  if(flagged.length){const t=flagged.sort((a,b)=>b.rate-a.rate)[0];F.push(`<li class="w"><b>${flagged.length} kode</b> punya rasio pending ≥ 2× rata-rata RS (${pct(rate0)}) atau ≥ 5%; tertinggi <b>${esc(t.code)}</b> ${pct(t.rate)} (${nf.format(t.pn)} dari ${nf.format(t.kn)} klaim). Telaah kelengkapan resume medis dan koding untuk kode ini lebih dulu.</li>`)}
  else F.push('<li>Tidak ada kode berklaim ≥ 30 yang rasio pending-nya ≥ 2× rata-rata RS (atau ≥ 5%) pada bulan terpilih.</li>');
  const noK=rows.filter(r=>!r.kn);if(noK.length)F.push(`<li class="w">${noK.length} kode muncul di pending tetapi tidak ada di klaim bulan itu (${nf.format(sum(noK.map(r=>r.pn)))} SEP): perlu dicek apakah kode berubah setelah perbaikan koding.</li>`);
  $('ljp-find').innerHTML=F.join('');
  const cols=[
    {k:'code',h:'Kode',cls:'l',v:r=>r.code,f:r=>`<b>${esc(r.code)}</b>`},
    {k:'desc',h:'Deskripsi',cls:'l',v:r=>r.desc,f:r=>r.desc?esc(r.desc):'<span class="ksmall">belum ada deskripsi</span>'},
    {k:'kn',h:'Klaim',v:r=>r.kn,f:r=>nf.format(r.kn)},
    {k:'pn',h:'SEP pending',v:r=>r.pn,f:r=>nf.format(r.pn)},
    {k:'rate',h:'% SEP pending',v:r=>isFinite(r.rate)?r.rate:-1,f:r=>isFinite(r.rate)?`<b>${pct(r.rate)}</b>`:'–'},
    {k:'kt',h:'Pendapatan klaim',v:r=>r.kt,f:r=>rp(r.kt)},
    {k:'pa',h:'Nilai pending',v:r=>r.pa,f:r=>rp(r.pa)},
    {k:'vrate',h:'% nilai pending',v:r=>isFinite(r.vrate)?r.vrate:-1,f:r=>isFinite(r.vrate)?pct(r.vrate):'–'},
    {k:'avg',h:'Nilai / SEP pending',v:r=>r.avg,f:r=>rp(r.avg)},
    {k:'pm',h:'Bulan ada pending',v:r=>r.pm,f:r=>r.pm+' dari '+both.length}];
  const tb=table($('ljp-tbl'),cols,rows,{sort:'pa',asc:false,count:$('ljp-cnt')});
  combo($('ljp-combo'),{ph:'Cari kode atau nama diagnosis…',items:byAmt.map(r=>({s:r._s,text:r.code+(r.desc?' · '+r.desc:''),sub:nf.format(r.pn)+' SEP pending · '+nf.format(r.kn)+' klaim',code:r.code})),onPick:it=>tb.only(it?(r=>r.code===it.code):null),onType:v=>tb.search(v)});
};

/* ================= Uraian kategori “Lainnya” menurut keputusan pengelola RS =================
   Data: D.meta.lain (217 teks alasan beserta kelompok keputusan) dan D.months[k].lain (agregat per bulan x kelompok).
   Tanpa nomor SEP atau data pasien. Kelompok = keputusan analis RS, bukan klasifikasi BPJS. */
const LNC=['#84AAF3','#F4BA84','#6FC28F','#B79BE8','#9AA3B8'];
const LNS=['Klinis DPJP','Dokumen medis (dokter & koder)','Koding (koder)','Administrasi / kepesertaan','Kebijakan BPJS'];
const lainSection=pfx=>(catMode==='kw'&&D.meta&&D.meta.lain)?`<h3 class="ksect">Uraian SEP yang pada aturan tahap 1 berkategori “Lainnya”, menurut keputusan pengelola RS</h3><div id="${pfx}-box"></div>`:'';
/* Peringatan format berkas: bulan yang kategorinya banyak ditentukan aturan tahap 2 (teks bebas) tidak setara dengan bulan berlabel baku BPJS */
function kelasWarnKw(ps){
  const L=ps.filter(k=>PM(k)&&PM(k).fk).map(k=>({k,p:PM(k)}));
  if(!L.length) return '';
  const sh=L.map(x=>(x.p.via2||0)/Math.max(x.p.n,1)),dif=Math.max(...sh)-Math.min(...sh),kinds=new Set(L.map(x=>x.p.fk));
  const bad=L.length>1&&(dif>=0.15||(kinds.size>1&&dif>=0.05));
  const li=L.map(x=>`${esc(mlab(x.k))}: <b>${pct((x.p.via2||0)/Math.max(x.p.n,1),0)}</b> (${nf.format(x.p.via2||0)} dari ${nf.format(x.p.n)} SEP)`).join('; ');
  const st=bad?' style="border-left-color:#E5636B"':'';
  return `<div class="kcaveat"${st}><b>${bad?'Perbandingan kategori antarbulan ini belum setara.':'Catatan cara pengkategorian.'}</b> Format berkas pending berbeda antarbulan. Berkas Januari–Mei 2026 memuat jenis pending baku BPJS, sehingga kategorinya hampir pasti. Bulan lain hanya memuat tulisan bebas verifikator, jadi sebagian SEP dikategorikan lewat <b>aturan kata kunci tahap 2</b> (perkiraan, belum diperiksa satu per satu). Porsi SEP yang kategorinya ditentukan tahap 2: ${li}. ${bad?'Selisih pada kategori tertentu bisa berasal dari perbedaan cara baca ini, bukan perubahan nyata di lapangan. Yang dapat dibandingkan dengan aman hanya <b>total SEP dan nilai</b> per bulan.':'Selisih kecil antarbulan sebaiknya tidak ditafsirkan terlalu jauh.'}</div>`;
}
function lainDraw(ps,met,pfx){
  const box=$(pfx+'-box'),LN=D.meta&&D.meta.lain;if(!box||!LN)return;
  const mf=met==='n'?nf.format:rp;
  const noL=ps.filter(k=>PM(k).lain_nodec);const withL=ps.filter(k=>PM(k).lain&&!PM(k).lain_nodec);
  if(!withL.length){box.innerHTML=empty(noL.length&&noL.length===ps.length?'Bulan terpilih ('+noL.map(mlab).join(', ')+') belum memiliki keputusan pengelola RS atas alasan “Lainnya”, sehingga bagian ini belum dapat ditampilkan.':'Bulan terpilih tidak memiliki SEP yang pada aturan tahap 1 berkategori “Lainnya”, sehingga tidak ada yang perlu diuraikan.');return}
  const G=LN.groups,tot=G.map((g,i)=>({n:sum(ps.map(k=>(((PM(k).lain||{})[i])||{n:0}).n)),amt:sum(ps.map(k=>(((PM(k).lain||{})[i])||{amt:0}).amt)),ri:sum(ps.map(k=>(((PM(k).lain||{})[i])||{ri:0}).ri)),rj:sum(ps.map(k=>(((PM(k).lain||{})[i])||{rj:0}).rj))}));
  const psL=ps.filter(k=>!PM(k).lain_nodec),noteL=noL.length?` Bulan ${noL.map(mlab).join(', ')} belum memiliki keputusan pengelola RS, sehingga tidak dihitung di bagian ini.`:'';const lainN=sum(psL.map(k=>PM(k).lain_uniq||0)),allN=sum(psL.map(k=>PM(k).n)),lainA=sum(psL.map(k=>((PM(k).lain_v1||{}).amt)||0)),allA=sum(psL.map(k=>PM(k).amt));
  const gsum=sum(tot.map(t=>t[met]))||1;
  box.innerHTML=`${caveat(`<b>Cara membaca.</b> Kelompok di bawah adalah <b>keputusan pengelola RS</b> atas teks alasan verifikator pada SEP yang <b>pada aturan tahap 1 masuk “Lainnya”</b> (bukan klasifikasi resmi BPJS). Sebagian besar SEP ini kini sudah punya kategori penyebab bernama pada grafik di atas lewat aturan tahap 2; kelompok keputusan di sini tidak berubah. Artinya “siapa yang paling mungkin memegang perbaikan”, bukan penilaian kinerja dokter atau petugas. ${noteL} Cakupannya hanya SEP tersebut: <b>${nf.format(lainN)} dari ${nf.format(allN)} SEP pending</b> (${pct(lainN/allN)}) senilai <b>${rp(lainA)}</b> (${pct(lainA/allA)} dari nilai) pada bulan terpilih. SEP di kategori lain (kodefikasi, fisioterapi, dan seterusnya) belum dikelompokkan dengan cara ini. Satu SEP yang punya dua alasan berbeda dapat terhitung di dua kelompok (selisih paling banyak 1 SEP per bulan).`)}
  <div class="kgrid kg2"><div class="card"><h2>Kelompok penanggung jawab: antarbulan</h2><p class="knote">${met==='n'?'Jumlah SEP':'Nilai ajuan'} per kelompok keputusan, bulan-bulan terpilih berdampingan.</p><div id="${pfx}-c1"></div></div>
  <div class="card"><h2>Komposisi kelompok per bulan (100%)</h2><p class="knote">Porsi tiap kelompok terhadap SEP bulan itu yang pada aturan tahap 1 berkategori “Lainnya”.</p><div id="${pfx}-c2"></div></div></div>
  <div class="card"><h3 class="ksect" style="margin-top:0">Temuan otomatis</h3><ul class="kfind" id="${pfx}-find"></ul></div>
  <h3 class="ksect">Daftar alasan dan keputusan</h3><div class="card"><div class="ktoolbar"><span class="kl">Kelompok</span><div class="kseg ksegw" id="k-${pfx}g"></div><input type="search" id="${pfx}-q" placeholder="Cari kata dalam alasan atau catatan…" aria-label="Cari alasan"><span class="kl" id="${pfx}-cnt"></span></div><div class="ktbl" id="${pfx}-tbl"></div><p class="knote" style="margin:10px 0 0">Satu baris satu teks alasan (nomor SEP dan tanggal di dalam teks sudah disamarkan). Angka mengikuti bulan terpilih. Kolom Catatan berisi catatan yang tertulis di berkas keputusan; isinya belum diverifikasi ulang oleh analisis ini.</p></div>`;
  hbarsN($(pfx+'-c1'),G.map((g,i)=>({label:LNS[i],vals:ps.map(k=>((((PM(k).lain||{})[i])||{})[met])||0)})),serOf(ps,k=>null),{fmt:mf,lw:170,title:'Kelompok penanggung jawab antarbulan'});
  stack100($(pfx+'-c2'),withL.map(k=>({label:mlab(k),vals:G.map((g,i)=>((((PM(k).lain||{})[i])||{})[met])||0)})),LNS.map((s,i)=>({name:s,color:LNC[i]})),{title:'Komposisi kelompok'});
  /* temuan */
  const F=[],ord=tot.map((t,i)=>({i,...t})).sort((a,b)=>b[met]-a[met]),top=ord[0];
  F.push(`<li><b>Terbesar menurut ${met==='n'?'jumlah SEP':'nilai'}:</b> ${esc(G[top.i])} (${nf.format(top.n)} SEP, ${rp(top.amt)}; ${pct(top[met]/gsum)} dari SEP yang semula “Lainnya”).</li>`);
  const byA=tot.map((t,i)=>({i,...t})).sort((a,b)=>b.amt-a.amt)[0],byN=tot.map((t,i)=>({i,...t})).sort((a,b)=>b.n-a.n)[0];
  if(byA.i!==byN.i) F.push(`<li class="w"><b>Jumlah dan nilai tidak sejalan:</b> paling banyak SEP ada di <b>${esc(G[byN.i])}</b> (${nf.format(byN.n)} SEP, rata-rata ${rp(byN.amt/(byN.n||1))} per SEP), tetapi paling besar nilainya di <b>${esc(G[byA.i])}</b> (${rp(byA.amt)}, rata-rata ${rp(byA.amt/(byA.n||1))} per SEP). Prioritas perbaikan sebaiknya mempertimbangkan keduanya.</li>`);
  const own=tot[1].amt+tot[2].amt+tot[0].amt,out=tot[4].amt,adm=tot[3].amt;
  F.push(`<li class="${tot[4].n/(lainN||1)>0.15?'w':''}"><b>Di luar kendali RS:</b> kelompok “Kebijakan BPJS” hanya ${nf.format(tot[4].n)} SEP (${rp(out)}). Sisanya ${rp(own+adm)} berada pada kelompok yang berpeluang diperbaiki lewat proses internal (dokumen, koding, keputusan klinis, administrasi).</li>`);
  const ri=sum(tot.map(t=>t.ri)),rj=sum(tot.map(t=>t.rj));
  if(ri&&rj) F.push(`<li><b>Jenis pelayanan:</b> ${nf.format(ri)} SEP rawat inap dan ${nf.format(rj)} SEP rawat jalan pada kelompok-kelompok ini. Porsi rawat inap per kelompok (menurut jumlah SEP): ${tot.map((t,i)=>t.n?esc(LNS[i])+' '+pct(t.ri/t.n,0):'').filter(Boolean).join('; ')}.</li>`);
  const rs=(LN.reasons||[]).map(r=>({r,n:sum(ps.map(k=>(r.pm[k]||[0,0])[0])),a:sum(ps.map(k=>(r.pm[k]||[0,0])[1]))})).filter(x=>x.n>0).sort((x,y)=>y.n-x.n);
  if(rs.length){const t=rs[0];F.push(`<li><b>Alasan tunggal terbanyak:</b> “${esc(trunc(t.r.t,90))}” (${nf.format(t.n)} SEP, ${rp(t.a)}), keputusan: ${esc(G[t.r.g])}. ${rs.length} alasan berbeda terdapat pada bulan terpilih; ${rs.filter(x=>x.n===1).length} di antaranya hanya muncul pada satu SEP.</li>`)}
  $(pfx+'-find').innerHTML=F.join('');
  /* tabel */
  const rows=rs.map(x=>({g:x.r.g,t:x.r.t,n:x.n,a:x.a,m:ps.filter(k=>x.r.pm[k]).length,nt:x.r.nt,_s:(x.r.t+' '+LNS[x.r.g]+' '+x.r.nt).toLowerCase()}));
  const cols=[{k:'g',h:'Kelompok',cls:'l',v:r=>r.g,f:r=>`<span class="kchip" style="background:${LNC[r.g]};color:#1b1f3b">${esc(LNS[r.g])}</span>`},
    {k:'t',h:'Alasan',cls:'l',v:r=>r.t,f:r=>esc(r.t)},
    {k:'n',h:'SEP',v:r=>r.n,f:r=>nf.format(r.n)},{k:'a',h:'Nilai ajuan',v:r=>r.a,f:r=>rp(r.a)},
    {k:'m',h:'Bulan',v:r=>r.m,f:r=>r.m+' dari '+ps.length},
    {k:'nt',h:'Catatan',cls:'l',v:r=>r.nt,f:r=>r.nt?`<details class="kdet" style="margin:0;padding:4px 8px"><summary>Lihat</summary><div class="knote" style="margin:6px 0 0;white-space:normal;min-width:220px">${esc(r.nt)}</div></details>`:'<span class="ksmall">–</span>'}];
  const tb=table($(pfx+'-tbl'),cols,rows,{sort:'n',asc:false,count:$(pfx+'-cnt')});
  $(pfx+'-q').oninput=e=>tb.search(e.target.value);
  seg(pfx+'g',[['all','Semua']].concat(LNS.map((s,i)=>[String(i),s])),'all',v=>tb.only(v==='all'?null:(r=>String(r.g)===v)));
}

/* Peringatan asal jenis pending per bulan (tampilan jenis pending) */
const provSum=ks=>{const o={};ks.forEach(k=>Object.entries(PM(k).prov||{}).forEach(([x,v])=>{o[x]=(o[x]||0)+v.n}));return o};
function provShare(m){const p=m.prov||{},T=Math.max(m.n,1),g=x=>(p[x]||{n:0}).n;return {b:(g('asli')+g('teks'))/T,e:(g('isian_tinggi')+g('isian_sedang')+g('isian_rendah'))/T,r:g('isian_rendah')/T,x:(g('turunan')+g('kw')+g('tbd'))/T,eN:g('isian_tinggi')+g('isian_sedang')+g('isian_rendah')}}
function kelasWarn(ps){
  if(catMode==='kw') return kelasWarnKw(ps);
  const L=ps.filter(k=>PM(k)&&PM(k).prov).map(k=>({k,s:provShare(PM(k))}));
  if(!L.length) return '';
  const es=L.map(x=>x.s.e),dif=Math.max(...es)-Math.min(...es),anyE=Math.max(...es)>=0.2;
  const bad=L.length>1&&dif>=0.4;
  const li=L.map(x=>`${esc(mlab(x.k))}: <b>${pct(x.s.b,0)}</b> baku BPJS, <b>${pct(x.s.e,0)}</b> isian perkiraan${x.s.e>0?' (keyakinan rendah '+pct(x.s.r,0)+')':''}${x.s.x>=0.02?', '+pct(x.s.x,0)+' turunan/cadangan':''}`).join('; ');
  const st=bad?' style="border-left-color:#E5636B"':'';
  return `<div class="kcaveat"${st}><b>${bad?'Bulan-bulan ini berasal dari sumber jenis pending yang berbeda.':'Catatan asal jenis pending.'}</b> Berkas pending Januari–Juni 2026 memuat kolom JNSPENDING dari BPJS (sebagian barisnya kosong; untuk baris itu dipakai kalimat baku di awal teks alasan, atau teks yang sama di bulan lain). Berkas 2025, Juli, dan Agustus 2026 tidak memuat kolom itu. Untuk bulan tersebut jenis pending ditetapkan per teks alasan: dipakai langsung bila teks diawali kalimat baku BPJS; selebihnya <b>isian perkiraan Claude</b> (bukan keputusan BPJS dan <b>belum diverifikasi tim casemix</b>). Rincian: ${li}. ${anyE?(bad?'Selisih antarkategori antara bulan berisi isian dan bulan berkolom asli perlu dibaca sebagai perkiraan; ':'')+'Isian berkeyakinan rendah paling mungkin berubah bila tim casemix memeriksanya.':''}</div>`;
}

/* ================= Hasil verifikasi BPJS (BAVK) =================
   Data: window.BAVK_DATA (agregat dari Berita Acara Hasil Verifikasi Klaim, Bukti Penerimaan Klaim, BAKB, rincian per SEP, dicocokkan dengan TXT e-klaim dan berkas pending).
   Tanpa nomor SEP / data pasien. Bulan tersedia: Feb-Agu 2026 (Mar tanpa BAHV: status diturunkan; Mei tanpa BPK/BAKB; rincian induk Mei 20 Jun 2026 ada, susulan 6 Agu 2026 dipisah). */
const BV=(window.BAVK_DATA||{}).months||{}, BVX=window.BAVK_DATA||{};
const BVC={layak:'#6FC28F',pending:'#F4BA84',tl:'#DC8077',dispute:'#84AAF3'};
const fd=s=>s?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'–';
const dd=(a,b)=>(a&&b)?Math.round((Date.parse(b)-Date.parse(a))/864e5):null;
const bsum=(m,s,f,j)=>(j?[j]:['RI','RJ']).reduce((t,x)=>t+(f==='n'?m.st[s][x].n:m.st[s][x].amt),0);
const bsub=(m,f,j)=>(j?[j]:['RI','RJ']).reduce((t,x)=>t+m.sub[x][f],0);
const bavkKeys=()=>Object.keys(BV).sort();
LJ.bavk=()=>{
  const el=$('lj-bavk'),all=bavkKeys(),ks=SEL.filter(k=>BV[k]);
  if(!all.length){el.innerHTML=empty('Data BAVK belum tersedia pada modul ini.');return}
  if(!ks.length){el.innerHTML=empty(`Tidak ada data BAVK pada bulan terpilih. Data hasil verifikasi tersedia untuk <b>${all.length} bulan</b> (${mfull(all[0])} sampai ${mfull(all[all.length-1])}). Januari 2026 belum memiliki berkas BAVK, dan September 2026 belum terbit.`);return}
  const M=ks.map(k=>({k,m:BV[k]}));
  const T=(s,f,j)=>sum(M.map(x=>bsum(x.m,s,f,j))),S=(f,j)=>sum(M.map(x=>bsub(x.m,f,j)));
  const nS=S('n'),aS=S('amt'),nL=T('layak','n'),aL=T('layak','amt'),nP=T('pending','n'),aP=T('pending','amt'),nT=T('tl','n'),aT=T('tl','amt'),nD=T('dispute','n'),aD=T('dispute','amt');
  const turun=ks.filter(k=>BV[k].st_src==='turunan'),hitung=ks.filter(k=>BV[k].sub_src==='hitung');
  const lagK=M.filter(x=>x.m.lag);
  const wl=(i,j)=>{const n=sum(lagK.map(x=>x.m.st.layak[j].n));return n?sum(lagK.map(x=>x.m.lag[j][i]*x.m.st.layak[j].n))/n:NaN};
  const gap=M.map(x=>({k:x.k,bpk:dd(x.m.d.bpk||x.m.d.surat,x.m.d.bahv)})).filter(x=>x.bpk!=null);
  const gapAvg=gap.length?sum(gap.map(x=>x.bpk))/gap.length:NaN;
  const tak=M.filter(x=>x.m.tak),takN=sum(tak.map(x=>x.m.tak.RI.n+x.m.tak.RJ.n)),takA=sum(tak.map(x=>x.m.tak.RI.amt+x.m.tak.RJ.amt));
  el.innerHTML=`<div class="card"><h2>Hasil verifikasi BPJS (BAVK): dari diajukan sampai layak</h2><p class="knote">Setiap bulan klaim diserahkan ke BPJS (<b>Bukti Penerimaan Klaim</b>), diperiksa kelengkapannya (<b>BAKB</b>), lalu diverifikasi dan ditetapkan lewat <b>Berita Acara Hasil Verifikasi Klaim (BAHV)</b> dengan status <b>Layak</b>, <b>Pending</b>, <b>Dispute</b>, atau <b>Tidak layak</b>. <b>Pending bukan ditolak</b>: SEP menunggu jawaban atau perbaikan dan dapat berubah menjadi layak pada penetapan berikutnya. Nilai di sini adalah <b>nilai ajuan INA-CBG</b> menurut BAHV, bukan kas yang sudah diterima. Data tersedia untuk ${all.map(mlab).join(', ')}; Januari 2026 belum ada berkasnya.</p>
  <div id="ljb-k"></div></div>
  <div class="kgrid kg2"><div class="card"><h2>Komposisi nilai ajuan menurut status BAHV</h2><p class="knote">Rupiah per bulan terpilih; tiap batang 100%.</p><div id="ljb-c1"></div></div>
  <div class="card"><h2>Persentase nilai ajuan yang masih pending</h2><p class="knote">Rawat inap bernilai besar per SEP, sehingga porsi nilai pending jauh lebih besar daripada porsi jumlah SEP.</p><div id="ljb-c2"></div></div></div>
  <div class="kgrid kg2"><div class="card"><h2>Median hari: tanggal pulang → BAHV</h2><p class="knote">Lama dari pasien pulang sampai klaim itu ditetapkan layak dalam BAHV (hanya SEP layak yang punya rincian). Bulan tanpa rincian induk tidak ditampilkan.</p><div id="ljb-c3"></div></div>
  <div class="card"><h2>Temuan otomatis</h2><ul class="kfind" id="ljb-find"></ul></div></div>
  <h3 class="ksect">Rincian per bulan</h3><div class="card"><div class="ktbl" id="ljb-tbl"></div></div>
  <h3 class="ksect">Kecocokan dengan berkas pending dan TXT e-klaim</h3><div class="card"><p class="knote">BAHV dibandingkan dengan dua sumber lain di dashboard ini: jumlah SEP pending menurut berkas Laporan Verifikasi Pending, dan jumlah SEP pada TXT e-klaim bulan itu. Selisih bukan kesalahan pasti; lihat keterangan kolom.</p><div class="ktbl" id="ljb-rec"></div></div>
  <div id="ljb-sel"></div>
  ${caveat(`<b>Batas data BAVK.</b> (1) Rincian per SEP dalam BAVK hanya memuat SEP berstatus <b>layak</b>; SEP pending, dispute, dan tidak layak hanya diketahui jumlah dan nilainya dari BAHV. Karena itu "nilai disetujui sama dengan nilai ajuan" hanya berlaku untuk SEP layak dan <b>tidak membuktikan tidak ada pemotongan</b> pada SEP yang tidak layak. (2) Maret 2026 tidak punya BAHV: status diturunkan dari rincian layak ditambah berkas pending, dan cocok persis dengan BAKB (jumlah dan rupiah). (3) Mei 2026 punya BAHV dan rincian induk (verifikasi 20 Juni 2026), tetapi tidak punya Bukti Penerimaan/BAKB, sehingga jumlah diajukan dihitung dari jumlah status BAHV. Rincian susulan 6 Agustus 2026 (172 SEP) dipisahkan dan tidak dicampur ke rincian induk. (4) Pending yang berubah menjadi layak pada penetapan berikutnya hanya dapat dilihat untuk Mei 2026 (berkas susulan); bulan lain belum diketahui, dan Juni–Juli pasti masih memuat pending yang belum selesai. (5) "Biaya riil RS" pada rincian BAVK sama dengan Tarif RS pada TXT (99,99%), jadi bukan unit cost.`)}`;
  const nfR=x=>nf.format(x);
  $('ljb-k').innerHTML='<div class="kgrid kkpis">'+
    kcard('Diajukan ke BPJS',nS,nfR,'SEP · '+rp(aS)+(hitung.length?' (Mei dihitung dari status BAHV)':''))+
    kcard('Layak',nL/nS*100,x=>dec(x,1)+'%',nfR(nL)+' SEP · '+rp(aL)+' ('+dec(aL/aS*100,1)+'% nilai)')+
    kcard('Pending',nP,nfR,'SEP · '+rp(aP)+' ('+dec(aP/aS*100,1)+'% nilai) · '+dec(nP/nS*100,1)+'% SEP')+
    kcard('Tidak layak + dispute',nT+nD,nfR,'SEP · '+rp(aT+aD)+(nD?'':' · tidak ada dispute'))+
    kcard('Pengajuan → BAHV',gapAvg,x=>dec(x,0)+' hari','Rata-rata '+gap.length+' bulan; dari penyerahan klaim (tgl 3–6) sampai BAHV')+
    kcard('Pulang → BAHV (median)',wl(0,'RI'),x=>isFinite(x)?dec(x,0)+' hari':'–','Rawat inap; rawat jalan '+(isFinite(wl(0,'RJ'))?dec(wl(0,'RJ'),0):'–')+' hari')+'</div>';
  countUp($('ljb-k'));
  const segs=[['layak','Layak'],['pending','Pending'],['dispute','Dispute'],['tl','Tidak layak']].map(([s,n])=>({name:n,color:BVC[s],s}));
  stack100($('ljb-c1'),M.map(x=>({label:mlab(x.k),vals:segs.map(g=>bsum(x.m,g.s,'amt'))})),segs,{title:'Komposisi nilai ajuan menurut status BAHV'});
  vbarsN($('ljb-c2'),ks.map(mlab),[{name:'Rawat inap',color:COL[0],vals:M.map(x=>bsum(x.m,'pending','amt','RI')/bsub(x.m,'amt','RI')*100)},{name:'Rawat jalan',color:COL[1],vals:M.map(x=>bsum(x.m,'pending','amt','RJ')/bsub(x.m,'amt','RJ')*100)}],{fmt:x=>dec(x,1)+'%',ax:x=>dec(x,0)+'%',title:'Persen nilai pending'});
  if(lagK.length) vbarsN($('ljb-c3'),lagK.map(x=>mlab(x.k)),[{name:'Rawat inap',color:COL[0],vals:lagK.map(x=>x.m.lag.RI[0])},{name:'Rawat jalan',color:COL[1],vals:lagK.map(x=>x.m.lag.RJ[0])}],{fmt:x=>dec(x,0),ax:x=>dec(x,0),title:'Median hari pulang sampai BAHV'});
  else $('ljb-c3').innerHTML='<p class="knote">Bulan terpilih tidak punya rincian induk.</p>';
  const F=[];
  const lp=M.map(x=>({k:x.k,p:bsum(x.m,'layak','n')/bsub(x.m,'n')})).sort((a,b)=>a.p-b.p);
  F.push(`<li><b>Layak:</b> ${pct(nL/nS)} SEP dan ${pct(aL/aS)} nilai ajuan pada bulan terpilih (terendah ${mfull(lp[0].k)} ${pct(lp[0].p)}, tertinggi ${mfull(lp[lp.length-1].k)} ${pct(lp[lp.length-1].p)}).</li>`);
  F.push(`<li class="${aP/aS>0.08?'w':''}"><b>Pending:</b> ${pct(nP/nS)} SEP tetapi ${pct(aP/aS)} nilai; rawat inap menyumbang ${pct(T('pending','amt','RI')/aP,0)} dari nilai pending.</li>`);
  const rv=M.filter(x=>x.m.beda),nb=sum(rv.map(x=>x.m.beda.RI+x.m.beda.RJ)),nr=sum(rv.map(x=>bsum(x.m,'layak','n')));
  if(rv.length) F.push(`<li><b>Tidak ada pemotongan nilai pada SEP layak:</b> pada ${nfR(nr)} SEP layak (${rv.length} bulan dengan rincian), nilai disetujui sama dengan nilai diajukan (${nb} SEP berbeda). Ini hanya berlaku untuk SEP layak.</li>`);
  if(nT) F.push(`<li><b>Tidak layak:</b> ${nfR(nT)} SEP (${rp(aT)}), ${T('tl','n','RI')?'':'seluruhnya rawat jalan, '}rata-rata ${rp(aT/nT)} per SEP${nD?'':'; tidak ada dispute'}.</li>`);
  if(isFinite(gapAvg)) F.push(`<li><b>Proses BPJS:</b> penetapan BAHV rata-rata ${dec(gapAvg,0)} hari setelah klaim diserahkan; dari tanggal pulang median ${isFinite(wl(0,'RI'))?dec(wl(0,'RI'),0):'–'} hari (RI) dan ${isFinite(wl(0,'RJ'))?dec(wl(0,'RJ'),0):'–'} hari (RJ), dengan ${isFinite(wl(2,'RI'))?dec(wl(2,'RI'),0):'–'} dan ${isFinite(wl(2,'RJ'))?dec(wl(2,'RJ'),0):'–'} hari dihitung dari finalisasi e-klaim.</li>`);
  if(tak.length&&takN) F.push(`<li class="w"><b>Ada di TXT e-klaim tetapi tidak tercatat di BAVK:</b> ${nfR(takN)} SEP (${rp(takA)}) pada ${tak.filter(x=>x.m.tak.RI.n+x.m.tak.RJ.n>0).map(x=>mlab(x.k)).join(', ')}; tidak ditemukan pada pending maupun rincian bulan lain. Kemungkinan belum diajukan atau diajukan susulan yang belum diterima; perlu dicek ke tim klaim.</li>`);
  const cut=M.filter(x=>x.k==='2026-05');
  if(cut.length&&BVX.mei_tak_di_pending){const c=cut[0].m,mt=BVX.mei_tak_di_pending,dr=bsum(c,'pending','n','RI')-c.pf.RI.n;F.push(`<li class="w"><b>Pending Mei 2026:</b> BAHV mencatat ${bsum(c,'pending','n','RI')} SEP rawat inap pending, tetapi berkas pending hanya memuat ${c.pf.RI.n}; ${dr} SEP (${rp(bsum(c,'pending','amt','RI')-c.pf.RI.amt)}) tidak ada pada berkas pending Mei. Di TXT e-klaim ada ${mt.RI.n} SEP rawat inap yang tidak ada di rincian induk maupun berkas pending, dan ${mt.RI.di_susulan} di antaranya ditetapkan layak pada susulan 6 Agustus 2026: kemungkinan itu pending yang hilang dari berkas.</li>`)}
  $('ljb-find').innerHTML=F.join('');
  const rows=M.map(x=>{const m=x.m,k=x.k,sn=bsub(m,'n'),sa=bsub(m,'amt'),ln=bsum(m,'layak','n'),pn=bsum(m,'pending','n');
    return {k,src:m.st_src==='bahv'?'BAHV':'Turunan',sn,sa,ln,la:bsum(m,'layak','amt'),pl:ln/sn,pn,pa:bsum(m,'pending','amt'),tn:bsum(m,'tl','n'),dn:bsum(m,'dispute','n'),
      bpk:m.d.bpk||m.d.surat||null,bakb:m.d.bakb||null,bahv:m.d.bahv,gap:dd(m.d.bpk||m.d.surat,m.d.bahv),lri:m.lag?m.lag.RI[0]:null,lrj:m.lag?m.lag.RJ[0]:null,_s:(k+' '+mfull(k)).toLowerCase(),sub_src:m.sub_src,no:m.no}});
  const cols=[
    {k:'k',h:'Bulan layanan',cls:'l',v:r=>r.k,f:r=>`<b>${mfull(r.k)}</b>${r.src==='Turunan'?' <span class="ksmall">(tanpa BAHV, status diturunkan)</span>':''}`},
    {k:'sn',h:'Diajukan (SEP)',v:r=>r.sn,f:r=>nfR(r.sn)+(r.sub_src==='hitung'?' <span class="ksmall">dihitung</span>':'')},{k:'sa',h:'Nilai diajukan',v:r=>r.sa,f:r=>rp(r.sa)},
    {k:'ln',h:'Layak (SEP)',v:r=>r.ln,f:r=>nfR(r.ln)},{k:'pl',h:'% layak',v:r=>r.pl,f:r=>pct(r.pl)},{k:'la',h:'Nilai layak',v:r=>r.la,f:r=>rp(r.la)},
    {k:'pn',h:'Pending (SEP)',v:r=>r.pn,f:r=>nfR(r.pn)},{k:'pa',h:'Nilai pending',v:r=>r.pa,f:r=>rp(r.pa)},
    {k:'tn',h:'Tidak layak (SEP)',v:r=>r.tn,f:r=>nfR(r.tn)},{k:'dn',h:'Dispute (SEP)',v:r=>r.dn,f:r=>nfR(r.dn)},
    {k:'bpk',h:'Klaim diserahkan',v:r=>r.bpk||'',f:r=>fd(r.bpk)},{k:'bakb',h:'BAKB',v:r=>r.bakb||'',f:r=>fd(r.bakb)},{k:'bahv',h:'BAHV / rincian',v:r=>r.bahv||'',f:r=>fd(r.bahv)},
    {k:'gap',h:'Hari serah → BAHV',v:r=>r.gap==null?-1:r.gap,f:r=>r.gap==null?'–':r.gap},
    {k:'lri',h:'Median pulang → BAHV (RI)',v:r=>r.lri==null?-1:r.lri,f:r=>r.lri==null?'–':dec(r.lri,0)},{k:'lrj',h:'Median pulang → BAHV (RJ)',v:r=>r.lrj==null?-1:r.lrj,f:r=>r.lrj==null?'–':dec(r.lrj,0)}];
  table($('ljb-tbl'),cols,rows,{sort:'k',asc:true});
  const chip=(a,b)=>a===b?'<span class="kchip good">sama</span>':`<span class="kchip bad">${a>b?'+':'−'}${nfR(Math.abs(a-b))}</span>`;
  const rrows=[];
  M.forEach(x=>['RI','RJ'].forEach(j=>{const m=x.m,pb=m.st.pending[j].n,pf=m.pf[j].n,sn=m.sub[j].n,tx=m.txt[j],tk=m.tak?m.tak[j]:null,tlb=m.st.tl[j].n;
    rrows.push({k:x.k,j,pb,pf,pbA:m.st.pending[j].amt,pfA:m.pf[j].amt,sn,tx,tk,tlb,turun:m.st_src==='turunan',hit:m.sub_src==='hitung',_s:(x.k+' '+mfull(x.k)+' '+j).toLowerCase()})}));
  const rcols=[
    {k:'k',h:'Bulan',cls:'l',v:r=>r.k,f:r=>`<b>${mfull(r.k)}</b>`},{k:'j',h:'Jenis',cls:'l',v:r=>r.j,f:r=>r.j==='RI'?'Rawat inap':'Rawat jalan'},
    {k:'pb',h:'Pending menurut BAHV',v:r=>r.pb,f:r=>r.turun?'<span class="ksmall">tanpa BAHV</span>':nfR(r.pb)},
    {k:'pf',h:'Pending menurut berkas pending',v:r=>r.pf,f:r=>nfR(r.pf)},
    {k:'sel',h:'Selisih pending',v:r=>r.turun?0:r.pb-r.pf,f:r=>r.turun?'–':chip(r.pb,r.pf)},
    {k:'sn',h:'Diajukan',v:r=>r.sn,f:r=>nfR(r.sn)+(r.hit?' <span class="ksmall">dihitung</span>':'')},{k:'tx',h:'SEP di TXT e-klaim',v:r=>r.tx,f:r=>nfR(r.tx)},
    {k:'tk',h:'TXT tidak tercatat di BAVK',v:r=>r.tk?r.tk.n:-1,f:r=>r.tk==null?'<span class="ksmall">tak dapat dinilai</span>':(r.tk.n?`<span class="kchip bad">${nfR(r.tk.n)} SEP · ${rp(r.tk.amt)}</span>`:'<span class="kchip good">0</span>')}];
  table($('ljb-rec'),rcols,rrows,{sort:'k',asc:true});
  // Pending yang diselesaikan: satu-satunya contoh (Mei 2026)
  const PS=BVX.pending_selesai,MS=BVX.mei_susulan,sel=$('ljb-sel');
  if(PS&&MS) sel.innerHTML=`<h3 class="ksect">Tindak lanjut pending: berkas susulan Mei 2026 (6 Agustus 2026)</h3><div class="card"><p class="knote">Satu-satunya berkas tindak lanjut yang tersedia (Juni–Agustus belum punya). Berisi <b>${nfR(MS.n)} SEP</b> (${MS.ri} RI, ${MS.rj} RJ; nilai ajuan ${rp(MS.diaj)}) yang ditetapkan layak pada 6 Agustus 2026, ${dec(PS.lag_dis_med,0)} hari (median) setelah pasien pulang.</p>
  <ul class="kfind"><li><b>${nfR(PS.n)} SEP</b> di antaranya terdapat pada berkas pending Mei (${PS.ri} RI, ${PS.rj} RJ): pending ${rp(PS.pamt)} menjadi layak ${rp(PS.diaj)}; ${PS.n_nilai_berubah} SEP nilai ajuannya berubah (klaim direvisi).</li>
  <li class="w"><b>${nfR(MS.ri_tdk_di_pending+MS.rj_tdk_di_pending)} SEP</b> (${MS.ri_tdk_di_pending} RI senilai ${rp(MS.ri_tdk_di_pending_diaj)}, ${MS.rj_tdk_di_pending} RJ) layak pada susulan tetapi tidak ada pada berkas pending Mei; ${BVX.mei_tak_di_pending?`${BVX.mei_tak_di_pending.RI.di_susulan} RI dan ${BVX.mei_tak_di_pending.RJ.di_susulan} RJ di antaranya adalah SEP TXT Mei yang tidak ada di rincian induk (20 Juni) maupun berkas pending, `:''}konsisten dengan berkas pending Mei yang tidak lengkap untuk rawat inap. ${MS.tdk_di_klaim} SEP tidak ada pada TXT e-klaim.</li>
  <li>Dari ${nfR(bsum(BV['2026-05'],'pending','n'))} SEP pending Mei menurut BAHV, ${nfR(PS.n)} terbukti diselesaikan lewat berkas ini (ada di berkas pending); ${BVX.mei_tak_di_pending?BVX.mei_tak_di_pending.RI.di_susulan:0} SEP rawat inap lain kemungkinan juga pending yang hilang dari berkas. Sisanya belum diketahui statusnya dari data yang ada.</li></ul></div>`;
};

/* ================= Penyebab pending ================= */
const SK_COL={'Belum ada jawaban RS':'#E3B360','RS menerima / menyesuaikan':'#6FC28F','RS menyanggah / melampirkan bukti':'#84AAF3'};
let sebabMet='n',sebabSrc='topik';
R.sebab=()=>{
  const el=$('kview-sebab'),ps=selP();
  if(!ps.length){el.innerHTML=empty('Tidak ada data pending pada bulan terpilih. Pilih bulan yang bertanda titik biru.');return}
  const met=sebabMet,mf=met==='n'?nf.format:rp,mx=met==='n'?nf.format:rpAx;
  const tot={};ps.forEach(k=>Object.entries(PM(k).cat).forEach(([c,v])=>{tot[c]=(tot[c]||0)+v[met]}));
  const cats=Object.keys(tot).sort((a,b)=>tot[b]-tot[a]);
  const sv=ps.filter(k=>sikapOK(PM(k))),ev=ps.filter(k=>!sikapOK(PM(k)));
  el.innerHTML=`<div class="ktoolbar"><span class="kl">Ukuran</span><div class="kseg" id="k-sMet"></div><span class="kl">Dasar kategori</span><div class="kseg ksegw" id="k-sCat"></div></div>
  ${caveat('<b>Cara membaca.</b> '+catBasis()+' Satu SEP dihitung sekali pada kategori yang paling banyak muncul di barisnya. Bulan tanpa berkas tidak muncul.')}
  ${kelasWarn(ps)}
  <div class="kgrid kg2"><div class="card"><h2>Komposisi penyebab per bulan (100%)</h2><p class="knote">Porsi tiap kategori terhadap total ${met==='n'?'SEP':'nilai'} pending bulan itu. Arahkan kursor pada segmen untuk angka.</p><div id="s-c1"></div></div>
  <div class="card"><h2>Status jawaban RS atas pending (100%)</h2><p class="knote">${sv.length?'Klasifikasi kata kunci atas kolom jawaban yang tercatat di berkas pending. “Jawaban tidak tercatat di berkas” bukan berarti belum dijawab: jawaban dikirim lewat e-klaim dan tidak selalu dicatat ke berkas rekap.':'Tidak ada bulan yang berkasnya memuat jawaban RS pada pilihan ini.'}${ev.length?' <b>'+ev.map(mlab).join(', ')+'</b> tidak ditampilkan karena berkas pending bulan itu tidak memuat jawaban RS (kolom tidak ada, kosong, atau format ekspor).':''}</p><div id="s-c2"></div></div></div>
  <div class="card"><h2>Kategori penyebab: perbandingan antarbulan</h2><p class="knote">Setiap kelompok batang memperlihatkan bulan-bulan terpilih untuk satu kategori, diurutkan dari yang terbesar.</p><div id="s-c3"></div></div>
  <h3 class="ksect">Matriks kategori × bulan</h3><div class="card"><div class="ktoolbar"><span class="kl" id="s-cnt"></span></div><div class="ktbl" id="s-tbl"></div></div>
  ${lainSection('sln')}
  <h3 class="ksect">Teks alasan dari verifikator</h3><div class="card"><div class="ktoolbar"><span class="kl">Sumber</span><div class="kseg" id="k-sSrc"></div><input type="search" id="s-q" placeholder="Cari kata dalam alasan…" aria-label="Cari alasan"><span class="kl" id="s-cnt2"></span></div><div class="ktbl" id="s-tbl2"></div><p class="knote" style="margin:10px 0 0" id="s-note2"></p></div>`;
  seg('sCat',[['grp','JN 7 kelompok'],['jn','JN 15 jenis'],['kw','Kata kunci']],catMode,v=>setCatMode(v));
  seg('sMet',[['n','Jumlah SEP'],['amt','Nilai (Rp)']],met,v=>{sebabMet=v;rendered.sebab=0;KC.length=0;R.sebab();rendered.sebab=1});
  seg('sSrc',[['topik','Topik filtrasi (per SEP)'],['alasan','Teks alasan (per baris)']],sebabSrc,v=>{sebabSrc=v;drawText()});
  stack100($('s-c1'),ps.map(k=>({label:mlab(k),vals:cats.map(c=>((PM(k).cat[c]||{})[met])||0)})),cats.map((c,i)=>({name:c,color:COL[i%COL.length]})),{title:'Komposisi penyebab'});
  if(sv.length) stack100($('s-c2'),sv.map(k=>({label:mlab(k),vals:Object.keys(SK_COL).map(s=>((PM(k).sikap[s]||{})[met])||0)})),Object.keys(SK_COL).map(s=>({name:SK_LAB[s]||s,color:SK_COL[s]})),{title:'Status jawaban RS'});
  else $('s-c2').innerHTML='<p class="knote">Tidak ada data.</p>';
  const top=cats.slice(0,Math.min(cats.length,ps.length<=3?11:ps.length<=6?8:6));
  hbarsN($('s-c3'),top.map(c=>({label:c,vals:ps.map(k=>((PM(k).cat[c]||{})[met])||0)})),serOf(ps,k=>null),{fmt:mf,title:'Kategori penyebab antarbulan'});
  lainDraw(ps,met,'sln');
  /* tabel matriks */
  const trows=cats.map(c=>({c,v:Object.fromEntries(ps.map(k=>[k,(PM(k).cat[c]||{})[met]||0])),_s:c}));
  trows.forEach(r=>{r.t=sum(ps.map(k=>r.v[k]))});
  const grand=sum(trows.map(r=>r.t))||1;
  const cols=[{k:'c',h:'Kategori',cls:'l',v:r=>r.c,f:r=>esc(r.c)}].concat(ps.map(k=>({k,h:mlab(k),v:r=>r.v[k],f:r=>mf(r.v[k])})),[{k:'t',h:'Total',v:r=>r.t,f:r=>`<b>${mf(r.t)}</b>`},{k:'sh',h:'Porsi',v:r=>r.t,f:r=>pct(r.t/grand)}]);
  table($('s-tbl'),cols,trows,{sort:'t',asc:false,count:$('s-cnt')});
  /* teks alasan */
  let tb=null;
  function drawText(){
    const a={};
    ps.forEach(k=>{const src=PM(k)[sebabSrc]||{};Object.entries(src).forEach(([t,c])=>{const key=unent(t).trim();const o=a[key]=a[key]||{t:key,n:0,m:0};o.n+=c;o.m++})});
    const rows=Object.values(a).map(o=>({...o,_s:o.t.toLowerCase()}));
    const nm=sebabSrc==='topik'?'SEP':'baris alasan';
    $('s-note2').innerHTML=sebabSrc==='topik'
      ?'Topik filtrasi: 15 topik teratas per bulan, dihitung per SEP. Bulan berformat ekspor (Juli dan Agustus 2026) tidak memiliki kolom ini.'
      :'Teks alasan: 12 alasan teratas per bulan (huruf kecil, label sumber dibuang, dipotong 80 karakter), dihitung per baris sehingga satu SEP dapat terhitung lebih dari sekali. Hanya teratas per bulan, jadi total tidak sama dengan seluruh pending.';
    const cols=[{k:'t',h:'Teks',cls:'l',v:r=>r.t,f:r=>esc(r.t)},{k:'n',h:nm[0].toUpperCase()+nm.slice(1),v:r=>r.n,f:r=>nf.format(r.n)},{k:'m',h:'Muncul di (bulan)',v:r=>r.m,f:r=>r.m+' dari '+ps.length}];
    tb=table($('s-tbl2'),cols,rows,{sort:'n',asc:false,limit:40,count:$('s-cnt2')});
    $('s-q').oninput=e=>tb.search(e.target.value);tb.search($('s-q').value);
  }
  drawText();
};

/* ================= INA-CBG & DPJP (pending) ================= */
R.kasus=()=>{
  const el=$('kview-kasus'),ps=selP();
  if(!ps.length){el.innerHTML=empty('Tidak ada data pending pada bulan terpilih. Pilih bulan yang bertanda titik biru.');return}
  const agg={};
  ps.forEach(k=>Object.entries(PM(k).inacbg).forEach(([c,v])=>{const o=agg[c]=agg[c]||{code:c,n:0,amt:0,ri:0,rj:0,m:0,per:{}};o.n+=v.n;o.amt+=v.amt;o.ri+=v.ri;o.rj+=v.rj;o.m++;o.per[k]=v.amt}));
  const D2=Object.values(agg).map(o=>({...o,desc:D.desc[o.code]||'',_s:(o.code+' '+(D.desc[o.code]||'')).toLowerCase()}));
  const topN=ps.length<=3?12:ps.length<=6?8:6;
  const top=D2.slice().sort((a,b)=>b.amt-a.amt).slice(0,topN);
  const noDesc=D2.filter(r=>!r.desc).length;
  const dp=ps.filter(k=>PM(k).dpjp);
  el.innerHTML=`<div class="card"><h2>Kode INA-CBG dengan nilai pending terbesar</h2><p class="knote">${topN} kode teratas menurut total nilai pending pada bulan terpilih; batang menunjukkan nilai per bulan. Kode yang tidak punya baris pada suatu bulan tidak punya batang.</p><div id="c-c1"></div></div>
  <h3 class="ksect">Cari kode INA-CBG pending</h3><div class="card"><div class="ktoolbar"><div id="c-combo"></div><span class="kl" id="c-cnt"></span></div><div class="ktbl" id="c-tbl"></div>
  <p class="knote" style="margin:10px 0 0">${noDesc?`Deskripsi tersedia untuk ${D2.length-noDesc} dari ${D2.length} kode; ${noDesc} kode belum punya deskripsi karena kamus kode hanya berasal dari data klaim 2025–Sep 2026.`:'Deskripsi tersedia untuk semua kode.'} “RI” dan “RJ” adalah jumlah SEP. Kode diambil dari SEP unik; satu SEP dihitung pada satu kode.</p></div>
  <h3 class="ksect">DPJP dengan SEP pending</h3><div id="c-dp"></div>`;
  hbarsN($('c-c1'),top.map(r=>({label:r.code+(r.desc?' · '+r.desc:''),vals:ps.map(k=>r.per[k]||null)})),serOf(ps,k=>null),{fmt:rp,lw:Math.min(Math.floor(W($('c-c1'))*.42),300),title:'Kode INA-CBG pending'});
  const cols=[
    {k:'code',h:'Kode',cls:'l',v:r=>r.code,f:r=>`<b>${esc(r.code)}</b>`},
    {k:'desc',h:'Deskripsi',cls:'l',v:r=>r.desc,f:r=>r.desc?esc(r.desc):'<span class="ksmall">belum ada deskripsi</span>'},
    {k:'n',h:'SEP',v:r=>r.n,f:r=>nf.format(r.n)},
    {k:'ri',h:'RI',v:r=>r.ri,f:r=>nf.format(r.ri)},
    {k:'rj',h:'RJ',v:r=>r.rj,f:r=>nf.format(r.rj)},
    {k:'amt',h:'Nilai pending',v:r=>r.amt,f:r=>rp(r.amt)},
    {k:'avg',h:'Nilai / SEP',v:r=>r.amt/r.n,f:r=>rp(r.amt/r.n)},
    {k:'m',h:'Bulan muncul',v:r=>r.m,f:r=>r.m+' dari '+ps.length}
  ];
  const tb=table($('c-tbl'),cols,D2,{sort:'amt',asc:false,limit:40,count:$('c-cnt')});
  combo($('c-combo'),{ph:'Cari kode atau nama diagnosis…',
    items:D2.slice().sort((a,b)=>b.amt-a.amt).map(r=>({s:r._s,text:r.code+(r.desc?' · '+r.desc:''),sub:nf.format(r.n)+' SEP · '+rp(r.amt),code:r.code})),
    onPick:it=>tb.only(it?(r=>r.code===it.code):null),onType:v=>tb.search(v)});
  /* DPJP */
  const box=$('c-dp');
  if(!dp.length){box.innerHTML=empty('Bulan terpilih tidak memiliki data DPJP pending. Data DPJP tersedia untuk Januari 2025–Agustus 2026: Januari 2025–Juni 2026 diambil dari TXT e-klaim (dicocokkan per nomor SEP) dan Juli–Agustus 2026 dari berkas pending.');return}
  const da={};
  dp.forEach(k=>Object.entries(PM(k).dpjp).forEach(([name,v])=>{const key=nk(name),o=da[key]=da[key]||{name,n:0,amt:0,ri:0,rj:0};o.n+=v.n;o.amt+=v.amt;o.ri+=v.ri;o.rj+=v.rj}));
  const drows=Object.values(da).map(o=>({...o,_s:o.name.toLowerCase()}));
  box.innerHTML=`<div class="card"><div class="ktoolbar"><div id="d-combo"></div><span class="kl" id="d-cnt"></span></div><div class="kgrid kg2"><div id="d-c1"></div><div class="ktbl" id="d-tbl"></div></div>
  <p class="knote" style="margin:10px 0 0">Periode: ${dp.map(mfull).join(', ')}. Rawat inap dan rawat jalan <b>dijumlahkan</b> per DPJP. Pending tidak berarti DPJP salah; ini peta konsentrasi tindak lanjut. <b>Sumber nama DPJP:</b> ${dp.map(k=>mlab(k)+' = '+(PM(k).dpjp_src||'berkas pending')).join('; ')}. DPJP dari TXT e-klaim adalah DPJP pada klaim SEP tersebut (bukan keterangan verifikator); uji silang pada Juli–Agustus 2026 (yang punya kolom DPJP di berkas pending) menunjukkan nama sama persis dengan TXT e-klaim untuk semua SEP yang terisi. ${(()=>{const u=dp.reduce((t,k)=>t+(PM(k).dpjp_unmatched||0),0);return u?u+' SEP tidak ditemukan pada TXT e-klaim sehingga dicatat sebagai &quot;(tanpa DPJP)&quot;.':'Semua SEP pending pada bulan terpilih ditemukan pada TXT e-klaim bulan yang sama.'})()} Variasi penulisan nama (huruf besar/kecil, titik, gelar) disatukan; penyatuan nama yang meragukan belum dilakukan.</p></div>`;
  hbarsN($('d-c1'),drows.slice().sort((a,b)=>b.amt-a.amt).slice(0,10).map(r=>({label:r.name,vals:[r.amt]})),[{name:'Nilai pending',color:'#84AAF3',vals:[]}],{fmt:rp,title:'DPJP dengan nilai pending terbesar'});
  const dc=[
    {k:'name',h:'DPJP',cls:'l',v:r=>r.name,f:r=>esc(r.name)},
    {k:'n',h:'SEP',v:r=>r.n,f:r=>nf.format(r.n)},
    {k:'ri',h:'RI',v:r=>r.ri,f:r=>nf.format(r.ri)},
    {k:'rj',h:'RJ',v:r=>r.rj,f:r=>nf.format(r.rj)},
    {k:'amt',h:'Nilai pending',v:r=>r.amt,f:r=>rp(r.amt)}
  ];
  const t2=table($('d-tbl'),dc,drows,{sort:'amt',asc:false,limit:30,count:$('d-cnt')});
  combo($('d-combo'),{ph:'Cari nama DPJP…',items:drows.slice().sort((a,b)=>b.amt-a.amt).map(r=>({s:r._s,text:r.name,sub:nf.format(r.n)+' SEP · '+rp(r.amt),name:r.name})),
    onPick:it=>t2.only(it?(r=>r.name===it.name):null),onType:v=>t2.search(v)});
};

/* ================= Klaim ================= */
let klJ='ALL';
R.klaim=()=>{
  const el=$('kview-klaim'),ks=selK();
  const avl=TL.filter(hasK);
  if(!ks.length){el.innerHTML=empty(`Tidak ada data klaim pada bulan terpilih. Data klaim tersedia untuk <b>${avl.length} bulan</b> (${mfull(avl[0])} sampai ${mfull(avl[avl.length-1])}).`);return}
  const j=klJ;
  el.innerHTML=`<div class="ktoolbar"><span class="kl">Jenis pelayanan</span><div class="kseg" id="k-kJ"></div></div>
  <div id="k-kpis"></div>
  <div class="kgrid kg2"><div class="card"><h2>Pendapatan klaim vs Tarif RS</h2><p class="knote">Total tarif INA-CBG yang diajukan, tarif RS atas layanan yang sama, dan selisihnya.</p><div id="k-c1"></div></div>
  <div class="card"><h2>Jumlah klaim dan pasien unik</h2><p class="knote">Klaim = satu SEP. Pasien unik dihitung per bulan.</p><div id="k-c2"></div></div></div>
  <div class="card"><h2>Kode INA-CBG dengan pendapatan klaim terbesar</h2><p class="knote">Top kode menurut total tarif INA-CBG pada bulan terpilih (sesuai jenis pelayanan yang dipilih).</p><div id="k-c3"></div></div>
  <h3 class="ksect">Cari kode INA-CBG klaim</h3><div class="card"><div class="ktoolbar"><div id="k-combo"></div><span class="kl" id="k-cnt"></span></div><div class="ktbl" id="k-tbl"></div></div>
  <h3 class="ksect">DPJP (gabungan rawat inap + rawat jalan)</h3><div class="card"><div class="ktoolbar"><div id="kd-combo"></div><span class="kl" id="kd-cnt"></span></div><div class="ktbl" id="kd-tbl"></div>
  <p class="knote" style="margin:10px 0 0">Nilai per DPJP adalah total tarif INA-CBG kasus rawat inap dan rawat jalan yang <b>dijumlahkan</b>; kolom RI/RJ adalah jumlah klaim pada bulan terakhir terpilih. Nama DPJP disatukan tanpa membedakan huruf besar dan titik. Ini nilai klaim, bukan jasa medis atau remunerasi.</p></div>
  ${caveat('<b>Batas data klaim.</b> Berkas klaim hanya memuat klaim yang diajukan; status verifikasi BPJS (pending, dispute, koreksi) tidak terlihat di sini, sehingga pendapatan adalah nilai ajuan, bukan kas yang pasti diterima. Periode memakai tanggal pulang. Tarif RS bukan unit cost.')}`;
  seg('kJ',[['ALL','Gabungan RI + RJ'],['RI','Rawat inap'],['RJ','Rawat jalan']],j,v=>{klJ=v;rendered.klaim=0;KC.length=0;R.klaim();rendered.klaim=1});
  const Kj=k=>KQ(k,j),f=ks[0],l=ks[ks.length-1],two=ks.length>1;
  const ch=(fn,good)=>two?chg(fn(Kj(f)),fn(Kj(l)),good)+`<span class="ksmall">${mlab(f)} → ${mlab(l)}</span>`:'';
  $('k-kpis').innerHTML='<div class="kgrid kkpis">'+
    kcard('Jumlah klaim',sum(ks.map(k=>Kj(k).n)),nf.format,two?'Total bulan terpilih':'',ch(x=>x.n,true))+
    kcard('Pendapatan klaim INA-CBG',sum(ks.map(k=>Kj(k).tot)),rp,'Total tarif INA-CBG diajukan',ch(x=>x.tot,true))+
    kcard('Tarif RS atas layanan sama',sum(ks.map(k=>Kj(k).rs)),rp,'',ch(x=>x.rs,null))+
    kcard('Defisit klaim vs Tarif RS',-sum(ks.map(k=>Kj(k).sel)),rp,'Tarif RS dikurangi klaim',ch(x=>-x.sel,false))+
    kcard('Rasio klaim / Tarif RS',sum(ks.map(k=>Kj(k).tot))/sum(ks.map(k=>Kj(k).rs)),x=>pct(x),'Makin rendah, makin besar selisih',two?chg(Kj(f).tot/Kj(f).rs,Kj(l).tot/Kj(l).rs,true):'')+
    kcard('Rata-rata klaim per kasus',sum(ks.map(k=>Kj(k).tot))/sum(ks.map(k=>Kj(k).n)),rp,'',ch(x=>x.tot/x.n,null))+
    '</div>';
  countUp($('k-kpis'));
  vbarsN($('k-c1'),['Tarif INA-CBG (klaim)','Tarif RS','Defisit'],serOf(ks,k=>[Kj(k).tot,Kj(k).rs,-Kj(k).sel]),{fmt:rp,ax:rpAx,title:'Klaim vs Tarif RS'});
  vbarsN($('k-c2'),['Klaim','Pasien unik'],serOf(ks,k=>[Kj(k).n,Kj(k).pat]),{title:'Klaim dan pasien'});
  /* INA-CBG */
  const pickJ=(v)=>j==='ALL'?{n:(v.ri?v.ri.n:0)+(v.rj?v.rj.n:0),tot:(v.ri?v.ri.tot:0)+(v.rj?v.rj.tot:0),rs:(v.ri?v.ri.rs:0)+(v.rj?v.rj.rs:0)}:(v[j.toLowerCase()]||{n:0,tot:0,rs:0});
  const ag={};
  ks.forEach(k=>Object.entries(D.klaim[k].inacbg).forEach(([c,v])=>{const x=pickJ(v);if(!x.n)return;const o=ag[c]=ag[c]||{code:c,n:0,tot:0,rs:0,per:{}};o.n+=x.n;o.tot+=x.tot;o.rs+=x.rs;o.per[k]=x.tot}));
  const rows=Object.values(ag).map(o=>({...o,desc:D.desc[o.code]||'',_s:(o.code+' '+(D.desc[o.code]||'')).toLowerCase()}));
  const topN=ks.length<=3?12:8;
  hbarsN($('k-c3'),rows.slice().sort((a,b)=>b.tot-a.tot).slice(0,topN).map(r=>({label:r.code+(r.desc?' · '+r.desc:''),vals:ks.map(k=>r.per[k]||null)})),serOf(ks,k=>null),{fmt:rp,lw:Math.min(Math.floor(W($('k-c3'))*.42),300),title:'Kode INA-CBG klaim'});
  const cols=[
    {k:'code',h:'Kode',cls:'l',v:r=>r.code,f:r=>`<b>${esc(r.code)}</b>`},
    {k:'desc',h:'Deskripsi',cls:'l',v:r=>r.desc,f:r=>r.desc?esc(r.desc):'<span class="ksmall">belum ada deskripsi</span>'},
    {k:'n',h:'Klaim',v:r=>r.n,f:r=>nf.format(r.n)},
    {k:'tot',h:'Pendapatan INA-CBG',v:r=>r.tot,f:r=>rp(r.tot)},
    {k:'rs',h:'Tarif RS',v:r=>r.rs,f:r=>rp(r.rs)},
    {k:'def',h:'Defisit',v:r=>r.rs-r.tot,f:r=>rp(r.rs-r.tot)}
  ];
  const tb=table($('k-tbl'),cols,rows,{sort:'tot',asc:false,limit:40,count:$('k-cnt')});
  combo($('k-combo'),{ph:'Cari kode atau nama diagnosis…',items:rows.slice().sort((a,b)=>b.tot-a.tot).map(r=>({s:r._s,text:r.code+(r.desc?' · '+r.desc:''),sub:nf.format(r.n)+' klaim · '+rp(r.tot),code:r.code})),onPick:it=>tb.only(it?(r=>r.code===it.code):null),onType:v=>tb.search(v)});
  /* DPJP gabungan */
  const da={};
  ks.forEach(k=>Object.entries(D.klaim[k].dpjp).forEach(([name,v])=>{if(name==='ALL')return;const key=nk(name),o=da[key]=da[key]||{name,per:{},n:0,tot:0,ri:0,rj:0};o.per[k]={n:v.n,tot:v.tot};o.n+=v.n;o.tot+=v.tot}));
  Object.values(da).forEach(o=>{const lk=[...ks].reverse().find(k=>o.per[k]);const src=Object.entries(D.klaim[lk].dpjp).find(([nm])=>nk(nm)===nk(o.name))[1];o.ri=src.ri;o.rj=src.rj});
  const dr=Object.values(da).map(o=>({...o,_s:o.name.toLowerCase()}));
  const dcols=[{k:'name',h:'DPJP',cls:'l',v:r=>r.name,f:r=>esc(r.name)}].concat(
    ks.map(k=>({k:'n'+k,h:'Klaim '+mlab(k),v:r=>(r.per[k]||{n:0}).n,f:r=>r.per[k]?nf.format(r.per[k].n):'–'})),
    ks.map(k=>({k:'t'+k,h:'Nilai '+mlab(k),v:r=>(r.per[k]||{tot:0}).tot,f:r=>r.per[k]?rp(r.per[k].tot):'–'})),
    [{k:'ri',h:'RI ('+mlab(l)+')',v:r=>r.ri,f:r=>nf.format(r.ri)},{k:'rj',h:'RJ ('+mlab(l)+')',v:r=>r.rj,f:r=>nf.format(r.rj)},{k:'tot',h:'Total nilai',v:r=>r.tot,f:r=>`<b>${rp(r.tot)}</b>`}]);
  const t2=table($('kd-tbl'),dcols,dr,{sort:'tot',asc:false,limit:40,count:$('kd-cnt')});
  combo($('kd-combo'),{ph:'Cari nama DPJP…',items:dr.slice().sort((a,b)=>b.tot-a.tot).map(r=>({s:r._s,text:r.name,sub:nf.format(r.n)+' klaim · '+rp(r.tot),name:r.name})),onPick:it=>t2.only(it?(r=>r.name===it.name):null),onType:v=>t2.search(v)});
};

/* ================= Kualitas data ================= */
R.data=()=>{
  const el=$('kview-data');
  const pk=TL.filter(hasP),np=pk.length,nrows=sum(pk.map(k=>PM(k).rows));
  const lain=sum(pk.map(k=>(PM(k).cat_kw['Lainnya']||{n:0}).n)),allN=sum(pk.map(k=>PM(k).n)),lain1=sum(pk.map(k=>(PM(k).lain_v1||{n:0}).n)),via=sum(pk.map(k=>PM(k).via2||0));
  el.innerHTML=`<h3 class="ksect" style="margin-top:0">Cakupan data per bulan</h3><div class="card"><div class="ktoolbar"><span class="kl" id="q-cnt"></span></div><div class="ktbl" id="q-tbl"></div>
  <p class="knote" style="margin:10px 0 0">Baris di berkas = satu SEP per alasan pending, sehingga lebih banyak dari SEP unik. Dashboard menghitung <b>SEP unik</b> untuk jumlah dan nilai agar satu SEP tidak terhitung berulang.</p></div>
  <h3 class="ksect">Pemeriksaan integritas</h3><div class="card"><ul class="kfind">
   <li class="g"><b>Tidak ada SEP ganda antarbulan.</b> ${nf.format(D.meta.sum_sep_months)} SEP dijumlahkan dari ${np} bulan = ${nf.format(D.meta.unique_sep_all)} SEP unik di seluruh bulan, jadi total lintas bulan tidak menghitung dua kali.</li>
   <li class="g"><b>Periode mengikuti tanggal pulang</b> (bulan berkas). Baris dengan tanggal pulang di luar bulan berkas atau kosong: ${sum(pk.map(k=>PM(k).month_mismatch))} (Juli 2026: 5 SEP berstatus Tidak Layak tanpa tarif dan tanpa tanggal pulang; Agustus 2026: 59 SEP rawat jalan Tidak Layak yang bercampur di berkas pending. Keduanya sudah dikeluarkan dari daftar pending sehingga tidak dihitung sebagai pending; untuk Agustus pemisahan per SEP berdasarkan alasan dan cocok persis dengan BAHV dalam jumlah dan rupiah).</li>
   <li class="g"><b>Baris persis kembar:</b> ${sum(pk.map(k=>PM(k).dup_rows))} dari ${nf.format(nrows)} baris.</li>
   <li class="${TL.filter(k=>hasK(k)&&!hasP(k)).length?'w':'g'}"><b>Pending ${np} bulan</b> (${mlab(pk[0])}–${mlab(pk[np-1])}), tanpa bulan kosong di antaranya${TL.filter(k=>hasK(k)&&!hasP(k)).length?'; belum ada berkas pending untuk '+TL.filter(k=>hasK(k)&&!hasP(k)).map(mfull).join(', ')+' (hanya klaim)':''}. ${mfull('2025-04')} dan ${mfull('2026-06')} sudah termasuk (berkas terenkripsi, dibuka dengan kata sandi masing-masing).</li>
   <li class="r"><b>${mfull('2026-05')}: hanya ${PM('2026-05').ri.n} SEP rawat inap</b> (bulan lain 50–150); ${BV['2026-05']?`BAHV Mei 2026 mencatat ${BV['2026-05'].st.pending.RI.n} SEP rawat inap pending (${rp(BV['2026-05'].st.pending.RI.amt)}), jadi berkas pending <b>terbukti tidak lengkap</b>: ${BV['2026-05'].st.pending.RI.n-PM('2026-05').ri.n} SEP (${rp(BV['2026-05'].st.pending.RI.amt-PM('2026-05').ri.amt)}) tidak ada pada berkas. Angka pending rawat inap Mei di dashboard terlalu rendah; minta ulang berkas pending Mei yang lengkap. Sebagian SEP itu kemungkinan sudah ditetapkan layak pada susulan 6 Agustus 2026 (lihat tab Hasil verifikasi).`:'berkas kemungkinan belum memuat pending rawat inap, sehingga nilainya terlalu rendah.'}</li>
   ${Object.keys(BV).length?`<li class="g"><b>Hasil verifikasi BPJS (BAVK)</b> tersedia untuk ${Object.keys(BV).sort().map(mlab).join(', ')} (Analisis lanjutan, tab Hasil verifikasi). Jumlah pending menurut BAHV sama dengan berkas pending pada Feb, Apr, Jun, Jul, dan Agu 2026 (Jul dan Agu setelah SEP Tidak Layak dipisahkan; Mar tanpa BAHV; Mei selisih seperti di atas). Januari 2026 belum ada.</li>`:''}
   <li class="w"><b>Rawat jalan Januari–Maret 2025 tepat 100, 100, dan 120 SEP.</b> Pola angka bulat ini patut dicurigai sebagai pembatasan ekspor; perlu konfirmasi ke petugas sebelum dipakai sebagai pembanding.</li>
   <li class="w"><b>${mfull('2026-07')} dan ${mfull('2026-08')} berformat berbeda</b> (hasil ekspor: tanpa jawaban RS dan topik filtrasi, tetapi memuat DPJP). Kolom diselaraskan secara manual: SEP, jenis rawat, tanggal pulang, total tarif, dan keterangan pending.</li>
   <li class="w"><b>Jawaban RS atas pending tidak tercatat lengkap di berkas.</b> ${(()=>{const no=pk.filter(k=>!sikapOK(PM(k))),yes=pk.filter(k=>sikapOK(PM(k))),lo=yes.length?yes.slice().sort((a,b)=>skRec(PM(a))-skRec(PM(b)))[0]:null;return `Berkas ${no.length} bulan (${no.map(mlab).join(', ')}) tidak memuat jawaban RS sama sekali (kolom tidak ada, kosong, atau format ekspor)${lo?`, dan pada bulan lain cakupannya berbeda-beda (terendah ${mlab(lo)}: ${pct(skRec(PM(lo)))} SEP bertanda jawaban)`:''}. Jawaban pending dikirim lewat e-klaim, jadi SEP tanpa jawaban tercatat <b>tidak</b> berarti belum dijawab. Dashboard sengaja tidak menyimpulkan tingkat penyelesaian pending dari kolom ini; untuk itu diperlukan kolom jawaban dan tanggal jawab pada rekap pending (atau data balasan dari e-klaim).`})()}</li>
   <li class="w"><b>Dasar kategori penyebab: jenis pending (JNSPENDING).</b> ${(()=>{const o=provSum(pk),T=Math.max(allN,1),b=(o.asli||0)+(o.teks||0),e=(o.isian_tinggi||0)+(o.isian_sedang||0)+(o.isian_rendah||0),r=o.isian_rendah||0,x=(o.turunan||0)+(o.kw||0)+(o.tbd||0);return `Dari ${nf.format(allN)} SEP: ${nf.format(b)} (${pct(b/T)}) berjenis pending baku BPJS (kolom JNSPENDING atau kalimat baku di awal teks alasan), ${nf.format(e)} (${pct(e/T)}) memakai <b>isian perkiraan Claude</b> (bukan keputusan BPJS dan belum diverifikasi tim casemix; ${nf.format(r)} SEP di antaranya berkeyakinan rendah), dan ${nf.format(x)} (${pct(x/T)}) diturunkan dari teks yang sama atau kata kunci cadangan. Total SEP dan nilai tidak bergantung pada kategori.`})()} Tampilan kata kunci tetap tersedia di tab Penyebab pending sebagai pembanding.</li>
   ${(()=>{const KA=window.KLAIM_AGG,ks=TL.filter(hasK),rc=KA?KA.recon:{};const bad=ks.filter(k=>rc[k]&&['RI','RJ'].some(j=>rc[k][j]&&rc[k][j].rek_n!=null&&(rc[k][j].only_txt||rc[k][j].only_rek||rc[k][j].txt_tot!==rc[k][j].rek_tot)));const none=ks.filter(k=>rc[k]&&['RI','RJ'].some(j=>rc[k][j]&&rc[k][j].rek_n==null));const both=TL.filter(k=>hasP(k)&&hasK(k));
     return `<li class="g"><b>Data klaim ${ks.length} bulan</b> (${mfull(ks[0])}–${mfull(ks[ks.length-1])}) dari TXT e-klaim; ${ks.length-bad.length-none.length} bulan cocok per nomor SEP dengan Rekap Klaim XLSX tanpa selisih.</li>`+
     (bad.length?`<li class="w"><b>Selisih TXT dan Rekap XLSX:</b> ${bad.map(k=>mfull(k)+' ('+['RI','RJ'].map(j=>{const r=rc[k][j];return r&&r.rek_n!=null&&(r.only_txt||r.only_rek)?j+': '+r.only_txt+' SEP hanya di TXT, '+r.only_rek+' hanya di XLSX':''}).filter(Boolean).join('; ')+')').join('; ')}. Dashboard memakai TXT.</li>`:'')+
     (none.length?`<li class="w"><b>${none.map(mfull).join(', ')}:</b> Rekap Klaim rawat inap tidak dapat dicocokkan (format berkas berbeda), sehingga tidak direkonsiliasi.</li>`:'')+
     `<li class="w"><b>Pemilihan berkas klaim:</b> ${mfull('2025-10')} memakai subfolder FIX (989 SEP rawat inap; Rekap FIX memuat 992) dan ${mfull('2025-12')} memakai berkas induk (rawat jalan 6.757 SEP; subfolder FIX memuat 6.746 dan rekap rawat inap-nya berformat pivot). Jika berkas final yang diajukan berbeda, selisihnya kecil tetapi perlu dikonfirmasi.</li>`+
     (()=>{const cv=ks.map(k=>{const q=KA&&KA.months[k]&&KA.months[k].kpi&&KA.months[k].kpi.ALL;return{k,c:q&&q.n?q.n_idrg/q.n:0}}),z=cv.filter(x=>x.c===0),pa=cv.filter(x=>x.c>0&&x.c<.99),fu=cv.filter(x=>x.c>=.99);return fu.length?`<li class="w"><b>Keluaran iDRG lengkap mulai ${mfull(fu[0].k)}:</b> ${z.length?mfull(z[0].k)+(z.length>1?'–'+mfull(z[z.length-1].k):'')+' tidak memuat iDRG pada berkas; ':''}${pa.map(x=>mfull(x.k)+' hanya '+pct(x.c)+' klaim').join('; ')}${pa.length?'. ':''}Perbandingan iDRG antarbulan tidak ditampilkan bila cakupan tidak penuh.</li>`:''})()+
     `<li class="w"><b>Pending dan klaim dapat disandingkan untuk ${both.length} bulan</b> (${both.length?mlab(both[0])+'–'+mlab(both[both.length-1]):'–'}${TL.filter(k=>hasK(k)&&!hasP(k)).length?', tanpa '+TL.filter(k=>hasK(k)&&!hasP(k)).map(mlab).join(', ')+' yang pending-nya belum ada':''}). Rasionya indikatif karena tanggal tarik laporan pending berbeda dari berkas klaim.</li>`})()}
   <li><b>Data pasien tidak ditampilkan.</b> Dashboard hanya memuat agregat: nama, nomor kartu, NIK, nomor RM, dan nomor SEP tidak dimasukkan.</li>
  </ul></div>
  <h3 class="ksect">Batas penafsiran</h3><div class="card"><ul class="kfind">
   <li><b>Pending bukan penolakan.</b> Pending adalah klaim yang menunggu konfirmasi atau perbaikan; sebagian akan dibayar setelah dijawab. Nilai pending adalah <i>risiko arus kas</i>, bukan kerugian.</li>
   <li><b>Nilai pending adalah nilai ajuan</b> (BYPENGAJUAN) per SEP, bukan jumlah yang pasti dipotong.</li>
   <li><b>Perbandingan antarbulan</b> dipengaruhi hari kerja, musim penyakit, jumlah verifikator, dan kapan berkas ditarik; selisih satu atau dua bulan belum membuktikan tren.</li>
  </ul></div>`;
  const rows=TL.map(k=>({k,p:hasP(k)?PM(k):null,q:hasK(k),note:MISS[k]||'',_s:mfull(k)}));
  const st=(r)=>r.p?'<span class="kchip good">ada</span>':'<span class="kchip bad">tidak ada</span>';
  const cols=[
    {k:'k',h:'Bulan',cls:'l',v:r=>r.k,f:r=>`<b>${mfull(r.k)}</b>`},
    {k:'p',h:'Pending',v:r=>r.p?1:0,f:st},
    {k:'fmt',h:'Format',cls:'l',v:r=>r.p?r.p.fmt:'',f:r=>r.p?r.p.fmt:'–'},
    {k:'rows',h:'Baris berkas',v:r=>r.p?r.p.rows:0,f:r=>r.p?nf.format(r.p.rows):'–'},
    {k:'n',h:'SEP unik',v:r=>r.p?r.p.n:0,f:r=>r.p?nf.format(r.p.n):'–'},
    {k:'ratio',h:'Baris per SEP',v:r=>r.p?r.p.rows/r.p.n:0,f:r=>r.p?dec(r.p.rows/r.p.n,2):'–'},
    {k:'q',h:'Klaim',v:r=>r.q?1:0,f:r=>r.q?'<span class="kchip good">ada</span>':'<span class="kchip bad">tidak ada</span>'},
    {k:'note',h:'Catatan',cls:'l',v:r=>r.note||(D.meta.caution&&D.meta.caution[r.k])||'',f:r=>esc(r.note||(D.meta.caution&&D.meta.caution[r.k])||'')}
  ];
  table($('q-tbl'),cols,rows,{sort:'k',asc:true,count:$('q-cnt')});
};

/* ================= Integrasi MonEv P3A ================= */
$('src').innerHTML='Sumber: <b>Laporan Verifikasi Pending</b> ('+TL.filter(hasP).length+' bulan, '+nf.format(D.meta.unique_sep_all)+' SEP unik) + <b>e-klaim</b> ('+TL.filter(hasK).map(mlab).join(', ')+')';
let booted=false;
function boot(){if(booted){rerender();return}booted=true;renderPicker();rerender()}
const ROOTS=['appRoot','appRootPendapatan','appRootGabungan'];
window.showKlaimApp=function(){
  $('hubScreen').style.display='none';
  const cs=$('comingSoonScreen');if(cs)cs.style.display='none';
  ROOTS.forEach(id=>{const e=$(id);if(e)e.style.display='none'});
  $('appRootKlaim').style.display='flex';
  boot();
  window.scrollTo(0,0);
};
window.hideKlaimApp_=function(){const e=$('appRootKlaim');if(e)e.style.display='none'};
function initHost(){
  document.querySelectorAll('.hub-menu-card[data-hub="klaim"]').forEach(c=>c.addEventListener('click',window.showKlaimApp));
  const home=$('btnHomeMenuK');if(home)home.addEventListener('click',()=>{if(typeof showHub==='function')showHub()});
  const rf=$('btnRefreshK');if(rf)rf.addEventListener('click',rerender);
  // mode HP/Komputer diganti tanpa reload halaman -> gambar ulang grafik
  let hp=document.documentElement.classList.contains('mode-hp');
  new MutationObserver(()=>{const n=document.documentElement.classList.contains('mode-hp');if(n===hp)return;hp=n;if(booted&&visible())setTimeout(rerender,80)}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initHost);else initHost();

})();
(function(){
(function(){
"use strict";
const KA = window.KLAIM_AGG;
let D = null, KEYA='', KEYB='', LA='A', LB='B', MA='', MB='';
const P = ['Agu','Sep'];   /* slot internal: Agu = bulan A (pertama), Sep = bulan B (kedua) */
const MNs=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const MFs=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const mlabK=k=>MNs[+k.slice(5)-1]+' '+k.slice(2,4), mfullK=k=>MFs[+k.slice(5)-1]+' '+k.slice(0,4);
const pullTxt=k=>((KA.months[k].checks.pull)||[]).map(x=>(+x.slice(6))+' '+MFs[+x.slice(4,6)-1]+' '+x.slice(0,4)).join(' dan ');
/* gabung data dua bulan menjadi bentuk lama {Agu:..., Sep:...} */
function compose(a,b){
  const A=KA.months[a],B=KA.months[b],o={};
  const Z=[0,0,0,0], row=v=>({n:v[0],tot:v[1],rs:v[2],los:v[3]});
  const tab=(ta,tb,desc,sortFn)=>{
    const ks=[...new Set(Object.keys(ta).concat(Object.keys(tb)))].sort(sortFn||((x,y)=>x<y?-1:x>y?1:0));
    return ks.map(k=>{const r={k,Agu:row(ta[k]||Z),Sep:row(tb[k]||Z)};if(desc)r.d=KA.desc[k]||'';return r});
  };
  o.kpi={Agu:A.kpi,Sep:B.kpi}; o.daily={Agu:A.daily,Sep:B.daily}; o.eff={Agu:A.eff,Sep:B.eff};
  o.kelas=tab(A.kelas,B.kelas); o.sev=tab(A.sev,B.sev);
  o.mdc={RI:tab(A.mdc.RI,B.mdc.RI),RJ:tab(A.mdc.RJ,B.mdc.RJ)};
  o.inacbg={RI:tab(A.inacbg.RI,B.inacbg.RI,true),RJ:tab(A.inacbg.RJ,B.inacbg.RJ,true)};
  const dp={RI:tab(A.dpjp.RI,B.dpjp.RI),RJ:tab(A.dpjp.RJ,B.dpjp.RJ)};
  /* nama DPJP digabung tanpa membedakan huruf besar/kecil dan titik */
  const nkk=x=>String(x).toUpperCase().replace(/[\s.,]+/g,' ').trim();
  const mergeNames=rows=>{const m={};rows.forEach(r=>{const key=nkk(r.k),e=m[key];if(!e)m[key]=r;else{['Agu','Sep'].forEach(p=>{['n','tot','rs'].forEach(f=>e[p][f]+=r[p][f])});if(r.k.startsWith('dr.')&&!e.k.startsWith('dr.'))e.k=r.k}});return Object.values(m)};
  dp.RI=mergeNames(dp.RI);dp.RJ=mergeNames(dp.RJ);
  const all={};
  [['RI',dp.RI],['RJ',dp.RJ]].forEach(([j,rows])=>rows.forEach(r=>{const key=nkk(r.k);const e=all[key]=all[key]||{k:r.k,ri:{Agu:0,Sep:0},rj:{Agu:0,Sep:0},Agu:{n:0,tot:0,rs:0,los:0},Sep:{n:0,tot:0,rs:0,los:0}};
    ['Agu','Sep'].forEach(p=>{e[j.toLowerCase()][p]+=r[p].n;e[p].n+=r[p].n;e[p].tot+=r[p].tot;e[p].rs+=r[p].rs})}));
  dp.ALL=Object.values(all); o.dpjp=dp;
  const sumKeys=(x,y)=>{const r={};Object.keys(x).concat(Object.keys(y)).forEach(k=>r[k]=0);return r};
  o.losbins={Agu:A.losbins,Sep:B.losbins}; o.losbin_labels=['1','2','3','4','5','6-7','8-14','>14'];
  o.status={};o.age={};o.cara={};o.comp={};o.lag={};o.lag_mean={};o.lag_med={};o.ver={};
  ['RI','RJ'].forEach(j=>{
    o.status[j]={Agu:A.status[j],Sep:B.status[j]};o.age[j]={Agu:A.age[j],Sep:B.age[j]};o.cara[j]={Agu:A.cara[j],Sep:B.cara[j]};
    o.comp[j]={Agu:A.comp[j],Sep:B.comp[j]};o.lag[j]={Agu:A.lag[j],Sep:B.lag[j]};o.lag_mean[j]={Agu:A.lag_mean[j],Sep:B.lag_mean[j]};
    o.lag_med[j]={Agu:A.lag_med[j],Sep:B.lag_med[j]};o.ver[j]={Agu:A.ver[j],Sep:B.ver[j]};
  });
  const pr=KA.pairs[a+'|'+b]; o.pat=pr.pat; o.pvm=pr.pvm;
  o.carry={Agu:A.carry,Sep:B.carry}; o.dupRJ={Agu:A.dupRJ,Sep:B.dupRJ}; o.dupRI={Agu:A.dupRI,Sep:B.dupRI};
  o.diagA={Agu:A.diagA,Sep:B.diagA}; o.chk={Agu:A.checks,Sep:B.checks}; o.recon={Agu:KA.recon[a],Sep:KA.recon[b]};
  return o;
}

const nf = new Intl.NumberFormat('id-ID');
const dec = (n,d=1)=>n.toLocaleString('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function rp(n,full){const a=Math.abs(n),s=n<0?'−':'';if(full)return s+'Rp '+nf.format(Math.round(a));if(a>=1e9)return s+'Rp '+dec(a/1e9,2)+' M';if(a>=1e6)return s+'Rp '+dec(a/1e6,1)+' jt';return s+'Rp '+nf.format(Math.round(a));}
const rpAx = n=>{const a=Math.abs(n);return a>=1e9?dec(n/1e9,1)+' M':a>=1e6?dec(n/1e6,0)+' jt':nf.format(n)};
const pct = (x,d=1)=>dec(x*100,d)+'%';
const sg = (n,f)=> (n>0?'+':n<0?'−':'')+f(Math.abs(n));
// perubahan relatif; good: true = naik baik, false = naik buruk, null = netral
function chg(a,b,good=true){
  if(!a) return b?'<span class="kchip flat">baru</span>':'<span class="kchip flat">–</span>';
  const r=(b-a)/a, up=r>0.0005, dn=r<-0.0005; let c='flat';
  if(good!==null){ if(up) c=good?'good':'bad'; if(dn) c=good?'bad':'good'; }
  return `<span class="kchip ${c}">${up?'▲':dn?'▼':'■'} ${dec(Math.abs(r)*100,1)}%</span>`;
}
function chgPP(a,b,good=true){
  const d=(b-a)*100, up=d>0.05, dn=d<-0.05; let c='flat';
  if(up) c=good?'good':'bad'; if(dn) c=good?'bad':'good';
  return `<span class="kchip ${c}">${up?'▲':dn?'▼':'■'} ${dec(Math.abs(d),1)} pp</span>`;
}
const title = s=>s.toLowerCase().replace(/(^|[\s\/(])([a-z])/g,(m,a,c)=>a+c.toUpperCase());
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const K=(p,j='ALL')=>D.kpi[p][j];
const sum=a=>a.reduce((x,y)=>x+y,0);

/* ---------- chart primitives ---------- */
const W=el=>Math.max(280,Math.floor(el.clientWidth));
const niceMax=v=>{if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p};
const tipCmp=(label,a,s,fmt,good)=>`<b>${esc(label)}</b><br><span class="m">${LA} ${fmt(a)}</span><br><span class="m">${LB} ${fmt(s)}</span>`+(a?`<br>Δ <span class="m">${sg(s-a,x=>fmt(x))} (${a?dec((s-a)/a*100,1):'–'}%)</span>`:'');

const reduceMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ---------- gaya grafik: batang bergradasi membulat, garis halus berpendar, label persentase berbentuk pil ---------- */
let KG=0;const GLOSS=u=>{const C={fa:'--k-agu',fs:'--k-sep',fp:'--k-pos',fn:'--k-neg'};let d='<defs>';
 Object.keys(C).forEach(k=>{
  d+=`<linearGradient id="kb-${k}-v${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(${C[k]})" stop-opacity=".62"/><stop offset="1" style="stop-color:var(${C[k]})" stop-opacity="1"/></linearGradient>`+
     `<linearGradient id="kb-${k}-h${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(${C[k]})" stop-opacity=".62"/><stop offset="1" style="stop-color:var(${C[k]})" stop-opacity="1"/></linearGradient>`});
 d+='<linearGradient id="kga${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--k-agu)" stop-opacity=".30"/><stop offset="1" style="stop-color:var(--k-agu)" stop-opacity="0"/></linearGradient>'+
    '<linearGradient id="kgs${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--k-sep)" stop-opacity=".30"/><stop offset="1" style="stop-color:var(--k-sep)" stop-opacity="0"/></linearGradient></defs>';return d};
function bar3(x,y,w,h,cls,d,dir,i){
  if(!(h>0)||!(w>0)) return '';
  const rx=Math.min(7,w/2,h/2);
  return `<g class="bar ${dir}" style="--i:${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" style="fill:url(#kb-${cls}-${dir==='bv'?'v':'h'}${d})"/></g>`;
}
const legendSvg=(w)=>{const ta=MA.length*6.3,tb=MB.length*6.3,tot=14+ta+30+14+tb,x0=Math.max(0,w/2-tot/2);return `<g class="klg"><rect x="${x0}" y="4" width="10" height="10" rx="2" style="fill:var(--k-agu)"/><text x="${x0+14}" y="13">${MA}</text><rect x="${x0+14+ta+30}" y="4" width="10" height="10" rx="2" style="fill:var(--k-sep)"/><text x="${x0+14+ta+30+14}" y="13">${MB}</text></g>`};
function pill(cx,y,a,s,tone){
  if(!(a>0)) return '';
  const p=(s-a)/a*100; if(!isFinite(p)) return '';
  const txt=Math.abs(p)<0.05?'0%':(p>0?'+':'')+dec(p,1)+'%', wd=txt.length*6+14;
  const c=tone==='flat'||Math.abs(p)<0.05?'f':((p>0)===(tone!=='bad')?'g':'r');
  return `<g class="kpill ${c}"><rect x="${cx-wd/2}" y="${y}" width="${wd}" height="16" rx="8"/><text x="${cx}" y="${y+11.5}" text-anchor="middle">${txt}</text></g>`;
}
function hbars(el,rows,o={}){
  const u=++KG,w=W(el),fmt=o.fmt||nf.format,lw=o.lw||Math.min(Math.floor(w*.42),250),vp=158,rh=38,bh=11,oy=26;
  const max=Math.max(...rows.flatMap(r=>[r.a,r.s]),1),sc=(w-lw-vp)/max;
  let s=`<svg width="${w}" height="${rows.length*rh+oy+6}" role="img" aria-label="${esc(o.title||'Grafik batang')}">${GLOSS(u)}${legendSvg(w)}`;
  rows.forEach((r,i)=>{
    const y=i*rh+oy, wa=r.a*sc, ws=r.s*sc;
    s+=`<g data-ktip="${esc(tipCmp(r.label,r.a,r.s,fmt))}"><rect x="0" y="${y-4}" width="${w}" height="${rh-2}" fill="transparent"/>`+
       `<text class="klbl v" x="0" y="${y+bh+5}">${esc(trunc(r.label,Math.floor(lw/6.3)))}</text>`+
       bar3(lw,y,Math.max(wa,r.a>0?2:0),bh,'fa',u,'bh',i*2)+`<text class="kv" x="${lw+wa+6}" y="${y+bh-1}">${fmt(r.a)}</text>`+
       bar3(lw,y+bh+4,Math.max(ws,r.s>0?2:0),bh,'fs',u,'bh',i*2+1)+`<text class="kv" x="${lw+ws+6}" y="${y+2*bh+3}">${fmt(r.s)}</text>`+
       pill(w-30,y+bh-8,r.a,r.s,o.tone)+`</g>`;
  });
  el.innerHTML=s+'</svg>';
}
function vbars(el,labels,a,sv,o={}){
  const u=++KG,w=W(el),h=(o.h||240)+16,fmt=o.fmt||nf.format,ax=o.ax||fmt,l=o.pct?44:Math.max(40,String(ax(Math.max(...a,...sv))).length*7+10),r=10,t=52,b=26;
  const mx=niceMax(Math.max(...a,...sv)),pw=w-l-r,ph=h-t-b,n=labels.length,gw=pw/n,bw=Math.min(34,gw*.3);
  let s=`<svg width="${w}" height="${h}" role="img" aria-label="${esc(o.title||'Grafik batang')}">${GLOSS(u)}${legendSvg(w)}`;
  for(let i=0;i<=4;i++){const y=t+ph-ph*i/4;s+=`<line class="kgrid" x1="${l}" x2="${w-r}" y1="${y}" y2="${y}"/><text x="${l-6}" y="${y+4}" text-anchor="end">${ax(mx*i/4)}</text>`}
  s+=`<line class="axis" x1="${l}" x2="${w-r}" y1="${t+ph}" y2="${t+ph}"/>`;
  labels.forEach((lb,i)=>{
    const cx=l+gw*i+gw/2,ha=a[i]/mx*ph,hs=sv[i]/mx*ph,top=t+ph-Math.max(ha,hs);
    s+=`<g data-ktip="${esc(tipCmp(lb,a[i],sv[i],fmt))}"><rect x="${l+gw*i}" y="${t-8}" width="${gw}" height="${ph+8}" fill="transparent"/>`+
       bar3(cx-bw-2,t+ph-Math.max(ha,a[i]>0?2:0),bw,Math.max(ha,a[i]>0?2:0),'fa',u,'bv',i*2)+
       bar3(cx+2,t+ph-Math.max(hs,sv[i]>0?2:0),bw,Math.max(hs,sv[i]>0?2:0),'fs',u,'bv',i*2+1);
    if(gw>=86){s+=`<text class="kv" x="${cx-bw/2-2}" y="${t+ph-ha-5}" text-anchor="middle" font-size="10">${fmt(a[i])}</text><text class="kv" x="${cx+bw/2+2}" y="${t+ph-hs-5}" text-anchor="middle" font-size="10">${fmt(sv[i])}</text>`}
    if(gw>=46) s+=pill(cx,Math.max(24,top-(gw>=86?34:22)),a[i],sv[i],o.tone);
    s+=`<text class="klbl" x="${cx}" y="${h-8}" text-anchor="middle">${esc(trunc(lb,Math.floor(gw/6.2)+2))}</text></g>`;
  });
  el.innerHTML=s+'</svg>';
}
function diverge(el,rows,o={}){
  const u=++KG,w=W(el),fmt=o.fmt||nf.format,lw=o.lw||Math.min(Math.floor(w*.42),250),rh=30,p0=lw+92,p1=w-96,bh=13;
  const mn=Math.min(0,...rows.map(r=>r.v)),mx=Math.max(0,...rows.map(r=>r.v)),sc=(p1-p0)/((mx-mn)||1),z=p0+(-mn)*sc;
  let s=`<svg width="${w}" height="${rows.length*rh+10}" role="img" aria-label="${esc(o.title||'Perubahan')}">${GLOSS(u)}`;
  rows.forEach((r,i)=>{
    const y=i*rh+10,bw=Math.abs(r.v)*sc,x=r.v>=0?z:z-bw;
    s+=`<g data-ktip="${esc(r.tip||('<b>'+esc(r.label)+'</b><br><span class=m>'+sg(r.v,fmt)+'</span>'))}"><rect x="0" y="${y-9}" width="${w}" height="${rh-1}" fill="transparent"/>`+
       `<text class="klbl v" x="0" y="${y+bh-2}">${esc(trunc(r.label,Math.floor(lw/6.3)))}</text>`+
       bar3(x,y,Math.max(bw,r.v?2:0),bh,r.v>=0?'fp':'fn',u,'bh',i)+
       `<text class="kv" x="${r.v>=0?x+bw+6:x-6}" y="${y+bh-2}" text-anchor="${r.v>=0?'start':'end'}">${sg(r.v,fmt)}</text></g>`;
  });
  s+=`<line class="axis" x1="${z}" x2="${z}" y1="0" y2="${rows.length*rh+8}"/>`;
  el.innerHTML=s+'</svg>';
}
function lineChart(el,o){
  const u=++KG,w=W(el),h=(o.h||260)+20,l=48,r=14,t=34,b=26,fmt=o.fmt||nf.format,n=Math.max(...o.series.map(s=>s.vals.length));
  const mx=niceMax(Math.max(...o.series.flatMap(s=>s.vals))),pw=w-l-r,ph=h-t-b,X=i=>l+pw*(i/(n-1)),Y=v=>t+ph-ph*v/mx;
  const dn=['Sen','Sel','Rab','Kam','Jum','Sab','Min'],cl=y=>Math.min(t+ph,Math.max(t,y));
  let s=`<svg width="${w}" height="${h}" role="img" aria-label="${esc(o.title||'Tren harian')}">${GLOSS(u)}${legendSvg(w)}`;
  for(let i=0;i<=4;i++){const y=t+ph-ph*i/4;s+=`<line class="kgrid" x1="${l}" x2="${w-r}" y1="${y}" y2="${y}"/><text x="${l-6}" y="${y+4}" text-anchor="end">${(o.ax||fmt)(mx*i/4)}</text>`}
  for(let i=0;i<n;i++) if((i+1)%5===0||i===0) s+=`<text x="${X(i)}" y="${h-8}" text-anchor="middle">${i+1}</text>`;
  s+=`<line class="axis" x1="${l}" x2="${w-r}" y1="${t+ph}" y2="${t+ph}"/>`;
  o.series.forEach((se,k)=>{
    const P=se.vals.map((v,i)=>[X(i),Y(v)]);let path='M'+P[0][0].toFixed(1)+' '+P[0][1].toFixed(1);
    for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;
      path+=`C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)} ${cl(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)} ${cl(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}
    const area=path+`L${P[P.length-1][0].toFixed(1)} ${t+ph}L${P[0][0].toFixed(1)} ${t+ph}Z`;
    s+=`<path class="larea" d="${area}" fill="url(#${se.cls==='sa'?'kga':'kgs'}${u})" style="animation-delay:${k*120+250}ms"/>`+
       `<path class="lsh ${se.cls}" d="${path}" transform="translate(0 6)" pathLength="1" stroke-linejoin="round" style="animation-delay:${k*120}ms"/>`+
       `<path class="lmain ${se.cls}" d="${path}" pathLength="1" stroke-linejoin="round" stroke-linecap="round" style="animation-delay:${k*120}ms"/>`;
  });
  for(let i=0;i<n;i++){
    const tp=`<b>Tanggal ${i+1}</b>`+o.series.map(se=>se.vals[i]===undefined?'':`<br>${se.name} (${dn[se.dow[i]]}): <span class="m">${fmt(se.vals[i])}</span>`).join('');
    s+=`<g class="col" data-ktip="${esc(tp)}"><rect class="hit" x="${X(i)-pw/n/2}" y="${t}" width="${pw/n}" height="${ph}"/><line class="xh" x1="${X(i)}" x2="${X(i)}" y1="${t}" y2="${t+ph}"/>`+
       o.series.map((se,k)=>se.vals[i]===undefined?'':`<circle class="dot ${se.cls==='sa'?'fa':'fs'}" style="animation-delay:${.9+k*.12}s" cx="${X(i)}" cy="${Y(se.vals[i])}" r="3.4"/>`).join('')+`</g>`;
  }
  el.innerHTML=s+'</svg>';
}

/* ---------- pencarian: semua kata harus muncul (urutan bebas, huruf besar/kecil diabaikan) ---------- */
const toks=q=>String(q||'').toLowerCase().split(/\s+/).filter(Boolean);
const matchAll=(s,q)=>{const t=toks(q);return t.every(x=>s.includes(x))};
const hl=(text,q)=>{const low=text.toLowerCase(),m=new Array(text.length).fill(0);toks(q).forEach(t=>{let i=low.indexOf(t);while(i>=0){for(let k=i;k<i+t.length;k++)m[k]=1;i=low.indexOf(t,i+1)}});let out='',inM=false;for(let i=0;i<text.length;i++){if(m[i]&&!inM){out+='<mark>';inM=true}if(!m[i]&&inM){out+='</mark>';inM=false}out+=esc(text[i])}if(inM)out+='</mark>';return out};
function combo(el,o){
  el.classList.add('kcombo');
  el.innerHTML=`<input type="text" class="kcin" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${esc(o.ph)}" aria-label="${esc(o.ph)}"><button type="button" class="kcx" aria-label="Hapus pencarian" hidden>×</button><div class="kclist" role="listbox" hidden></div>`;
  const inp=el.querySelector('input'),list=el.querySelector('.kclist'),x=el.querySelector('.kcx');
  let act=-1,shown=[],picked=null;
  const close=()=>{list.hidden=true;inp.setAttribute('aria-expanded','false');act=-1};
  const open=()=>{list.hidden=false;inp.setAttribute('aria-expanded','true')};
  const draw=()=>{
    const q=inp.value; x.hidden=!q;
    const all=o.items.filter(it=>matchAll(it.s,q));
    shown=all.slice(0,12);
    if(!shown.length){list.innerHTML='<div class="kcempty">Tidak ada yang cocok dengan “'+esc(q)+'”</div>';open();return}
    list.innerHTML=`<div class="kchead">${all.length} hasil${all.length>shown.length?' · tampil '+shown.length+' teratas, ketik lebih spesifik':''}</div>`+
      shown.map((it,i)=>`<div class="kcitem" role="option" data-i="${i}"><div class="kct">${hl(it.text,q)}</div><div class="kcs">${esc(it.sub||'')}</div></div>`).join('');
    open();
  };
  const mark=()=>list.querySelectorAll('.kcitem').forEach((e,i)=>{e.classList.toggle('on',i===act);if(i===act)e.scrollIntoView({block:'nearest'})});
  const pick=it=>{picked=it;inp.value=it.text;x.hidden=false;close();o.onPick(it)};
  const clear=()=>{picked=null;inp.value='';x.hidden=true;close();o.onPick(null);o.onType('')};
  inp.addEventListener('input',()=>{picked=null;o.onPick(null);o.onType(inp.value);draw()});
  inp.addEventListener('focus',()=>{if(!picked)draw()});
  inp.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)draw();act=Math.min(act+1,shown.length-1);mark()}
    else if(e.key==='ArrowUp'){e.preventDefault();act=Math.max(act-1,0);mark()}
    else if(e.key==='Enter'){if(act>=0&&shown[act]){e.preventDefault();pick(shown[act])}}
    else if(e.key==='Escape'){close()}
  });
  list.addEventListener('mousedown',e=>{const it=e.target.closest('.kcitem');if(it){e.preventDefault();pick(shown[+it.dataset.i])}});
  x.addEventListener('click',()=>{clear();inp.focus()});
  document.addEventListener('mousedown',e=>{if(!el.contains(e.target))close()});
}

/* ---------- table ---------- */
window.KPG=window.KPG||{size:10};
function table(el,cols,rows,o={}){
  let sk=o.sort||cols[0].k,asc=!!o.asc,q='',only=null,page=1;
  let pg=el.nextElementSibling;
  if(!(pg&&pg.classList&&pg.classList.contains('kpager'))){pg=document.createElement('div');pg.className='kpager';el.insertAdjacentElement('afterend',pg)}
  const SIZES=[10,100,500];
  const draw=(scroll)=>{
    let rs=rows.filter(r=>(!q||matchAll(r._s||'',q))&&(!only||only(r)));
    const c=cols.find(c=>c.k===sk);
    rs=rs.slice().sort((x,y)=>{const a=c.v(x),b=c.v(y);const d=(typeof a==='string')?a.localeCompare(b,'id'):(a-b);return asc?d:-d});
    const size=window.KPG.size,pages=Math.max(1,Math.ceil(rs.length/size));
    if(page>pages)page=pages;
    const st=(page-1)*size,sl=rs.slice(st,st+size);
    el.querySelector('tbody').innerHTML=sl.map(r=>'<tr>'+cols.map(c=>`<td class="${c.cls||'num'}">${c.f(r)}</td>`).join('')+'</tr>').join('')+(rs.length?'':`<tr><td class="l" colspan="${cols.length}">Tidak ada baris yang cocok.</td></tr>`);
    el.querySelectorAll('th').forEach(th=>{const on=th.dataset.k===sk;th.classList.toggle('sorted',on);th.classList.toggle('asc',on&&asc)});
    if(o.count) o.count.textContent=nf.format(rs.length)+' baris';
    /* pager: pilihan jumlah baris per halaman + nomor halaman */
    if(rs.length<=SIZES[0]){pg.innerHTML='';pg.hidden=true}
    else{
      pg.hidden=false;
      const nums=[];const add=n=>{if(n>=1&&n<=pages&&!nums.includes(n))nums.push(n)};
      add(1);for(let i=page-2;i<=page+2;i++)add(i);add(pages);nums.sort((a,b)=>a-b);
      let btns='',prev=0;
      nums.forEach(n=>{if(prev&&n-prev>1)btns+='<span class="kpg-gap" aria-hidden="true">…</span>';btns+=`<button type="button" class="kpg-btn${n===page?' on':''}" data-pg="${n}" aria-label="Halaman ${n}"${n===page?' aria-current="page"':''}>${n}</button>`;prev=n});
      pg.innerHTML=`<div class="kpg-top"><span class="kpg-lbl">Tampilkan</span><span class="kseg kpg-sz" role="group" aria-label="Jumlah baris per halaman">${SIZES.map(s=>`<button type="button" aria-pressed="${s===size}" data-sz="${s}">${s}</button>`).join('')}</span><span class="kpg-lbl">baris &middot; menampilkan ${nf.format(st+1)}&ndash;${nf.format(Math.min(st+size,rs.length))} dari ${nf.format(rs.length)}</span></div>`+
        (pages>1?`<div class="kpg-nav" role="navigation" aria-label="Halaman tabel"><button type="button" class="kpg-btn" data-pg="${page-1}" aria-label="Halaman sebelumnya"${page===1?' disabled':''}>&lsaquo;</button>${btns}<button type="button" class="kpg-btn" data-pg="${page+1}" aria-label="Halaman berikutnya"${page===pages?' disabled':''}>&rsaquo;</button></div>`:'');
    }
    if(scroll&&el.getBoundingClientRect().top<70)el.scrollIntoView({block:'start'});
  };
  pg.onclick=e=>{
    const s=e.target.closest('[data-sz]');
    if(s){window.KPG.size=+s.dataset.sz;page=1;draw(true);return}
    const b=e.target.closest('[data-pg]');
    if(b&&!b.disabled){page=+b.dataset.pg;draw(true)}
  };
  el.innerHTML=`<table><thead><tr>${cols.map(c=>`<th tabindex="0" data-k="${c.k}" class="${c.cls==='l'?'l':'num'}">${c.h}</th>`).join('')}</tr></thead><tbody></tbody></table>`;
  el.querySelectorAll('th').forEach(th=>{const f=()=>{const k=th.dataset.k;if(sk===k)asc=!asc;else{sk=k;asc=cols.find(c=>c.k===k).cls==='l'}page=1;draw()};th.onclick=f;th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}}});
  draw();
  return {search:v=>{q=v;page=1;draw()},only:f=>{only=f;page=1;draw()}};
}

function seg(id,opts,cur,cb){
  const el=document.getElementById('dk-'+id);
  const paint=()=>{el.innerHTML=opts.map(o=>`<button type="button" aria-pressed="${o[0]===cur}" data-v="${o[0]}">${o[1]}</button>`).join('')};
  paint();
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;cur=b.dataset.v;paint();cb(cur)};
}

/* ---------- derived data ---------- */
const JN={ALL:'Semua',RI:'Rawat Inap',RJ:'Rawat Jalan'};
const codes=j=>D.inacbg[j].map(r=>({code:r.k,desc:title(r.d),Agu:r.Agu,Sep:r.Sep,dt:r.Sep.tot-r.Agu.tot,dn:r.Sep.n-r.Agu.n,defA:r.Agu.rs-r.Agu.tot,defS:r.Sep.rs-r.Sep.tot}));
let eff,daily,perDay,rjCodes,riCodes,dial,viral,dA=30,dB=30,idrgOK=false;
const cov=(p,j='ALL')=>{const k=K(p,j);return k.n?k.n_idrg/k.n:0};
function prepare(a,b){
  KEYA=a;KEYB=b;MA=mfullK(a);MB=mfullK(b);LA=mlabK(a);LB=mlabK(b);
  D=compose(a,b);eff=D.eff;daily=D.daily;
  dA=daily.Agu.dow.length;dB=daily.Sep.dow.length;
  const e1=Math.max(1,eff.Agu.eff),e2=Math.max(1,eff.Sep.eff);
  perDay={rjWd:[eff.Agu.rj_wd/e1,eff.Sep.rj_wd/e2],rjWdRev:[eff.Agu.rj_wd_tot/e1,eff.Sep.rj_wd_tot/e2],
    ri:[K('Agu','RI').n/dA,K('Sep','RI').n/dB],riRev:[K('Agu','RI').tot/dA,K('Sep','RI').tot/dB]};
  rjCodes=codes('RJ');riCodes=codes('RI');
  dial=rjCodes.find(c=>c.code==='N-3-15-0')||null;viral=riCodes.find(c=>c.code==='A-4-13-I')||null;
  idrgOK=cov('Agu')>=0.99&&cov('Sep')>=0.99;
}
const fl=v=>v==null?'–':v;
const hol=e=>e.hol.length?` (Senin–Jumat tanggal ${e.hol.join(', ')} dengan klaim rawat jalan di bawah 100, diduga libur)`:'';
/* ---------- KPI ---------- */
const KC=[];
/* angka berputar naik seperti meteran pompa bensin: tiap digit adalah kolom 0-9 yang bergulir dari bawah ke atas */
function odo(e,txt){
  const ch=[...txt],nd=ch.filter(c=>c>='0'&&c<='9').length;let pos=0,html='';
  ch.forEach(c=>{
    if(c>='0'&&c<='9'){const rank=nd-1-pos,end=(+c)+10*(rank<3?2:1);let strip='';for(let k=0;k<30;k++)strip+='<i>'+(k%10)+'</i>';
      html+=`<span class="od" aria-hidden="true"><span class="odc" style="--end:${end};--dl:${(pos*0.06).toFixed(2)}s">${strip}</span></span>`;pos++}
    else html+=`<span class="oc" aria-hidden="true">${esc(c)}</span>`;
  });
  e.setAttribute('aria-label',txt);e.innerHTML=html;e.classList.remove('go');
  requestAnimationFrame(()=>requestAnimationFrame(()=>e.classList.add('go')));
}
function countUp(root){
  if(reduceMotion())return;
  root.querySelectorAll('[data-cu]').forEach(e=>{const [v,f]=KC[+e.dataset.cu];odo(e,f(v))});
}
function kpiCards(j){
  const a=K('Agu',j),s=K('Sep',j);
  const card=(lab,va,vs,f,ch,hint)=>`<div class="kpi-card k-kpi"><div class="klab">${lab}</div><div class="kval" data-cu="${KC.push([vs,f])-1}">${f(vs)}</div><div class="krow"><span class="a">${LA} <b>${f(va)}</b></span><span class="s">${LB} ${ch}</span></div>${hint?`<div class="khint">${hint}</div>`:''}</div>`;
  return '<div class="kgrid kkpis">'+
   card('Jumlah klaim',a.n,s.n,nf.format,chg(a.n,s.n,true))+
   card('Pendapatan klaim INA-CBG',a.tot,s.tot,rp,chg(a.tot,s.tot,true),'Total tarif yang diajukan')+
   card('Tarif RS atas layanan sama',a.rs,s.rs,rp,chg(a.rs,s.rs,null))+
   card('Defisit klaim vs Tarif RS',-a.sel,-s.sel,rp,chg(-a.sel,-s.sel,false),'Tarif RS dikurangi klaim')+
   card('Rasio klaim / Tarif RS',a.tot/a.rs,s.tot/s.rs,x=>pct(x),chgPP(a.tot/a.rs,s.tot/s.rs,true),'Makin rendah, makin besar selisih')+
   card('Rata-rata klaim per kasus',a.tot/a.n,s.tot/s.n,rp,chg(a.tot/a.n,s.tot/s.n,null))+
   card(j==='RI'?'Pasien rawat inap unik':'Pasien unik (No. RM)',a.pat,s.pat,nf.format,chg(a.pat,s.pat,true))+
  '</div>';
}

/* ---------- tabs ---------- */
const TABS=[['ringkasan','Ringkasan'],['tren','Tren harian'],['ri','Rawat inap'],['rj','Rawat jalan'],['defisit','Defisit tarif'],['casemix','Case-mix & INA-CBG'],['dpjp','DPJP'],['biaya','Komponen biaya'],['proses','Proses & iDRG'],['data','Kualitas data']];
const rendered={};
const R={};
let curTab='ringkasan';
const nav=document.getElementById('dk-tabs');
nav.innerHTML=TABS.map(t=>`<button type="button" role="tab" data-t="${t[0]}" aria-selected="false">${t[1]}</button>`).join('');
function show(id){
  if(!TABS.some(t=>t[0]===id)) id='ringkasan';
  curTab=id;
  nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===id));
  document.querySelectorAll('#duoK .dkview').forEach(s=>s.classList.toggle('active',s.id==='dkview-'+id));
  if(!rendered[id]){R[id]();rendered[id]=1}
}
nav.onclick=e=>{const b=e.target.closest('button');if(b)show(b.dataset.t)};
const visible=()=>{const r=document.getElementById('duoK');return r&&!r.hidden};
let rz,lastW=window.innerWidth;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(!visible()||window.innerWidth===lastW)return;lastW=window.innerWidth;Object.keys(rendered).forEach(k=>delete rendered[k]);show(curTab)},180)});

/* ===== Ringkasan ===== */
R.ringkasan=()=>{
  const el=document.getElementById('dkview-ringkasan'),a=K('Agu'),s=K('Sep'),ar=K('Agu','RI'),sr=K('Sep','RI'),aj=K('Agu','RJ'),sj=K('Sep','RJ');
  const dRev=s.tot-a.tot;
  const pc=(x,y)=>sg((y/x-1)*100,v=>dec(v,1))+'%';
  const F=[],I=[];
  /* temuan */
  F.push(`<li><b>Pendapatan klaim ${dRev>=0?'naik':'turun'} ${rp(Math.abs(dRev))} (${pc(a.tot,s.tot)})</b>, dari ${rp(a.tot)} (${LA}) ke ${rp(s.tot)} (${LB}); jumlah klaim ${nf.format(a.n)} → ${nf.format(s.n)} (${pc(a.n,s.n)}). Rawat inap ${sg(sr.tot-ar.tot,rp)}, rawat jalan ${sg(sj.tot-aj.tot,rp)}.</li>`);
  const rjAll=sj.n/aj.n-1, rjDay=perDay.rjWd[1]/perDay.rjWd[0]-1, calend=Math.abs(rjAll-rjDay)>=0.03;
  F.push(`<li class="${calend?'w':''}"><b>${calend?'Jumlah hari kerja memengaruhi perbandingan rawat jalan.':'Rawat jalan per hari kerja bergerak searah dengan totalnya.'}</b> ${LA}: ${eff.Agu.eff} hari kerja efektif${hol(eff.Agu)}; ${LB}: ${eff.Sep.eff}${hol(eff.Sep)}. Klaim rawat jalan total ${sg(rjAll*100,v=>dec(v,1))}%, per hari kerja ${sg(rjDay*100,v=>dec(v,1))}% (${nf.format(Math.round(perDay.rjWd[0]))} → ${nf.format(Math.round(perDay.rjWd[1]))} klaim/hari); pendapatan rawat jalan per hari kerja ${sg((perDay.rjWdRev[1]/perDay.rjWdRev[0]-1)*100,v=>dec(v,1))}%.</li>`);
  const up=riCodes.slice().sort((x,y)=>y.dt-x.dt)[0], dn=riCodes.slice().sort((x,y)=>x.dt-y.dt)[0];
  let diagNote='';
  if(up&&up.code==='A-4-13-I'){const da=D.diagA.Agu,db=D.diagA.Sep;const ks=[...new Set(Object.keys(da).concat(Object.keys(db)))].slice(0,3);if(ks.length)diagNote=` Diagnosis utama kelompok ini: ${ks.map(k=>k+' ('+(da[k]||0)+' → '+(db[k]||0)+')').join(', ')}.`}
  F.push(`<li><b>Rawat inap ${sr.n>=ar.n?'naik':'turun'} ${dec(Math.abs((sr.n/ar.n-1)*100),1)}% dalam jumlah klaim</b> (${dec(perDay.ri[0],1)} → ${dec(perDay.ri[1],1)} per hari kalender), rata-rata klaim per kasus ${pc(ar.tot/ar.n,sr.tot/sr.n)} (${rp(ar.tot/ar.n)} → ${rp(sr.tot/sr.n)}).${up?` Perubahan pendapatan terbesar: ${esc(up.desc)} (${esc(up.code)}), ${up.Agu.n} → ${up.Sep.n} kasus (${sg(up.dt,rp)})${dn&&dn.dt<0?`; berlawanan arah, ${esc(dn.desc)} (${esc(dn.code)}) ${sg(dn.dt,rp)}`:''}.`:''}${diagNote}</li>`);
  const defA=-a.sel, defB=-s.sel, topDef=riCodes.concat(rjCodes).sort((x,y)=>y.defS-x.defS)[0];
  if(defA>0){const defR=defB/defA-1;
    F.push(`<li class="${defR>0.02?'r':defR<-0.02?'g':''}"><b>Defisit terhadap Tarif RS ${defR>=0?'melebar':'menyempit'} ${dec(Math.abs(defR)*100,1)}%</b>: ${rp(defA)} → ${rp(defB)}; rasio klaim/Tarif RS ${pct(a.tot/a.rs)} → ${pct(s.tot/s.rs)}. ${topDef?`Penyumbang defisit terbesar ${LB}: ${esc(topDef.desc)} (${rp(topDef.defS)}).`:''}${dial&&(sj.rs-sj.tot)>0?` Dialisis rawat jalan sendiri ${rp(dial.defS)} atau ${pct(dial.defS/(sj.rs-sj.tot),0)} dari defisit rawat jalan.`:''}</li>`);}
  const lmJ=D.lag_med.RJ,lmI=D.lag_med.RI;
  if(lmJ.Agu!=null&&lmJ.Sep!=null){const better=lmJ.Sep<lmJ.Agu;
    F.push(`<li class="${better?'g':lmJ.Sep>lmJ.Agu?'w':''}"><b>Proses klaim ${better?'lebih cepat':lmJ.Sep>lmJ.Agu?'lebih lambat':'setara'}.</b> Median jarak tanggal pulang ke tanggal grouping di berkas: rawat jalan ${fl(lmJ.Agu)} → ${fl(lmJ.Sep)} hari, rawat inap ${fl(lmI.Agu)} → ${fl(lmI.Sep)} hari. Ini membaca penanda waktu di berkas, bukan status verifikasi BPJS; selisihnya juga dipengaruhi tanggal penarikan berkas (${pullTxt(KEYA)} dan ${pullTxt(KEYB)}).</li>`);}
  if(idrgOK) F.push(`<li class="w"><b>Simulasi iDRG di berkas</b> menghasilkan ${rp(s.idrg)} untuk ${LB}, ${sg((s.idrg/s.tot-1)*100,v=>dec(v,1))}% terhadap klaim INA-CBG dan ${pct(s.idrg/s.rs,1)} dari Tarif RS. Angka indikatif, belum tentu tarif pembayaran yang berlaku.</li>`);
  else F.push(`<li class="w"><b>Simulasi iDRG tidak dibandingkan:</b> cakupan data iDRG di berkas ${LA} ${pct(cov('Agu'),0)} dan ${LB} ${pct(cov('Sep'),0)} dari klaim.</li>`);
  /* implikasi */
  I.push(`<li><b>Minta rekap status verifikasi BPJS</b> (layak, pending, dispute) untuk ${MA} dan ${MB}. Berkas klaim hanya memuat klaim yang diajukan, sehingga nilai layak bayar dan piutang belum dapat dihitung dari sini. Jika laporan pending kedua bulan tersedia, pilih mode Pending di atas untuk melihat klaim yang tertahan.</li>`);
  const tops=riCodes.concat(rjCodes).sort((x,y)=>y.defS-x.defS).slice(0,3).filter(c=>c.defS>0);
  if(tops.length) I.push(`<li><b>Telaah biaya layanan dengan jarak tarif terbesar</b> (${tops.map(c=>esc(c.desc)).join('; ')}). Tarif RS bukan unit cost; lakukan costing riil sebelum menyimpulkan kerugian.</li>`);
  if(up&&up.dt>0&&(up.Sep.n-up.Agu.n)>=10) I.push(`<li><b>Audit kodefikasi dan kebutuhan klinis ${esc(up.desc)}</b>, kelompok dengan kenaikan pendapatan terbesar pada rawat inap (${up.Agu.n} → ${up.Sep.n} kasus). Pastikan spesifisitas diagnosis wajar dan konsisten dengan data surveilans atau kejadian klinis.</li>`);
  if(calend) I.push(`<li><b>Gunakan metrik per hari kerja</b> untuk membandingkan rawat jalan antarbulan; perbandingan bulanan mentah menyesatkan ketika jumlah hari kerja berbeda.</li>`);
  const s5a=D.status.RJ.Agu['5']||0,s5b=D.status.RJ.Sep['5']||0;
  if(Math.abs(s5b-s5a)>=Math.max(20,0.25*Math.max(s5a,1))) I.push(`<li><b>Telaah klaim rawat jalan berstatus pulang “lain-lain”</b> yang berubah dari ${s5a} ke ${s5b} kasus; cek proses entri status pulang.</li>`);
  el.innerHTML=`
  <div class="ktoolbar"><span class="kl">Tampilkan KPI untuk</span><div class="kseg" id="dk-kseg"></div></div>
  <div id="dk-kpis"></div>
  <h3 class="ksect">Temuan utama</h3>
  <div class="card"><ul class="kfind">${F.join('')}</ul></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Dari mana perubahan pendapatan berasal</h2><p class="knote">Dekomposisi per jenis layanan: efek volume (jumlah klaim berubah pada bauran dan tarif ${LA}), efek bauran (kelompok INA-CBG yang lebih berat atau ringan), dan efek harga (tarif per kombinasi kode dan kelas berubah antarbulan).</p><div id="dk-c-pvm"></div>
     <div class="ksmall" style="margin-top:8px">Total perubahan ${sg(dRev,rp)}.</div></div>
   <div class="card"><h2>Klaim vs Tarif RS per jenis layanan</h2><p class="knote">Selisih antara batang adalah defisit tarif.</p><div id="dk-c-rs"></div></div>
  </div>
  <h3 class="ksect">Implikasi dan tindak lanjut</h3>
  <div class="card"><ul class="kfind">${I.join('')}</ul></div>`;
  const draw=j=>{const e=document.getElementById('dk-kpis');e.innerHTML=kpiCards(j);countUp(e)};
  seg('kseg',[['ALL','Semua'],['RI','Rawat inap'],['RJ','Rawat jalan']],'ALL',draw);draw('ALL');
  const pv=D.pvm;
  diverge(document.getElementById('dk-c-pvm'),[
    {label:'Rawat inap · volume',v:pv.RI.vol},{label:'Rawat inap · bauran',v:pv.RI.mix},
    {label:'Rawat jalan · volume',v:pv.RJ.vol},{label:'Rawat jalan · bauran',v:pv.RJ.mix},
    ...(Math.abs(pv.RI.price)+Math.abs(pv.RJ.price)>1?[{label:'Rawat inap · harga',v:pv.RI.price},{label:'Rawat jalan · harga',v:pv.RJ.price}]:[]),
    {label:'Total perubahan',v:dRev}],{fmt:x=>rp(x),lw:140,title:'Dekomposisi perubahan pendapatan'});
  hbars(document.getElementById('dk-c-rs'),[
    {label:'Rawat inap · klaim',a:ar.tot,s:sr.tot},{label:'Rawat inap · Tarif RS',a:ar.rs,s:sr.rs},
    {label:'Rawat jalan · klaim',a:aj.tot,s:sj.tot},{label:'Rawat jalan · Tarif RS',a:aj.rs,s:sj.rs}],{fmt:rp,lw:140,title:'Klaim dan Tarif RS'});
};

/* ===== Tren ===== */
R.tren=()=>{
  const el=document.getElementById('dkview-tren');
  const dn=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  const dowSum=(p,j)=>{const r=[0,0,0,0,0,0,0];daily[p][j].n.forEach((v,i)=>r[daily[p].dow[i]]+=v);return r};
  el.innerHTML=`
  <div class="card"><h2>Klaim per tanggal pulang</h2><p class="knote">Sumbu x adalah tanggal dalam bulan; arahkan kursor untuk melihat hari dan nilainya. Rawat jalan hampir berhenti di Minggu dan hari libur, rawat inap berjalan setiap hari. Jumlah hari tiap bulan bisa berbeda.</p>
   <div class="ktoolbar"><div class="kseg" id="dk-sj"></div><div class="kseg" id="dk-sm"></div></div><div id="dk-c-line"></div></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Normalisasi hari kerja</h2><p class="knote">Hari kerja efektif: Senin–Jumat dengan sedikitnya 100 klaim rawat jalan. Hari Senin–Jumat di bawah ambang itu: ${LA} ${eff.Agu.hol.length?'tanggal '+eff.Agu.hol.join(', '):'tidak ada'}; ${LB} ${eff.Sep.hol.length?'tanggal '+eff.Sep.hol.join(', '):'tidak ada'}. Diduga libur; ini inferensi dari data, bukan kalender resmi.</p><div class="ktbl" id="dk-tb-norm"></div></div>
   <div class="card"><h2>Klaim rawat jalan menurut hari dalam minggu</h2><p class="knote">Total klaim per hari dalam minggu. Jumlah tiap hari dalam minggu berbeda antarbulan: ${LA} memuat ${daily.Agu.dow.filter(d=>d===5).length} Sabtu dan ${daily.Agu.dow.filter(d=>d===6).length} Minggu, ${LB} ${daily.Sep.dow.filter(d=>d===5).length} Sabtu dan ${daily.Sep.dow.filter(d=>d===6).length} Minggu.</p><div id="dk-c-dow"></div></div>
  </div>`;
  let jj='RJ',mm='n';
  const draw=()=>{
    const f=mm==='n'?nf.format:rp;
    lineChart(document.getElementById('dk-c-line'),{series:[
      {name:'Agu',cls:'sa',vals:daily.Agu[jj][mm],dow:daily.Agu.dow},{name:'Sep',cls:'ss',vals:daily.Sep[jj][mm],dow:daily.Sep.dow}],fmt:f,ax:mm==='n'?nf.format:rpAx,title:'Tren harian'});
  };
  seg('sj',[['RJ','Rawat jalan'],['RI','Rawat inap']],jj,v=>{jj=v;draw()});
  seg('sm',[['n','Jumlah klaim'],['tot','Pendapatan']],mm,v=>{mm=v;draw()});
  draw();
  const rows=[
    ['Hari kalender',dA,dB,null,nf.format],['Hari Senin–Jumat',eff.Agu.weekdays,eff.Sep.weekdays,null,nf.format],['Hari kerja efektif',eff.Agu.eff,eff.Sep.eff,true,nf.format],
    ['Klaim RJ total',K('Agu','RJ').n,K('Sep','RJ').n,true,nf.format],
    ['Klaim RJ per hari kerja efektif',perDay.rjWd[0],perDay.rjWd[1],true,x=>dec(x,1)],
    ['Pendapatan RJ per hari kerja efektif',perDay.rjWdRev[0],perDay.rjWdRev[1],true,rp],
    ['Klaim RI per hari kalender',perDay.ri[0],perDay.ri[1],true,x=>dec(x,1)],
    ['Pendapatan RI per hari kalender',perDay.riRev[0],perDay.riRev[1],true,rp]];
  document.getElementById('dk-tb-norm').innerHTML='<table><thead><tr><th class="l">Ukuran</th><th class="num">'+LA+'</th><th class="num">'+LB+'</th><th class="num">Δ</th></tr></thead><tbody>'+
    rows.map(r=>`<tr><td class="l">${r[0]}</td><td class="num">${r[4](r[1])}</td><td class="num">${r[4](r[2])}</td><td class="num">${r[3]===null?'<span class="kchip flat">'+sg(r[2]-r[1],nf.format)+'</span>':chg(r[1],r[2],r[3])}</td></tr>`).join('')+'</tbody></table>';
  vbars(document.getElementById('dk-c-dow'),dn,dowSum('Agu','RJ'),dowSum('Sep','RJ'),{tone:'flat',title:'Klaim RJ menurut hari'});
};

/* ===== RI / RJ ===== */
function jenisTab(j){
  const el=document.getElementById('dkview-'+j.toLowerCase()),cs=j==='RI'?riCodes:rjCodes,pre=j.toLowerCase();
  const top=cs.slice().sort((x,y)=>y.Sep.tot-x.Sep.tot).slice(0,10);
  const movers=cs.slice().sort((x,y)=>y.dt-x.dt);
  const mv=movers.slice(0,6).concat(movers.slice(-6).reverse().filter(x=>x.dt<0));
  const lab=c=>c.code+' '+c.desc;
  el.innerHTML=kpiCards(j)+`
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>10 kelompok INA-CBG terbesar (pendapatan)</h2><p class="knote">Urut menurut pendapatan ${MB}.</p><div id="dk-${pre}-top"></div></div>
   <div class="card"><h2>Perubahan pendapatan terbesar per kelompok</h2><p class="knote">Enam kenaikan dan enam penurunan terbesar, ${MB} dikurangi ${MA}.</p><div id="dk-${pre}-mv"></div></div>
   ${j==='RI'?`<div class="card"><h2>Kelas rawat</h2><p class="knote">Jumlah klaim per kelas hak rawat.</p><div id="dk-ri-kelas"></div></div>
   <div class="card"><h2>Tingkat keparahan (severity)</h2><p class="knote">Jumlah klaim. ${D.sev.map(r=>'Keparahan '+r.k+': '+r.Agu.n+' → '+r.Sep.n).join(' · ')}.</p><div id="dk-ri-sev"></div></div>
   <div class="card"><h2>Lama rawat (hari)</h2><p class="knote">Distribusi klaim menurut LOS. Rata-rata ${dec(K('Agu','RI').los/K('Agu','RI').n,2)} hari di ${MA}, ${dec(K('Sep','RI').los/K('Sep','RI').n,2)} di ${MB}.</p><div id="dk-ri-los"></div></div>
   <div class="card"><h2>Kelas rawat: pendapatan vs Tarif RS</h2><p class="knote">Rasio klaim terhadap Tarif RS per kelas.</p><div class="ktbl" id="dk-ri-kelas-t"></div></div>`:''}
   <div class="card"><h2>Kelompok usia</h2><p class="knote">Jumlah klaim.</p><div id="dk-${pre}-age"></div></div>
   <div class="card"><h2>Status pulang</h2><p class="knote">1 atas persetujuan dokter · 2 dirujuk · 3 atas permintaan sendiri · 4 meninggal · 5 lain-lain.</p><div id="dk-${pre}-st"></div></div>
  </div>`;
  const g=id=>document.getElementById('dk-'+id); countUp(el);
  hbars(g(pre+'-top'),top.map(c=>({label:lab(c),a:c.Agu.tot,s:c.Sep.tot})),{fmt:rp,title:'Top kelompok'});
  diverge(g(pre+'-mv'),mv.map(c=>({label:lab(c),v:c.dt,tip:`<b>${esc(lab(c))}</b><br>Klaim ${c.Agu.n} → ${c.Sep.n}<br>Pendapatan <span class=m>${rp(c.Agu.tot)} → ${rp(c.Sep.tot)}</span>`})),{fmt:rp,title:'Perubahan terbesar'});
  const ages=['0–4','5–17','18–44','45–59','60+'];
  vbars(g(pre+'-age'),ages,D.age[j].Agu,D.age[j].Sep,{tone:'flat',title:'Usia'});
  const st={'1':'Persetujuan dokter','2':'Dirujuk','3':'Permintaan sendiri','4':'Meninggal','5':'Lain-lain'};
  const ks=Object.keys(st);
  vbars(g(pre+'-st'),ks.map(k=>st[k]),ks.map(k=>D.status[j].Agu[k]||0),ks.map(k=>D.status[j].Sep[k]||0),{tone:'flat',title:'Status pulang',h:240});
  if(j==='RI'){
    const kl=D.kelas;
    vbars(g('ri-kelas'),kl.map(r=>'Kelas '+r.k),kl.map(r=>r.Agu.n),kl.map(r=>r.Sep.n),{tone:'flat',title:'Kelas rawat'});
    const sv=D.sev;
    vbars(g('ri-sev'),sv.map(r=>'Severity '+r.k),sv.map(r=>r.Agu.n),sv.map(r=>r.Sep.n),{tone:'flat',title:'Severity'});
    vbars(g('ri-los'),D.losbin_labels,D.losbins.Agu,D.losbins.Sep,{tone:'flat',title:'LOS'});
    g('ri-kelas-t').innerHTML='<table><thead><tr><th class="l">Kelas</th><th class="num">Rasio '+LA+'</th><th class="num">Rasio '+LB+'</th><th class="num">Klaim/kasus '+LB+'</th></tr></thead><tbody>'+
      kl.map(r=>`<tr><td class="l">Kelas ${r.k}</td><td class="num">${pct(r.Agu.tot/r.Agu.rs)}</td><td class="num">${pct(r.Sep.tot/r.Sep.rs)}</td><td class="num">${rp(r.Sep.tot/r.Sep.n)}</td></tr>`).join('')+'</tbody></table>';
  }
}
R.ri=()=>jenisTab('RI'); R.rj=()=>jenisTab('RJ');

/* ===== Defisit ===== */
R.defisit=()=>{
  const el=document.getElementById('dkview-defisit');
  const row=(lab,j)=>{const a=K('Agu',j),s=K('Sep',j);return `<tr><td class="l">${lab}</td><td class="num">${rp(a.tot)}</td><td class="num">${rp(s.tot)}</td><td class="num">${rp(a.rs)}</td><td class="num">${rp(s.rs)}</td><td class="num">${rp(-a.sel)}</td><td class="num">${rp(-s.sel)}</td><td class="num">${pct(a.tot/a.rs)}</td><td class="num">${pct(s.tot/s.rs)}</td><td class="num">${pct(a.def_n/a.n,0)} → ${pct(s.def_n/s.n,0)}</td></tr>`};
  el.innerHTML=`
  <div class="kcaveat"><b>Cara membaca.</b> Defisit di sini adalah Tarif RS dikurangi Total Tarif INA-CBG per klaim. Tarif RS adalah tarif layanan menurut rumah sakit, bukan biaya produksi, sehingga angka ini menunjukkan jarak tarif, bukan kerugian akuntansi. Kolom defisit adalah selisih neto: klaim yang dibayar di atas Tarif RS sudah mengurangi defisit. Nilai bruto defisit dan surplus dipisah di tabel kanan bawah.</div>
  <div class="card" style="margin-top:14px"><h2>Ringkasan selisih</h2><div class="ktbl"><table><thead><tr><th class="l">Jenis</th><th class="num">Klaim ${LA}</th><th class="num">Klaim ${LB}</th><th class="num">Tarif RS ${LA}</th><th class="num">Tarif RS ${LB}</th><th class="num">Defisit ${LA}</th><th class="num">Defisit ${LB}</th><th class="num">Rasio ${LA}</th><th class="num">Rasio ${LB}</th><th class="num">Klaim di bawah Tarif RS</th></tr></thead><tbody>${row('Rawat inap','RI')}${row('Rawat jalan','RJ')}<tr class="tot">${row('Total','ALL').slice(4)}</tbody></table></div></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Defisit terbesar · rawat jalan</h2><p class="knote">Tarif RS dikurangi klaim, per kelompok INA-CBG. Urut menurut ${MB}.</p><div id="dk-d-rj"></div></div>
   <div class="card"><h2>Defisit terbesar · rawat inap</h2><p class="knote">Sama seperti di kiri.</p><div id="dk-d-ri"></div></div>
   <div class="card"><h2>Kasus dengan klaim di bawah Tarif RS</h2><p class="knote">Jumlah klaim yang mengalami defisit.</p><div id="dk-d-n"></div></div>
   <div class="card"><h2>Defisit dan surplus bruto</h2><p class="knote">Jumlah selisih klaim yang di bawah (defisit) dan di atas (surplus) Tarif RS, sebelum dinetralkan.</p><div class="ktbl" id="dk-d-gs"></div></div>
  </div>`;
  const tops=cs=>cs.slice().sort((x,y)=>y.defS-x.defS).slice(0,8).map(c=>({label:c.code+' '+c.desc,a:Math.max(c.defA,0),s:Math.max(c.defS,0)}));
  hbars(document.getElementById('dk-d-rj'),tops(rjCodes),{fmt:rp,title:'Defisit RJ',tone:'bad'});
  hbars(document.getElementById('dk-d-ri'),tops(riCodes),{fmt:rp,title:'Defisit RI',tone:'bad'});
  vbars(document.getElementById('dk-d-n'),['Rawat inap','Rawat jalan'],[K('Agu','RI').def_n,K('Agu','RJ').def_n],[K('Sep','RI').def_n,K('Sep','RJ').def_n],{tone:'bad',title:'Kasus defisit'});
  const gs=j=>{const a=K('Agu',j),s=K('Sep',j);return `<tr><td class="l">${JN[j]}</td><td class="num">${rp(a.def_amt)}</td><td class="num">${rp(s.def_amt)}</td><td class="num">${rp(a.sur_amt)}</td><td class="num">${rp(s.sur_amt)}</td></tr>`};
  document.getElementById('dk-d-gs').innerHTML='<table><thead><tr><th class="l">Jenis</th><th class="num">Defisit bruto '+LA+'</th><th class="num">Defisit bruto '+LB+'</th><th class="num">Surplus bruto '+LA+'</th><th class="num">Surplus bruto '+LB+'</th></tr></thead><tbody>'+gs('RI')+gs('RJ')+gs('ALL')+'</tbody></table>';
};

/* ===== Case-mix ===== */
R.casemix=()=>{
  const el=document.getElementById('dkview-casemix');
  el.innerHTML=`
  <div class="ktoolbar"><span class="kl">Jenis layanan</span><div class="kseg" id="dk-cj"></div></div>
  <div class="kgrid kg2">
   <div class="card"><h2>Kelompok penyakit (MDC iDRG)</h2><p class="knote">Pendapatan klaim per Major Diagnostic Category menurut keluaran grouper iDRG di berkas. Delapan teratas menurut ${MB}.</p><div id="dk-mdc-b"></div></div>
   <div class="card"><h2>Kode INA-CBG baru dan hilang</h2><p class="knote">Kode yang hanya muncul di salah satu bulan (nilai kecil, sering kasus langka).</p><div id="dk-cm-new"></div></div>
  </div>
  <h3 class="ksect">Semua kelompok INA-CBG</h3>
  <div class="card"><div class="ktoolbar"><div id="dk-cq"></div><span class="ksmall" id="dk-cc"></span></div><div class="ktbl" id="dk-cm-t" style="max-height:560px;overflow:auto"></div></div>`;
  let tb;
  const draw=j=>{
    const cs=j==='RI'?riCodes:rjCodes;
    const md=D.mdc[j].map(r=>({label:r.k||'(tanpa MDC)',a:r.Agu.tot,s:r.Sep.tot,n:r.Sep.n})).sort((x,y)=>y.s-x.s).slice(0,8);
    const cA=cov('Agu',j),cB=cov('Sep',j);
    if(cA>=0.99&&cB>=0.99) hbars(document.getElementById('dk-mdc-b'),md,{fmt:rp,title:'MDC'});
    else document.getElementById('dk-mdc-b').innerHTML=`<div class="kcaveat">Grafik MDC tidak ditampilkan karena keluaran iDRG tidak lengkap pada berkas: ${LA} ${pct(cA,0)} dan ${LB} ${pct(cB,0)} klaim ${JN[j].toLowerCase()} punya data iDRG.</div>`;
    const nw=cs.filter(c=>c.Agu.n===0||c.Sep.n===0).sort((x,y)=>Math.abs(y.dt)-Math.abs(x.dt));
    const nb=cs.filter(c=>c.Agu.n===0).length,nh=cs.filter(c=>c.Sep.n===0).length;
    document.getElementById('dk-cm-new').innerHTML=`<div class="ksmall" style="margin-bottom:8px">${nb} kode baru di ${MB} (${rp(sum(cs.filter(c=>c.Agu.n===0).map(c=>c.Sep.tot)))}) · ${nh} kode tidak muncul lagi (${rp(sum(cs.filter(c=>c.Sep.n===0).map(c=>c.Agu.tot)))})</div><div class="ktbl"><table><tbody>`+
      nw.slice(0,7).map(c=>`<tr><td class="l">${esc(c.code)} ${esc(c.desc)}</td><td class="num"><span class="kchip ${c.Agu.n===0?'good':'bad'}">${c.Agu.n===0?'baru':'hilang'}</span></td><td class="num">${c.Agu.n===0?c.Sep.n:c.Agu.n} kasus</td><td class="num">${rp(Math.abs(c.dt))}</td></tr>`).join('')+'</tbody></table></div>';
    const rows=cs.map(c=>Object.assign({_s:(c.code+' '+c.desc).toLowerCase()},c));
    tb=table(document.getElementById('dk-cm-t'),[
      {k:'code',h:'Kode',cls:'l',v:r=>r.code,f:r=>r.code},{k:'desc',h:'Kelompok',cls:'l',v:r=>r.desc,f:r=>esc(r.desc)},
      {k:'na',h:'Klaim '+LA+'',v:r=>r.Agu.n,f:r=>nf.format(r.Agu.n)},{k:'ns',h:'Klaim '+LB+'',v:r=>r.Sep.n,f:r=>nf.format(r.Sep.n)},{k:'dn',h:'Δ klaim',v:r=>r.dn,f:r=>sg(r.dn,nf.format)},
      {k:'ta',h:'Pendapatan '+LA+'',v:r=>r.Agu.tot,f:r=>rp(r.Agu.tot)},{k:'ts',h:'Pendapatan '+LB+'',v:r=>r.Sep.tot,f:r=>rp(r.Sep.tot)},{k:'dt',h:'Δ pendapatan',v:r=>r.dt,f:r=>sg(r.dt,rp)},
      {k:'df',h:'Defisit '+LB+'',v:r=>r.defS,f:r=>rp(r.defS)}],rows,{sort:'ts',count:document.getElementById('dk-cc')});
    combo(document.getElementById('dk-cq'),{ph:'Cari kode atau nama kelompok, mis. pernafasan',items:rows.map(r=>({id:r.code,text:r.code+' '+r.desc,s:r._s,sub:nf.format(r.Sep.n)+' klaim '+LB+' · '+rp(r.Sep.tot)})),onType:v=>tb.search(v),onPick:it=>tb.only(it?r=>r.code===it.id:null)});
  };
  seg('cj',[['RI','Rawat inap'],['RJ','Rawat jalan']],'RI',draw);draw('RI');
};

/* ===== DPJP ===== */
R.dpjp=()=>{
  const el=document.getElementById('dkview-dpjp');
  el.innerHTML=`<div class="kcaveat"><b>Gunakan dengan hati-hati.</b> Angka per DPJP mencerminkan jenis kasus (case-mix) dan keparahan yang ditangani, bukan kinerja. Bandingkan rasio klaim/Tarif RS dan rata-rata klaim per kasus, bukan volume mentah.</div>
  <div class="ktoolbar" style="margin-top:14px"><span class="kl">Jenis layanan</span><div class="kseg" id="dk-dj"></div><div id="dk-dq"></div><span class="ksmall" id="dk-dc"></span></div>
  <div class="ksmall" id="dk-dnote" style="margin-bottom:10px"></div>
  <div class="kgrid kg2"><div class="card" style="grid-column:1/-1"><h2>10 DPJP dengan pendapatan klaim terbesar</h2><div id="dk-dp-b"></div></div></div>
  <div class="card" style="margin-top:14px"><div class="ktbl" id="dk-dp-t" style="max-height:600px;overflow:auto"></div></div>`;
  let tb;
  const draw=j=>{
    const rows=D.dpjp[j].map(r=>({_s:r.k.toLowerCase(),name:r.k||'(tanpa DPJP)',a:r.Agu,s:r.Sep,ri:r.ri?r.ri.Sep:0,rj:r.rj?r.rj.Sep:0}));
    document.getElementById('dk-dnote').innerHTML=j==='ALL'?`<b>Gabungan:</b> klaim rawat inap dan rawat jalan dijumlahkan per DPJP (${rows.length} DPJP). Kolom RI dan RJ ${LB} memisahkan asalnya. Rata-rata klaim per kasus bercampur kasus inap (mahal) dan jalan (murah), jadi tidak sebanding antar DPJP dengan proporsi RI/RJ berbeda.`:'';
    hbars(document.getElementById('dk-dp-b'),rows.slice().sort((x,y)=>y.s.tot-x.s.tot).slice(0,10).map(r=>({label:r.name,a:r.a.tot,s:r.s.tot})),{fmt:rp,lw:Math.min(300,Math.floor(W(document.getElementById('dk-dp-b'))*.45)),title:'Top DPJP'});
    tb=table(document.getElementById('dk-dp-t'),[
      {k:'name',h:'DPJP',cls:'l',v:r=>r.name,f:r=>esc(r.name)},].concat(j==='ALL'?[{k:'ris',h:'RI '+LB+'',v:r=>r.ri,f:r=>nf.format(r.ri)},{k:'rjs',h:'RJ '+LB+'',v:r=>r.rj,f:r=>nf.format(r.rj)}]:[]).concat([
      {k:'na',h:'Klaim '+LA+'',v:r=>r.a.n,f:r=>nf.format(r.a.n)},{k:'ns',h:'Klaim '+LB+'',v:r=>r.s.n,f:r=>nf.format(r.s.n)},{k:'dn',h:'Δ klaim',v:r=>r.s.n-r.a.n,f:r=>sg(r.s.n-r.a.n,nf.format)},
      {k:'ta',h:'Pendapatan '+LA+'',v:r=>r.a.tot,f:r=>rp(r.a.tot)},{k:'ts',h:'Pendapatan '+LB+'',v:r=>r.s.tot,f:r=>rp(r.s.tot)},{k:'dt',h:'Δ pendapatan',v:r=>r.s.tot-r.a.tot,f:r=>sg(r.s.tot-r.a.tot,rp)},
      {k:'ra',h:'Rasio '+LA+'',v:r=>r.a.rs?r.a.tot/r.a.rs:0,f:r=>r.a.rs?pct(r.a.tot/r.a.rs,0):'–'},{k:'rs',h:'Rasio '+LB+'',v:r=>r.s.rs?r.s.tot/r.s.rs:0,f:r=>r.s.rs?pct(r.s.tot/r.s.rs,0):'–'},
      {k:'avg',h:'Klaim/kasus '+LB+'',v:r=>r.s.n?r.s.tot/r.s.n:0,f:r=>r.s.n?rp(r.s.tot/r.s.n):'–'}]),rows,{sort:'ts',count:document.getElementById('dk-dc')});
    combo(document.getElementById('dk-dq'),{ph:'Cari nama DPJP, mis. Pandu',items:rows.map(r=>({id:r.name,text:r.name,s:r.name.toLowerCase(),sub:nf.format(r.s.n)+' klaim '+LB+' · '+rp(r.s.tot)})),onType:v=>tb.search(v),onPick:it=>tb.only(it?r=>r.name===it.id:null)});
  };
  seg('dj',[['ALL','Gabungan RI + RJ'],['RI','Rawat inap'],['RJ','Rawat jalan']],'ALL',draw);draw('ALL');
};

/* ===== Biaya ===== */
R.biaya=()=>{
  const el=document.getElementById('dkview-biaya');
  const NM={PELAYANAN_DARAH:'Pelayanan darah',OBAT_KRONIS:'Obat kronis',OBAT_KEMO:'Obat kemoterapi',PROSEDUR_NON_BEDAH:'Prosedur non-bedah',PROSEDUR_BEDAH:'Prosedur bedah',KONSULTASI:'Konsultasi',TENAGA_AHLI:'Tenaga ahli',KEPERAWATAN:'Keperawatan',PENUNJANG:'Penunjang',RADIOLOGI:'Radiologi',LABORATORIUM:'Laboratorium',REHABILITASI:'Rehabilitasi',KAMAR_AKOMODASI:'Kamar/akomodasi',RAWAT_INTENSIF:'Rawat intensif',OBAT:'Obat',ALKES:'Alkes',BMHP:'BMHP',SEWA_ALAT:'Sewa alat'};
  el.innerHTML=`<div class="kcaveat"><b>Catatan.</b> Komponen biaya adalah rincian Tarif RS (billing rumah sakit) per kelompok tagihan di berkas e-klaim. ${(()=>{const x=D.chk.Agu.komp_full_ne_rs+D.chk.Sep.komp_full_ne_rs,n=K('Agu').n+K('Sep').n;return x===0?'Jumlah seluruh komponen sama dengan Tarif RS untuk semua '+nf.format(n)+' klaim kedua bulan.':'Jumlah seluruh komponen sama dengan Tarif RS pada '+nf.format(n-x)+' dari '+nf.format(n)+' klaim; '+nf.format(x)+' klaim berselisih (lihat Kualitas data).'})()}</div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Rawat inap</h2><p class="knote">Tarif RS per komponen.</p><div id="dk-bi-ri"></div></div>
   <div class="card"><h2>Rawat jalan</h2><p class="knote">Tarif RS per komponen.</p><div id="dk-bi-rj"></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Perubahan komponen</h2><div class="ktbl" id="dk-bi-t"></div></div>`;
  ['RI','RJ'].forEach(j=>{
    const ks=Object.keys(NM).filter(k=>D.comp[j].Agu[k]+D.comp[j].Sep[k]>0).sort((x,y)=>D.comp[j].Sep[y]-D.comp[j].Sep[x]);
    hbars(document.getElementById('dk-bi-'+j.toLowerCase()),ks.slice(0,10).map(k=>({label:NM[k],a:D.comp[j].Agu[k],s:D.comp[j].Sep[k]})),{fmt:rp,lw:130,title:'Komponen '+j});
  });
  const t=j=>{const A=sum(Object.values(D.comp[j].Agu)),S=sum(Object.values(D.comp[j].Sep));return Object.keys(NM).filter(k=>D.comp[j].Agu[k]+D.comp[j].Sep[k]>0).sort((x,y)=>D.comp[j].Sep[y]-D.comp[j].Sep[x]).map(k=>`<tr><td class="l">${NM[k]}</td><td class="num">${rp(D.comp[j].Agu[k])}</td><td class="num">${rp(D.comp[j].Sep[k])}</td><td class="num">${chg(D.comp[j].Agu[k],D.comp[j].Sep[k],null)}</td><td class="num">${pct(D.comp[j].Agu[k]/A)} → ${pct(D.comp[j].Sep[k]/S)}</td></tr>`).join('')};
  const head=n=>`<tr class="tot"><td class="l" colspan="5" style="background:var(--soft)">${n}</td></tr>`;
  document.getElementById('dk-bi-t').innerHTML='<table><thead><tr><th class="l">Komponen</th><th class="num">'+LA+'</th><th class="num">'+LB+'</th><th class="num">Δ</th><th class="num">Porsi '+LA+' → '+LB+'</th></tr></thead><tbody>'+head('Rawat inap')+t('RI')+head('Rawat jalan')+t('RJ')+'</tbody></table>';
};

/* ===== Proses & iDRG ===== */
R.proses=()=>{
  const el=document.getElementById('dkview-proses');
  const A=K('Agu'),S=K('Sep');
  const vsum=p=>{const o={};['RI','RJ'].forEach(j=>Object.entries(D.ver[j][p]||{}).forEach(([v,n])=>o[v]=(o[v]||0)+n));return Object.entries(o).sort((x,y)=>y[1]-x[1]).map(([v,n])=>`${v} (${nf.format(n)} klaim, ${pct(n/K(p).n)})`).join(', ')};
  const rowsI=['RI','RJ','ALL'].flatMap(j=>P.map(p=>{const k=K(p,j);return `<tr><td class="l">${JN[j]} · ${p==='Agu'?LA:LB}</td><td class="num">${rp(k.tot)}</td><td class="num">${rp(k.idrg)}</td><td class="num">${pct(k.idrg/k.tot,1)}</td><td class="num">${rp(k.rs)}</td><td class="num">${pct(k.idrg/k.rs,1)}</td></tr>`})).join('');
  el.innerHTML=`<div class="kcaveat"><b>Tafsiran penanda waktu.</b> Waktu proses dihitung dari tanggal pulang ke tanggal-jam yang tercatat di bidang C2 berkas e-klaim (diduga waktu grouping/finalisasi klaim). Ini inferensi dari struktur berkas dan belum dikonfirmasi. Berkas ${MA} ditarik ${pullTxt(KEYA)}, ${MB} ${pullTxt(KEYB)}; bulan yang ditarik lebih lama setelah akhir bulan wajar punya jarak proses lebih panjang.</div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Proses klaim rawat inap</h2><p class="knote">Jumlah klaim menurut hari dari tanggal pulang ke grouping. Median ${fl(D.lag_med.RI.Agu)} → ${fl(D.lag_med.RI.Sep)} hari, rata-rata ${fl(D.lag_mean.RI.Agu)} → ${fl(D.lag_mean.RI.Sep)}.</p><div id="dk-p-ri"></div></div>
   <div class="card"><h2>Proses klaim rawat jalan</h2><p class="knote">Median ${fl(D.lag_med.RJ.Agu)} → ${fl(D.lag_med.RJ.Sep)} hari, rata-rata ${fl(D.lag_mean.RJ.Agu)} → ${fl(D.lag_mean.RJ.Sep)}.</p><div id="dk-p-rj"></div></div>
  </div>
  <h3 class="ksect">Versi grouper INA-CBG</h3>
  <div class="card"><ul class="kfind">
   <li><b>${MA}:</b> ${vsum('Agu')}.</li><li><b>${MB}:</b> ${vsum('Sep')}.</li>
   <li class="${Math.abs(D.pvm.RI.price)+Math.abs(D.pvm.RJ.price)>1?'w':'g'}">${Math.abs(D.pvm.RI.price)+Math.abs(D.pvm.RJ.price)>1?'Tarif untuk kombinasi kode dan kelas yang sama berubah antara kedua bulan; efek harga ditampilkan pada dekomposisi di Ringkasan.':'Tarif INA-CBG untuk kombinasi kode dan kelas yang sama <b>tidak berbeda</b> antara kedua bulan (efek harga nol), jadi pergantian versi grouper tidak menggeser nilai klaim kelompok yang sama. Perubahan kode klaim individual akibat regrouping tidak dapat dinilai karena berkas tidak memuat hasil grouping sebelumnya.'}</li>
  </ul></div>
  <h3 class="ksect">Simulasi iDRG pada berkas</h3>
  ${idrgOK?`<div class="kcaveat" style="margin-bottom:14px"><b>Indikatif.</b> Setiap klaim memuat keluaran grouper iDRG (kode DRG, cost weight, tarif). Nilai berasal dari berkas dan belum dikonfirmasi sebagai tarif pembayaran resmi untuk RS ini.</div>
  <div class="kgrid kg2">
   <div class="card"><h2>Rawat inap</h2><p class="knote">Klaim INA-CBG, simulasi iDRG, dan Tarif RS.</p><div id="dk-i-ri"></div></div>
   <div class="card"><h2>Rawat jalan</h2><p class="knote">Klaim INA-CBG, simulasi iDRG, dan Tarif RS.</p><div id="dk-i-rj"></div></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="ktbl"><table><thead><tr><th class="l">Jenis · bulan</th><th class="num">INA-CBG</th><th class="num">iDRG (simulasi)</th><th class="num">iDRG ÷ INA-CBG</th><th class="num">Tarif RS</th><th class="num">iDRG ÷ Tarif RS</th></tr></thead><tbody>${rowsI}</tbody></table></div></div>`
  :`<div class="kcaveat"><b>Tidak dibandingkan.</b> Keluaran iDRG hanya ada pada sebagian klaim di berkas: ${LA} ${pct(cov('Agu'),0)} dan ${LB} ${pct(cov('Sep'),0)} dari klaim. Membandingkan nilai iDRG pada cakupan yang tidak penuh akan menyesatkan. Pilih dua bulan dengan cakupan iDRG penuh (mis. April–Juni 2026, Agustus–September 2026).</div>`}`;
  const lb=['0–3 hari','4–7','8–14','>14'];
  vbars(document.getElementById('dk-p-ri'),lb,D.lag.RI.Agu,D.lag.RI.Sep,{tone:'flat',title:'Proses RI'});
  vbars(document.getElementById('dk-p-rj'),lb,D.lag.RJ.Agu,D.lag.RJ.Sep,{tone:'flat',title:'Proses RJ'});
  if(idrgOK) ['RI','RJ'].forEach(j=>{const a=K('Agu',j),s=K('Sep',j);vbars(document.getElementById('dk-i-'+j.toLowerCase()),['INA-CBG','iDRG (simulasi)','Tarif RS'],[a.tot,a.idrg,a.rs],[s.tot,s.idrg,s.rs],{fmt:rp,ax:rpAx,title:'iDRG '+j})});
};

/* ===== Kualitas data ===== */
R.data=()=>{
  const el=document.getElementById('dkview-data');
  const rcRow=(p,m)=>['RI','RJ'].map(j=>{const r=D.recon[p][j],lab=(JN[j])+' '+m;
    if(!r||r.rek_n==null) return `<tr><td class="l">${lab}</td><td class="num">${nf.format(r?r.txt_n:0)}</td><td class="num">–</td><td class="num" colspan="4"><span class="ksmall">Rekap XLSX tidak dapat dicocokkan (format berbeda), tidak direkonsiliasi</span></td></tr>`;
    const ok=r.only_txt===0&&r.only_rek===0&&r.txt_tot===r.rek_tot, c=ok?'ok':'bad';
    return `<tr><td class="l">${lab}</td><td class="num">${nf.format(r.txt_n)}</td><td class="num">${nf.format(r.rek_n)}</td><td class="num ${c}">${nf.format(r.only_txt)} / ${nf.format(r.only_rek)}</td><td class="num ${c}">${rp(r.txt_tot-r.rek_tot,true)}</td></tr>`}).join('');
  const C=D.chk,both=(f)=>C.Agu[f]+C.Sep[f];
  const li=(ok,t)=>`<li class="${ok?'g':'w'}">${t}</li>`;
  const passes=[
    li(both('sep_dup')===0&&KA.meta_x.sep_dobel_lintas===0,both('sep_dup')===0?`Tidak ada nomor SEP ganda dalam satu bulan; lintas seluruh ${KA.meta.keys.length} bulan data klaim juga ${KA.meta_x.sep_dobel_lintas===0?'tidak ada ('+nf.format(KA.meta_x.sep_unik)+' SEP unik)':'ada '+nf.format(KA.meta_x.sep_dobel_lintas)+' SEP ganda'}.`:`${both('sep_dup')} baris SEP ganda dalam bulan terpilih.`),
    li(both('total_ne_komponen')===0,both('total_ne_komponen')===0?'Total Tarif sama dengan jumlah komponen (INA-CBG + special CMG + subacute/kronis) untuk seluruh klaim.':`Total Tarif tidak sama dengan jumlah komponen pada ${both('total_ne_komponen')} klaim (${LA}: ${C.Agu.total_ne_komponen}, ${LB}: ${C.Sep.total_ne_komponen}).`),
    li(both('komp_full_ne_rs')===0,both('komp_full_ne_rs')===0?'Jumlah komponen biaya (termasuk pelayanan darah dan obat kronis/kemoterapi bila ada) sama dengan Tarif RS untuk seluruh klaim.':`Jumlah komponen biaya tidak sama dengan Tarif RS pada ${both('komp_full_ne_rs')} klaim (${LA}: ${C.Agu.komp_full_ne_rs}, ${LB}: ${C.Sep.komp_full_ne_rs}).`),
    li(both('hari_tanpa_klaim')===0,`Rentang tanggal pulang ${C.Agu.tgl_min} s.d. ${C.Agu.tgl_max} dan ${C.Sep.tgl_min} s.d. ${C.Sep.tgl_max}; ${both('hari_tanpa_klaim')===0?'tidak ada hari tanpa klaim.':both('hari_tanpa_klaim')+' hari tanpa klaim.'}`),
    li(both('kombinasi_multi_tarif')===0,both('kombinasi_multi_tarif')===0?`Tarif per kombinasi kode INA-CBG dan kelas konsisten dalam tiap bulan (${C.Agu.kombinasi} dan ${C.Sep.kombinasi} kombinasi).`:`Ada ${both('kombinasi_multi_tarif')} kombinasi kode-kelas dengan lebih dari satu tarif dalam bulan yang sama.`),
    `<li class="g">Special CMG: ${C.Agu.spcmg_n} klaim di ${LA} dan ${C.Sep.spcmg_n} di ${LB} (${C.Agu.spcmg_ri+C.Sep.spcmg_ri} rawat inap), termasuk dalam Total Tarif.</li>`].join('');
  const warns=[];
  [['Agu',LA],['Sep',LB]].forEach(([p,l])=>{
    if(D.dupRJ[p].n) warns.push(`<li class="w">${D.dupRJ[p].n} klaim rawat jalan ${l} (${rp(D.dupRJ[p].amt,true)}) memiliki No. RM, tanggal pulang, dan kode INA-CBG sama dengan SEP berbeda. Bisa kunjungan sah ke poli berbeda, tetapi layak diverifikasi.</li>`);
    if(D.dupRI[p]) warns.push(`<li class="w">${D.dupRI[p]} klaim rawat inap ${l} memiliki No. RM, tanggal masuk, dan tanggal pulang sama dengan SEP berbeda; periksa kemungkinan klaim ganda.</li>`);
    if(C[p].rs_nol) warns.push(`<li class="w">${C[p].rs_nol} klaim ${l} bernilai Tarif RS nol atau negatif; ini menggeser rasio klaim/Tarif RS.</li>`);
  });
  warns.push(`<li class="w">Status pulang rawat jalan “lain-lain”: ${D.status.RJ.Agu['5']||0} (${LA}) dan ${D.status.RJ.Sep['5']||0} (${LB}) klaim; status meninggal ${D.status.RJ.Agu['4']||0} dan ${D.status.RJ.Sep['4']||0}. Tidak ada penjelasan klinis di berkas; bila berubah tajam, cek proses entri.</li>`);
  warns.push(`<li class="w">${D.carry.Agu} klaim rawat inap ${LA} dan ${D.carry.Sep} klaim ${LB} masuk di bulan sebelumnya; seluruhnya dihitung pada bulan tanggal pulang.</li>`);
  const rcBad=['Agu','Sep'].some(p=>['RI','RJ'].some(j=>{const r=D.recon[p][j];return r&&r.rek_n!=null&&(r.only_txt||r.only_rek||r.txt_tot!==r.rek_tot)}));
  if(rcBad) warns.push(`<li class="w"><b>Berkas TXT dan Rekap XLSX tidak sepenuhnya cocok</b> pada bulan terpilih (lihat tabel). Dashboard memakai berkas TXT; selisihnya adalah SEP yang ada di rekap tetapi tidak ada di TXT, atau sebaliknya.</li>`);
  warns.push(`<li class="w">Penulisan nama DPJP tidak seragam antarberkas (huruf besar/kecil, titik, nama belakang disingkat, gelar tidak lengkap). Dashboard menggabungkan penulisan yang jelas merujuk orang yang sama: ${KA.meta_x.dpjp_raw} penulisan menjadi ${KA.meta_x.dpjp_norm} nama (daftar penyatuan ada di Analisis lanjutan › DPJP &amp; case-mix; mohon dikonfirmasi bagian SDM). Tanpa penggabungan ini perbandingan per DPJP antarbulan akan keliru.</li>`);
  el.innerHTML=`
  <div class="card"><h2>Rekonsiliasi berkas TXT dengan Rekap Klaim XLSX</h2><p class="knote">Dicocokkan per nomor SEP. Kolom “SEP tak cocok” = hanya di TXT / hanya di XLSX.</p><div class="ktbl"><table><thead><tr><th class="l">Berkas</th><th class="num">Baris TXT</th><th class="num">Baris XLSX</th><th class="num">SEP tak cocok</th><th class="num">Selisih Total Tarif</th></tr></thead><tbody>${rcRow('Agu',LA)}${rcRow('Sep',LB)}</tbody></table></div></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Pemeriksaan</h2><ul class="kfind">${passes}</ul></div>
   <div class="card"><h2>Perlu diperiksa</h2><ul class="kfind">${warns.join('')}</ul></div>
  </div>
  <h3 class="ksect">Keterbatasan analisis</h3>
  <div class="card"><ul class="kfind">
   <li><b>Belum ada status verifikasi BPJS di data klaim.</b> Berkas hanya memuat klaim yang diajukan; klaim pending, dispute, atau yang dikoreksi verifikator tidak terlihat. Pendapatan di dashboard adalah nilai ajuan, bukan pendapatan yang sudah pasti dibayar.</li>
   <li><b>Periode memakai tanggal pulang,</b> bukan tanggal pengajuan. Klaim yang difinalisasi setelah tanggal tarik berkas (${pullTxt(KEYA)} untuk ${MA}, ${pullTxt(KEYB)} untuk ${MB}) tidak tercakup, dan revisi susulan tidak bisa dipastikan.</li>
   <li><b>Tarif RS bukan unit cost.</b> Selisih terhadap tarif INA-CBG menunjukkan jarak tarif; kerugian riil memerlukan costing.</li>
   <li><b>Hari libur diinferensi dari data</b> (hari kerja dengan klaim rawat jalan kurang dari 100), bukan dari kalender resmi.</li>
   <li><b>Satu bulan melawan satu bulan.</b> Perbedaan dua bulan tidak menunjukkan tren; musim penyakit, jumlah hari kerja, dan kejadian luar biasa bisa menggerakkan angka. Untuk tren, gunakan mode multi-bulan.</li>
   <li><b>Data pasien tidak ditampilkan.</b> Nama, nomor kartu, NIK, dan nomor SEP tidak dimasukkan ke dashboard.</li>
  </ul></div>`;
};

window.DUOK={show:function(a,b){prepare(a,b);Object.keys(rendered).forEach(k=>delete rendered[k]);show(curTab)}};
})();

})();
