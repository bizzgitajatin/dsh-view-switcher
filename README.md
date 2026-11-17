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
├── dist/               # hasil build (dibuat oleh "pnpm build")
├── test/
│   ├── client.test.js     # test node:test + jsdom
│   └── dev-server.cmd     # boot DSH dengan profil uji lokal
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

```cmd
dsh plugin --profile web add D:\DSHplugin
:: lalu restart DSH
```

`package.json` mendeklarasikan `dsh.bundle.patch` (row loader) dan
`dsh.client` (bundle browser), jadi instalasi cukup lewat `dsh plugin add`.

## Penggunaan

- **Mode tampilan**: toolbar di kanan atas; klik salah satu tombol mode.
- **Inspektur**: tekan `F1` (kursor jadi crosshair), hover untuk melihat
  selector dan kotak sorot, klik untuk menyalin. Klik pertama tidak diteruskan
  ke aplikasi; mode keluar dengan `Esc` atau `F1`.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
