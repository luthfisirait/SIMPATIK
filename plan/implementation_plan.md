# SIMPATIK — Implementation Plan (Next.js + SQLite)

**Sistem Monitoring Terintegrasi Kepatuhan Perpajakan**
KPP Pratama Padang Satu

---

## 1. Ringkasan Proyek

Migrasi dashboard SIMPATIK dari file HTML statis menjadi aplikasi web full-stack menggunakan **Next.js 14 (App Router)** + **SQLite** (via `better-sqlite3`). Semua API bersifat **dummy-ready** — data di-seed otomatis, siap diswap ke API real (Coretax/BKPSDM) di masa depan.

### Referensi Desain
- UI/UX: Langsung dari `SIMPATIK_Dashboard (1).html` — design system navy/teal sudah final
- Bisnis proses: Dari `Panduan_Membangun_SIMPATIK_Microsoft365.docx` — SOP, role, modul

---

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | SQLite via `better-sqlite3` |
| Styling | Vanilla CSS (CSS Modules) |
| Charts | Chart.js + react-chartjs-2 |
| Auth | NextAuth.js (Credentials provider, dummy) |
| Icons | Lucide React |
| Font | DM Sans + DM Mono (Google Fonts) |

---

## 3. Struktur Folder

```
SIMPATIK/
├── plan/                         # Folder plan (dokumen ini)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout + font + metadata
│   │   ├── globals.css           # Design tokens & base styles
│   │   ├── page.tsx              # Redirect ke /login
│   │   ├── login/page.tsx        # Halaman login
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        # Shell: sidebar + topbar
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── modul1-spt/page.tsx
│   │   │   ├── modul2-pph21/page.tsx
│   │   │   ├── modul3-sosialisasi/page.tsx
│   │   │   ├── data-opd/page.tsx
│   │   │   ├── pegawai-belum-lapor/page.tsx
│   │   │   ├── direktori-ar/page.tsx
│   │   │   ├── direktori-opd/page.tsx
│   │   │   ├── analitik/page.tsx
│   │   │   ├── pengguna/page.tsx
│   │   │   └── pengaturan/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── opd/route.ts
│   │       ├── pegawai/route.ts
│   │       ├── spt/route.ts
│   │       ├── pph21/route.ts
│   │       ├── sosialisasi/route.ts
│   │       ├── action-log/route.ts
│   │       ├── ar/route.ts
│   │       ├── users/route.ts
│   │       ├── dashboard/route.ts
│   │       ├── notifications/route.ts
│   │       └── seed/route.ts
│   ├── components/
│   │   ├── layout/ (Sidebar, Topbar + CSS Modules)
│   │   ├── ui/ (KpiCard, DataTable, Badge, TrafficLight, Modal, Button, SearchBar, FilterChip, Pagination, ProgressBar, Toggle, Tabs)
│   │   └── charts/ (TrenChart, PieChart, BarChart, ScatterChart)
│   ├── lib/
│   │   ├── db.ts                 # SQLite connection singleton
│   │   ├── seed.ts               # Seed 185 OPD + data dummy
│   │   ├── auth.ts               # NextAuth config
│   │   └── utils.ts              # Helper functions
│   └── types/index.ts            # TypeScript interfaces
├── database/simpatik.db          # SQLite (auto-generated)
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## 4. Database Schema (SQLite)

### 4.1 `wilayah`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | Auto increment |
| nama | TEXT UNIQUE | 'Kota Padang', 'Kota Pariaman', dll |
| kode | TEXT UNIQUE | 'kota_padang', 'kota_pariaman' |

### 4.2 `users`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | Auto increment |
| nama | TEXT | Nama lengkap |
| email | TEXT UNIQUE | Email login |
| password_hash | TEXT | Bcrypt hash |
| nip, jabatan | TEXT | Data pegawai |
| role | TEXT | 'kepala_kpp' / 'kasiwas' / 'ar' / 'teknisi' |
| phone, avatar_color | TEXT | Kontak & UI |
| status | TEXT | 'aktif' / 'cuti' / 'nonaktif' |

### 4.3 `opd`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | Auto increment |
| nama | TEXT | Nama OPD |
| wilayah_id | INTEGER FK | Referensi wilayah |
| jumlah_asn | INTEGER | Total ASN & PPPK |
| nama_bendahara, hp_bendahara | TEXT | Kontak bendahara |
| nama_pic_kepeg, hp_pic_kepeg | TEXT | Kontak PIC kepegawaian |
| ar_id | INTEGER FK | AR pengampu |
| status | TEXT | 'aktif' / 'tidak_aktif' / 'perlu_update' |

### 4.4 `spt_monitoring` (Modul 1)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | |
| opd_id | INTEGER FK | |
| tahun_pajak | INTEGER | 2024, 2025 |
| periode | TEXT | '2026-01', '2026-02', '2026-03' |
| jumlah_wajib_lapor | INTEGER | |
| jumlah_sudah_lapor | INTEGER | |
| persen_kepatuhan | REAL | Generated: sudah/wajib * 100 |
| traffic_light | TEXT | Generated: hijau/kuning/merah |

### 4.5 `pph21_monitoring` (Modul 2)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | INTEGER PK | |
| opd_id | INTEGER FK | |
| bulan | TEXT | '2026-04' |
| jumlah_dipotong | INTEGER | |
| nominal_setor, estimasi_wajar | INTEGER | Rupiah |
| ketepatan | TEXT | 'tepat_waktu' / 'terlambat' / 'belum_setor' |
| status | TEXT | 'normal' / 'under_reporting' / 'kritis' |

### 4.6 `sosialisasi` (Modul 3)
| Kolom | Tipe | Keterangan |
|---|---|---|
| opd_id | INTEGER FK | |
| tanggal | DATE | Tgl sosialisasi |
| jumlah_peserta | INTEGER | |
| penyuluh_id | INTEGER FK | AR pelaksana |
| status | TEXT | 'sudah' / 'belum' / 'perlu_ulang' |

### 4.7 `pegawai`
| Kolom | Tipe | Keterangan |
|---|---|---|
| nama, nip | TEXT | Identitas individu |
| opd_id | INTEGER FK | |
| jabatan | TEXT | |
| status_coretax | TEXT | 'aktif_belum_lapor' / 'belum_aktivasi' / 'sudah_lapor' |

### 4.8 `action_log`, `notifications`, `settings`
Tabel pendukung untuk aktivitas AR, notifikasi in-app, dan konfigurasi sistem.

---

## 5. API Routes (Dummy-Ready)

| Method | Route | Deskripsi |
|---|---|---|
| GET | `/api/dashboard` | Aggregasi KPI dashboard |
| GET/POST | `/api/opd` | List & tambah OPD |
| GET/PUT/DELETE | `/api/opd/[id]` | Detail, edit, hapus OPD |
| GET | `/api/spt` | Data SPT (filter: wilayah, status, AR) |
| GET | `/api/pph21` | Data PPh 21 (filter: bulan, status) |
| GET/POST | `/api/sosialisasi` | List & tambah sosialisasi |
| GET | `/api/pegawai` | Pegawai belum lapor (filter: OPD, wilayah, status) |
| GET/POST | `/api/action-log` | Action log AR |
| GET/POST | `/api/ar` | List & tambah AR |
| GET/POST | `/api/users` | Manajemen users |
| GET/PUT | `/api/notifications` | Notifikasi in-app |
| POST | `/api/seed` | Seed semua dummy data |

> **Catatan**: Semua API bersifat dummy. Data di-seed dari `lib/seed.ts`. Di masa depan, endpoint bisa di-replace dengan panggilan ke API Coretax real.

---

## 6. Halaman & Fitur

### 6.1 Login
- Form email + password, NextAuth Credentials
- 4 dummy users (1 per role)

### 6.2 Dashboard
- Quick Action Strip (5 cards)
- KPI Grid (5 cards: Kepatuhan SPT, SPT Masuk, PPh 21 Belum Setor, Belum Sosialisasi, Total OPD)
- Chart tren SPT bulanan (line) + distribusi per wilayah (doughnut + progress bars)
- Traffic Light table (top 5 OPD)
- Activity Feed (4 log terbaru)

### 6.3 Modul 1 — SPT PPh OP
- KPI: OPD Hijau/Kuning/Merah + Total Belum Lapor
- Tabel 185 OPD: sort, search, filter wilayah & status, pagination
- Aksi: Detail, Kirim Imbauan, Unduh Laporan

### 6.4 Modul 2 — PPh Pasal 21
- KPI: Sudah Setor, Belum/Terlambat, Under-Reporting, Total Setoran
- Tabel status bendahara per bulan
- Badge: Tepat Waktu / Terlambat / Belum Setor / Normal / Under / Kritis

### 6.5 Modul 3 — Sosialisasi Coretax
- KPI: Sudah/Belum Disosialisasi, Total Peserta, Sesi Terlaksana
- Tabel rekam jejak + jadwal mendatang (prioritas cards)

### 6.6 Data OPD — CRUD lengkap, filter, bulk export/hapus
### 6.7 Pegawai Belum Lapor — Tabel individual + bulk imbauan
### 6.8 Direktori AR — Grid cards per AR + kontak
### 6.9 Direktori OPD — Tabel kontak bendahara & PIC + link WA
### 6.10 Analitik — 4 charts + insight cards
### 6.11 Pengguna — Role cards + user list
### 6.12 Pengaturan — Profil, notifikasi toggles, integrasi status

---

## 7. Design System

Diambil langsung dari HTML reference tanpa perubahan:

```css
:root {
  --navy: #0D2B55; --navy-mid: #1A3D6E;
  --teal: #0A8090; --teal-lt: #0FB5CA; --teal-faint: #E6F7FA;
  --gold: #F5A623; --red: #D64550; --green: #16A663; --amber: #D97706;
  --bg: #F0F4F8; --card: #FFFFFF; --border: #E2EAF0;
  --text-1: #0D2240; --text-2: #4A637A; --text-3: #8FA5B8;
  --sidebar-c: #061A36; --radius: 10px;
  --font: 'DM Sans', sans-serif; --mono: 'DM Mono', monospace;
}
```

---

## 8. RBAC (Role-Based Access)

| Role | Dashboard | Modul 1-3 | Data OPD | Pegawai | Direktori | Analitik | Users | Settings |
|---|---|---|---|---|---|---|---|---|
| Kepala KPP | View | View | ❌ | ❌ | View | View | ❌ | ❌ |
| Kasiwas | Full | Full | Full | Full | Full | Full | Full | Full |
| AR | View | Edit (OPD sendiri) | View | View | View | View | ❌ | ❌ |
| Teknisi | View | View | Full | Full | View | View | ❌ | Full |

---

## 9. Dummy Data Seeding

`lib/seed.ts` men-generate:
- **4 Wilayah** + **185 OPD** (nama realistis)
- **12 users** (8 AR + 1 Kasiwas + 1 Kepala KPP + 2 Teknisi)
- **Data SPT** 3 bulan (Jan-Mar 2026) + historis 2025
- **PPh 21** 6 bulan per OPD
- **48 sesi sosialisasi** + 23 OPD belum
- **~500 sample pegawai** belum lapor
- **20 action log** + **10 notifikasi**

---

## 10. Tahapan Implementasi

### Phase 1: Foundation (Hari 1-2)
- Inisialisasi Next.js + SQLite + schema
- Design system (globals.css)
- Seed data + NextAuth setup

### Phase 2: Layout (Hari 2-3)
- Sidebar (collapsible) + Topbar + Login page
- Dashboard layout shell

### Phase 3: Komponen UI (Hari 3-4)
- KpiCard, Badge, TrafficLight, Button, DataTable
- Modal, SearchBar, FilterChip, Pagination, ProgressBar, Toggle, Tabs
- Chart components (Line, Bar, Doughnut, Scatter)

### Phase 4: Halaman & API (Hari 4-7)
- Dashboard + Modul 1-3
- Data OPD, Pegawai, Direktori AR, Direktori OPD
- Analitik, Pengguna, Pengaturan

### Phase 5: Polish (Hari 7-8)
- Responsive, loading states, error handling
- Animasi, micro-interactions, testing

---

## 11. Verification Plan

### Build
```bash
npm run build    # Zero errors
npm run lint     # Clean
```

### Manual Testing
- Verifikasi setiap halaman render data dari SQLite
- Test CRUD OPD (tambah, edit, hapus)
- Test login 4 role
- Test filter/search/sort/pagination
- Verifikasi semua chart
- Test sidebar collapse + responsive

---

## Open Questions

1. **Export CSV/Excel**: Perlu implementasi real atau cukup dummy button?
2. **Notifikasi email**: Simulasi Power Automate atau cukup in-app?
3. **Jumlah data pegawai seed**: Full 21.764 atau sample 500?
4. **Port dev server**: Default `localhost:3000` OK?

---

*Berdasarkan SIMPATIK Dashboard v2.0.1 dan Panduan Microsoft 365 — Elsa Trisni, Kasi Pengawasan VI, KPP Pratama Padang Satu.*
