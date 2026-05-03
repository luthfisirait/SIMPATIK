# SIMPATIK — Plan Migrasi Database ke Microsoft Office 365

**Pemetaan lengkap dari SQLite → Excel Online + SharePoint + Power Automate + Microsoft Forms**

---

## 1. Ringkasan Arsitektur

### Dari (Sekarang — Next.js + SQLite)
```
Next.js App ←→ better-sqlite3 ←→ simpatik.db (lokal)
```

### Ke (Target — Next.js + Microsoft 365)
```
Next.js App ←→ Microsoft Graph API ←→ SharePoint/Excel Online
                                   ←→ Power Automate (notifikasi)
                                   ←→ Microsoft Forms (input AR)
```

### Prinsip Migrasi
1. **1 Tabel SQLite = 1 Sheet/Tabel di Excel Online** — file `SIMPATIK_Database.xlsx` di SharePoint
2. **Autentikasi** via Microsoft Entra ID (Azure AD) — menggantikan NextAuth Credentials
3. **Notifikasi** via Power Automate — menggantikan tabel `notifications`
4. **Input AR** via Microsoft Forms — menggantikan CRUD action_log manual

---

## 2. Struktur File SharePoint

```
📁 SharePoint Site: SIMPATIK - KPP Pratama Padang Satu
├── 📁 Dokumen/
│   ├── 📊 SIMPATIK_Database.xlsx          ← Database utama (10 sheet = 10 tabel)
│   ├── 📊 SIMPATIK_Arsip_2024.xlsx        ← Arsip tahun lalu (performa)
│   └── 📄 SOP_SIMPATIK.pdf                ← Panduan pengguna
├── 📁 Laporan/
│   └── 📄 Template_Laporan_Bulanan.docx   ← Template laporan
├── 📁 Forms/
│   ├── 📋 Form_Action_Log_AR              ← Microsoft Forms
│   └── 📋 Form_Update_Data_SPT            ← Microsoft Forms
└── 📁 Dashboard/
    └── 🌐 SIMPATIK_Dashboard.aspx         ← Halaman SharePoint (link ke Next.js)
```

---

## 3. Pemetaan Tabel SQLite → Sheet Excel Online

### 3.1 Sheet `DATA_WILAYAH` ← tabel `wilayah`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID_WILAYAH | Number | `id` | 1 |
| NAMA_WILAYAH | Text | `nama` | Kota Padang |
| KODE_WILAYAH | Text | `kode` | kota_padang |

**Catatan**: Sheet referensi, jarang berubah. Dipakai VLOOKUP oleh sheet lain.

---

### 3.2 Sheet `DATA_USERS` ← tabel `users`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID_USER | Number | `id` | 1 |
| NAMA | Text | `nama` | Elsa Trisni |
| EMAIL | Text | `email` | elsa@kpp-padangsatu.go.id |
| NIP | Text | `nip` | 198501122010012001 |
| JABATAN | Text | `jabatan` | Kasiwas VI |
| ROLE | Text (Dropdown) | `role` | kasiwas |
| PHONE | Text | `phone` | 08127654321 |
| STATUS | Text (Dropdown) | `status` | aktif |

**Validasi**: Kolom ROLE dibatasi dropdown: `kepala_kpp`, `kasiwas`, `ar`, `teknisi`.
**Catatan**: `password_hash` dan `avatar_color` tidak perlu di Excel — autentikasi via Microsoft Entra ID.

---

### 3.3 Sheet `DATA_OPD` ← tabel `opd`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID_OPD | Number | `id` | 1 |
| NAMA_OPD | Text | `nama` | Dinas Pendidikan Kota Padang |
| ID_WILAYAH | Number | `wilayah_id` | 1 |
| NAMA_WILAYAH | Formula | `=VLOOKUP(C2, DATA_WILAYAH, 2, FALSE)` | Kota Padang |
| JUMLAH_ASN | Number | `jumlah_asn` | 450 |
| NAMA_BENDAHARA | Text | `nama_bendahara` | Sri Wahyuni |
| HP_BENDAHARA | Text | `hp_bendahara` | 08123456789 |
| NAMA_PIC_KEPEG | Text | `nama_pic_kepeg` | Andi Saputra |
| HP_PIC_KEPEG | Text | `hp_pic_kepeg` | 08198765432 |
| ID_AR | Number | `ar_id` | 3 |
| NAMA_AR | Formula | `=VLOOKUP(J2, DATA_USERS, 2, FALSE)` | Rina Aulia |
| STATUS | Text (Dropdown) | `status` | aktif |

