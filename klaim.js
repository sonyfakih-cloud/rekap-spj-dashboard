(function(){
"use strict";
const D = window.KLAIM_DATA;
const P = ['Agu','Sep'], PN = {Agu:'Agu',Sep:'Sep'};
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
  return `<span class="kkchip ${c}">${up?'▲':dn?'▼':'■'} ${dec(Math.abs(r)*100,1)}%</span>`;
}
function chgPP(a,b,good=true){
  const d=(b-a)*100, up=d>0.05, dn=d<-0.05; let c='flat';
  if(up) c=good?'good':'bad'; if(dn) c=good?'bad':'good';
  return `<span class="kkchip ${c}">${up?'▲':dn?'▼':'■'} ${dec(Math.abs(d),1)} pp</span>`;
}
const title = s=>s.toLowerCase().replace(/(^|[\s\/(])([a-z])/g,(m,a,c)=>a+c.toUpperCase());
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const K=(p,j='ALL')=>D.kpi[p][j];
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
const tipCmp=(label,a,s,fmt,good)=>`<b>${esc(label)}</b><br><span class="m">Agu ${fmt(a)}</span><br><span class="m">Sep ${fmt(s)}</span>`+(a?`<br>Δ <span class="m">${sg(s-a,x=>fmt(x))} (${a?dec((s-a)/a*100,1):'–'}%)</span>`:'');

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
const legendSvg=(w)=>{const cx=w/2;return `<g class="klg"><rect x="${cx-96}" y="4" width="10" height="10" rx="2" style="fill:var(--k-agu)"/><text x="${cx-82}" y="13">Agustus 2026</text><rect x="${cx+8}" y="4" width="10" height="10" rx="2" style="fill:var(--k-sep)"/><text x="${cx+22}" y="13">September 2026</text></g>`};
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
function table(el,cols,rows,o={}){
  let sk=o.sort||cols[0].k,asc=!!o.asc,q='',only=null;
  const draw=()=>{
    let rs=rows.filter(r=>(!q||matchAll(r._s||'',q))&&(!only||only(r)));
    const c=cols.find(c=>c.k===sk);
    rs=rs.slice().sort((x,y)=>{const a=c.v(x),b=c.v(y);const d=(typeof a==='string')?a.localeCompare(b,'id'):(a-b);return asc?d:-d});
    const lim=o.limit||rs.length;
    el.querySelector('tbody').innerHTML=rs.slice(0,lim).map(r=>'<tr>'+cols.map(c=>`<td class="${c.cls||'num'}">${c.f(r)}</td>`).join('')+'</tr>').join('')+(rs.length>lim?`<tr><td class="l" colspan="${cols.length}">… ${rs.length-lim} baris lain, gunakan pencarian atau urutkan kolom</td></tr>`:'')+(rs.length?'':`<tr><td class="l" colspan="${cols.length}">Tidak ada baris yang cocok.</td></tr>`);
    el.querySelectorAll('th').forEach(th=>{const on=th.dataset.k===sk;th.classList.toggle('sorted',on);th.classList.toggle('asc',on&&asc)});
    if(o.count) o.count.textContent=nf.format(rs.length)+' baris';
  };
  el.innerHTML=`<table><thead><tr>${cols.map(c=>`<th tabindex="0" data-k="${c.k}" class="${c.cls==='l'?'l':'num'}">${c.h}</th>`).join('')}</tr></thead><tbody></tbody></table>`;
  el.querySelectorAll('th').forEach(th=>{const f=()=>{const k=th.dataset.k;if(sk===k)asc=!asc;else{sk=k;asc=cols.find(c=>c.k===k).cls==='l'}draw()};th.onclick=f;th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}}});
  draw();
  return {search:v=>{q=v;draw()},only:f=>{only=f;draw()}};
}

function seg(id,opts,cur,cb){
  const el=document.getElementById('k-'+id);
  const paint=()=>{el.innerHTML=opts.map(o=>`<button type="button" aria-pressed="${o[0]===cur}" data-v="${o[0]}">${o[1]}</button>`).join('')};
  paint();
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;cur=b.dataset.v;paint();cb(cur)};
}

/* ---------- derived data ---------- */
const JN={ALL:'Semua',RI:'Rawat Inap',RJ:'Rawat Jalan'};
const codes=j=>D.inacbg[j].map(r=>({code:r.k,desc:title(r.d),Agu:r.Agu,Sep:r.Sep,dt:r.Sep.tot-r.Agu.tot,dn:r.Sep.n-r.Agu.n,defA:r.Agu.rs-r.Agu.tot,defS:r.Sep.rs-r.Sep.tot}));
const eff=D.eff, daily=D.daily;
const perDay={
  rjWd:[eff.Agu.rj_wd/eff.Agu.eff,eff.Sep.rj_wd/eff.Sep.eff],
  rjWdRev:[eff.Agu.rj_wd_tot/eff.Agu.eff,eff.Sep.rj_wd_tot/eff.Sep.eff],
  ri:[K('Agu','RI').n/31,K('Sep','RI').n/30], riRev:[K('Agu','RI').tot/31,K('Sep','RI').tot/30]
};
const rjCodes=codes('RJ'), riCodes=codes('RI');
const dial=rjCodes.find(c=>c.code==='N-3-15-0'), viral=riCodes.find(c=>c.code==='A-4-13-I');

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
  const card=(lab,va,vs,f,ch,hint)=>`<div class="kpi-card k-kpi"><div class="klab">${lab}</div><div class="kval" data-cu="${KC.push([vs,f])-1}">${f(vs)}</div><div class="krow"><span class="a">Agu <b>${f(va)}</b></span><span class="s">Sep ${ch}</span></div>${hint?`<div class="khint">${hint}</div>`:''}</div>`;
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
const nav=document.getElementById('k-tabs');
nav.innerHTML=TABS.map(t=>`<button type="button" role="tab" data-t="${t[0]}" aria-selected="false">${t[1]}</button>`).join('');
function show(id){
  if(!TABS.some(t=>t[0]===id)) id='ringkasan';
  curTab=id;
  nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===id));
  document.querySelectorAll('#appRootKlaim .kview').forEach(s=>s.classList.toggle('active',s.id==='kview-'+id));
  if(!rendered[id]){R[id]();rendered[id]=1}
}
nav.onclick=e=>{const b=e.target.closest('button');if(b)show(b.dataset.t)};
const visible=()=>{const r=document.getElementById('appRootKlaim');return r&&r.style.display!=='none'};
let rz,lastW=window.innerWidth;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(!visible()||window.innerWidth===lastW)return;lastW=window.innerWidth;Object.keys(rendered).forEach(k=>delete rendered[k]);show(curTab)},180)});

