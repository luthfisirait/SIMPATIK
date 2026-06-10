# Fitur SIMPATIK

**Sistem Monitoring Terintegrasi Kepatuhan Perpajakan — KPP Pratama Padang Satu**

Daftar fitur yang **saat ini tersedia** di aplikasi berdasarkan audit kode. Setiap fitur disertai penjelasan singkat. Status mengacu pada implementasi aktual, bukan rencana.

---

## Ringkasan

SIMPATIK memantau kepatuhan perpajakan 185 OPD lintas 4 wilayah melalui lima modul monitoring, sistem scoring, manajemen data master, serta tooling import/export dan audit. Akses dikontrol per role (Kepala KPP, Kasiwas, AR, Teknisi).

---

## 1. Autentikasi & Akses

- **Login berbasis email + password** (NextAuth Credentials, sesi JWT). Password demo: `simpatik123`.
- **Alias kredensial cepat** untuk demo tiap role: `kepala@`, `kasiwas@`, `ar1@`, `teknisi1@simpatik.local`.
- **Kontrol akses berbasis role (RBAC)** ditegakkan di middleware, API, dan navigasi sidebar — menu yang tidak diizinkan tidak muncul, akses langsung ditolak/diarahkan ulang.
- **Logout** dari sidebar.

## 2. Dashboard

Halaman ringkasan eksekutif yang menampilkan:
- **KPI utama**: kepatuhan SPT (%), jumlah SPT masuk, PPh 21 belum setor, OPD belum disosialisasi, total OPD, total setoran.
- **Grafik tren** kepatuhan SPT bulanan (membandingkan 2024 vs 2025) dan **distribusi per wilayah**.
- **Tabel traffic light** menyorot OPD dengan kepatuhan terendah.
- **Activity feed** (action log terbaru) dan **notifikasi** terbaru.

## 3. Modul 1 — SPT PPh OP (`/modul1-spt`)

Monitoring kepatuhan pelaporan SPT per OPD.
- Indikator **traffic light** (hijau ≥70%, kuning 40–69%, merah <40%).
- KPI ringkas: jumlah OPD per kategori dan total belum lapor.
- Tabel dengan **pencarian, filter wilayah/status/AR, dan pagination**, diurut dari kepatuhan terendah.

## 4. Modul 2 — PPh Pasal 21 (`/modul2-pph21`)

Monitoring kewajiban setoran PPh 21 bendahara per bulan.
- Status **ketepatan** (tepat waktu / terlambat / belum setor) dan **status nominal** (normal / under-reporting / kritis).
- KPI: jumlah tepat waktu, belum/terlambat, under-reporting, dan total setoran.
- Filter bulan, wilayah, status, AR + pagination.

## 5. Modul 3 — Sosialisasi Coretax (`/modul3-sosialisasi`)

Rekam jejak sesi sosialisasi Coretax ke OPD.
- Status sesi: sudah / belum / perlu ulang, jumlah peserta, dan penyuluh (AR).
- Mendukung **penambahan sesi** (POST, role kasiwas/AR).

## 6. Modul 4 — SPT Masa (`/modul4-spt-masa`)

Monitoring SPT Masa untuk **PPh Pasal 22, PPh Pasal 23, dan PPN PUT** per masa pajak.
- Nominal & status per jenis pajak, penanda OPD pemungut, dan **status keseluruhan** (hijau/kuning/merah).
- Catatan AR per baris. Filter wilayah/status/AR + pagination.

## 7. Modul 5 — Deposit (`/modul5-deposit`)

Monitoring realisasi setoran (deposit) pajak per masa pajak.
- Komponen deposit: PPh 21, PPh unifikasi, PPN PUT, beserta total dan **status deposit keseluruhan**.
- Diurut dari status terburuk/total terendah. Filter + pagination.

## 8. Scoring OPD (`/scoring-opd`)

Sistem penilaian komposit kepatuhan OPD untuk **reward & punishment**.
- Skor total = SPT (30%) + PPh 21 (25%) + SPT Masa (25%) + Deposit (20%).
- Kategori: hijau/reward (≥90), kuning/monitor (70–89), merah/punishment (<70).
- Menampilkan **Top Reward** dan **Top Punishment**, ringkasan per kategori, dan rata-rata skor. Filter periode/kategori/status/AR.

