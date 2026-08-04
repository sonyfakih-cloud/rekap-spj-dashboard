// Isi APPS_SCRIPT_URL setelah Anda deploy Code.gs sebagai Web App (lihat PANDUAN_DEPLOY.md).
// Contoh: "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec"
// Kalau dikosongkan, dashboard tetap jalan pakai data bawaan (data.js / snapshot di REKAP_DATA).
// PENTING: pakai "window.APPS_SCRIPT_URL =" (bukan "const APPS_SCRIPT_URL =").
// Alasan: app.js mengecek keberadaan variabel ini lewat "window.APPS_SCRIPT_URL".
// Kalau dideklarasikan dengan const/let di top-level <script>, JS TIDAK
// menempelkannya ke objek window (beda dengan var) -- jadi window.APPS_SCRIPT_URL
// akan selalu undefined dan dashboard akan selalu bilang "belum tersambung",
// walau nilainya sudah benar-benar diisi di sini. Ini akar masalah sebenarnya.
window.APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw2EQouYVdSHVIiwwB3q0TJxtLaQsCIgHSVyHM-UjgorvVAIh9Sdza5eDmjTQuQCCcYew/exec";

// ============ PASSWORD LOGIN ============
// Password default (dipakai selama GITHUB_* di bawah masih kosong):
const LOCAL_FALLBACK_PASSWORD = "belanjap3asf";

// (Opsional, lanjutan) Password terpusat via repo GitHub privat -- lihat
// PANDUAN_DEPLOY.md bagian "Password Login Terpusat" untuk cara membuatnya.
// Selama 4 nilai di bawah ini kosong, dashboard otomatis pakai LOCAL_FALLBACK_PASSWORD di atas.
// PENTING: token di sini HARUS fine-grained, read-only, dan hanya untuk 1 repo privat
// khusus berisi file password saja -- jangan pernah pakai token dengan akses lebih luas,
// karena token ini akan terlihat oleh siapa pun yang membuka source code situs ini.
const GITHUB_OWNER = "";
const GITHUB_REPO = "";
const GITHUB_FILE_PATH = "password.json";
const GITHUB_TOKEN = "";

// Lama sesi login tersimpan di browser (jam) sebelum diminta password lagi:
const AUTH_SESSION_HOURS = 12;