/* ===== Ringkasan ===== */
R.ringkasan=()=>{
  const el=document.getElementById('kview-ringkasan'),a=K('Agu'),s=K('Sep'),ar=K('Agu','RI'),sr=K('Sep','RI'),aj=K('Agu','RJ'),sj=K('Sep','RJ');
  const dRev=s.tot-a.tot, defR=(-s.sel)/(-a.sel)-1;
  const dialShare=dial.defS/(sj.rs-sj.tot);
  const topDef=riCodes.concat(rjCodes).sort((x,y)=>y.defS-x.defS)[0];
  el.innerHTML=`
  <div class="ktoolbar"><span class="kl">Tampilkan KPI untuk</span><div class="kseg" id="k-kseg"></div></div>
  <div id="k-kpis"></div>
  <h3 class="ksect">Temuan utama</h3>
  <div class="card"><ul class="kfind">
   <li><b>Pendapatan klaim naik ${rp(dRev)} (${sg((s.tot/a.tot-1)*100,x=>dec(x,1))}%)</b>, dari ${rp(a.tot)} ke ${rp(s.tot)}, dengan jumlah klaim ${nf.format(a.n)} → ${nf.format(s.n)} (${sg((s.n/a.n-1)*100,x=>dec(x,1))}%). Kenaikan rawat inap ${rp(sr.tot-ar.tot)} dan rawat jalan ${rp(sj.tot-aj.tot)}.</li>
   <li><b>Kenaikan rawat jalan sebagian besar efek kalender.</b> Agustus punya ${eff.Agu.eff} hari kerja efektif (hari Senin–Jumat ${eff.Agu.hol.join(' dan ')} Agustus hampir tanpa klaim, diduga libur) dan September ${eff.Sep.eff}. Per hari kerja, klaim rawat jalan justru turun ${dec((1-perDay.rjWd[1]/perDay.rjWd[0])*100,1)}% (${nf.format(Math.round(perDay.rjWd[0]))} → ${nf.format(Math.round(perDay.rjWd[1]))} klaim/hari) dan pendapatannya ${dec((1-perDay.rjWdRev[1]/perDay.rjWdRev[0])*100,1)}% lebih rendah per hari.</li>
   <li><b>Rawat inap naik nyata, tetapi lebih ringan.</b> Klaim ${sg((sr.n/ar.n-1)*100,x=>dec(x,1))}% (${dec(perDay.ri[0],1)} → ${dec(perDay.ri[1],1)} per hari, ${sg((perDay.ri[1]/perDay.ri[0]-1)*100,x=>dec(x,1))}%) sementara rata-rata klaim per kasus turun ${dec((1-(sr.tot/sr.n)/(ar.tot/ar.n))*100,1)}% (${rp(ar.tot/ar.n)} → ${rp(sr.tot/sr.n)}). Pemicu terbesar: Infeksi Viral &amp; Non-Bakterial Lain (Ringan), ${viral.Agu.n} → ${viral.Sep.n} kasus (${sg(viral.dt,rp)}), dengan diagnosis utama B34.9 (${D.diagA.Agu['B34.9']} → ${D.diagA.Sep['B34.9']}) dan A90/DBD (${D.diagA.Agu['A90']} → ${D.diagA.Sep['A90']}).</li>
   <li class="r"><b>Defisit terhadap Tarif RS melebar ${dec(defR*100,1)}%</b>: ${rp(-a.sel)} → ${rp(-s.sel)}; rasio klaim/Tarif RS turun dari ${pct(a.tot/a.rs)} ke ${pct(s.tot/s.rs)}. Penyumbang defisit terbesar September adalah ${esc(topDef.desc)} (${rp(topDef.defS)}). Dialisis sendirian ${rp(dial.defS)} atau ${pct(dialShare,0)} dari defisit rawat jalan.</li>
   <li class="g"><b>Proses klaim lebih cepat.</b> Median jarak tanggal pulang ke tanggal grouping di berkas turun dari ${D.lag_med.RJ.Agu} ke ${D.lag_med.RJ.Sep} hari (rawat jalan) dan ${D.lag_med.RI.Agu} ke ${D.lag_med.RI.Sep} hari (rawat inap). Ini membaca penanda waktu di berkas, bukan status verifikasi BPJS.</li>
   <li class="w"><b>Simulasi iDRG di berkas</b> menghasilkan ${rp(s.idrg)} untuk September, ${sg((s.idrg/s.tot-1)*100,x=>dec(x,1))}% di atas klaim INA-CBG dan ${pct(s.idrg/s.rs,1)} dari Tarif RS. Angka ini indikatif dan belum tentu tarif yang berlaku untuk pembayaran.</li>
  </ul></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Dari mana perubahan pendapatan berasal</h2><p class="knote">Dekomposisi per jenis layanan: efek volume (jumlah klaim naik pada bauran dan tarif Agustus) dan efek bauran (kelompok INA-CBG yang lebih berat atau ringan). Tarif per kelompok dan kelas tidak berubah, sehingga efek harga nol.</p><div id="k-c-pvm"></div>
     <div class="ksmall" style="margin-top:8px">Total perubahan ${sg(dRev,rp)}.</div></div>
   <div class="card"><h2>Klaim vs Tarif RS per jenis layanan</h2><p class="knote">Selisih antara batang adalah defisit tarif.</p><div id="k-c-rs"></div></div>
  </div>
  <h3 class="ksect">Implikasi dan tindak lanjut</h3>
  <div class="card"><ul class="kfind">
   <li><b>Minta rekap status verifikasi BPJS</b> (layak, pending, dispute) untuk Agustus dan September. Berkas ini hanya memuat klaim yang diajukan, sehingga nilai klaim layak bayar dan piutang belum bisa dihitung.</li>
   <li><b>Telaah biaya layanan dialisis, persalinan, dan operasi caesar</b>, tempat selisih Tarif RS terhadap INA-CBG paling besar. Tarif RS bukan unit cost, jadi lakukan costing riil sebelum menyimpulkan kerugian.</li>
   <li><b>Audit kodefikasi klaster infeksi viral</b>: kode B34.9 (infeksi virus tidak spesifik) naik dua kali lipat. Pastikan spesifisitas diagnosis wajar secara klinis dan konsisten dengan data surveilans DBD.</li>
   <li><b>Gunakan metrik per hari kerja</b> untuk membandingkan rawat jalan antarbulan. Perbandingan bulanan mentah menyesatkan ketika jumlah hari kerja berbeda.</li>
   <li><b>Siapkan simulasi iDRG</b> dengan tarif resmi yang berlaku, dan telaah klaim berstatus pulang “lain-lain” rawat jalan yang naik dari ${D.status.RJ.Agu['5']} ke ${D.status.RJ.Sep['5']} kasus.</li>
  </ul></div>`;
  const draw=j=>{const e=document.getElementById('k-kpis');e.innerHTML=kpiCards(j);countUp(e)};
  seg('kseg',[['ALL','Semua'],['RI','Rawat inap'],['RJ','Rawat jalan']],'ALL',draw);draw('ALL');
  const pv=D.pvm;
  diverge(document.getElementById('k-c-pvm'),[
    {label:'Rawat inap · volume',v:pv.RI.vol},{label:'Rawat inap · bauran',v:pv.RI.mix},
    {label:'Rawat jalan · volume',v:pv.RJ.vol},{label:'Rawat jalan · bauran',v:pv.RJ.mix},
    {label:'Total perubahan',v:dRev}],{fmt:x=>rp(x),lw:140,title:'Dekomposisi perubahan pendapatan'});
  hbars(document.getElementById('k-c-rs'),[
    {label:'Rawat inap · klaim',a:ar.tot,s:sr.tot},{label:'Rawat inap · Tarif RS',a:ar.rs,s:sr.rs},
    {label:'Rawat jalan · klaim',a:aj.tot,s:sj.tot},{label:'Rawat jalan · Tarif RS',a:aj.rs,s:sj.rs}],{fmt:rp,lw:140,title:'Klaim dan Tarif RS'});
};

