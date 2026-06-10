# Arsitektur SIMPATIK

**Sistem Monitoring Terintegrasi Kepatuhan Perpajakan**
KPP Pratama Padang Satu

Dokumen ini adalah hasil audit terhadap kode yang benar-benar terimplementasi di repositori (bukan sekadar rencana). Disusun per Juni 2026.

---

## 1. Ringkasan Teknis

SIMPATIK adalah aplikasi web full-stack berbasis **Next.js 14 (App Router, TypeScript)** dengan **SQLite** sebagai penyimpanan data lokal melalui `better-sqlite3`. Seluruh data saat ini bersifat *dummy-ready* — di-seed otomatis dan siap diganti ke sumber data nyata (Coretax/BKPSDM) atau dimigrasikan ke Microsoft 365 (lihat `plan/database_to_office365.md`).

Aplikasi menggunakan rendering server (Server Components) untuk halaman dashboard dan API Routes untuk operasi data, dengan autentikasi dan otorisasi berbasis role yang ditegakkan di tiga lapis: middleware, API guard, dan UI.

---

## 2. Tech Stack

| Layer | Teknologi | Versi (package.json) |
|---|---|---|
| Framework | Next.js (App Router) | ^14.2.28 |
| Bahasa | TypeScript | ^5.8.3 |
| UI Runtime | React / React DOM | ^18.3.1 |
| Database | SQLite via `better-sqlite3` | ^11.10.0 |
| Auth | NextAuth.js (Credentials, JWT) | ^4.24.11 |
| Hashing | bcryptjs | ^2.4.3 |
| Charts | Chart.js + react-chartjs-2 | ^4.4.9 / ^5.3.0 |
| Excel/Import | exceljs | ^4.4.0 |
| Ikon | lucide-react | ^0.468.0 |
| Styling | Vanilla CSS (global `globals.css`) | — |
| Linting | ESLint + eslint-config-next | ^8.57.1 |

---

## 3. Struktur Direktori (Aktual)

```
SIMPATIK/
├── src/
│   ├── middleware.ts                 # Auth + RBAC gate untuk semua route
│   ├── app/
│   │   ├── layout.tsx                # Root layout, font, metadata
│   │   ├── globals.css               # Design tokens & base styles
│   │   ├── page.tsx                  # Entry (redirect)
│   │   ├── login/page.tsx            # Halaman login
│   │   ├── (dashboard)/              # Route group dengan Shell (sidebar + topbar)
│   │   │   ├── layout.tsx            # Mengambil session, render <Shell>
│   │   │   ├── loading.tsx           # Loading state
│   │   │   ├── error.tsx             # Error boundary
│   │   │   ├── dashboard/
│   │   │   ├── modul1-spt/           # SPT PPh OP
│   │   │   ├── modul2-pph21/         # PPh Pasal 21
│   │   │   ├── modul3-sosialisasi/   # Sosialisasi Coretax
│   │   │   ├── modul4-spt-masa/      # SPT Masa (PPh Unifikasi & PPN PUT)
│   │   │   ├── modul5-deposit/       # Deposit / realisasi setoran
│   │   │   ├── scoring-opd/          # Scoring & reward/punishment
│   │   │   ├── action-log/input/     # Form input tindak lanjut AR
│   │   │   ├── data-opd/             # CRUD OPD
│   │   │   ├── pegawai-belum-lapor/
│   │   │   ├── direktori-ar/
│   │   │   ├── direktori-bendahara/
│   │   │   ├── direktori-opd/        # (redirect ke /data-opd via next.config)
│   │   │   ├── analitik/
│   │   │   ├── notifikasi/
│   │   │   ├── audit-trail/
│   │   │   ├── import-data/          # page.tsx + ImportDataClient.tsx
│   │   │   ├── pengguna/
│   │   │   └── pengaturan/
│   │   └── api/
│   │       ├── auth/[...nextauth]/   # NextAuth handler
│   │       ├── dashboard/            # Agregasi KPI
│   │       ├── opd/ + opd/[id]/      # CRUD OPD
│   │       ├── spt/ spt-masa/ pph21/ deposit/ scoring/
│   │       ├── sosialisasi/ pegawai/ bendahara/ ar/
│   │       ├── action-log/ audit/ notifications/ notifications/[id]/
│   │       ├── users/ + users/[id]/
│   │       ├── import/preview/ import/commit/
│   │       ├── export/[dataset]/
│   │       └── seed/
│   ├── components/
│   │   ├── layout/Shell.tsx          # Sidebar (collapsible) + topbar + nav RBAC
│   │   ├── charts/ChartPanels.tsx    # Wrapper Chart.js (line, doughnut, bar, scatter)
│   │   └── ui/                       # Badge, Button, DataTable, FilterChip, KpiCard,
│   │                                 # Modal, PageHeader, Pagination, ProgressBar,
│   │                                 # SearchBar, Tabs, Toggle
│   ├── lib/
│   │   ├── db.ts                     # Koneksi SQLite singleton + schema + migrasi kolom
│   │   ├── seed.ts                   # Generator data dummy (4 wilayah, 185 OPD, dst.)
│   │   ├── auth.ts                   # Konfigurasi NextAuth (Credentials)
│   │   ├── api-auth.ts               # requireApiPermission() untuk route handler
│   │   ├── rbac.ts                   # Aturan akses halaman & API per role
│   │   ├── queries.ts               # Seluruh query baca/tulis + audit log
│   │   ├── validation.ts             # Validasi payload OPD/user/sosialisasi
│   │   ├── import-data.ts            # Parsing & preview/commit import CSV/XLSX
│   │   ├── export.ts                 # Generator CSV per dataset
│   │   ├── search.ts                 # Helper parsing search params & query string
│   │   └── utils.ts                  # Format angka/rupiah/persen, traffic light, WA link
│   └── types/
│       ├── index.ts                  # Tipe domain (Role, Opd, SptRecord, dst.)
│       └── next-auth.d.ts            # Augmentasi tipe session NextAuth
├── database/                         # File simpatik.db + backup + sumber Excel
├── scripts/import-excel-to-sqlite.mjs
├── plan/                             # Dokumen rencana (implementasi & migrasi M365)
├── public/logos/simpatik-brand.svg
├── next.config.js                    # reactStrictMode + redirect direktori-opd
└── package.json
```

