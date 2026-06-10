#!/usr/bin/env node
/**
 * Importer khusus untuk file "Contoh.xlsx".
 *
 * Struktur yang didukung:
 *   Sheet1 = data pegawai (kunci unik: NIK)
 *     No | Nama | NIP | npwp | NIK | OPD | Email | No HP | PNS/P3K
 *   Sheet2 = direktori OPD + 2 sesi sosialisasi (header bertingkat, kunci unik OPD: NPWP)
 *     No | NPWP | Nama OPD | Wilayah Kerja
 *       | Tema PPh Pasal 21        -> Hari/Tgl | Tempat | Jumlah Peserta
 *       | Tema SPT PPh Orang Pribadi -> Hari/Tgl | Tempat | Jumlah Peserta
 *
 * Sifat: ADITIF (upsert). Tidak menghapus data modul lain.
 * Backup .db dibuat otomatis sebelum menulis (kecuali --no-backup).
 *
 * Pakai:
 *   npm run import:contoh -- --source "C:\\path\\Contoh.xlsx"
 *   node scripts/import-contoh-to-sqlite.mjs --source <file> [--db <file>] [--no-backup]
 */
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import ExcelJS from "exceljs";

const ROOT = process.cwd();
const DEFAULT_SOURCE = path.join(ROOT, "database", "Contoh.xlsx");
const DEFAULT_DB = path.join(ROOT, "database", "simpatik.db");

const args = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(args.source ?? DEFAULT_SOURCE);
const dbPath = path.resolve(args.db ?? DEFAULT_DB);

if (!fs.existsSync(sourcePath)) {
  throw new Error(`File Excel tidak ditemukan: ${sourcePath}`);
}
if (!fs.existsSync(dbPath)) {
  throw new Error(`Database tidak ditemukan: ${dbPath}. Jalankan aplikasi atau import:excel dahulu.`);
}