/* ===== Tren ===== */
R.tren=()=>{
  const el=document.getElementById('kview-tren');
  const dn=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  const dowSum=(p,j)=>{const r=[0,0,0,0,0,0,0];daily[p][j].n.forEach((v,i)=>r[daily[p].dow[i]]+=v);return r};
  el.innerHTML=`
  <div class="card"><h2>Klaim per tanggal pulang</h2><p class="knote">Sumbu x adalah tanggal dalam bulan; arahkan kursor untuk melihat hari dan nilainya. Rawat jalan hampir berhenti di Minggu dan hari libur, rawat inap berjalan setiap hari.</p>
   <div class="ktoolbar"><div class="kseg" id="k-sj"></div><div class="kseg" id="k-sm"></div></div><div id="k-c-line"></div></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Normalisasi hari kerja</h2><p class="knote">Hari kerja efektif: Senin–Jumat dengan sedikitnya 100 klaim rawat jalan. Dua hari Senin–Selasa di Agustus (17 dan 25) di bawah ambang itu, diduga libur nasional; ini inferensi dari data, bukan kalender resmi.</p><div class="ktbl" id="k-tb-norm"></div></div>
   <div class="card"><h2>Klaim rawat jalan menurut hari dalam minggu</h2><p class="knote">Total klaim per hari dalam minggu. September memuat satu hari Senin, Selasa, dan Rabu tambahan dibanding Agustus, tetapi satu Sabtu lebih sedikit.</p><div id="k-c-dow"></div></div>
  </div>`;
  let jj='RJ',mm='n';
  const draw=()=>{
    const f=mm==='n'?nf.format:rp;
    lineChart(document.getElementById('k-c-line'),{series:[
      {name:'Agu',cls:'sa',vals:daily.Agu[jj][mm],dow:daily.Agu.dow},{name:'Sep',cls:'ss',vals:daily.Sep[jj][mm],dow:daily.Sep.dow}],fmt:f,ax:mm==='n'?nf.format:rpAx,title:'Tren harian'});
  };
  seg('sj',[['RJ','Rawat jalan'],['RI','Rawat inap']],jj,v=>{jj=v;draw()});
  seg('sm',[['n','Jumlah klaim'],['tot','Pendapatan']],mm,v=>{mm=v;draw()});
  draw();
  const rows=[
    ['Hari kalender',31,30,null,nf.format],['Hari Senin–Jumat',eff.Agu.weekdays,eff.Sep.weekdays,null,nf.format],['Hari kerja efektif',eff.Agu.eff,eff.Sep.eff,true,nf.format],
    ['Klaim RJ total',K('Agu','RJ').n,K('Sep','RJ').n,true,nf.format],
    ['Klaim RJ per hari kerja efektif',perDay.rjWd[0],perDay.rjWd[1],true,x=>dec(x,1)],
    ['Pendapatan RJ per hari kerja efektif',perDay.rjWdRev[0],perDay.rjWdRev[1],true,rp],
    ['Klaim RI per hari kalender',perDay.ri[0],perDay.ri[1],true,x=>dec(x,1)],
    ['Pendapatan RI per hari kalender',perDay.riRev[0],perDay.riRev[1],true,rp]];
  document.getElementById('k-tb-norm').innerHTML='<table><thead><tr><th class="l">Ukuran</th><th class="num">Agu</th><th class="num">Sep</th><th class="num">Δ</th></tr></thead><tbody>'+
    rows.map(r=>`<tr><td class="l">${r[0]}</td><td class="num">${r[4](r[1])}</td><td class="num">${r[4](r[2])}</td><td class="num">${r[3]===null?'<span class="kchip flat">'+sg(r[2]-r[1],nf.format)+'</span>':chg(r[1],r[2],r[3])}</td></tr>`).join('')+'</tbody></table>';
  vbars(document.getElementById('k-c-dow'),dn,dowSum('Agu','RJ'),dowSum('Sep','RJ'),{tone:'flat',title:'Klaim RJ menurut hari'});
};

