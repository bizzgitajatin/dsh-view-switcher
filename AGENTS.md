# dsh-view-switcher — Agent Instructions

## Gambaran Proyek

Plugin DSH yang menyediakan:
1. Sakelar tampilan manual (auto / mobile / tablet / desktop / fullhd)
2. Inspeksi elemen dengan kursor (hover sorot + klik ambil selector)

Lokasi proyek: `D:/DSHplugin`

## Perintah Build & Jalankan

- Instalasi dependensi: `pnpm install`
- Build ke `dist/`: `pnpm build` (alias `tsc`)
- Pemeriksaan tipe: `pnpm typecheck` (alias `tsc --noEmit`)
- Test: `pnpm test` (`node --test --test-isolation=none test/client.test.js`)
- Debug lokal: `test\dev-server.cmd` → `dsh web` dengan profil uji `.test-home`

## Pengujian

- Test otomatis: `test/client.test.js` (node:test + jsdom) — registrasi modul,
  render toolbar, ganti mode, inspect/salin selector, cleanup.
- Verifikasi manual: boot `test\dev-server.cmd`, buka URL+token, F12 — pastikan
  `.dsh-vs-toolbar` ada di DOM dan klik mode mengubah `data-dsh-view-mode`.
- Verifikasi cleanup: unmount/hapus plugin → tidak ada style, listener, atau
  timer yang tersisa.
- Demo visual: `pnpm build; pnpm demo`, buka `demo/index.html` (variasi:
  `#mode=mobile`, `#inspect`) — dipakai untuk screenshot/uji tanpa DSH.

## Struktur Proyek
D:/DSHplugin/
├── AGENTS.md
├── PLAN.md
├── ROADMAP.md
├── ARCHITECTURE.md
├── README.md
├── LAPORAN.md
├── LICENSE
├── package.json
├── tsconfig.json
├── cordis.patch.yml
├── src/
│ ├── index.ts          (host half — inert)
│ └── client.ts         (client half — DOM/UI)
├── test/
│ ├── client.test.js
│ └── dev-server.cmd
├── demo/
│ ├── index.html        (mock repo GitHub + wiring __ModuleLoader__)
│ ├── client.js         (salinan dist/client.js — dibuat `pnpm demo`)
│ ├── prepare.mjs
│ ├── fetch-vendor.mjs
│ └── vendor/           (React 18 UMD untuk demo offline)
├── dist/               (hasil build)
└── scratch-plugin/
  ├── cordis.yml
  └── tsconfig.json

## Gaya Kode

- TypeScript strict mode, ESM (`"type": "module"`).
- Named exports, tidak ada default export.
- Setiap listener/timer WAJIB dibungkus `ctx.effect()` (host) atau `useEffect`
  dengan cleanup (client).
- Gaya UI menggunakan kelas CSS, hindari inline style kecuali untuk posisi dinamis.
- Log memakai prefix `[dsh-view-switcher]`.

## Batasan

- ✅ **Boleh**: Menambah tombol, listener, kelas CSS, tooltip.
- ⚠️ **Perlu konfirmasi**: Mengubah struktur DOM aplikasi DSH, menambah dependensi runtime.
- 🚫 **Dilarang**: Hardcode path selain `D:/DSHplugin`, `setInterval` langsung di `apply`, commit `.env`.

## Kesalahan Umum

- Entry host tidak boleh menyentuh `document`/`window` — host berjalan di Node.
  Semua UI ada di `src/client.ts` yang dimuat browser lewat `exports["./client"]`.
- `dsh.bundle` harus berupa objek `{ patch: "./cordis.patch.yml" }`, bukan string.
- `scratch-plugin/cordis.yml` menunjuk hasil build: `file:///D:/DSHplugin/dist/index.js`
  (bukan `src/index.ts` — Node tidak memetakan `./x.js` ke `x.ts`).
- Setiap file tambahan di bawah `D:/DSHplugin` yang dimuat sebagai loader row
  perlu `package.json` sendiri, kalau tidak akan bentrok dengan nama paket ini.
- `dist/` WAJIB di-commit (jangan di-.gitignore): `dsh plugin add github:...` memasang
  isi repo apa adanya, dan `package.json` hanya mengekspos `dist/index.js` + `dist/client.js`.
  Setiap perubahan `src/` → `pnpm build` → commit `src/` dan `dist/` bersama.
- Type checking (tsc) dan loading runtime (cordis) adalah dua jalur independen.
- `node --test` tanpa `--test-isolation=none` gagal `spawn EPERM` di sandbox Windows.
- Di DSH desktop (Electron) toolbar tidak ditaruh di jendela utama: deteksi lewat
  `Electron/` di user agent, protokol `dsh-app:`, atau bridge `dsh`/`dshPlatform`.
  Sebagai gantinya toolbar menempel pada panel Browser bawaan
  (`[data-sidebar-browser-frame]`, iframe di web / `<webview>` di desktop) dan
  mengubah lebar frame itu. Tanpa panel, tidak ada toolbar.
  Halaman uji bisa memakai `window.__DSH_VS_FORCE__ = true` (lihat `demo/index.html`).
- Inspektur isi panel: untuk `<webview>` dipakai `webview.executeJavaScript`
  (skrip `GUEST_INSPECTOR` menyorot & menyimpan selector di
  `window.__dshVsPicked`, host polling 250 ms lalu menyalinnya). iframe lintas-origin
  di DSH web tidak bisa dijangkau — tampilkan pesan, jangan diam-diam
  menginspeksi elemen frame.