**Validasi**: STATUS dropdown: `aktif`, `tidak_aktif`, `perlu_update`.
**Jumlah baris**: 185 OPD.

---

### 3.4 Sheet `MODUL1_SPT` ← tabel `spt_monitoring`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID | Number | `id` | 1 |
| ID_OPD | Number | `opd_id` | 1 |
| NAMA_OPD | Formula | `=VLOOKUP(B2, DATA_OPD, 2, FALSE)` | Dinas Pendidikan |
| TAHUN_PAJAK | Number | `tahun_pajak` | 2025 |
| PERIODE | Text | `periode` | 2026-03 |
| JML_WAJIB_LAPOR | Number | `jumlah_wajib_lapor` | 450 |
| JML_SUDAH_LAPOR | Number | `jumlah_sudah_lapor` | 312 |
| PERSEN_KEPATUHAN | Formula | `=G2/F2*100` | 69.3 |
| STATUS_TRAFFIC_LIGHT | Formula | `=IF(H2>=70,"HIJAU",IF(H2>=40,"KUNING","MERAH"))` | KUNING |
| NAMA_WILAYAH | Formula | `=VLOOKUP(...)` | Kota Padang |
| NAMA_AR | Formula | `=VLOOKUP(...)` | Rina Aulia |

**Conditional Formatting**:
- HIJAU → background `#C6EFCE`, font `#006100`
- KUNING → background `#FFEB9C`, font `#9C5700`
- MERAH → background `#FFC7CE`, font `#9C0006`

**Jumlah baris**: 185 × 3 periode = ~555 baris (tahun berjalan) + historis.

---

### 3.5 Sheet `MODUL2_PPH21` ← tabel `pph21_monitoring`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID | Number | `id` | 1 |
| ID_OPD | Number | `opd_id` | 1 |
| NAMA_OPD | Formula | VLOOKUP | Dinas Pendidikan |
| BULAN | Text | `bulan` | 2026-04 |
| JML_DIPOTONG | Number | `jumlah_dipotong` | 35 |
| NOMINAL_SETOR | Number | `nominal_setor` | 45000000 |
| ESTIMASI_WAJAR | Number | `estimasi_wajar` | 52000000 |
| TGL_SETOR | Date | (tambahan) | 2026-04-10 |
| KETEPATAN | Text (Dropdown) | `ketepatan` | tepat_waktu |
| STATUS | Formula | `=IF(F2<G2*0.7,"kritis",IF(F2<G2*0.85,"under_reporting","normal"))` | normal |

**Validasi**: KETEPATAN dropdown: `tepat_waktu`, `terlambat`, `belum_setor`.
**Jumlah baris**: 185 × 6 bulan = ~1.110 baris.

---

### 3.6 Sheet `MODUL3_SOSIALISASI` ← tabel `sosialisasi`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID | Number | `id` | 1 |
| ID_OPD | Number | `opd_id` | 1 |
| NAMA_OPD | Formula | VLOOKUP | Dinas Pendidikan |
| TANGGAL | Date | `tanggal` | 2026-02-15 |
| JUMLAH_PESERTA | Number | `jumlah_peserta` | 45 |
| ID_PENYULUH | Number | `penyuluh_id` | 3 |
| NAMA_PENYULUH | Formula | VLOOKUP | Rina Aulia |
| STATUS | Text (Dropdown) | `status` | sudah |
| CATATAN | Text | (tambahan) | Sosialisasi e-Filing batch 1 |

**Validasi**: STATUS dropdown: `sudah`, `belum`, `perlu_ulang`.

---

### 3.7 Sheet `DATA_PEGAWAI` ← tabel `pegawai`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID | Number | `id` | 1 |
| NAMA | Text | `nama` | Ahmad Rizki |
| NIP | Text | `nip` | 199001052015011001 |
| ID_OPD | Number | `opd_id` | 1 |
| NAMA_OPD | Formula | VLOOKUP | Dinas Pendidikan |
| JABATAN | Text | `jabatan` | Staf Keuangan |
| STATUS_CORETAX | Text (Dropdown) | `status_coretax` | aktif_belum_lapor |
| PHONE | Text | `phone` | 08123456789 |
| NAMA_AR | Formula | VLOOKUP | Rina Aulia |

**Validasi**: STATUS_CORETAX dropdown: `aktif_belum_lapor`, `belum_aktivasi`, `sudah_lapor`.
**Jumlah baris**: ~500 sampel (atau full ~21.764 — lihat catatan performa).

---