/* ===== RI / RJ ===== */
function jenisTab(j){
  const el=document.getElementById('kview-'+j.toLowerCase()),cs=j==='RI'?riCodes:rjCodes,pre=j.toLowerCase();
  const top=cs.slice().sort((x,y)=>y.Sep.tot-x.Sep.tot).slice(0,10);
  const movers=cs.slice().sort((x,y)=>y.dt-x.dt);
  const mv=movers.slice(0,6).concat(movers.slice(-6).reverse().filter(x=>x.dt<0));
  const lab=c=>c.code+' '+c.desc;
  el.innerHTML=kpiCards(j)+`
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>10 kelompok INA-CBG terbesar (pendapatan)</h2><p class="knote">Urut menurut pendapatan September.</p><div id="k-${pre}-top"></div></div>
   <div class="card"><h2>Perubahan pendapatan terbesar per kelompok</h2><p class="knote">Enam kenaikan dan enam penurunan terbesar, September dikurangi Agustus.</p><div id="k-${pre}-mv"></div></div>
   ${j==='RI'?`<div class="card"><h2>Kelas rawat</h2><p class="knote">Jumlah klaim per kelas hak rawat.</p><div id="k-ri-kelas"></div></div>
   <div class="card"><h2>Tingkat keparahan (severity)</h2><p class="knote">Jumlah klaim. Keparahan I (ringan) naik 761 → 911, II (sedang) turun 165 → 154, III (berat) hampir tetap 46 → 51, jadi bauran bergeser ke kasus ringan.</p><div id="k-ri-sev"></div></div>
   <div class="card"><h2>Lama rawat (hari)</h2><p class="knote">Distribusi klaim menurut LOS. Rata-rata ${dec(K('Agu','RI').los/K('Agu','RI').n,2)} hari di Agustus, ${dec(K('Sep','RI').los/K('Sep','RI').n,2)} di September.</p><div id="k-ri-los"></div></div>
   <div class="card"><h2>Kelas rawat: pendapatan vs Tarif RS</h2><p class="knote">Rasio klaim terhadap Tarif RS per kelas.</p><div class="ktbl" id="k-ri-kelas-t"></div></div>`:''}
   <div class="card"><h2>Kelompok usia</h2><p class="knote">Jumlah klaim.</p><div id="k-${pre}-age"></div></div>
   <div class="card"><h2>Status pulang</h2><p class="knote">1 atas persetujuan dokter · 2 dirujuk · 3 atas permintaan sendiri · 4 meninggal · 5 lain-lain.</p><div id="k-${pre}-st"></div></div>
  </div>`;
  const g=id=>document.getElementById('k-'+id); countUp(el);
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
    g('ri-kelas-t').innerHTML='<table><thead><tr><th class="l">Kelas</th><th class="num">Rasio Agu</th><th class="num">Rasio Sep</th><th class="num">Klaim/kasus Sep</th></tr></thead><tbody>'+
      kl.map(r=>`<tr><td class="l">Kelas ${r.k}</td><td class="num">${pct(r.Agu.tot/r.Agu.rs)}</td><td class="num">${pct(r.Sep.tot/r.Sep.rs)}</td><td class="num">${rp(r.Sep.tot/r.Sep.n)}</td></tr>`).join('')+'</tbody></table>';
  }
}
R.ri=()=>jenisTab('RI'); R.rj=()=>jenisTab('RJ');

/* ===== Defisit ===== */
R.defisit=()=>{
  const el=document.getElementById('kview-defisit');
  const row=(lab,j)=>{const a=K('Agu',j),s=K('Sep',j);return `<tr><td class="l">${lab}</td><td class="num">${rp(a.tot)}</td><td class="num">${rp(s.tot)}</td><td class="num">${rp(a.rs)}</td><td class="num">${rp(s.rs)}</td><td class="num">${rp(-a.sel)}</td><td class="num">${rp(-s.sel)}</td><td class="num">${pct(a.tot/a.rs)}</td><td class="num">${pct(s.tot/s.rs)}</td><td class="num">${pct(a.def_n/a.n,0)} → ${pct(s.def_n/s.n,0)}</td></tr>`};
  el.innerHTML=`
  <div class="kcaveat"><b>Cara membaca.</b> Defisit di sini adalah Tarif RS dikurangi Total Tarif INA-CBG per klaim. Tarif RS adalah tarif layanan menurut rumah sakit, bukan biaya produksi, sehingga angka ini menunjukkan jarak tarif, bukan kerugian akuntansi. Kolom defisit adalah selisih neto: klaim yang dibayar di atas Tarif RS sudah mengurangi defisit. Nilai bruto defisit dan surplus dipisah di tabel kanan bawah.</div>
  <div class="card" style="margin-top:14px"><h2>Ringkasan selisih</h2><div class="ktbl"><table><thead><tr><th class="l">Jenis</th><th class="num">Klaim Agu</th><th class="num">Klaim Sep</th><th class="num">Tarif RS Agu</th><th class="num">Tarif RS Sep</th><th class="num">Defisit Agu</th><th class="num">Defisit Sep</th><th class="num">Rasio Agu</th><th class="num">Rasio Sep</th><th class="num">Klaim di bawah Tarif RS</th></tr></thead><tbody>${row('Rawat inap','RI')}${row('Rawat jalan','RJ')}<tr class="tot">${row('Total','ALL').slice(4)}</tbody></table></div></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Defisit terbesar · rawat jalan</h2><p class="knote">Tarif RS dikurangi klaim, per kelompok INA-CBG. Urut menurut September.</p><div id="k-d-rj"></div></div>
   <div class="card"><h2>Defisit terbesar · rawat inap</h2><p class="knote">Sama seperti di kiri.</p><div id="k-d-ri"></div></div>
   <div class="card"><h2>Kasus dengan klaim di bawah Tarif RS</h2><p class="knote">Jumlah klaim yang mengalami defisit.</p><div id="k-d-n"></div></div>
   <div class="card"><h2>Defisit dan surplus bruto</h2><p class="knote">Jumlah selisih klaim yang di bawah (defisit) dan di atas (surplus) Tarif RS, sebelum dinetralkan.</p><div class="ktbl" id="k-d-gs"></div></div>
  </div>`;
  const tops=cs=>cs.slice().sort((x,y)=>y.defS-x.defS).slice(0,8).map(c=>({label:c.code+' '+c.desc,a:Math.max(c.defA,0),s:Math.max(c.defS,0)}));
  hbars(document.getElementById('k-d-rj'),tops(rjCodes),{fmt:rp,title:'Defisit RJ',tone:'bad'});
  hbars(document.getElementById('k-d-ri'),tops(riCodes),{fmt:rp,title:'Defisit RI',tone:'bad'});
  vbars(document.getElementById('k-d-n'),['Rawat inap','Rawat jalan'],[K('Agu','RI').def_n,K('Agu','RJ').def_n],[K('Sep','RI').def_n,K('Sep','RJ').def_n],{tone:'bad',title:'Kasus defisit'});
  const gs=j=>{const a=K('Agu',j),s=K('Sep',j);return `<tr><td class="l">${JN[j]}</td><td class="num">${rp(a.def_amt)}</td><td class="num">${rp(s.def_amt)}</td><td class="num">${rp(a.sur_amt)}</td><td class="num">${rp(s.sur_amt)}</td></tr>`};
  document.getElementById('k-d-gs').innerHTML='<table><thead><tr><th class="l">Jenis</th><th class="num">Defisit bruto Agu</th><th class="num">Defisit bruto Sep</th><th class="num">Surplus bruto Agu</th><th class="num">Surplus bruto Sep</th></tr></thead><tbody>'+gs('RI')+gs('RJ')+gs('ALL')+'</tbody></table>';
};