---

## 4. Lapisan Aplikasi

### 4.1 Routing & Rendering
- **App Router** dengan route group `(dashboard)` yang membungkus semua halaman terproteksi dalam `Shell` (sidebar + topbar).
- Halaman umumnya **Server Components** yang membaca data langsung dari layer `queries.ts`, dengan komponen klien (`"use client"`) hanya untuk interaksi (chart, form import, toggle).
- `next.config.js` melakukan redirect `/direktori-opd → /data-opd` dan mengaktifkan `reactStrictMode`.

### 4.2 Data Layer
- `db.ts` membuat **koneksi singleton** ke `database/simpatik.db`. Pada lingkungan Vercel (`VERCEL=1`), database dipindah ke `os.tmpdir()` dengan `journal_mode = DELETE`; selain itu memakai `WAL`.
- Skema dibuat idempotent via `CREATE TABLE IF NOT EXISTS`, ditambah fungsi `ensureExistingSchema()` yang melakukan **migrasi kolom inkremental** (ALTER TABLE ADD COLUMN) untuk tabel `opd` dan `action_log` agar kompatibel dengan database lama.
- `foreign_keys = ON` diaktifkan; banyak relasi memakai `ON DELETE CASCADE`.
- Seluruh akses data melalui `queries.ts`, yang memanggil `ensureSeeded()` sehingga database otomatis terisi saat pertama kali diakses.

### 4.3 Autentikasi
- **NextAuth Credentials provider** dengan strategi **JWT**.
- Login memvalidasi email + password (`bcrypt.compare`) terhadap tabel `users` berstatus `aktif`.
- Tersedia **alias kredensial** (`kepala@`, `kasiwas@`, `ar1@`, `teknisi1@simpatik.local`) yang memetakan ke user pertama dengan role terkait. Password dummy: `simpatik123`.
- `role`, `jabatan`, dan `avatarColor` di-inject ke token JWT dan session melalui callback. Tipe session diperluas di `types/next-auth.d.ts`.

### 4.4 Otorisasi (RBAC) — Tiga Lapis
1. **Middleware** (`src/middleware.ts`): menjaga semua route non-publik. Tanpa token → redirect ke `/login` (atau 401 untuk `/api/*`). Cek `canAccessPage` / `canAccessApi`; akses halaman ditolak → redirect `/dashboard?denied=1`, API ditolak → 403.
2. **API guard** (`api-auth.ts`): `requireApiPermission()` memanggil `getServerSession` lalu `canAccessApi` di dalam route handler (pertahanan berlapis bila middleware terlewat).
3. **UI** (`Shell.tsx`): navigasi sidebar memfilter item via `roleCanSeeNav`, sehingga menu yang tidak diizinkan tidak ditampilkan.

Aturan akses terpusat di `rbac.ts` (`pageRules` & `apiRules`), termasuk pembedaan per method HTTP (GET/POST/PUT/DELETE) dan helper kepemilikan (`canEditOpd` mengizinkan AR mengedit hanya OPD yang ia ampu).

### 4.5 Validasi & Audit
- `validation.ts` memvalidasi payload OPD, user, dan sosialisasi (cek field wajib, enum, email, angka) dan mengembalikan `{ ok, data | errors }`.
- Setiap operasi tulis OPD (create/update/delete/import) menulis **audit log** ke tabel `audit_log` dengan snapshot `before`/`after` (JSON) dan identitas aktor.

