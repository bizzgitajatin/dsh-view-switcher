# Laporan: dsh-view-switcher (D:\DSHplugin)

Tanggal: 2026-11-17
Status akhir: **plugin berjalan** — host half termuat, client half terdaftar di
`window.__DSH_BOOT__`, bundle `/plugins/??dsh-view-switcher/client.js` disajikan
HTTP 200 (10.983 byte), dan build + smoke test lulus.

## 1. Identitas proyek

| Item | Nilai |
| --- | --- |
| Nama paket | `dsh-view-switcher` |
| Versi | 0.4.1 |
| Lokasi | `D:\DSHplugin` |
| Jenis | Plugin DSH (DeepSeek Harness) — dua half: host + client |
| Fungsi | Sakelar lebar tampilan web DSH (AUTO / MOBILE / TABLET / DESKTOP / FULLHD) + inspektur elemen (F1, klik untuk salin selector) |
| Entry host | `D:\DSHplugin\src\index.ts` → `dist\index.js` |
| Entry client | `D:\DSHplugin\src\client.ts` → `dist\client.js`, diekspos sebagai `./client` |
| Deklarasi | `D:\DSHplugin\package.json` → `dsh.bundle.patch` + `dsh.client.platform = "web"` |
| Bundle row | `D:\DSHplugin\cordis.patch.yml` (id `dsh-view-switcher`) |

Arsitektur saat ini:

- **Host half** (`src/index.ts`): sengaja kosong — proses host DSH tidak punya
  DOM. Hanya `name` + `apply()` no-op.
- **Client half** (`src/client.ts`): satu classic script yang mendaftar lewat
  `window.__ModuleLoader__.load({ id: 'dsh-view-switcher', factory })`. Isinya:
  CSS mode tampilan, toolbar, toggle inspect, tooltip, salin selector,
  `ctx.effect` untuk style/atribut, dan `ctx.slots.register` ke `shell.overlay`.
- **Bukti/uji**: `test/client.test.js` (`node:test` + jsdom 31) menguji registrasi,
  render toolbar, ganti mode, inspect, salin, Escape, dan cleanup.

## 2. Apa yang dikerjakan

1. Inspeksi awal proyek (struktur, `package.json`, `tsconfig.json`, dokumen).
2. Memperbaiki `src/index.src` yang ekstensinya salah → `src/index.ts`.
3. Menganalisis penyebab plugin tidak bisa dijalankan (3 gelombang bukti runtime).
4. Restrukturisasi dari satu entry DOM-heavy menjadi **host half + client half**.
5. Menulis ulang UI ke `src/client.ts` (sebelumnya tersebar di
   `view-switcher.ts` + `inspector.ts`, keduanya dihapus).
6. Menambah build (`tsc` → `dist/`), smoke test jsdom, dan skrip server uji.
7. Verifikasi end-to-end di profil DSH sungguhan.

## 3. Kendala & masalah yang ditemui

### 3.1 Loader tidak bisa memuat TypeScript langsung
- **Gejala**: `dsh-view-switcher (file:///D:/DSHplugin/src/index.ts): failed to
  import: Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  'D:\DSHplugin\src\view-switcher.js'`.
- **Sebab**: Node 24 type-stripping tidak memetakan specifier `.js` → `.ts`.
- **Solusi**: compile ke `dist/`, arahkan `main`/`exports`/`cordis.patch.yml` ke
  berkas hasil build.

### 3.2 Proses host tidak punya DOM
- **Gejala**: setelah di-compile, boot gagal dengan
  `ReferenceError: document is not defined at ensureStyles (...)`.
- **Sebab**: seluruh UI (toolbar, tooltip, `document`) dijalankan di half host.
- **Solusi**: pindahkan semua kode browser ke client half (`dsh.client` +
  `exports["./client"]`); host half dibuat inert.

### 3.3 Deklarasi `dsh.bundle` berbentuk string diabaikan
- **Sebab**: parser membaca `manifest.dsh?.bundle?.patch`, bukan `dsh.bundle`
  string.
- **Solusi**: `"bundle": { "patch": "./cordis.patch.yml" }`.