let backupPath = null;
if (args.backup !== false) {
  backupPath = path.join(path.dirname(dbPath), `${path.basename(dbPath, ".db")}.backup-${timestampForFile()}.db`);
  fs.copyFileSync(dbPath, backupPath);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(sourcePath);

const database = new Database(dbPath);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
ensureColumns(database);

const result = database.transaction(() => {
  const wilayah = createWilayahRegistry(database);
  const opd = createOpdRegistry(database, wilayah);

  const sosialisasi = importSheet2(database, workbook, opd);
  const pegawai = importSheet1(database, workbook, opd);

  return { ...opd.stats(), ...sosialisasi, ...pegawai };
})();

console.log(`Import ${path.relative(ROOT, sourcePath)} -> ${path.relative(ROOT, dbPath)}`);
if (backupPath) console.log(`Backup: ${path.relative(ROOT, backupPath)}`);
console.table(result);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
function ensureColumns(db) {
  const columns = {
    pegawai: ["npwp TEXT", "nik TEXT", "email TEXT", "jenis_kepegawaian TEXT"],
    sosialisasi: ["tempat TEXT", "tema TEXT"],
  };
  Object.entries(columns).forEach(([table, defs]) => {
    const existing = new Set(
      db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map((c) => c.name),
    );
    defs.forEach((def) => {
      const [name] = def.split(/\s+/, 1);
      if (!existing.has(name)) db.exec(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${def}`);
    });
  });
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_pegawai_nik ON pegawai(nik)");
}

// ---------------------------------------------------------------------------
// Registries (upsert)
// ---------------------------------------------------------------------------
function createWilayahRegistry(db) {
  const cache = new Map();
  const find = db.prepare("SELECT id FROM wilayah WHERE LOWER(nama) = LOWER(?)");
  const insert = db.prepare("INSERT INTO wilayah (nama, kode) VALUES (?, ?)");
  const usedKode = new Set(db.prepare("SELECT kode FROM wilayah").all().map((r) => r.kode));

  return {
    ensure(name) {
      const clean = stringOrNull(name) ?? "Tidak Diketahui";
      const key = clean.toLowerCase();
      if (cache.has(key)) return cache.get(key);
      const found = find.get(clean);
      if (found) {
        cache.set(key, found.id);
        return found.id;
      }
      let kode = slug(clean) || `wilayah-${cache.size + 1}`;
      let i = 2;
      while (usedKode.has(kode)) kode = `${slug(clean) || "wilayah"}-${i++}`;
      usedKode.add(kode);
      const id = Number(insert.run(clean, kode).lastInsertRowid);
      cache.set(key, id);
      return id;
    },
  };
}

function createOpdRegistry(db, wilayah) {
  const findByNpwp = db.prepare("SELECT id FROM opd WHERE npwp_opd = ? AND npwp_opd IS NOT NULL");
  const findByName = db.prepare("SELECT id FROM opd WHERE LOWER(nama) = LOWER(?)");
  const insert = db.prepare(`
    INSERT INTO opd (
      nama, wilayah_id, jenis_instansi, jumlah_asn, jumlah_pppk, npwp_opd, status_pemungut_ppn,
      nama_bendahara, hp_bendahara, nama_pic_kepeg, hp_pic_kepeg, status, tanggal_input
    )
    VALUES (?, ?, ?, 0, 0, ?, 'TIDAK', 'Belum diisi', '-', 'Belum diisi', '-', 'perlu_update', ?)
  `);
  const updateNpwp = db.prepare("UPDATE opd SET npwp_opd = COALESCE(npwp_opd, ?) WHERE id = ?");
  let created = 0;
  let matched = 0;

  function ensure({ nama, npwp, wilayahNama }) {
    const cleanNama = stringOrNull(nama);
    const cleanNpwp = stringOrNull(npwp);
    if (!cleanNama && !cleanNpwp) return null;

    if (cleanNpwp) {
      const byNpwp = findByNpwp.get(cleanNpwp);
      if (byNpwp) {
        matched += 1;
        return byNpwp.id;
      }
    }
    if (cleanNama) {
      const byName = findByName.get(cleanNama);
      if (byName) {
        matched += 1;
        if (cleanNpwp) updateNpwp.run(cleanNpwp, byName.id);
        return byName.id;
      }
    }

    const wilayahId = wilayah.ensure(wilayahNama);
    const id = Number(
      insert.run(
        cleanNama ?? `OPD ${cleanNpwp}`,
        wilayahId,
        stringOrNull(wilayahNama),
        cleanNpwp,
        new Date().toISOString().slice(0, 10),
      ).lastInsertRowid,
    );
    created += 1;
    return id;
  }

  return { ensure, stats: () => ({ opd_baru: created, opd_cocok: matched }) };
}

// ---------------------------------------------------------------------------
// Sheet2 -> OPD + sosialisasi
// ---------------------------------------------------------------------------
function importSheet2(db, wb, opd) {
  const ws = findSheet(wb, "Sheet2") ?? wb.worksheets[1];
  if (!ws) return { sosialisasi_baru: 0 };

  // Header dua baris (baris 1-2), data mulai baris 3.
  const delTema = db.prepare("DELETE FROM sosialisasi WHERE opd_id = ? AND tema = ?");
  const insertSos = db.prepare(`
    INSERT INTO sosialisasi (opd_id, tanggal, jumlah_peserta, penyuluh_id, status, tempat, tema)
    VALUES (?, ?, ?, NULL, ?, ?, ?)
  `);

  let count = 0;
  const themes = [
    { tema: "PPh Pasal 21", tgl: 5, tempat: 6, peserta: 7 },
    { tema: "SPT PPh Orang Pribadi", tgl: 8, tempat: 9, peserta: 10 },
  ];

  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rn <= 2) return; // lewati header bertingkat
    const npwp = cell(row, 2);
    const nama = cell(row, 3);
    const wilayahNama = cell(row, 4);
    if (!stringOrNull(npwp) && !stringOrNull(nama)) return;

    const opdId = opd.ensure({ nama, npwp, wilayahNama });
    if (!opdId) return;

    themes.forEach((t) => {
      const tanggal = parseIndoDate(cell(row, t.tgl));
      const tempat = stringOrNull(cell(row, t.tempat));
      const peserta = integerOrNull(cell(row, t.peserta)) ?? 0;
      const sudah = Boolean(tanggal);
      if (!sudah && !tempat) return; // sesi tema ini tidak diisi
      delTema.run(opdId, t.tema);
      insertSos.run(
        opdId,
        tanggal ?? new Date().toISOString().slice(0, 10),
        peserta,
        sudah ? "sudah" : "belum",
        tempat,
        t.tema,
      );
      count += 1;
    });
  });

  return { sosialisasi_baru: count };
}

// ---------------------------------------------------------------------------
// Sheet1 -> pegawai (kunci unik NIK)
// ---------------------------------------------------------------------------
function importSheet1(db, wb, opd) {
  const ws = findSheet(wb, "Sheet1") ?? wb.worksheets[0];
  if (!ws) return { pegawai_baru: 0, pegawai_update: 0 };

  const findByNik = db.prepare("SELECT id FROM pegawai WHERE nik = ? AND nik IS NOT NULL");
  const findByNip = db.prepare("SELECT id FROM pegawai WHERE nip = ?");
  const insert = db.prepare(`
    INSERT INTO pegawai (nama, nip, opd_id, jabatan, status_coretax, phone, npwp, nik, email, jenis_kepegawaian)
    VALUES (?, ?, ?, ?, 'aktif_belum_lapor', ?, ?, ?, ?, ?)
  `);
  const update = db.prepare(`
    UPDATE pegawai SET
      nama = ?, nip = COALESCE(?, nip), opd_id = ?, phone = COALESCE(?, phone),
      npwp = COALESCE(?, npwp), nik = COALESCE(?, nik), email = COALESCE(?, email),
      jenis_kepegawaian = COALESCE(?, jenis_kepegawaian)
    WHERE id = ?
  `);

  let created = 0;
  let updated = 0;
  let headerSeen = false;

  ws.eachRow({ includeEmpty: false }, (row) => {
    const nama = stringOrNull(cell(row, 2));
    if (!headerSeen) {
      // lewati baris header (kolom "Nama")
      if (nama && nama.toLowerCase() === "nama") {
        headerSeen = true;
        return;
      }
      headerSeen = true;
    }
    if (!nama) return;

    const nip = stringOrNull(cell(row, 3));
    const npwp = stringOrNull(cell(row, 4));
    const nik = stringOrNull(cell(row, 5));
    const opdNama = stringOrNull(cell(row, 6));
    const email = stringOrNull(cell(row, 7));
    const phone = stringOrNull(cell(row, 8));
    const jenis = stringOrNull(cell(row, 9));

    const opdId = opd.ensure({ nama: opdNama, npwp: null, wilayahNama: null });
    if (!opdId) return; // pegawai tanpa OPD tidak bisa ditautkan (opd_id NOT NULL)

    const nipValue = nip ?? nik ?? `TANPA-NIP-${Date.now()}-${created + updated}`;
    const existing = (nik && findByNik.get(nik)) || (nip && findByNip.get(nip)) || null;

    if (existing) {
      update.run(nama, nip, opdId, phone, npwp, nik, email, jenis, existing.id);
      updated += 1;
    } else {
      insert.run(nama, nipValue, opdId, "Pegawai", phone, npwp, nik, email, jenis);
      created += 1;
    }
  });

  return { pegawai_baru: created, pegawai_update: updated };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseArgs(items) {
  const parsed = {};
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item === "--no-backup") parsed.backup = false;
    else if (item === "--source") parsed.source = items[++i];
    else if (item === "--db") parsed.db = items[++i];
  }
  return parsed;
}

function findSheet(wb, name) {
  const target = name.trim().toLowerCase();
  return wb.worksheets.find((ws) => ws.name.trim().toLowerCase() === target);
}

function cell(row, index) {
  return cellText(row.getCell(index).value);
}

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((t) => t.text).join("");
    if ("hyperlink" in value && "text" in value) return String(value.text ?? "");
    return "";
  }
  return String(value);
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function integerOrNull(value) {
  const text = String(value ?? "").replace(/[^\d-]/g, "");
  if (!text) return null;
  const num = Number.parseInt(text, 10);
  return Number.isNaN(num) ? null : num;
}

function indoMonth(name) {
  return {
    januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
    juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  }[String(name).toLowerCase()];
}

/** "Senin, 1 Desember 2025" / Date / "2025-12-01" -> "YYYY-MM-DD" | null */
function parseIndoDate(value) {
  const raw = stringOrNull(value);
  if (!raw) return null;

  // sudah ISO
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // hapus prefix nama hari + koma
  const cleaned = raw.replace(/^[A-Za-z]+\s*,\s*/, "").trim();
  const m = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const day = Number.parseInt(m[1], 10);
    const month = indoMonth(m[2]);
    const year = Number.parseInt(m[3], 10);
    if (month) return `${year}-${pad(month)}-${pad(day)}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
