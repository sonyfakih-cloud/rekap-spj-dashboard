/* Gerbang password sederhana untuk dashboard.
 * CATATAN KEAMANAN: ini BUKAN keamanan data sesungguhnya. Siapa pun yang cukup teknis
 * (buka DevTools / lihat source) tetap bisa melihat data atau melewati pengecekan ini.
 * Gerbang ini hanya untuk mencegah orang awam/tidak berkepentingan membuka dashboard,
 * dan supaya password bisa diganti/dicabut terpusat lewat GitHub tanpa deploy ulang situs
 * (lihat PANDUAN_DEPLOY.md bagian "Password Login Terpusat").
 */
(function(){
  const STORAGE_KEY = 'spj_dashboard_auth';

  function isAuthed(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return false;
      const {ts} = JSON.parse(raw);
      const hours = (Date.now() - ts) / 36e5;
      return hours < (typeof AUTH_SESSION_HOURS !== 'undefined' ? AUTH_SESSION_HOURS : 12);
    }catch(e){ return false; }
  }

  function setAuthed(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ts: Date.now()}));
  }

  function clearAuthed(){
    localStorage.removeItem(STORAGE_KEY);
  }

  // Setelah login, yang tampil BUKAN langsung dashboard Belanja (appRoot),
  // tapi Menu Utama (hubScreen) berisi pilihan modul (Belanja / Pendapatan /
  // gabungan). appRoot baru ditampilkan kalau user klik kartu "Belanja" --
  // lihat showBelanjaApp() di app.js.
  function showApp(){
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('hubScreen').style.display = 'flex';
  }
  function showGate(){
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('hubScreen').style.display = 'none';
    document.getElementById('comingSoonScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'none';
    const rootP = document.getElementById('appRootPendapatan');
    if(rootP) rootP.style.display = 'none';
    const rootG = document.getElementById('appRootGabungan');
    if(rootG) rootG.style.display = 'none';
    // Jaga-jaga: kalau logout terjadi di tengah animasi intro sedang main,
    // pastikan ikut disembunyikan & di-reset supaya bisa muter lagi dari awal
    // kalau login ulang di sesi tab yang sama (tanpa reload halaman).
    const intro = document.getElementById('introAnimScreen');
    const stage = document.getElementById('introStage');
    if(intro) intro.classList.remove('show');
    if(stage) stage.classList.remove('play');
  }

  // Animasi logo (badge panah+koin) diputar SEKALI setiap kali password benar
  // dimasukkan, sebelum Menu Utama tampil -- lihat #introAnimScreen di
  // index.html & keyframes intro-* di style.css. User bisa lewati animasinya
  // dengan klik di mana saja pada layar animasi, atau tombol "Lewati ⟶";
  // kalau tidak diklik, otomatis lanjut sendiri setelah animasi selesai.
  function showIntroThenApp(){
    const intro = document.getElementById('introAnimScreen');
    const stage = document.getElementById('introStage');
    const authOverlay = document.getElementById('authOverlay');
    if(!intro || !stage){ showApp(); return; } // fallback kalau markup tidak ada
    authOverlay.style.display = 'none';

    // Reset dulu (jaga-jaga kalau sebelumnya sempat 'play' di sesi tab yang
    // sama tanpa reload halaman, mis. logout lalu login lagi) supaya animasi
    // selalu mulai dari awal, bukan lanjut dari state lama.
    stage.classList.remove('play');
    intro.classList.remove('show');
    void intro.offsetWidth; // paksa reflow biar restart animasi bersih
    intro.classList.add('show');
    requestAnimationFrame(function(){ stage.classList.add('play'); });

    let advanced = false;
    function goToApp(){
      if(advanced) return;
      advanced = true;
      intro.classList.remove('show');
      stage.classList.remove('play');
      showApp();
    }
    const skipBtn = document.getElementById('introSkip');
    if(skipBtn) skipBtn.onclick = goToApp;
    stage.onclick = goToApp;
    // Total durasi koreografi (rings -> panah -> checklist -> koin -> teks)
    // selesai sekitar detik ke-3.7; ditahan sebentar lagi (termasuk sedikit
    // efek floaty) baru otomatis lanjut ke Menu Utama kalau tidak di-skip.
    setTimeout(goToApp, 4800);
  }

  async function fetchRemotePassword(){
    const owner = (typeof GITHUB_OWNER !== 'undefined') ? GITHUB_OWNER : '';
    const repo = (typeof GITHUB_REPO !== 'undefined') ? GITHUB_REPO : '';
    const path = (typeof GITHUB_FILE_PATH !== 'undefined') ? GITHUB_FILE_PATH : 'password.json';
    const token = (typeof GITHUB_TOKEN !== 'undefined') ? GITHUB_TOKEN : '';
    if(!owner || !repo || !token) return (typeof LOCAL_FALLBACK_PASSWORD !== 'undefined') ? LOCAL_FALLBACK_PASSWORD : '';
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await fetch(url, {headers:{Authorization:`token ${token}`, Accept:'application/vnd.github.v3+json'}});
    if(!res.ok) throw new Error('Gagal mengambil password dari GitHub (status '+res.status+')');
    const json = await res.json();
    const decoded = decodeURIComponent(escape(atob(json.content.replace(/\n/g,''))));
    const data = JSON.parse(decoded);
    return data.password;
  }

  async function handleSubmit(e){
    e.preventDefault();
    const input = document.getElementById('authPassword');
    const errEl = document.getElementById('authError');
    const btn = document.getElementById('authSubmit');
    errEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Memeriksa...';
    try{
      const correct = await fetchRemotePassword();
      if(input.value === correct){
        setAuthed();
        showIntroThenApp();
      } else {
        errEl.textContent = 'Password salah. Coba lagi.';
        input.value = '';
        input.focus();
      }
    }catch(err){
      console.warn(err);
      // gagal ambil dari GitHub -> fallback ke password lokal supaya dashboard tetap bisa dibuka
      if(input.value === (typeof LOCAL_FALLBACK_PASSWORD !== 'undefined' ? LOCAL_FALLBACK_PASSWORD : '')){
        setAuthed(); showIntroThenApp();
      } else {
        errEl.textContent = 'Password salah, atau gagal terhubung ke server password. Coba lagi.';
      }
    } finally {
      btn.disabled = false; btn.textContent = 'Masuk';
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.getElementById('appRoot').style.display = 'none';
    const rootP0 = document.getElementById('appRootPendapatan');
    if(rootP0) rootP0.style.display = 'none';
    const rootG0 = document.getElementById('appRootGabungan');
    if(rootG0) rootG0.style.display = 'none';
    document.getElementById('hubScreen').style.display = 'none';
    document.getElementById('comingSoonScreen').style.display = 'none';
    if(isAuthed()){
      showApp();
    } else {
      showGate();
    }
    document.getElementById('authForm').addEventListener('submit', handleSubmit);
    // Dua tombol keluar: satu di dalam modul Belanja (fab #btnLogout), satu lagi
    // di Menu Utama (#hubLogout) -- keduanya pakai logika logout yang sama.
    ['btnLogout', 'btnLogoutP', 'btnLogoutG', 'hubLogout'].forEach(function(id){
      const btn = document.getElementById(id);
      if(btn) btn.addEventListener('click', function(){ clearAuthed(); showGate(); });
    });
  });
})();