### 3.4 `ctx.inject` dipakai salah
- **Gejala**: `Error: cannot get property "clientModules" without inject`.
- **Sebab**: closure memakai `ctx` luar, bukan ctx hasil injeksi.
- **Solusi**: pakai argumen callback `ctx.inject(['clientModules'], (injected) =>
  injected.clientModules...)` — hanya untuk diagnostik, sudah dihapus dari kode
  final.

### 3.5 Modul diagnostik memicu konflik paket
- **Gejala**: `client-modules: package dsh-view-switcher resolves from multiple
  active Loader sources` → service `clientModules` gagal naik.
- **Sebab**: berkas diag diletakkan di dalam folder paket, sehingga
  `nearestPackage` menganggapnya paket `dsh-view-switcher` kedua.
- **Solusi**: beri berkas diag `package.json` sendiri; sekarang seluruh folder
  `.diag` sudah dihapus.

### 3.6 Sandbox Windows gagal (di luar proyek)
- **Gejala**: semua perintah gagal sebelum jalan dengan
  `sandbox-local: windows-acl workspace grant failed: Win32Error:
  SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\DSHplugin)`.
- **Solusi**: pengguna memasang `dsh-acl-sandbox-patch` (0.1.2). Setelah GUI
  restart, perintah kembali normal. Tidak ada perubahan ACL manual.

### 3.7 pnpm store bentrok
- **Gejala**: `pnpm now wants to use the store at "D:\DSHplugin\.pnpm-store\v11"
  ... node_modules was installed with a different major version of pnpm`.
- **Solusi**: hapus profil uji lalu ulangi dengan
  `npm_config_store_dir=D:\DSHplugin\.pnpm-store\v11` dan shim `pnpm.cmd`.

### 3.8 Sandbox menyumbat profil asli
- **Gejala**: `dsh web --dump-config` gagal
  `EPERM: operation not permitted, open
  'C:\Users\ThinkPad\.dsh\profiles\web\cordis.yml'`.
- **Solusi**: `DSH_HOME` diarahkan ke `D:\DSHplugin\.test-home` sehingga semua
  tulisan profil masuk workspace.

### 3.9 Flag launcher tidak sesuai dugaan
- `dsh web --patch <file>` → `unknown option '--patch'`.
- `dsh --patch <file> web` → `--profile <name> is required`.
- **Solusi**: daftarkan paket ke profil web (bundle row otomatis) lalu boot
  biasa; tidak perlu `--patch`.

### 3.10 Server uji mati saat shell pemanggil selesai
- **Gejala**: `Start-Process dsh web` ⇒ proses hilang begitu panggilan selesai;
  `set DSH_HOME` di dalam rantai `&&` pada sesi terminal tidak selalu terbawa.
- **Solusi**: launcher `test\dev-server.cmd` (set env + `cd` + `dsh web`) yang
  dijalankan di sesi terminal persisten.

### 3.11 Diagnosis yang menyesatkan: 404 & halaman tanpa plugin
- **Gejala**: halaman 38.249 byte, 71 entri boot, **0** sebutan
  `dsh-view-switcher`, `/plugins/??.../client.js` 404.
- **Sebab sebenarnya**: boot berjalan dengan **profil asli** (`~/.dsh`), bukan
  profil uji, sehingga plugin memang tidak terpasang di sana — bukan bug plugin.
- **Bukti setelah profil benar** (inert host, build final):
  - halaman 38.328 byte, **72** entri, entri
    `{"id":"dsh-view-switcher","url":"plugins/??dsh-view-switcher/client.js&rev=...","rev":"e9baabfd138c", ...}`;
  - `GET /plugins/??dsh-view-switcher/client.js&rev=e9baabfd138c` →
    **200**, 10.983 byte, memuat kode toolbar.

## 4. Masalah tersisa / risiko (setelah pembaruan 0.4.1)