### 4.6 Import / Export
- **Import**: `import-data.ts` membaca CSV (parser custom, deteksi delimiter `,`/`;`) atau XLSX (exceljs). Header dinormalisasi via alias, wilayah/AR di-resolve dari nama/email/kode. Alur dua tahap: `preview` (validasi tanpa simpan, maks 500 baris) → `commit` (insert dalam transaksi).
- **Export**: `export.ts` menghasilkan CSV per dataset (opd, spt, pph21, sosialisasi, spt-masa, deposit, scoring, bendahara, pegawai, users) dengan proteksi **CSV injection** (prefix `'` pada sel diawali `= + - @`) dan BOM UTF-8.

### 4.7 Roles
Empat role didefinisikan: `kepala_kpp`, `kasiwas`, `ar`, `teknisi`. Ringkasan kelompok hak di `rbac.ts`:
- `kasiwas` — akses paling luas (termasuk manajemen pengguna).
- `teknisi` — fokus data, import, pengaturan, audit (tanpa manajemen pengguna).
- `ar` — operasional modul + edit OPD yang diampu.
- `kepala_kpp` — sebagian besar *view-only* (modul, dashboard, direktori, analitik).

---

## 5. Model Data (Skema SQLite Aktual)

Tabel didefinisikan di `db.ts`:

| Tabel | Fungsi |
|---|---|
| `wilayah` | Master wilayah (4 wilayah) |
| `users` | Pengguna + role + password hash |
| `opd` | Master OPD + kontak bendahara/PIC + AR pengampu + NPWP + status pemungut PPN |
| `spt_monitoring` | Modul 1 — kepatuhan SPT per periode (traffic light) |
| `pph21_monitoring` | Modul 2 — setoran PPh 21 per bulan (ketepatan & status) |
| `spt_masa_monitoring` | Modul 4 — PPh 22/23 & PPN PUT per masa pajak |
| `deposit_monitoring` | Modul 5 — deposit PPh21/unifikasi/PPN PUT |
| `scoring_opd` | Skor komposit + kategori + reward/monitor/punishment |
| `sosialisasi` | Modul 3 — rekam jejak sesi sosialisasi |
| `pegawai` | Pegawai individu + status Coretax |
| `action_log` | Tindak lanjut AR |
| `notifications` | Notifikasi in-app |
| `audit_log` | Jejak perubahan entitas (opd/user) |
| `settings` | Konfigurasi key-value |

Indeks dibuat untuk kolom periode, status, wilayah, dan relasi yang sering difilter.

### Logika Scoring (di `seed.ts`)
Skor total = `SPT×0.30 + PPh21×0.25 + SPT Masa×0.25 + Deposit×0.20`.
Kategori: `≥90 hijau/reward`, `70–89 kuning/monitor`, `<70 merah/punishment`.

### Traffic Light SPT (di `utils.ts`)
`≥70% hijau`, `40–69% kuning`, `<40% merah`.

---

## 6. Data Dummy (Seed)

`seed.ts` menggunakan PRNG ber-seed (deterministik) untuk menghasilkan:
- **4 wilayah** (Kota Padang, Prov. Sumbar, Kota Pariaman, Kab. Padang Pariaman) dengan kuota total **185 OPD**.
- **12 users**: 1 kasiwas, 1 kepala KPP, 2 teknisi, 8 AR.
- **Data SPT** periode berjalan (2026-01..03 sebagai tahun pajak 2025) + historis 2024.
- **PPh 21** 6 bulan (2025-10 .. 2026-03) per OPD.
- **SPT Masa & Deposit** masa 2026-03; **Scoring** 2026-03.
- **~162 sesi sosialisasi**, **500 pegawai**, **20 action log**, **10 notifikasi**, dan beberapa `settings`.

Seeding bersifat *guarded*: tidak menimpa data bila tabel `opd` sudah berisi (kecuali `force: true`).

---

## 7. Catatan Keamanan & Operasional

- **Secret default**: `NEXTAUTH_SECRET` punya fallback hardcoded untuk pengembangan lokal — wajib di-set di produksi.
- **Password dummy** seragam (`simpatik123`) untuk semua user seed — hanya untuk demo.
- Proteksi **CSV injection** sudah diterapkan pada export.
- SQLite cocok untuk single-instance; untuk multi-user/produksi pertimbangkan migrasi ke Microsoft 365 (`plan/database_to_office365.md`) atau RDBMS.
- Belum ada test otomatis di repositori.

---

## 8. Build & Menjalankan

```bash
npm install
npm run dev      # http://localhost:3000 (seed otomatis saat akses pertama)
npm run build    # Build produksi
npm run start    # Jalankan hasil build
npm run lint     # ESLint
npm run import:excel   # Import dari Excel ke SQLite (scripts/)
```