### 3.8 Sheet `ACTION_LOG` ← tabel `action_log`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID | Auto | `id` | 1 |
| ID_USER | Number | `user_id` | 3 |
| NAMA_AR | Formula | VLOOKUP | Rina Aulia |
| AKSI | Text | `action` | Koordinasi telepon |
| JENIS_TARGET | Text | `target_type` | opd |
| NAMA_TARGET | Text | `target_name` | Dinas Pendidikan |
| TANGGAL | DateTime | `created_at` | 30/04/2026 08:30 |

**Input**: Via **Microsoft Forms** (Form Action Log AR) — otomatis masuk ke sheet ini.

---

### 3.9 Sheet `NOTIFIKASI` ← tabel `notifications`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| ID | Auto | `id` | 1 |
| JUDUL | Text | `title` | OPD Merah Ditemukan |
| PESAN | Text | `body` | 5 OPD berstatus merah hari ini |
| TIPE | Text | `type` | warning |
| SUDAH_DIBACA | Yes/No | `is_read` | No |
| TANGGAL | DateTime | `created_at` | 30/04/2026 |

**Catatan**: Sheet ini diisi otomatis oleh **Power Automate**. Untuk Next.js, notifikasi in-app tetap dari API.

---

### 3.10 Sheet `PENGATURAN` ← tabel `settings`

| Kolom Excel | Tipe | Kolom SQLite | Contoh |
|---|---|---|---|
| KEY | Text | `key` | frekuensi_sync |
| VALUE | Text | `value` | harian |

---

## 4. Microsoft Forms → Excel

### 4.1 Form Action Log AR

**URL**: Dibuat di Microsoft Forms, dihubungkan ke sheet `ACTION_LOG`.

| Field Form | Tipe | Map ke Kolom |
|---|---|---|
| Nama AR | Dropdown (dari DATA_USERS, role=ar) | ID_USER |
| OPD yang Ditindaklanjuti | Dropdown (dari DATA_OPD) | NAMA_TARGET |
| Jenis Tindak Lanjut | Choice: Koordinasi / Deteksi / Sosialisasi / Exec Summary | AKSI |
| Catatan | Long Text | (kolom tambahan CATATAN) |

**Koneksi**: Tab Respons → ikon Excel → hubungkan ke `SIMPATIK_Database.xlsx` sheet `ACTION_LOG`.

### 4.2 Form Update Data SPT

**URL**: Untuk AR update data SPT setelah export dari Coretax.

| Field Form | Tipe | Map ke Kolom |
|---|---|---|
| Nama OPD | Dropdown | ID_OPD |
| Periode | Choice: 2026-01 / 2026-02 / 2026-03 | PERIODE |
| Jumlah Sudah Lapor | Number | JML_SUDAH_LAPOR |

---

## 5. Power Automate — Alur Otomasi

### 5.1 Alur 1: Notifikasi Harian OPD Merah

```
┌─────────────────────────────────────┐
│ Trigger: Recurrence                  │
│ Jadwal: Setiap hari kerja, 07:30    │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Action: Excel Online (Business)      │
│ Daftar baris dari tabel MODUL1_SPT  │
│ File: SIMPATIK_Database.xlsx        │
│ Situs: SharePoint SIMPATIK          │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Action: Filter Array                 │
│ Dari: output langkah sebelumnya     │
│ Kondisi: STATUS_TRAFFIC_LIGHT = MERAH│
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Action: Office 365 Outlook           │
│ Kirim Email (V2)                    │
│ Kepada: tim AR (semua)              │
│ Subjek: "SIMPATIK - OPD Merah"      │
│ Isi: Daftar OPD merah + persentase  │
└─────────────────────────────────────┘
```

### 5.2 Alur 2: Executive Summary Mingguan

```
┌─────────────────────────────────────┐
│ Trigger: Recurrence                  │
│ Jadwal: Setiap Senin, 08:00         │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Baca data dari SEMUA sheet modul    │
│ (MODUL1_SPT, MODUL2_PPH21,         │
│  MODUL3_SOSIALISASI)                │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Compose: Ringkasan                   │
│ - Total kepatuhan SPT: XX%          │
│ - Jumlah OPD merah: X              │
│ - PPh 21 terlambat: X              │
│ - Top 3 OPD intervensi segera      │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Kirim Email ke:                      │
│ - Kepala Seksi (Kasiwas)            │
│ - Kepala KPP                        │
└─────────────────────────────────────┘
```

### 5.3 Alur 3: Auto-Log dari Forms

```
┌─────────────────────────────────────┐
│ Trigger: When new response submitted │
│ Form: Form_Action_Log_AR            │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Get response details                 │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│ Add row to Excel table ACTION_LOG   │
│ Map: respons form → kolom tabel     │
└─────────────────────────────────────┘
```

