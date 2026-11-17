# dsh-view-switcher

Plugin DeepSeek Harness (DSH) dengan dua half — **host** dan **client** — untuk
mengatur lebar tampilan web DSH dan menginspeksi elemen.

## Fitur

1. **Sakelar tampilan**: AUTO, MOBILE (375px), TABLET (768px), DESKTOP (1280px),
   FULLHD (1920px). AUTO melepas override dan memakai lebar bawaan.
2. **Inspektur elemen**: tekan `F1`, arahkan kursor, klik untuk menyalin CSS
   selector ke clipboard. `Esc` atau `F1` lagi untuk keluar.
3. **Dua half**: logika Node.js terpisah dari logika DOM sesuai standar
   `dsh.client` (lihat [ARCHITECTURE.md](ARCHITECTURE.md)).

## Struktur

```text
D:\DSHplugin\
├── src/
│   ├── index.ts        # host half (inert, tanpa DOM)
│   └── client.ts       # client half (toolbar, mode, inspektur)
├── dist/               # hasil build — ikut di-commit (instalasi github: memakai isi repo)
├── test/
│   ├── client.test.js     # test node:test + jsdom
│   └── dev-server.cmd     # boot DSH dengan profil uji lokal
├── demo/
│   ├── index.html         # halaman contoh (mock GitHub) untuk mencoba plugin
│   ├── prepare.mjs        # menyalin dist/client.js ke demo/client.js
│   ├── fetch-vendor.mjs   # unduh React 18 UMD ke demo/vendor/ (sekali saja)
│   └── vendor/            # React + ReactDOM UMD untuk demo offline
├── cordis.patch.yml    # bundle row yang dipasang DSH
├── package.json
└── tsconfig.json
```

## Prasyarat

- Node.js >= 20
- pnpm
- DSH terpasang di sistem Anda

## Build & Test

```bash
pnpm install
pnpm build      # kompilasi TypeScript ke dist/
pnpm test       # test client half (node:test + jsdom)
```

Uji end-to-end dengan profil DSH terpisah (tidak menyentuh profil utama):

```cmd
test\dev-server.cmd
```

Profil uji hidup di `.test-home\` (dibuat sekali dengan
`dsh plugin --profile web add D:\DSHplugin`), lalu DSH membuka URL dengan token.

## Instalasi ke DSH

Dari folder lokal:

```cmd
dsh plugin --profile web add D:\DSHplugin
:: lalu restart DSH
```

Langsung dari GitHub:

```cmd
dsh plugin --profile web add github:bizzgitajatin/dsh-view-switcher
:: lalu restart DSH
```

`package.json` mendeklarasikan `dsh.bundle.patch` (row loader) dan
`dsh.client` (bundle browser), jadi instalasi cukup lewat `dsh plugin add`.

## Penggunaan

- **Panel Browser bawaan DSH**: buka sebuah halaman di tab Browser. Toolbar
  menempel di sudut kanan atas panel itu, dan tombol mode mengubah lebar halaman
  di dalam panel (AUTO = selebar panel). Berlaku untuk iframe (DSH web) maupun
  `<webview>` (DSH desktop), karena keduanya ditandai
  `[data-sidebar-browser-frame]`. Lebar frame dibatasi lebar panel: mode yang
  lebih lebar dari panel (mis. DESKTOP 1280 di panel 700px) tampak sama seperti
  AUTO, sedangkan MOBILE/TABLET langsung menyempitkan halaman.
- **Tampilan web DSH tanpa panel browser**: toolbar tetap di kanan atas dan
  mengatur lebar konten web view (`#root`).
- **Inspektur**: tekan `F1` (kursor jadi crosshair), hover untuk melihat
  selector dan kotak sorot, klik untuk menyalin. Klik pertama tidak diteruskan
  ke aplikasi; mode keluar dengan `Esc` atau `F1`. Di dalam panel Browser:
  pada DSH desktop (`<webview>`) inspektur menyuntik skrip ke halaman lewat
  `executeJavaScript`, jadi selector diambil dari DOM halaman itu sendiri;
  pada DSH web (iframe lintas-origin) isi panel memang tidak bisa dijangkau dan
  plugin menampilkan pesan singkat. Selama ada panel Browser terbuka, inspektur
  hanya menyasar isi panel itu; UI DSH di sekitarnya tidak disorot.

### Khusus DSH desktop (Electron)

Di dalam aplikasi DSH desktop, plugin **tidak** menaruh toolbar di jendela
utama (ukuran jendela diatur OS, jadi toolbar di sana hanya bertabrakan dengan
tombol minimize/maximize/close). Toolbar hanya muncul saat ada panel Browser
terbuka, dan menempel pada panel tersebut. Plugin mendeteksi shell desktop
(`Electron/` pada user agent, protokol `dsh-app:`, atau bridge
`dsh`/`dshPlatform`). Halaman yang memang ingin memaksa tampil — seperti halaman
demo — bisa menyetel `window.__DSH_VS_FORCE__ = true`.

## Demo lokal

`demo/index.html` adalah halaman contoh (mock halaman repo GitHub) yang memuat
`dist/client.js` dengan `window.__ModuleLoader__` tiruan, jadi toolbar dan
inspektur bisa dicoba tanpa menjalankan DSH:

```cmd
pnpm build
pnpm demo
:: buka demo\index.html di browser
```

Variasi lewat hash URL: `demo/index.html#mode=mobile` langsung mengaktifkan mode
MOBILE, `demo/index.html#inspect` menyalakan inspektur dan menyorot satu elemen.

Catatan: halaman demo memakai **container query** (`#root { container-type: inline-size }`)
supaya tata letaknya ikut menyempit saat plugin mengubah lebar `#root`. Halaman
yang hanya memakai media query viewport akan tetap terlihat selebar layar
walaupun mode MOBILE aktif.

Tangkapan layar hasil demo (1280×900): `demo/screenshots/demo-auto.jpg`,
`demo-mobile.jpg`, `demo-inspect.jpg`.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
