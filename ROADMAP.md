# Roadmap dsh-view-switcher

## v0.3.0 — Fitur Inti & Slot (Selesai)

- Sakelar tampilan 5 mode (AUTO–FULLHD)
- Inspektur elemen (F1 + salin selector)
- Injeksi UI melalui `shell.overlay`

## v0.4.0 — Migrasi Arsitektur (Selesai)

- Pemisahan *host half* dan *client half*
- Build pipeline `tsc` ke `dist/`
- `dsh.bundle.patch` + `dsh.client.platform` terdeklarasi
- Verifikasi end-to-end: entri boot muncul dan bundle client HTTP 200

## v0.4.1 — Paket & Test (Selesai)

- Test otomatis `node:test` + jsdom (`test/client.test.js`)
- `README.md`, `ARCHITECTURE.md`, `LICENSE`, `.gitignore`
- `test\dev-server.cmd` untuk boot profil uji lokal

## v1.0.0 — Stabil & Publikasi (Target Utama)

- [ ] Verifikasi klik manual di browser DSH sungguhan
- [ ] Publikasi ke registri plugin DSH
- [ ] CI (build + test) di repositori

## Di Luar Cakupan

- Dukungan multi-bahasa
- Dukungan versi DSH lama