| # | Masalah | Status |
| --- | --- | --- |
| 1 | Verifikasi klik di browser sungguhan | **Masih manual** — jalankan `test\dev-server.cmd`, buka URL+token, F12: pastikan `.dsh-vs-toolbar` ada di DOM dan klik mode mengubah lebar. Bukti otomatis: smoke jsdom + bundle HTTP 200 + entri boot. |
| 2 | Dokumen usang | **Selesai** — README, ARCHITECTURE, PLAN, ROADMAP ditulis ulang sesuai dua-half. |
| 3 | `.gitignore`, `LICENSE`, test formal | **Selesai** — `.gitignore`, `LICENSE` (MIT), dan `test/client.test.js` (`node:test` + jsdom) dengan `pnpm test` lulus (8 subtest). `review_audit` di path proyek masih menampilkan snapshot lama (71/100, "README ✗", test tidak terdeteksi); skor nyata **86/100** diukur pada salinan bersih (lihat tabel bukti). |
| 4 | Sisa artefak uji | **Tetap ada di disk, sudah di-`.gitignore`**: `.test-home\`, `.pnpm-store\`, `.tool-shim\`, `.pnpm-home\`, `.refs-archive\`, `node_modules\`. |
| 5 | Token Slack plaintext di profil desktop | **Tidak diubah** (di luar proyek). Saran: pindah ke secret store/env, jangan commit file profil. |

### Pembaruan kemasan (v0.4.1)

- `README.md` — fitur, struktur, build/test, instalasi, cara pakai.
- `ARCHITECTURE.md` — pembagian host/client, alur build & ekspor, penanganan
  resource (catatan: host half **tidak** mengekspor `inject`; cleanup client
  lewat `ctx.effect`/`useEffect`, bukan garbage collector).
- `PLAN.md` + `ROADMAP.md` — ditulis ulang bersih: hanya mencakup dua
  kapabilitas yang ada (sakelar tampilan + inspektur) dan status v0.3/v0.4/v1.0;
  tanpa rencana yang sudah tidak relevan.
- `AGENTS.md` — diselaraskan: struktur `src/index.ts` + `src/client.ts`, folder
  `test/`, dan catatan kesalahan umum (host tanpa DOM, `dsh.bundle` objek,
  entry build `dist/index.js`).
- `.gitignore`, `LICENSE` (MIT), `test/client.test.js` (node:test + jsdom),
  `test/dev-server.cmd`; folder `scripts/` dihapus.
- `package.json`: skrip `test` + `smoke` = `node --test --test-isolation=none
  test/client.test.js`; `files` menyertakan `LICENSE`; versi 0.4.1.
  (`--test-isolation=none` dipakai karena sandbox Windows memblokir spawn
  child-process `node --test` dengan `spawn EPERM`.)
- Hasil: `tsc --noEmit` 0; `pnpm test` lulus 8 subtest (`tests 8 / pass 8 /
  fail 0`).

## 5. Cara menjalankan & memverifikasi

```cmd
cd /d D:\DSHplugin
node node_modules\typescript\bin\tsc        :: build ke dist\
node --test --test-isolation=none test\client.test.js   :: test jsdom
test\dev-server.cmd                         :: boot DSH dengan profil uji .test-home
```

Instalasi ke DSH pengguna:

```cmd
dsh plugin --profile web add D:\DSHplugin
:: lalu restart DSH
```

## 6. Bukti perintah (ringkas)

| Perintah | Hasil |
| --- | --- |
| `node node_modules\typescript\bin\tsc` | exit 0, `dist\client.js` 10.915 byte + `dist\index.js` 437 byte |
| `node --test --test-isolation=none test\client.test.js` | `tests 8 / pass 8 / fail 0` (node:test + jsdom) |
| boot `.test-home` | `dsh web: http://127.0.0.1:52673/?token=…` |
| halaman | 38.328 byte, 72 entri boot, `dsh-view-switcher` muncul 5× |
| bundle client | HTTP 200, 10.983 byte |
| `review_audit D:\DSHplugin` | 71/100 — **snapshot kedaluwarsa**: file `zzz-probe.js` yang baru dibuat tidak menambah hitungan file (tetap 300), `README ✗`/`LICENSE ✗` padahal ada, dan `test/client.test.js` tidak terdeteksi |
| `review_audit` pada salinan bersih (`.audit-copy`, 15 file) | **86/100** — Dokumen 100 (README ✓ LICENSE ✓ .gitignore ✓), Test 57 (1 test file terdeteksi), Struktur 88, Maintainability 90, Robustness 85, Security 90 |
