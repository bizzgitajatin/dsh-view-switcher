# Arsitektur dsh-view-switcher (v0.4.0)

Plugin ini hidup di dua lingkungan berbeda di dalam DSH, jadi kodenya sengaja
dipisah menjadi dua half.

## 1. Host half — `src/index.ts` → `dist/index.js`

- Berjalan di proses Node.js/Electron milik DSH. Proses ini **tidak punya DOM**.
- Isinya hanya `export const name = 'dsh-view-switcher'` dan `apply()` kosong.
- Tidak ada `inject` yang diperlukan: row loader dipasang lewat
  `cordis.patch.yml`, dan tidak ada pekerjaan host yang harus ditunggu.
- Semua kode DOM dipindah ke client half; kalau tidak, boot gagal dengan
  `ReferenceError: document is not defined`.

## 2. Client half — `src/client.ts` → `dist/client.js`

- Berjalan di browser/WebView. Didaftarkan lewat

  ```js
  window.__ModuleLoader__.load({
    id: 'dsh-view-switcher',
    factory(require) {
      const React = require('react')
      return { inject: ['slots'], apply: (ctx) => apply(ctx, React) }
    },
  })
  ```

- Modul ini **classic script**: tidak ada `import`/`export` di level atas, supaya
  hasil build tetap berjalan di module loader DSH.
- `apply(ctx, React)` melakukan dua hal:
  1. `ctx.effect` menyuntikkan `<style id="dsh-view-switcher-styles">` dan
     memasang atribut `data-dsh-view-mode` di `<html>`; cleanup mengembalikan
     keduanya saat plugin di-unload.
  2. `ctx.slots.inject('shell.overlay', () => ctx.slots.register({...},
     Overlay))` mendaftarkan toolbar + inspektur ke slot overlay frame-wide.
- Overlay memakai `useState` untuk mode/inspeksi/hover/toast dan `useEffect`
  untuk memasang listener `mousemove`, `click`, dan `keydown` (capture) — semua
  listener dicabut di cleanup effect.

## Alur build & ekspor

- TypeScript `tsc` target ES2022, `rootDir: src`, `outDir: dist`, `lib` berisi
  `ES2022` + `DOM` (client half butuh tipe DOM, host half tidak memakainya).
- `package.json`:
  - `main` / `exports["."]` → `./dist/index.js` (host loader),
  - `exports["./client"]` → `./dist/client.js` (web server DSH),
  - `dsh.bundle.patch` → `./cordis.patch.yml`,
  - `dsh.client.platform = "web"` dan `immediately: true`.
- DSH membaca `exports["./client"]` sebagai bundle browser; tanpa entri itu
  loader melempar
  `client-modules: <paket> declares dsh.client but exports no "./client" bundle`.

## Penanganan resource (client)

- Listener global dipasang di dalam `useEffect` dan dibersihkan saat unmount;
  style dan atribut root dibersihkan lewat disposer `ctx.effect`.
- Tidak ada `setInterval` di level modul. Toast memakai `setTimeout` yang
  dibersihkan saat komponen unmount atau toast berganti.
- Cleanup manual: hapus `<style id="dsh-view-switcher-styles">`, hapus atribut
  `data-dsh-view-mode`, dan lepaskan listener inspeksi (diuji di
  `test/client.test.js`).