/* ===== Case-mix ===== */
R.casemix=()=>{
  const el=document.getElementById('kview-casemix');
  el.innerHTML=`
  <div class="ktoolbar"><span class="kl">Jenis layanan</span><div class="kseg" id="k-cj"></div></div>
  <div class="kgrid kg2">
   <div class="card"><h2>Kelompok penyakit (MDC iDRG)</h2><p class="knote">Pendapatan klaim per Major Diagnostic Category menurut keluaran grouper iDRG di berkas. Delapan teratas menurut September.</p><div id="k-mdc-b"></div></div>
   <div class="card"><h2>Kode INA-CBG baru dan hilang</h2><p class="knote">Kode yang hanya muncul di salah satu bulan (nilai kecil, sering kasus langka).</p><div id="k-cm-new"></div></div>
  </div>
  <h3 class="ksect">Semua kelompok INA-CBG</h3>
  <div class="card"><div class="ktoolbar"><div id="k-cq"></div><span class="ksmall" id="k-cc"></span></div><div class="ktbl" id="k-cm-t" style="max-height:560px;overflow:auto"></div></div>`;
  let tb;
  const draw=j=>{
    const cs=j==='RI'?riCodes:rjCodes;
    const md=D.mdc[j].map(r=>({label:r.k||'(tanpa MDC)',a:r.Agu.tot,s:r.Sep.tot,n:r.Sep.n})).sort((x,y)=>y.s-x.s).slice(0,8);
    hbars(document.getElementById('k-mdc-b'),md,{fmt:rp,title:'MDC'});
    const nw=cs.filter(c=>c.Agu.n===0||c.Sep.n===0).sort((x,y)=>Math.abs(y.dt)-Math.abs(x.dt));
    const nb=cs.filter(c=>c.Agu.n===0).length,nh=cs.filter(c=>c.Sep.n===0).length;
    document.getElementById('k-cm-new').innerHTML=`<div class="ksmall" style="margin-bottom:8px">${nb} kode baru di September (${rp(sum(cs.filter(c=>c.Agu.n===0).map(c=>c.Sep.tot)))}) · ${nh} kode tidak muncul lagi (${rp(sum(cs.filter(c=>c.Sep.n===0).map(c=>c.Agu.tot)))})</div><div class="ktbl"><table><tbody>`+
      nw.slice(0,7).map(c=>`<tr><td class="l">${esc(c.code)} ${esc(c.desc)}</td><td class="num"><span class="kkchip ${c.Agu.n===0?'good':'bad'}">${c.Agu.n===0?'baru':'hilang'}</span></td><td class="num">${c.Agu.n===0?c.Sep.n:c.Agu.n} kasus</td><td class="num">${rp(Math.abs(c.dt))}</td></tr>`).join('')+'</tbody></table></div>';
    const rows=cs.map(c=>Object.assign({_s:(c.code+' '+c.desc).toLowerCase()},c));
    tb=table(document.getElementById('k-cm-t'),[
      {k:'code',h:'Kode',cls:'l',v:r=>r.code,f:r=>r.code},{k:'desc',h:'Kelompok',cls:'l',v:r=>r.desc,f:r=>esc(r.desc)},
      {k:'na',h:'Klaim Agu',v:r=>r.Agu.n,f:r=>nf.format(r.Agu.n)},{k:'ns',h:'Klaim Sep',v:r=>r.Sep.n,f:r=>nf.format(r.Sep.n)},{k:'dn',h:'Δ klaim',v:r=>r.dn,f:r=>sg(r.dn,nf.format)},
      {k:'ta',h:'Pendapatan Agu',v:r=>r.Agu.tot,f:r=>rp(r.Agu.tot)},{k:'ts',h:'Pendapatan Sep',v:r=>r.Sep.tot,f:r=>rp(r.Sep.tot)},{k:'dt',h:'Δ pendapatan',v:r=>r.dt,f:r=>sg(r.dt,rp)},
      {k:'df',h:'Defisit Sep',v:r=>r.defS,f:r=>rp(r.defS)}],rows,{sort:'ts',count:document.getElementById('k-cc')});
    combo(document.getElementById('k-cq'),{ph:'Cari kode atau nama kelompok, mis. pernafasan',items:rows.map(r=>({id:r.code,text:r.code+' '+r.desc,s:r._s,sub:nf.format(r.Sep.n)+' klaim Sep · '+rp(r.Sep.tot)})),onType:v=>tb.search(v),onPick:it=>tb.only(it?r=>r.code===it.id:null)});
  };
  seg('cj',[['RI','Rawat inap'],['RJ','Rawat jalan']],'RI',draw);draw('RI');
};