---

## 6. Integrasi Next.js ↔ Microsoft Graph API

### 6.1 Autentikasi — Microsoft Entra ID (Azure AD)

Menggantikan NextAuth Credentials dengan MSAL (Microsoft Authentication Library).

```
dependencies baru:
- @azure/msal-node        ← Server-side auth
- @azure/msal-react       ← Client-side auth
- @microsoft/microsoft-graph-client  ← Graph API calls
```

**App Registration di Azure Portal**:
- Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad`
- Permissions: `Files.ReadWrite.All`, `Sites.ReadWrite.All`, `User.Read`

### 6.2 Pemetaan API Routes

| Route Lama (SQLite) | Route Baru (Graph API) | Operasi Graph |
|---|---|---|
| `GET /api/dashboard` | `GET /api/dashboard` | Read multiple sheets + aggregate |
| `GET /api/opd` | `GET /api/opd` | Read `DATA_OPD` sheet rows |
| `POST /api/opd` | `POST /api/opd` | Add row to `DATA_OPD` |
| `PUT /api/opd/[id]` | `PUT /api/opd/[id]` | Update row in `DATA_OPD` |
| `DELETE /api/opd/[id]` | `DELETE /api/opd/[id]` | Delete row from `DATA_OPD` |
| `GET /api/spt` | `GET /api/spt` | Read `MODUL1_SPT` + filter |
| `GET /api/pph21` | `GET /api/pph21` | Read `MODUL2_PPH21` + filter |
| `GET /api/sosialisasi` | `GET /api/sosialisasi` | Read `MODUL3_SOSIALISASI` |
| `GET /api/pegawai` | `GET /api/pegawai` | Read `DATA_PEGAWAI` + filter |
| `GET /api/ar` | `GET /api/ar` | Read `DATA_USERS` WHERE role=ar |
| `GET /api/action-log` | `GET /api/action-log` | Read `ACTION_LOG` |
| `GET /api/notifications` | `GET /api/notifications` | Read `NOTIFIKASI` |

### 6.3 Contoh Graph API Call — Read Sheet

```typescript
// lib/graph.ts
import { Client } from '@microsoft/microsoft-graph-client';

const SITE_ID = 'your-sharepoint-site-id';
const DRIVE_ID = 'your-drive-id';
const FILE_ID = 'your-file-id'; // SIMPATIK_Database.xlsx

export async function readSheet(sheetName: string) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken); // dari MSAL
    }
  });

  const result = await client
    .api(`/sites/${SITE_ID}/drives/${DRIVE_ID}/items/${FILE_ID}/workbook/worksheets('${sheetName}')/tables/usedRange`)
    .get();

  return result.values; // Array 2D: [[header], [row1], [row2], ...]
}

export async function addRow(sheetName: string, tableName: string, values: any[]) {
  const client = getGraphClient();

  await client
    .api(`/sites/${SITE_ID}/drives/${DRIVE_ID}/items/${FILE_ID}/workbook/tables('${tableName}')/rows/add`)
    .post({ values: [values] });
}

