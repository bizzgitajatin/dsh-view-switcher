# Rencana Pengembangan dsh-view-switcher

## Tujuan

Membangun plugin DSH dua-half (Host + Client) yang berfokus pada dua
kapabilitas utama:

1. Sakelar tampilan (AUTO, MOBILE, TABLET, DESKTOP, FULLHD) via `shell.overlay`.
2. Inspektur elemen (F1) untuk menyorot dan menyalin CSS Selector.

## Fase

### Fase 1 — Verifikasi Loading Minimal (Selesai)

- [x] Setup repositori dan `scratch-plugin`
- [x] Verifikasi log `[dsh-view-switcher] loaded`

### Fase 2 — Arsitektur Host & Client (Selesai)

- [x] Migrasi build ke `tsc` (output ke `dist/`)
- [x] Memisahkan logika Node.js (host inert) dan DOM (client)
- [x] Injeksi UI via `window.__ModuleLoader__.load`

### Fase 3 — Fitur Inti (Selesai)

- [x] Sakelar tampilan 5 mode (AUTO–FULLHD)
- [x] Inspektur kursor (F1, hover, klik salin selector)
- [x] Pendaftaran UI ke `shell.overlay` via `ctx.slots`

### Fase 4 — Stabilisasi & Distribusi (Sedang Berjalan)

- [x] Build pipeline (`pnpm build`)
- [x] Test otomatis (`node:test` + jsdom) berjalan — `test/client.test.js`
- [x] Deklarasi `dsh.bundle.patch` dan `dsh.client.platform`
- [x] Dokumentasi lengkap (`README.md`, `ARCHITECTURE.md`, `LICENSE` di root)
- [ ] Verifikasi klik manual di browser DSH sungguhan
- [ ] Publikasi ke registri plugin DSH
- [ ] CI (build + test) di repositori

## Risiko

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| API DSH preview berubah | Build gagal | Lock versi, pantau changelog |
| Kebocoran listener/timer | Instabilitas | Cleanup wajib lewat `ctx.effect`/`useEffect` |
| Perubahan DOM DSH | Toolbar tidak muncul | Selektor berbasis `#root` + atribut data |