/* ===== DPJP ===== */
R.dpjp=()=>{
  const el=document.getElementById('kview-dpjp');
  el.innerHTML=`<div class="kcaveat"><b>Gunakan dengan hati-hati.</b> Angka per DPJP mencerminkan jenis kasus (case-mix) dan keparahan yang ditangani, bukan kinerja. Bandingkan rasio klaim/Tarif RS dan rata-rata klaim per kasus, bukan volume mentah.</div>
  <div class="ktoolbar" style="margin-top:14px"><span class="kl">Jenis layanan</span><div class="kseg" id="k-dj"></div><div id="k-dq"></div><span class="ksmall" id="k-dc"></span></div>
  <div class="ksmall" id="k-dnote" style="margin-bottom:10px"></div>
  <div class="kgrid kg2"><div class="card" style="grid-column:1/-1"><h2>10 DPJP dengan pendapatan klaim terbesar</h2><div id="k-dp-b"></div></div></div>
  <div class="card" style="margin-top:14px"><div class="ktbl" id="k-dp-t" style="max-height:600px;overflow:auto"></div></div>`;
  let tb;
  const draw=j=>{
    const rows=D.dpjp[j].map(r=>({_s:r.k.toLowerCase(),name:r.k||'(tanpa DPJP)',a:r.Agu,s:r.Sep,ri:r.ri?r.ri.Sep:0,rj:r.rj?r.rj.Sep:0}));
    document.getElementById('k-dnote').innerHTML=j==='ALL'?`<b>Gabungan:</b> klaim rawat inap dan rawat jalan dijumlahkan per DPJP (${rows.length} DPJP). Kolom RI dan RJ Sep memisahkan asalnya. Rata-rata klaim per kasus bercampur kasus inap (mahal) dan jalan (murah), jadi tidak sebanding antar DPJP dengan proporsi RI/RJ berbeda.`:'';
    hbars(document.getElementById('k-dp-b'),rows.slice().sort((x,y)=>y.s.tot-x.s.tot).slice(0,10).map(r=>({label:r.name,a:r.a.tot,s:r.s.tot})),{fmt:rp,lw:Math.min(300,Math.floor(W(document.getElementById('k-dp-b'))*.45)),title:'Top DPJP'});
    tb=table(document.getElementById('k-dp-t'),[
      {k:'name',h:'DPJP',cls:'l',v:r=>r.name,f:r=>esc(r.name)},].concat(j==='ALL'?[{k:'ris',h:'RI Sep',v:r=>r.ri,f:r=>nf.format(r.ri)},{k:'rjs',h:'RJ Sep',v:r=>r.rj,f:r=>nf.format(r.rj)}]:[]).concat([
      {k:'na',h:'Klaim Agu',v:r=>r.a.n,f:r=>nf.format(r.a.n)},{k:'ns',h:'Klaim Sep',v:r=>r.s.n,f:r=>nf.format(r.s.n)},{k:'dn',h:'Δ klaim',v:r=>r.s.n-r.a.n,f:r=>sg(r.s.n-r.a.n,nf.format)},
      {k:'ta',h:'Pendapatan Agu',v:r=>r.a.tot,f:r=>rp(r.a.tot)},{k:'ts',h:'Pendapatan Sep',v:r=>r.s.tot,f:r=>rp(r.s.tot)},{k:'dt',h:'Δ pendapatan',v:r=>r.s.tot-r.a.tot,f:r=>sg(r.s.tot-r.a.tot,rp)},
      {k:'ra',h:'Rasio Agu',v:r=>r.a.rs?r.a.tot/r.a.rs:0,f:r=>r.a.rs?pct(r.a.tot/r.a.rs,0):'–'},{k:'rs',h:'Rasio Sep',v:r=>r.s.rs?r.s.tot/r.s.rs:0,f:r=>r.s.rs?pct(r.s.tot/r.s.rs,0):'–'},
      {k:'avg',h:'Klaim/kasus Sep',v:r=>r.s.n?r.s.tot/r.s.n:0,f:r=>r.s.n?rp(r.s.tot/r.s.n):'–'}]),rows,{sort:'ts',count:document.getElementById('k-dc')});
    combo(document.getElementById('k-dq'),{ph:'Cari nama DPJP, mis. Pandu',items:rows.map(r=>({id:r.name,text:r.name,s:r.name.toLowerCase(),sub:nf.format(r.s.n)+' klaim Sep · '+rp(r.s.tot)})),onType:v=>tb.search(v),onPick:it=>tb.only(it?r=>r.name===it.id:null)});
  };
  seg('dj',[['ALL','Gabungan RI + RJ'],['RI','Rawat inap'],['RJ','Rawat jalan']],'ALL',draw);draw('ALL');
};

/* ===== Biaya ===== */
R.biaya=()=>{
  const el=document.getElementById('kview-biaya');
  const NM={PROSEDUR_NON_BEDAH:'Prosedur non-bedah',PROSEDUR_BEDAH:'Prosedur bedah',KONSULTASI:'Konsultasi',TENAGA_AHLI:'Tenaga ahli',KEPERAWATAN:'Keperawatan',PENUNJANG:'Penunjang',RADIOLOGI:'Radiologi',LABORATORIUM:'Laboratorium',REHABILITASI:'Rehabilitasi',KAMAR_AKOMODASI:'Kamar/akomodasi',RAWAT_INTENSIF:'Rawat intensif',OBAT:'Obat',ALKES:'Alkes',BMHP:'BMHP',SEWA_ALAT:'Sewa alat'};
  el.innerHTML=`<div class="kcaveat"><b>Catatan.</b> Komponen biaya adalah rincian Tarif RS (billing rumah sakit) per kelompok tagihan di berkas e-klaim. Jumlah seluruh komponen sama dengan Tarif RS untuk semua 16.593 klaim.</div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Rawat inap</h2><p class="knote">Tarif RS per komponen.</p><div id="k-bi-ri"></div></div>
   <div class="card"><h2>Rawat jalan</h2><p class="knote">Tarif RS per komponen.</p><div id="k-bi-rj"></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Perubahan komponen</h2><div class="ktbl" id="k-bi-t"></div></div>`;
  ['RI','RJ'].forEach(j=>{
    const ks=Object.keys(NM).filter(k=>D.comp[j].Agu[k]+D.comp[j].Sep[k]>0).sort((x,y)=>D.comp[j].Sep[y]-D.comp[j].Sep[x]);
    hbars(document.getElementById('k-bi-'+j.toLowerCase()),ks.slice(0,10).map(k=>({label:NM[k],a:D.comp[j].Agu[k],s:D.comp[j].Sep[k]})),{fmt:rp,lw:130,title:'Komponen '+j});
  });
  const t=j=>{const A=sum(Object.values(D.comp[j].Agu)),S=sum(Object.values(D.comp[j].Sep));return Object.keys(NM).filter(k=>D.comp[j].Agu[k]+D.comp[j].Sep[k]>0).sort((x,y)=>D.comp[j].Sep[y]-D.comp[j].Sep[x]).map(k=>`<tr><td class="l">${NM[k]}</td><td class="num">${rp(D.comp[j].Agu[k])}</td><td class="num">${rp(D.comp[j].Sep[k])}</td><td class="num">${chg(D.comp[j].Agu[k],D.comp[j].Sep[k],null)}</td><td class="num">${pct(D.comp[j].Agu[k]/A)} → ${pct(D.comp[j].Sep[k]/S)}</td></tr>`).join('')};
  const head=n=>`<tr class="tot"><td class="l" colspan="5" style="background:var(--soft)">${n}</td></tr>`;
  document.getElementById('k-bi-t').innerHTML='<table><thead><tr><th class="l">Komponen</th><th class="num">Agu</th><th class="num">Sep</th><th class="num">Δ</th><th class="num">Porsi Agu → Sep</th></tr></thead><tbody>'+head('Rawat inap')+t('RI')+head('Rawat jalan')+t('RJ')+'</tbody></table>';
};