export async function updateRow(sheetName: string, rowIndex: number, values: any[]) {
  const client = getGraphClient();

  await client
    .api(`/sites/${SITE_ID}/drives/${DRIVE_ID}/items/${FILE_ID}/workbook/worksheets('${sheetName}')/range(address='A${rowIndex}:L${rowIndex}')`)
    .patch({ values: [values] });
}
```

---

## 7. Hak Akses SharePoint

| Peran | Yang Bisa Diakses | Level Akses | Cara Membagikan |
|---|---|---|---|
| Kepala KPP | Sheet DASHBOARD, semua modul | View Only | SharePoint → Bagikan → Dapat Melihat |
| Kasiwas | Semua sheet, semua data | Edit Penuh | SharePoint → Bagikan → Dapat Mengedit |
| AR | Sheet modul, ACTION_LOG (OPD sendiri) | Edit Terbatas | Bagikan file + ajarkan edit kolom relevan saja |
| Teknisi | Semua sheet | Edit Penuh | SharePoint → Bagikan → Dapat Mengedit |

---

## 8. Catatan Performa & Limitasi Excel Online

| Aspek | Batas | Mitigasi |
|---|---|---|
| Baris per sheet | ~1.048.576 (Excel max) | Cukup untuk 185 OPD × 12 bulan |
| Ukuran file | 25 MB via Graph API | Arsipkan data tahun lalu ke file terpisah |
| Concurrent editors | ~25 user | Atur: AR hanya edit baris OPD miliknya |
| VLOOKUP performance | Lambat di >10.000 baris | Ganti VLOOKUP range penuh → range spesifik |
| Graph API rate limit | 10.000 req / 10 menit | Cache di Next.js (ISR / revalidate) |
| Data Pegawai 21.764 | Bisa berat | Pertimbangkan pisah ke file `DATA_PEGAWAI.xlsx` terpisah |

---

## 9. Strategi Migrasi Data

### Step 1: Buat File Excel di SharePoint
1. Buat site SharePoint "SIMPATIK"
2. Upload `SIMPATIK_Database.xlsx` kosong dengan 10 sheet + header

### Step 2: Export dari SQLite → Excel
```bash
# Script export (jalankan sekali)
node scripts/export-to-excel.js
```
Script ini akan:
- Query semua tabel dari `simpatik.db`
- Generate file `.xlsx` dengan library `xlsx`
- Upload ke SharePoint via Graph API

### Step 3: Buat Tabel Excel
Di setiap sheet, select semua data → Insert → Table. Beri nama tabel:
- `TBL_WILAYAH`, `TBL_USERS`, `TBL_OPD`, `TBL_SPT`, `TBL_PPH21`, `TBL_SOSIALISASI`, `TBL_PEGAWAI`, `TBL_ACTION_LOG`, `TBL_NOTIFIKASI`, `TBL_PENGATURAN`

### Step 4: Tambahkan Formula & Conditional Formatting
- VLOOKUP untuk kolom referensi (NAMA_WILAYAH, NAMA_AR, NAMA_OPD)
- Traffic light conditional formatting di sheet MODUL1_SPT
- Dropdown validation di kolom STATUS

### Step 5: Buat Microsoft Forms
- Form Action Log AR
- Form Update Data SPT
- Hubungkan ke sheet yang sesuai

### Step 6: Buat Power Automate Flows
- Alur notifikasi harian
- Alur executive summary mingguan
- Alur auto-log dari Forms

### Step 7: Ganti API Layer di Next.js
- Install `@azure/msal-node` + `@microsoft/microsoft-graph-client`
- Buat `lib/graph.ts` — wrapper Graph API
- Refactor setiap route di `app/api/` dari SQLite → Graph API
- Hapus dependency `better-sqlite3`

### Step 8: Bagikan Akses
- Atur permission per role di SharePoint
- Buat shortcut di halaman SharePoint
- Kirim link ke semua AR via WhatsApp

---

## 10. Timeline Migrasi

| Minggu | Aktivitas |
|---|---|
| Minggu 1 | Setup SharePoint site, buat file Excel, isi header + formula + validasi |
| Minggu 2 | Export data dari SQLite → Excel, buat tabel Excel, conditional formatting |
| Minggu 3 | Buat Microsoft Forms, hubungkan ke Excel, buat Power Automate flows |
| Minggu 4 | Refactor Next.js API ke Graph API, testing, bagikan akses ke tim |

---

## 11. Dependency Baru (package.json)

```json
{
  "dependencies": {
    "@azure/msal-node": "^2.x",
    "@azure/msal-react": "^2.x",
    "@azure/msal-browser": "^3.x",
    "@microsoft/microsoft-graph-client": "^3.x",
    "xlsx": "^0.18.x"
  }
}
```

**Yang dihapus**:
- `better-sqlite3` + `@types/better-sqlite3`
- `bcryptjs` + `@types/bcryptjs` (auth via Microsoft Entra ID)
- `next-auth` (diganti MSAL)

---

## 12. Perbandingan Pendekatan

| Aspek | SQLite (Sekarang) | Excel Online (Target) |
|---|---|---|
| Setup | Instant, lokal | Perlu Azure AD + SharePoint |
| Query speed | <1ms (SQL) | 200-500ms (Graph API) |
| Offline | ✅ | ❌ Perlu internet |
| Multi-user edit | ❌ | ✅ Real-time co-authoring |
| Backup | Manual | ✅ Otomatis (SharePoint versioning) |
| Notifikasi email | ❌ Custom code | ✅ Power Automate bawaan |
| Mobile access | Via browser | ✅ Excel app + SharePoint app |
| Akses instansi | Lokal saja | ✅ Seluruh pegawai M365 |
| Biaya | Gratis | ✅ Sudah termasuk lisensi M365 instansi |

---

*Plan ini memetakan seluruh 10 tabel SQLite ke ekosistem Microsoft 365, sesuai panduan SIMPATIK oleh Elsa Trisni, Kasi Pengawasan VI — KPP Pratama Padang Satu.*