## 9. Input Action Log (`/action-log/input`)

Form bagi AR/Kasiwas/Teknisi untuk mencatat **tindak lanjut**: aksi, target OPD, deskripsi, hasil, rencana follow-up, dan tanggal follow-up berikutnya. Tercatat di tabel `action_log`.

## 10. Data OPD (`/data-opd`)

Manajemen master OPD — **CRUD lengkap**.
- Tambah, edit, hapus OPD dengan field lengkap: wilayah, jenis instansi, jumlah ASN/PPPK, NPWP, status pemungut PPN, kontak bendahara (pengeluaran & penerimaan), PIC kepegawaian, dan AR pengampu.
- **Validasi** field wajib, email, dan angka.
- Edit OPD oleh AR dibatasi pada OPD yang ia ampu; create/delete hanya kasiwas/teknisi.
- Pencarian, filter, dan pagination. Setiap perubahan tercatat di **audit trail**.

## 11. Pegawai Belum Lapor (`/pegawai-belum-lapor`)

Daftar pegawai individu yang belum melapor berdasarkan **status Coretax** (aktif belum lapor / belum aktivasi / sudah lapor). Filter per OPD/wilayah/status, lengkap dengan kontak.

## 12. Direktori AR (`/direktori-ar`)

Daftar kontak Account Representative beserta OPD yang diampu.

## 13. Direktori Bendahara (`/direktori-bendahara`)

Kontak bendahara pengeluaran/penerimaan tiap OPD, dilengkapi status PPh 21 terakhir dan skor terakhir. Mendukung **tautan WhatsApp** otomatis dari nomor HP.

## 14. Analitik (`/analitik`)

Halaman visualisasi tren & distribusi menggunakan Chart.js (line, doughnut, bar, scatter) untuk analisis kepatuhan lintas wilayah dan waktu.

## 15. Notifikasi (`/notifikasi`)

Inbox notifikasi in-app (info / warning / success / danger), dengan penanda **sudah/belum dibaca** (update via `/api/notifications/[id]`).

## 16. Audit Trail (`/audit-trail`)

Riwayat perubahan entitas (OPD & user) — aksi create/update/delete/import, identitas aktor, serta snapshot data **sebelum & sesudah**. Akses: kasiwas/teknisi.

## 17. Import Data (`/import-data`)

Impor massal data OPD dari **CSV atau Excel (.xlsx)**.
- Deteksi delimiter otomatis (`,`/`;`), normalisasi header via alias, resolusi wilayah/AR dari nama/email/kode.
- Alur **preview → commit**: validasi tiap baris (maks 500) lalu simpan dalam satu transaksi. Tercatat di audit trail.

## 18. Export Data

Ekspor **CSV** per dataset: OPD, SPT, PPh 21, sosialisasi, SPT Masa, deposit, scoring, bendahara, pegawai, dan users. Aman terhadap **CSV injection** dan ber-BOM UTF-8 (kompatibel Excel). Mengikuti filter aktif.

## 19. Pengguna (`/pengguna`)

Manajemen akun & role pengguna (CRUD). Hanya untuk **kasiwas**.

## 20. Pengaturan (`/pengaturan`)

Konfigurasi sistem (key-value `settings`): sumber data, status integrasi Coretax/BKPSDM (saat ini *simulated*), dan notifikasi email. Akses: kasiwas/teknisi.

---

## Fitur Pendukung (Lintas Halaman)

- **Sidebar collapsible** dengan navigasi terkelompok (Monitoring / Data / Sistem) yang menyesuaikan role.
- **Pencarian global** OPD/AR/pegawai dari topbar.
- **Format lokal Indonesia** untuk angka, persentase, dan rupiah (termasuk format ringkas "jt/M").
- **Seed data otomatis** saat akses pertama (185 OPD, 12 user, ~500 pegawai, dll.).
- **Loading & error boundary** pada route group dashboard.

---

## Catatan Status

- Seluruh data masih **dummy/seed**; integrasi Coretax & BKPSDM berstatus *simulated*.
- **Notifikasi email belum aktif** (rencana via Power Automate pada migrasi M365).
- **Belum ada test otomatis**.
- Roadmap migrasi ke Microsoft 365 (SharePoint + Excel Online + Graph API) terdokumentasi di `plan/database_to_office365.md`.