/* ===== Proses & iDRG ===== */
R.proses=()=>{
  const el=document.getElementById('kview-proses');
  const A=K('Agu'),S=K('Sep');
  el.innerHTML=`<div class="kcaveat"><b>Tafsiran penanda waktu.</b> Waktu proses dihitung dari tanggal pulang ke tanggal-jam yang tercatat di bidang C2 berkas e-klaim (diduga waktu grouping/finalisasi klaim). Ini inferensi dari struktur berkas dan belum dikonfirmasi; berkas September ditarik 2 Oktober, Agustus 3 September.</div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Proses klaim rawat inap</h2><p class="knote">Jumlah klaim menurut hari dari tanggal pulang ke grouping. Median ${D.lag_med.RI.Agu} → ${D.lag_med.RI.Sep} hari, rata-rata ${D.lag_mean.RI.Agu} → ${D.lag_mean.RI.Sep}.</p><div id="k-p-ri"></div></div>
   <div class="card"><h2>Proses klaim rawat jalan</h2><p class="knote">Median ${D.lag_med.RJ.Agu} → ${D.lag_med.RJ.Sep} hari, rata-rata ${D.lag_mean.RJ.Agu} → ${D.lag_mean.RJ.Sep}.</p><div id="k-p-rj"></div></div>
  </div>
  <h3 class="ksect">Versi grouper INA-CBG</h3>
  <div class="card"><ul class="kfind">
   <li><b>${nf.format(D.v9.n)} klaim September (${pct(D.v9.n/S.n)}; ${rp(D.v9.tot)})</b> dikelompokkan ulang dengan versi 5.10.9 (rilis 29 September) pada 1–2 Oktober. Sisanya memakai 5.10.8.</li>
   <li class="g">Tarif INA-CBG untuk kombinasi kode dan kelas yang sama <b>tidak berbeda</b> antarversi maupun antarbulan (0 dari 490 kombinasi punya lebih dari satu tarif), jadi pergantian versi tidak menggeser nilai klaim untuk kelompok yang sama. Perubahan kode klaim individual akibat regrouping tidak dapat dinilai karena berkas tidak memuat hasil grouping sebelumnya.</li>
  </ul></div>
  <h3 class="ksect">Simulasi iDRG pada berkas</h3>
  <div class="kcaveat" style="margin-bottom:14px"><b>Indikatif.</b> Setiap klaim memuat keluaran grouper iDRG (kode DRG, cost weight, tarif). Nilai berasal dari berkas dan memakai tarif dasar yang tersimpan di sana (rawat inap Rp 8.037.060 dan rawat jalan Rp 461.474 per cost weight). Belum dikonfirmasi sebagai tarif pembayaran resmi untuk RS ini.</div>
  <div class="kgrid kg2">
   <div class="card"><h2>Rawat inap</h2><p class="knote">Klaim INA-CBG, simulasi iDRG, dan Tarif RS.</p><div id="k-i-ri"></div></div>
   <div class="card"><h2>Rawat jalan</h2><p class="knote">Klaim INA-CBG, simulasi iDRG, dan Tarif RS.</p><div id="k-i-rj"></div></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="ktbl"><table><thead><tr><th class="l">Jenis · bulan</th><th class="num">INA-CBG</th><th class="num">iDRG (simulasi)</th><th class="num">iDRG ÷ INA-CBG</th><th class="num">Tarif RS</th><th class="num">iDRG ÷ Tarif RS</th></tr></thead><tbody>${
   ['RI','RJ','ALL'].flatMap(j=>P.map(p=>{const k=K(p,j);return `<tr><td class="l">${JN[j]} · ${p}</td><td class="num">${rp(k.tot)}</td><td class="num">${rp(k.idrg)}</td><td class="num">${pct(k.idrg/k.tot,1)}</td><td class="num">${rp(k.rs)}</td><td class="num">${pct(k.idrg/k.rs,1)}</td></tr>`})).join('')}</tbody></table></div></div>`;
  const lb=['0–3 hari','4–7','8–14','>14'];
  vbars(document.getElementById('k-p-ri'),lb,D.lag.RI.Agu,D.lag.RI.Sep,{tone:'flat',title:'Proses RI'});
  vbars(document.getElementById('k-p-rj'),lb,D.lag.RJ.Agu,D.lag.RJ.Sep,{tone:'flat',title:'Proses RJ'});
  ['RI','RJ'].forEach(j=>{const a=K('Agu',j),s=K('Sep',j);vbars(document.getElementById('k-i-'+j.toLowerCase()),['INA-CBG','iDRG (simulasi)','Tarif RS'],[a.tot,a.idrg,a.rs],[s.tot,s.idrg,s.rs],{fmt:rp,ax:rpAx,title:'iDRG '+j})});
};

