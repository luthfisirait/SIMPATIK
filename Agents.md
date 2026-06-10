# Agents.md

Panduan untuk agen AI dan kontributor yang bekerja di repositori **SIMPATIK**. Baca ini sebelum membuat perubahan.

---

## Tentang Proyek

SIMPATIK (Sistem Monitoring Terintegrasi Kepatuhan Perpajakan) adalah aplikasi web **Next.js 14 (App Router, TypeScript)** + **SQLite** untuk memantau kepatuhan perpajakan 185 OPD di lingkungan KPP Pratama Padang Satu. Detail lengkap ada di `arsitektur.md` dan `fitur.md`.

- **Bahasa UI & domain: Bahasa Indonesia.** Label, pesan error, dan teks UI ditulis dalam Bahasa Indonesia. Identifier kode (variabel/fungsi) boleh Inggris, tetapi istilah domain (opd, wilayah, bendahara, sosialisasi, scoring) tetap Indonesia.

---

## Perintah Penting

```bash
npm install
npm run dev      # Dev server di http://localhost:3000 (JANGAN dijalankan agen sbg blocking; minta user)
npm run build    # Verifikasi build — WAJIB dijalankan setelah perubahan
npm run lint     # ESLint (next/core-web-vitals)
npm run import:excel   # Import Excel -> SQLite (scripts/import-excel-to-sqlite.mjs)
```

Sistem: **Windows / cmd**. Gunakan separator `&` (bukan `&&`) bila menggabungkan perintah. Jangan jalankan `npm run dev`/`next dev` sebagai proses blocking — itu long-running; sarankan user menjalankannya manual atau gunakan background process.

**Verifikasi wajib**: setelah perubahan kode, jalankan `npm run build` dan `npm run lint`. Perbaiki error sebelum menyerahkan hasil.

---

## Peta Arsitektur Singkat

| Area | Lokasi | Catatan |
|---|---|---|
| Halaman | `src/app/(dashboard)/<fitur>/page.tsx` | Server Components; baca data via `lib/queries.ts` |
| API | `src/app/api/<resource>/route.ts` | Lindungi dengan `requireApiPermission()` |
| Data layer | `src/lib/queries.ts` | SEMUA query baca/tulis terpusat di sini |
| Skema DB | `src/lib/db.ts` | `CREATE TABLE IF NOT EXISTS` + migrasi kolom inkremental |
| Seed | `src/lib/seed.ts` | PRNG deterministik; jangan ubah tanpa alasan |
| Auth | `src/lib/auth.ts` | NextAuth Credentials, JWT |
| RBAC | `src/lib/rbac.ts` | `pageRules` & `apiRules` — sumber kebenaran akses |
| Middleware | `src/middleware.ts` | Gate auth + RBAC untuk semua route |
| Validasi | `src/lib/validation.ts` | Payload OPD/user/sosialisasi |
| Import/Export | `src/lib/import-data.ts`, `src/lib/export.ts` | CSV/XLSX |
| Tipe | `src/types/index.ts` | Tipe domain bersama |
| UI components | `src/components/ui/`, `layout/Shell.tsx`, `charts/` | Reusable |
| Styling | `src/app/globals.css` | Vanilla CSS + design tokens (CSS vars) |

---

## Konvensi & Aturan Wajib

### Data & Query
- **Selalu lewati `lib/queries.ts`** untuk akses database. Jangan menulis SQL mentah langsung di route/page baru — tambahkan fungsi di `queries.ts`.
- Database otomatis di-seed via `ensureSeeded()` di dalam `queries.ts`/`auth.ts`. Jangan panggil seed manual di tempat lain.
- Saat menambah **kolom** ke tabel `opd`/`action_log`, daftarkan di `ensureExistingSchema()` (`db.ts`) agar database lama termigrasi. Untuk tabel baru, tambahkan di blok `CREATE TABLE IF NOT EXISTS`.
- Gunakan **prepared statements** dengan parameter (`?`) — jangan interpolasi string ke SQL (cegah injection).

### Keamanan & RBAC
- Setiap **route API baru** harus: (1) terdaftar di `apiRules` (`rbac.ts`), dan (2) memanggil `requireApiPermission(request)` di awal handler.
- Setiap **halaman baru** harus terdaftar di `pageRules` (`rbac.ts`) dan idealnya di `navGroups`/`meta` pada `Shell.tsx`.
- Untuk operasi tulis OPD, pakai helper kepemilikan (`canEditOpd`, `canCreateOpd`, `canDeleteOpd`) dan teruskan aktor agar **audit log** tercatat (`createAuditLog`).
- Jangan hardcode secret. `NEXTAUTH_SECRET` berasal dari env (`.env.local`).

### Validasi & Audit
- Validasi input tulis lewat `validation.ts` (kembalikan `{ ok, data | errors }`).
- Operasi create/update/delete/import pada OPD/user **harus** menulis audit log dengan snapshot before/after.

### Export
- Saat menambah dataset export, jaga proteksi **CSV injection** (`toCsv` sudah meng-escape sel diawali `= + - @`) dan sertakan BOM UTF-8.

### Frontend
- Default **Server Component**; tambahkan `"use client"` hanya bila perlu interaktivitas (chart, form, state).
- Gunakan komponen UI yang ada di `src/components/ui/` sebelum membuat yang baru.
- Pakai helper format dari `lib/utils.ts` (`formatRupiah`, `formatPercent`, `formatNumber`, `trafficFromPercent`, `toWaLink`) — jangan format manual.
- Ikuti design token di `globals.css` (navy/teal). Jangan introduksi library styling baru.

### Tipe
- Tambah/ubah tipe domain di `src/types/index.ts`. Hindari `any`; pertahankan kesesuaian dengan kolom DB.

---

## Yang TIDAK Boleh Dilakukan

- Jangan menambahkan test otomatis kecuali diminta eksplisit oleh user.
- Jangan mengganti stack (mis. menambah ORM, ganti styling framework, ganti auth) tanpa persetujuan.
- Jangan menjalankan operasi destruktif pada `database/*.db` (file produksi data dummy + backup). Jika perlu reset, gunakan endpoint/seed `force`, dan konfirmasi dulu.
- Jangan commit kecuali user memintanya. Jika diminta, jangan push ke `main` langsung.
- Jangan menulis file Markdown dokumentasi baru kecuali diminta.

---

## Alur Kerja yang Disarankan

1. Pahami konteks: baca `arsitektur.md`, `fitur.md`, dan file terkait di `lib/`.
2. Untuk fitur data baru: tambah query di `queries.ts` → tipe di `types/index.ts` → route API + `apiRules` → halaman + `pageRules` + nav di `Shell.tsx`.
3. Validasi & audit untuk operasi tulis.
4. Jalankan `npm run build` lalu `npm run lint`; perbaiki temuan.
5. Ringkas perubahan secara singkat.

---

## Roadmap Relevan

Migrasi ke **Microsoft 365** (SharePoint + Excel Online + Graph API + Power Automate) terdokumentasi di `plan/database_to_office365.md`. Saat menyentuh data layer, jaga agar `lib/queries.ts` tetap menjadi satu-satunya titik abstraksi sehingga penggantian backend di masa depan minim friksi.