/* ===== Kualitas data ===== */
R.data=()=>{
  const el=document.getElementById('kview-data');
  const files=[['Rawat inap Agustus',972,972],['Rawat jalan Agustus',7110,7110],['Rawat inap September',1116,1116],['Rawat jalan September',7395,7395]];
  el.innerHTML=`
  <div class="card"><h2>Rekonsiliasi berkas TXT dengan Rekap Klaim XLSX</h2><p class="knote">Dicocokkan per nomor SEP. Seluruh selisih nol.</p><div class="ktbl"><table><thead><tr><th class="l">Berkas</th><th class="num">Baris TXT</th><th class="num">Baris XLSX</th><th class="num">SEP tak cocok</th><th class="num">Selisih Total Tarif</th><th class="num">Selisih Tarif RS</th><th class="num">Selisih kode INA-CBG</th></tr></thead><tbody>${files.map(f=>`<tr><td class="l">${f[0]}</td><td class="num">${nf.format(f[1])}</td><td class="num">${nf.format(f[2])}</td><td class="num ok">0</td><td class="num ok">Rp 0</td><td class="num ok">Rp 0</td><td class="num ok">0</td></tr>`).join('')}<tr class="tot"><td class="l">Total</td><td class="num">16.593</td><td class="num">16.593</td><td class="num">0</td><td class="num">Rp 0</td><td class="num">Rp 0</td><td class="num">0</td></tr></tbody></table></div></div>
  <div class="kgrid kg2" style="margin-top:14px">
   <div class="card"><h2>Pemeriksaan lolos</h2><ul class="kfind">
    <li class="g">Tidak ada nomor SEP ganda, baik dalam satu berkas maupun lintas keempat berkas.</li>
    <li class="g">Total Tarif sama dengan jumlah komponen (INA-CBG + special CMG) untuk seluruh klaim.</li>
    <li class="g">Jumlah 15 komponen biaya sama dengan Tarif RS untuk seluruh klaim.</li>
    <li class="g">Rentang tanggal pulang tepat 1–31 Agustus dan 1–30 September; tidak ada hari tanpa klaim.</li>
    <li class="g">Tarif per kombinasi kode INA-CBG dan kelas konsisten (satu tarif per kombinasi).</li>
    <li class="g">Special CMG hanya satu jenis: fakoemulsifikasi (SP), ${nf.format(62)} klaim rawat jalan, termasuk dalam Total Tarif.</li>
   </ul></div>
   <div class="card"><h2>Perlu diperiksa</h2><ul class="kfind">
    <li class="w">Dua pasang klaim rawat jalan September (${D.dupRJ.n} klaim, ${rp(D.dupRJ.amt,true)}, kode Q-5-44-0) memiliki No. RM, tanggal pulang, dan kode INA-CBG sama dengan SEP berbeda. Bisa kunjungan sah ke poli berbeda, tetapi layak diverifikasi.</li>
    <li class="w">Status pulang rawat jalan “lain-lain” melonjak dari ${D.status.RJ.Agu['5']} menjadi ${D.status.RJ.Sep['5']} klaim, sedangkan status meninggal turun dari ${D.status.RJ.Agu['4']} menjadi ${D.status.RJ.Sep['4']}. Tidak ada penjelasan klinis di berkas; cek proses entri.</li>
    <li class="w">${D.carry.Agu} klaim rawat inap Agustus dan ${D.carry.Sep} klaim September masuk di bulan sebelumnya; dalam analisis ini semuanya dihitung pada bulan tanggal pulang.</li>
    <li class="w">Diagnosis B34.9 (infeksi virus, tidak spesifik) menjadi diagnosis utama pada ${D.diagA.Sep['B34.9']} klaim September, dua kali lipat Agustus. Perlu audit kodefikasi.</li>
    <li class="w">Penulisan nama DPJP tidak seragam antarberkas (huruf besar “DR. … SP.PD” di satu berkas, “dr. … Sp.PD” di berkas lain). Dashboard menggabungkannya tanpa membedakan huruf besar/kecil dan titik: rawat inap 41 → 27 DPJP, rawat jalan 58 → 33. Tanpa penggabungan ini, perbandingan per DPJP antarbulan akan keliru.</li>
   </ul></div>
  </div>
  <h3 class="ksect">Keterbatasan analisis</h3>
  <div class="card"><ul class="kfind">
   <li><b>Belum ada status verifikasi BPJS.</b> Berkas hanya memuat klaim yang diajukan; klaim pending, dispute, atau yang dikoreksi verifikator tidak terlihat. Pendapatan di dashboard adalah nilai ajuan, bukan pendapatan yang sudah pasti dibayar.</li>
   <li><b>Periode memakai tanggal pulang,</b> bukan tanggal pengajuan. Klaim yang difinalisasi setelah tanggal tarik berkas (3 September untuk Agustus, 2 Oktober untuk September) tidak tercakup. Jumlah klaim di tanggal akhir bulan normal, yang mengindikasikan cakupan lengkap, tetapi revisi susulan tidak bisa dipastikan.</li>
   <li><b>Tarif RS bukan unit cost.</b> Selisih terhadap tarif INA-CBG menunjukkan jarak tarif; kerugian riil memerlukan costing.</li>
   <li><b>Hari libur diinferensi dari data</b> (hari kerja dengan klaim rawat jalan kurang dari 100), bukan dari kalender resmi.</li>
   <li><b>Satu bulan melawan satu bulan.</b> Perbedaan dua bulan tidak menunjukkan tren; musim penyakit, jumlah hari kerja, dan kejadian luar biasa (klaster infeksi viral) bisa menggerakkan angka.</li>
   <li><b>Data pasien tidak ditampilkan.</b> Nama, nomor kartu, NIK, dan nomor SEP tidak dimasukkan ke dashboard.</li>
  </ul></div>`;
};

/* ---------------- Integrasi dengan Menu Utama MonEv P3A ---------------- */
const $q=id=>document.getElementById(id);
const ROOTS=['appRoot','appRootPendapatan','appRootGabungan'];
window.showKlaimApp=function(){
  $q('hubScreen').style.display='none';
  $q('comingSoonScreen').style.display='none';
  ROOTS.forEach(id=>{const e=$q(id);if(e)e.style.display='none'});
  $q('appRootKlaim').style.display='flex';
  Object.keys(rendered).forEach(k=>delete rendered[k]);
  show(curTab);
};
window.hideKlaimApp_=function(){const e=$q('appRootKlaim');if(e)e.style.display='none'};
function initKlaim(){
  document.querySelectorAll('.hub-menu-card[data-hub="klaim"]').forEach(c=>c.addEventListener('click',window.showKlaimApp));
  const home=$q('btnHomeMenuK');if(home)home.addEventListener('click',()=>{if(typeof showHub==='function')showHub()});
  const rf=$q('btnRefreshK');if(rf)rf.addEventListener('click',()=>{Object.keys(rendered).forEach(k=>delete rendered[k]);show(curTab)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initKlaim);else initKlaim();
})();
