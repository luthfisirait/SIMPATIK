#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";

const ROOT = process.cwd();
const DEFAULT_SOURCE = path.join(ROOT, "database", "SIMPATIK_Database_KPP_Padang_Satu.xlsx");
const DEFAULT_DB = path.join(ROOT, "database", "simpatik.db");
const PASSWORD = "simpatik123";

const args = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(args.source ?? DEFAULT_SOURCE);
const dbPath = path.resolve(args.db ?? DEFAULT_DB);

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Excel source not found: ${sourcePath}`);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let backupPath = null;
if (fs.existsSync(dbPath) && args.backup !== false) {
  backupPath = path.join(
    path.dirname(dbPath),
    `${path.basename(dbPath, ".db")}.backup-${timestampForFile()}.db`,
  );
  fs.copyFileSync(dbPath, backupPath);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(sourcePath);
const database = new Database(dbPath);

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
ensureSchema(database);

const sheets = readWorkbook(workbook);
const result = database.transaction(() => {
  resetAppTables(database);
  importRawSheets(database, sheets);
  return importAppTables(database, sheets, sourcePath);
})();

console.log(`Imported ${path.relative(ROOT, sourcePath)} into ${path.relative(ROOT, dbPath)}`);
if (backupPath) {
  console.log(`Backup created at ${path.relative(ROOT, backupPath)}`);
}
console.table(result);

function parseArgs(items) {
  const parsed = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === "--no-backup") {
      parsed.backup = false;
    } else if (item === "--source") {
      parsed.source = items[++index];
    } else if (item === "--db") {
      parsed.db = items[++index];
    }
  }
  return parsed;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wilayah (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL UNIQUE,
      kode TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nip TEXT,
      jabatan TEXT,
      role TEXT NOT NULL CHECK(role IN ('kepala_kpp','kasiwas','ar','teknisi')),
      phone TEXT,
      avatar_color TEXT,
      status TEXT NOT NULL DEFAULT 'aktif' CHECK(status IN ('aktif','cuti','nonaktif')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opd (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      wilayah_id INTEGER NOT NULL REFERENCES wilayah(id),
      jenis_instansi TEXT,
      jumlah_asn INTEGER NOT NULL DEFAULT 0,
      jumlah_pppk INTEGER NOT NULL DEFAULT 0,
      npwp_opd TEXT,
      status_pemungut_ppn TEXT NOT NULL DEFAULT 'TIDAK',
      nama_bendahara TEXT NOT NULL,
      nip_bendahara TEXT,
      hp_bendahara TEXT NOT NULL,
      email_bendahara TEXT,
      nama_bendahara_penerimaan TEXT,
      hp_bendahara_penerimaan TEXT,
      nama_pic_kepeg TEXT NOT NULL,
      hp_pic_kepeg TEXT NOT NULL,
      ar_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'aktif' CHECK(status IN ('aktif','tidak_aktif','perlu_update')),
      tanggal_input TEXT,
      tanggal_update_kontak TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS spt_monitoring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opd_id INTEGER NOT NULL REFERENCES opd(id) ON DELETE CASCADE,
      tahun_pajak INTEGER NOT NULL,
      periode TEXT NOT NULL,
      jumlah_wajib_lapor INTEGER NOT NULL,
      jumlah_sudah_lapor INTEGER NOT NULL,
      persen_kepatuhan REAL NOT NULL,
      traffic_light TEXT NOT NULL CHECK(traffic_light IN ('hijau','kuning','merah')),
      UNIQUE(opd_id, tahun_pajak, periode)
    );

    CREATE TABLE IF NOT EXISTS pph21_monitoring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opd_id INTEGER NOT NULL REFERENCES opd(id) ON DELETE CASCADE,
      bulan TEXT NOT NULL,
      jumlah_dipotong INTEGER NOT NULL,
      nominal_setor INTEGER NOT NULL,
      estimasi_wajar INTEGER NOT NULL,
      ketepatan TEXT NOT NULL CHECK(ketepatan IN ('tepat_waktu','terlambat','belum_setor')),
      status TEXT NOT NULL CHECK(status IN ('normal','under_reporting','kritis')),
      UNIQUE(opd_id, bulan)
    );

    CREATE TABLE IF NOT EXISTS spt_masa_monitoring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opd_id INTEGER NOT NULL REFERENCES opd(id) ON DELETE CASCADE,
      masa_pajak TEXT NOT NULL,
      pph22_nominal INTEGER NOT NULL DEFAULT 0,
      pph22_status TEXT,
      pph23_nominal INTEGER NOT NULL DEFAULT 0,
      pph23_status TEXT,
      ppn_put_nominal INTEGER NOT NULL DEFAULT 0,
      ppn_put_status TEXT,
      status_opd_pemungut TEXT,
      status_keseluruhan TEXT,
      catatan_ar TEXT,
      UNIQUE(opd_id, masa_pajak)
    );

    CREATE TABLE IF NOT EXISTS deposit_monitoring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opd_id INTEGER NOT NULL REFERENCES opd(id) ON DELETE CASCADE,
      masa_pajak TEXT NOT NULL,
      deposit_pph21 INTEGER NOT NULL DEFAULT 0,
      status_pph21 TEXT,
      deposit_pph_unifikasi INTEGER NOT NULL DEFAULT 0,
      status_unifikasi TEXT,
      deposit_ppn_put INTEGER NOT NULL DEFAULT 0,
      status_ppn_put TEXT,
      total_deposit INTEGER NOT NULL DEFAULT 0,
      status_deposit_overall TEXT,
      UNIQUE(opd_id, masa_pajak)
    );

    CREATE TABLE IF NOT EXISTS scoring_opd (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opd_id INTEGER NOT NULL REFERENCES opd(id) ON DELETE CASCADE,
      bulan_scoring TEXT NOT NULL,
      skor_spt_op REAL NOT NULL DEFAULT 0,
      skor_pph21 REAL NOT NULL DEFAULT 0,
      skor_spt_masa REAL NOT NULL DEFAULT 0,
      skor_deposit REAL NOT NULL DEFAULT 0,
      skor_total REAL NOT NULL DEFAULT 0,
      kategori TEXT NOT NULL CHECK(kategori IN ('hijau','kuning','merah')),
      status_rp TEXT NOT NULL CHECK(status_rp IN ('reward','monitor','punishment')),
      catatan TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(opd_id, bulan_scoring)
    );

    CREATE TABLE IF NOT EXISTS sosialisasi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opd_id INTEGER NOT NULL REFERENCES opd(id) ON DELETE CASCADE,
      tanggal TEXT NOT NULL,
      jumlah_peserta INTEGER NOT NULL,
      penyuluh_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('sudah','belum','perlu_ulang'))
    );

    CREATE TABLE IF NOT EXISTS pegawai (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      nip TEXT NOT NULL UNIQUE,
      opd_id INTEGER NOT NULL REFERENCES opd(id) ON DELETE CASCADE,
      jabatan TEXT NOT NULL,
      status_coretax TEXT NOT NULL CHECK(status_coretax IN ('aktif_belum_lapor','belum_aktivasi','sudah_lapor')),
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      opd_id INTEGER REFERENCES opd(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_name TEXT NOT NULL,
      description TEXT,
      result TEXT,
      follow_up TEXT,
      next_follow_up_at TEXT,
      attachment_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('info','warning','success','danger')),
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_opd_wilayah ON opd(wilayah_id);
    CREATE INDEX IF NOT EXISTS idx_spt_period ON spt_monitoring(periode, tahun_pajak);
    CREATE INDEX IF NOT EXISTS idx_pph_bulan ON pph21_monitoring(bulan);
    CREATE INDEX IF NOT EXISTS idx_spt_masa_period ON spt_masa_monitoring(masa_pajak);
    CREATE INDEX IF NOT EXISTS idx_deposit_period ON deposit_monitoring(masa_pajak);
    CREATE INDEX IF NOT EXISTS idx_scoring_period ON scoring_opd(bulan_scoring);
    CREATE INDEX IF NOT EXISTS idx_scoring_status ON scoring_opd(status_rp, kategori);
    CREATE INDEX IF NOT EXISTS idx_pegawai_status ON pegawai(status_coretax);
  `);

  ensureExistingSchema(db);
  db.exec("CREATE INDEX IF NOT EXISTS idx_action_log_opd ON action_log(opd_id)");
}

function ensureExistingSchema(db) {
  const columns = {
    opd: [
      "jenis_instansi TEXT",
      "jumlah_pppk INTEGER NOT NULL DEFAULT 0",
      "npwp_opd TEXT",
      "status_pemungut_ppn TEXT NOT NULL DEFAULT 'TIDAK'",
      "nip_bendahara TEXT",
      "email_bendahara TEXT",
      "nama_bendahara_penerimaan TEXT",
      "hp_bendahara_penerimaan TEXT",
      "tanggal_input TEXT",
      "tanggal_update_kontak TEXT",
    ],
    action_log: [
      "opd_id INTEGER REFERENCES opd(id) ON DELETE SET NULL",
      "description TEXT",
      "result TEXT",
      "follow_up TEXT",
      "next_follow_up_at TEXT",
      "attachment_url TEXT",
    ],
  };

  Object.entries(columns).forEach(([table, definitions]) => {
    const existing = new Set(db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map((column) => column.name));
    definitions.forEach((definition) => {
      const [name] = definition.split(/\s+/, 1);
      if (!existing.has(name)) {
        db.exec(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${definition}`);
      }
    });
  });
}

function resetAppTables(db) {
  db.exec(`
    DELETE FROM settings;
    DELETE FROM notifications;
    DELETE FROM action_log;
    DELETE FROM pegawai;
    DELETE FROM sosialisasi;
    DELETE FROM scoring_opd;
    DELETE FROM deposit_monitoring;
    DELETE FROM spt_masa_monitoring;
    DELETE FROM pph21_monitoring;
    DELETE FROM spt_monitoring;
    DELETE FROM opd;
    DELETE FROM users;
    DELETE FROM wilayah;
    DELETE FROM sqlite_sequence WHERE name IN (
      'wilayah','users','opd','spt_monitoring','pph21_monitoring',
      'spt_masa_monitoring','deposit_monitoring','scoring_opd',
      'sosialisasi','pegawai','action_log','notifications'
    );
  `);
}

function readWorkbook(wb) {
  return wb.worksheets.map((worksheet) => {
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = [];
      for (let index = 1; index <= row.cellCount; index += 1) {
        values.push(excelCellValue(row.getCell(index).value));
      }
      rows.push(values);
    });
    return buildSheetTable(worksheet.name, rows);
  });
}

function buildSheetTable(sheetName, rows) {
  const headerIndex = rows.findIndex((row) => row.some((value) => !isBlank(value)));
  if (headerIndex === -1) {
    return { sheetName, tableName: "", headers: [], rows: [] };
  }

  const relevantRows = rows.slice(headerIndex);
  const width = relevantRows.reduce((max, row) => Math.max(max, lastNonBlankIndex(row) + 1), 0);
  const headerRow = relevantRows[0] ?? [];
  const headers = makeUniqueHeaders(Array.from({ length: width }, (_, index) => headerRow[index]));
  const dataRows = relevantRows
    .slice(1)
    .map((row) => Array.from({ length: width }, (_, index) => normalizeCell(row[index])))
    .filter((row) => row.some((value) => !isBlank(value)));

  return {
    sheetName,
    tableName: "",
    headers,
    rows: dataRows,
  };
}

function importRawSheets(db, sheets) {
  const existing = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'xlsx_%'")
    .all();
  existing.forEach((row) => db.exec(`DROP TABLE IF EXISTS ${quoteIdent(row.name)}`));

  db.exec("DROP TABLE IF EXISTS excel_sheets");
  db.exec(`
    CREATE TABLE excel_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      column_count INTEGER NOT NULL
    );
  `);

  const usedNames = new Set();
  const insertMeta = db.prepare(
    "INSERT INTO excel_sheets (sheet_name, table_name, row_count, column_count) VALUES (?, ?, ?, ?)",
  );

  sheets.forEach((sheet) => {
    const tableName = uniqueName(`xlsx_${slug(sheet.sheetName) || "sheet"}`, usedNames);
    sheet.tableName = tableName;

    const columns = sheet.headers.map((header) => `${quoteIdent(header)} TEXT`).join(", ");
    const createColumns = columns ? `, ${columns}` : "";
    db.exec(`
      CREATE TABLE ${quoteIdent(tableName)} (
        import_id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_row INTEGER NOT NULL${createColumns}
      );
    `);

    if (sheet.headers.length > 0 && sheet.rows.length > 0) {
      const columnList = ["source_row", ...sheet.headers].map(quoteIdent).join(", ");
      const placeholders = ["?", ...sheet.headers.map(() => "?")].join(", ");
      const insert = db.prepare(`INSERT INTO ${quoteIdent(tableName)} (${columnList}) VALUES (${placeholders})`);
      sheet.rows.forEach((row, index) => {
        insert.run(index + 2, ...row.map(valueForRawDb));
      });
    }

    insertMeta.run(sheet.sheetName, tableName, sheet.rows.length, sheet.headers.length);
  });
}

function importAppTables(db, sheets, source) {
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);
  const users = createUserRegistry(db, passwordHash);
  const wilayah = createWilayahRegistry(db);
  const opd = createOpdRegistry(db, wilayah, users);

  seedBaseUsers(users);
  importOpd(sheetRows(sheets, "DATA_OPD"), opd);
  importDirektoriBendahara(sheetRows(sheets, "DIREKTORI_BENDAHARA"), db, opd);
  importSpt(sheetRows(sheets, "MODUL1_SPT"), db, opd);
  importPph21(sheetRows(sheets, "MODUL2_PPH21"), db, opd);
  importSosialisasi(sheetRows(sheets, "MODUL3_SOSIALISASI"), db, opd, users);
  importSptMasa(sheetRows(sheets, "MODUL4_SPT_MASA"), db, opd);
  importDeposit(sheetRows(sheets, "MODUL5_DEPOSIT"), db, opd);
  importScoring(sheetRows(sheets, "SCORING_OPD"), db, opd);
  importActionLog(
    [...sheetRows(sheets, "ACTION_LOG"), ...sheetRows(sheets, "ACTION LOG")],
    db,
    opd,
    users,
  );

  const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  insertSetting.run("data_source", "excel_import");
  insertSetting.run("source_file", path.basename(source));
  insertSetting.run("source_imported_at", new Date().toISOString());
  insertSetting.run("integration_coretax", "manual_excel");
  insertSetting.run("integration_bkpsdm", "manual_excel");
  insertSetting.run("notification_email", "disabled");

  db.prepare(
    `
      INSERT INTO notifications (title, body, type)
      VALUES (?, ?, 'success')
    `,
  ).run("Import Excel selesai", "Workbook SIMPATIK berhasil diubah menjadi database SQLite.");

  return {
    wilayah: count(db, "wilayah"),
    users: count(db, "users"),
    opd: count(db, "opd"),
    spt_monitoring: count(db, "spt_monitoring"),
    pph21_monitoring: count(db, "pph21_monitoring"),
    spt_masa_monitoring: count(db, "spt_masa_monitoring"),
    deposit_monitoring: count(db, "deposit_monitoring"),
    scoring_opd: count(db, "scoring_opd"),
    sosialisasi: count(db, "sosialisasi"),
    action_log: count(db, "action_log"),
    raw_sheets: count(db, "excel_sheets"),
  };
}

function createUserRegistry(db, passwordHash) {
  const byName = new Map();
  const insert = db.prepare(`
    INSERT INTO users (nama, email, password_hash, nip, jabatan, role, phone, avatar_color, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif')
  `);

  return {
    ensure(name, role = "ar", jabatan = "Account Representative", emailOverride = null) {
      const cleanName = stringOrNull(name);
      if (!cleanName) return null;
      const key = normalizeLookup(cleanName);
      if (byName.has(key)) return byName.get(key);
      const email = emailOverride ?? `${slug(cleanName) || `user-${byName.size + 1}`}@simpatik.local`;
      const result = insert.run(
        cleanName,
        email,
        passwordHash,
        null,
        jabatan,
        role,
        null,
        avatarColor(byName.size),
      );
      const id = Number(result.lastInsertRowid);
      byName.set(key, id);
      return id;
    },
  };
}

function seedBaseUsers(users) {
  users.ensure("Kepala KPP Pratama Padang Satu", "kepala_kpp", "Kepala KPP Pratama Padang Satu", "kepala@simpatik.local");
  users.ensure("Kasi Pengawasan VI", "kasiwas", "Kepala Seksi Pengawasan VI", "kasiwas@simpatik.local");
  users.ensure("Teknisi Data SIMPATIK", "teknisi", "Operator Data", "teknisi1@simpatik.local");
}

function createWilayahRegistry(db) {
  const byName = new Map();
  const insert = db.prepare("INSERT INTO wilayah (nama, kode) VALUES (?, ?)");

  return {
    ensure(name) {
      const cleanName = stringOrNull(name) ?? "Tidak Diketahui";
      const key = normalizeLookup(cleanName);
      if (byName.has(key)) return byName.get(key);
      const result = insert.run(cleanName, slug(cleanName) || `wilayah-${byName.size + 1}`);
      const id = Number(result.lastInsertRowid);
      byName.set(key, id);
      return id;
    },
  };
}

function createOpdRegistry(db, wilayah, users) {
  const byId = new Map();
  const insert = db.prepare(`
    INSERT INTO opd (
      id, nama, wilayah_id, jenis_instansi, jumlah_asn, jumlah_pppk, npwp_opd, status_pemungut_ppn,
      nama_bendahara, nip_bendahara, hp_bendahara, email_bendahara,
      nama_bendahara_penerimaan, hp_bendahara_penerimaan,
      nama_pic_kepeg, hp_pic_kepeg, ar_id, status, tanggal_input, tanggal_update_kontak
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?)
  `);

  return {
    ensure(row) {
      const excelId = integerOrNull(pickValue(row, "id_opd"));
      if (excelId && byId.has(excelId)) return byId.get(excelId);

      const nama = stringOrNull(pickValue(row, "nama_opd")) ?? `OPD ${excelId ?? byId.size + 1}`;
      const bendahara = stringOrNull(pickValue(row, "nama_bendahara", "nama_bendahara_pengeluaran")) ?? "Belum diisi";
      const hpBendahara =
        stringOrNull(pickValue(row, "kontak_bendahara", "no_hp_bendahara", "hp_bendahara")) ?? "-";
      const wilayahId = wilayah.ensure(pickValue(row, "wilayah"));
      const arId = users.ensure(pickValue(row, "ar_pengampu"), "ar", "Account Representative");
      const jumlahAsn =
        integerOrNull(pickValue(row, "jumlah_asn")) ??
        integerOrNull(pickValue(row, "total_wajib_lapor", "total_wajib")) ??
        0;
      const jumlahPppk = integerOrNull(pickValue(row, "jumlah_pppk")) ?? 0;

      const id = excelId ?? nextManualId(byId);
      insert.run(
        id,
        nama,
        wilayahId,
        stringOrNull(pickValue(row, "jenis_instansi")),
        jumlahAsn,
        jumlahPppk,
        stringOrNull(pickValue(row, "npwp_opd", "npwp")),
        yesNo(pickValue(row, "status_pemungut_ppn")),
        bendahara,
        stringOrNull(pickValue(row, "nip_bendahara", "nip_bendahara_pengeluaran")),
        hpBendahara,
        stringOrNull(pickValue(row, "email_bendahara")),
        stringOrNull(pickValue(row, "nama_bendahara_penerimaan")),
        stringOrNull(pickValue(row, "no_hp_penerimaan", "hp_bendahara_penerimaan")),
        stringOrNull(pickValue(row, "nama_pic_kepeg")) ?? bendahara,
        stringOrNull(pickValue(row, "hp_pic_kepeg")) ?? hpBendahara,
        arId,
        isoDate(pickValue(row, "tanggal_input")),
        isoDate(pickValue(row, "tanggal_update")),
      );
      byId.set(id, id);
      return id;
    },
  };
}

function importOpd(rows, opd) {
  rows.forEach((row) => {
    if (stringOrNull(pickValue(row, "nama_opd")) || integerOrNull(pickValue(row, "id_opd"))) {
      opd.ensure(row);
    }
  });
}

function importDirektoriBendahara(rows, db, opd) {
  const update = db.prepare(`
    UPDATE opd SET
      nama_bendahara = COALESCE(?, nama_bendahara),
      nip_bendahara = COALESCE(?, nip_bendahara),
      hp_bendahara = COALESCE(?, hp_bendahara),
      email_bendahara = COALESCE(?, email_bendahara),
      nama_bendahara_penerimaan = COALESCE(?, nama_bendahara_penerimaan),
      hp_bendahara_penerimaan = COALESCE(?, hp_bendahara_penerimaan),
      tanggal_update_kontak = COALESCE(?, tanggal_update_kontak)
    WHERE id = ?
  `);

  rows.forEach((row) => {
    if (!hasAny(row, "id_opd", "nama_opd")) return;
    const opdId = opd.ensure(row);
    update.run(
      stringOrNull(pickValue(row, "nama_bendahara_pengeluaran", "nama_bendahara")),
      stringOrNull(pickValue(row, "nip_bendahara")),
      stringOrNull(pickValue(row, "no_hp_bendahara", "kontak_bendahara", "hp_bendahara")),
      stringOrNull(pickValue(row, "email_bendahara")),
      stringOrNull(pickValue(row, "nama_bendahara_penerimaan")),
      stringOrNull(pickValue(row, "no_hp_penerimaan", "hp_bendahara_penerimaan")),
      isoDate(pickValue(row, "tanggal_update")),
      opdId,
    );
  });
}

function importSpt(rows, db, opd) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO spt_monitoring (
      opd_id, tahun_pajak, periode, jumlah_wajib_lapor, jumlah_sudah_lapor, persen_kepatuhan, traffic_light
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    if (!hasAny(row, "id_opd", "nama_opd")) return;
    const opdId = opd.ensure(row);
    const tahun = integerOrNull(pickValue(row, "tahun_spt", "tahun_pajak")) ?? new Date().getFullYear() - 1;
    const periode = periodFromValue(pickValue(row, "tanggal_update")) ?? `${tahun}-12`;
    const wajib = integerOrNull(pickValue(row, "total_wajib", "total_wajib_lapor")) ?? 0;
    const sudah = integerOrNull(pickValue(row, "sudah_lapor")) ?? 0;
    const persen = percentValue(pickValue(row, "persen_kepatuhan"), sudah, wajib);
    const traffic = trafficLight(pickValue(row, "status_traffic_light"), persen);
    insert.run(opdId, tahun, periode, wajib, sudah, persen, traffic);
  });
}

function importPph21(rows, db, opd) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO pph21_monitoring (
      opd_id, bulan, jumlah_dipotong, nominal_setor, estimasi_wajar, ketepatan, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    if (!hasAny(row, "id_opd", "nama_opd", "bulan")) return;
    const opdId = opd.ensure(row);
    const bulan = monthPeriod(pickValue(row, "bulan"), pickValue(row, "tahun")) ?? "unknown";
    const nominal = integerOrNull(pickValue(row, "nominal_setor")) ?? 0;
    const estimasi = integerOrNull(pickValue(row, "estimasi_wajar")) ?? 0;
    insert.run(
      opdId,
      bulan,
      integerOrNull(pickValue(row, "jumlah_dipotong")) ?? 0,
      nominal,
      estimasi,
      ketepatan(pickValue(row, "status_setor")),
      pphStatus(pickValue(row, "indikasi"), nominal, estimasi),
    );
  });
}

function importSosialisasi(rows, db, opd, users) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO sosialisasi (id, opd_id, tanggal, jumlah_peserta, penyuluh_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    if (!hasAny(row, "id_opd", "nama_opd", "tanggal_sosialisasi")) return;
    const id = integerOrNull(pickValue(row, "id_sesi")) ?? nextTableId(db, "sosialisasi");
    insert.run(
      id,
      opd.ensure(row),
      isoDate(pickValue(row, "tanggal_sosialisasi")) ?? new Date().toISOString().slice(0, 10),
      integerOrNull(pickValue(row, "jumlah_peserta")) ?? 0,
      users.ensure(pickValue(row, "nama_penyuluh"), "ar", "Penyuluh"),
      sosialisasiStatus(pickValue(row, "status_opd")),
    );
  });
}

function importSptMasa(rows, db, opd) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO spt_masa_monitoring (
      opd_id, masa_pajak, pph22_nominal, pph22_status, pph23_nominal, pph23_status,
      ppn_put_nominal, ppn_put_status, status_opd_pemungut, status_keseluruhan, catatan_ar
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    if (!hasAny(row, "id_opd", "nama_opd", "masa_pajak")) return;
    insert.run(
      opd.ensure(row),
      stringOrNull(pickValue(row, "masa_pajak")) ?? "unknown",
      integerOrNull(pickValue(row, "pph22_nominal")) ?? 0,
      stringOrNull(pickValue(row, "pph22_status")),
      integerOrNull(pickValue(row, "pph23_nominal")) ?? 0,
      stringOrNull(pickValue(row, "pph23_status")),
      integerOrNull(pickValue(row, "ppn_put_nominal")) ?? 0,
      stringOrNull(pickValue(row, "ppn_put_status")),
      stringOrNull(pickValue(row, "status_opd_pemungut")),
      stringOrNull(pickValue(row, "status_keseluruhan")),
      stringOrNull(pickValue(row, "catatan_ar")),
    );
  });
}

function importDeposit(rows, db, opd) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO deposit_monitoring (
      opd_id, masa_pajak, deposit_pph21, status_pph21, deposit_pph_unifikasi,
      status_unifikasi, deposit_ppn_put, status_ppn_put, total_deposit, status_deposit_overall
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    if (!hasAny(row, "id_opd", "nama_opd", "masa_pajak")) return;
    insert.run(
      opd.ensure(row),
      stringOrNull(pickValue(row, "masa_pajak")) ?? "unknown",
      integerOrNull(pickValue(row, "deposit_pph21")) ?? 0,
      stringOrNull(pickValue(row, "status_pph21")),
      integerOrNull(pickValue(row, "deposit_pph_unifikasi")) ?? 0,
      stringOrNull(pickValue(row, "status_unifikasi")),
      integerOrNull(pickValue(row, "deposit_ppn_put")) ?? 0,
      stringOrNull(pickValue(row, "status_ppn_put")),
      integerOrNull(pickValue(row, "total_deposit")) ?? 0,
      stringOrNull(pickValue(row, "status_deposit_overall")),
    );
  });
}

function importScoring(rows, db, opd) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO scoring_opd (
      opd_id, bulan_scoring, skor_spt_op, skor_pph21, skor_spt_masa, skor_deposit,
      skor_total, kategori, status_rp, catatan
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    if (!hasAny(row, "id_opd", "nama_opd")) return;
    const total =
      numberOrNull(pickValue(row, "skor_total")) ??
      compositeScore(
        numberOrNull(pickValue(row, "skor_spt_op")) ?? 0,
        numberOrNull(pickValue(row, "skor_pph21")) ?? 0,
        numberOrNull(pickValue(row, "skor_spt_masa")) ?? 0,
        numberOrNull(pickValue(row, "skor_deposit")) ?? 0,
      );

    insert.run(
      opd.ensure(row),
      scoringPeriod(pickValue(row, "bulan_scoring")) ?? "unknown",
      numberOrNull(pickValue(row, "skor_spt_op")) ?? 0,
      numberOrNull(pickValue(row, "skor_pph21")) ?? 0,
      numberOrNull(pickValue(row, "skor_spt_masa")) ?? 0,
      numberOrNull(pickValue(row, "skor_deposit")) ?? 0,
      Number(total.toFixed(2)),
      scoreCategory(pickValue(row, "kategori"), total),
      rewardStatus(pickValue(row, "status_rp"), total),
      stringOrNull(pickValue(row, "catatan")),
    );
  });
}

function importActionLog(rows, db, opd, users) {
  const insert = db.prepare(`
    INSERT INTO action_log (
      user_id, opd_id, action, target_type, target_name, description, result, follow_up, next_follow_up_at, created_at
    )
    VALUES (?, ?, ?, 'opd', ?, ?, ?, ?, ?, ?)
  `);

  rows.forEach((row) => {
    const action = stringOrNull(pickValue(row, "jenis_tindakan", "jenis_tindakan_yang_dilakukan"));
    if (!action) return;
    const opdId = hasAny(row, "id_opd", "nama_opd") ? opd.ensure(row) : null;
    const targetName =
      stringOrNull(pickValue(row, "nama_opd", "nama_opd_yang_ditindaklanjuti")) ??
      (opdId ? `OPD ${opdId}` : "OPD");
    insert.run(
      users.ensure(pickValue(row, "nama_ar", "nama_ar_anda", "name"), "ar", "Account Representative"),
      opdId,
      action,
      targetName,
      stringOrNull(pickValue(row, "deskripsi", "deskripsi_singkat_tindakan")),
      stringOrNull(pickValue(row, "hasil", "hasil_tindakan")),
      stringOrNull(pickValue(row, "follow_up", "tindak_lanjut", "tindak_lanjut_yang_direncanakan")),
      isoDate(pickValue(row, "tanggal_rencana_tindak_lanjut_berikutnya", "next_follow_up_at")),
      isoTimestamp(pickValue(row, "timestamp", "completion_time", "start_time")) ?? new Date().toISOString(),
    );
  });
}

function sheetRows(sheets, expectedName) {
  const target = sheets.find((sheet) => normalizeSheetName(sheet.sheetName) === normalizeSheetName(expectedName));
  if (!target) return [];
  return target.rows.map((row) => {
    const item = {};
    target.headers.forEach((header, index) => {
      item[header] = appValue(row[index]);
    });
    return item;
  });
}

function makeUniqueHeaders(values) {
  const used = new Set();
  return values.map((value, index) => {
    const base = slug(value) || `col_${index + 1}`;
    return uniqueName(base, used);
  });
}

function uniqueName(base, used) {
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function normalizeSheetName(value) {
  return slug(value).replace(/_+$/g, "");
}

function normalizeLookup(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCell(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string") return value.trim();
  if (value === undefined) return null;
  return value;
}

function excelCellValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if ("result" in value) return excelCellValue(value.result);
  if ("text" in value) return value.text;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("");
  }
  if ("error" in value) return value.error;
  return String(value);
}

function appValue(value) {
  const normalized = normalizeCell(value);
  if (typeof normalized === "string" && /^#(N\/A|VALUE!|REF!|DIV\/0!)$/i.test(normalized)) return null;
  if (isBlank(normalized)) return null;
  return normalized;
}

function valueForRawDb(value) {
  if (value instanceof Date) return isoDate(value);
  if (value === undefined) return null;
  return value;
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function lastNonBlankIndex(row) {
  for (let index = row.length - 1; index >= 0; index -= 1) {
    if (!isBlank(row[index])) return index;
  }
  return -1;
}

function pickValue(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && !isBlank(row[key])) return row[key];
  }
  return null;
}

function hasAny(row, ...keys) {
  return keys.some((key) => !isBlank(row[key]));
}

function stringOrNull(value) {
  if (value instanceof Date) return isoDate(value);
  if (isBlank(value)) return null;
  return String(value).trim();
}

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return number === null ? null : Math.round(number);
}

function percentValue(value, numerator, denominator) {
  const raw = numberOrNull(value);
  if (raw !== null) return Number((raw >= 0 && raw <= 1 ? raw * 100 : raw).toFixed(2));
  if (denominator > 0) return Number(((numerator * 100) / denominator).toFixed(2));
  return 0;
}

function trafficLight(value, percent) {
  const raw = normalizeLookup(value);
  if (raw.includes("hijau") || raw.includes("green")) return "hijau";
  if (raw.includes("kuning") || raw.includes("yellow")) return "kuning";
  if (raw.includes("merah") || raw.includes("red")) return "merah";
  if (percent >= 70) return "hijau";
  if (percent >= 40) return "kuning";
  return "merah";
}

function ketepatan(value) {
  const raw = normalizeLookup(value);
  if (raw.includes("belum")) return "belum_setor";
  if (raw.includes("terlambat")) return "terlambat";
  return "tepat_waktu";
}

function pphStatus(value, nominal, estimasi) {
  const raw = normalizeLookup(value);
  if (raw.includes("kritis") || raw.includes("belum")) return "kritis";
  if (raw.includes("under")) return "under_reporting";
  if (raw.includes("normal")) return "normal";
  if (nominal <= 0) return "kritis";
  if (estimasi > 0 && nominal < estimasi * 0.8) return "under_reporting";
  return "normal";
}

function sosialisasiStatus(value) {
  const raw = normalizeLookup(value);
  if (raw.includes("ulang")) return "perlu_ulang";
  if (raw.includes("belum")) return "belum";
  return "sudah";
}

function yesNo(value) {
  const raw = normalizeLookup(value);
  if (raw === "ya" || raw === "yes" || raw === "y" || raw === "true" || raw === "1") return "YA";
  return "TIDAK";
}

function compositeScore(spt, pph21, sptMasa, deposit) {
  return spt * 0.3 + pph21 * 0.25 + sptMasa * 0.25 + deposit * 0.2;
}

function scoreCategory(value, score) {
  const raw = normalizeLookup(value);
  if (raw.includes("hijau") || raw.includes("green")) return "hijau";
  if (raw.includes("kuning") || raw.includes("yellow")) return "kuning";
  if (raw.includes("merah") || raw.includes("red")) return "merah";
  if (score >= 90) return "hijau";
  if (score >= 70) return "kuning";
  return "merah";
}

function rewardStatus(value, score) {
  const raw = normalizeLookup(value);
  if (raw.includes("reward")) return "reward";
  if (raw.includes("punishment") || raw.includes("punish")) return "punishment";
  if (raw.includes("monitor")) return "monitor";
  if (score >= 90) return "reward";
  if (score < 70) return "punishment";
  return "monitor";
}

function monthPeriod(monthValue, yearValue) {
  const year = integerOrNull(yearValue);
  const month = monthNumber(monthValue);
  if (!year || !month) return null;
  return `${year}-${month}`;
}

function scoringPeriod(value) {
  const date = dateFromValue(value);
  if (date) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const text = stringOrNull(value);
  if (!text) return null;
  const iso = text.match(/(20\d{2})[-/ ](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  const parts = text.split(/\s+/);
  const month = monthNumber(parts[0]);
  const year = parts.map(integerOrNull).find((part) => part && part >= 2000);
  if (month && year) return `${year}-${month}`;
  return text;
}

function monthNumber(value) {
  const raw = normalizeLookup(value);
  if (/^\d{1,2}$/.test(raw)) return raw.padStart(2, "0");
  const months = {
    januari: "01",
    january: "01",
    februari: "02",
    february: "02",
    maret: "03",
    march: "03",
    april: "04",
    mei: "05",
    may: "05",
    juni: "06",
    june: "06",
    juli: "07",
    july: "07",
    agustus: "08",
    august: "08",
    september: "09",
    oktober: "10",
    october: "10",
    november: "11",
    desember: "12",
    december: "12",
  };
  return months[raw] ?? null;
}

function periodFromValue(value) {
  const date = dateFromValue(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isoDate(value) {
  const date = dateFromValue(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isoTimestamp(value) {
  const date = dateFromValue(value);
  return date ? date.toISOString() : null;
}

function dateFromValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 25569) return null;
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const text = stringOrNull(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

function nextManualId(map) {
  let id = 1;
  while (map.has(id)) id += 1;
  return id;
}

function nextTableId(db, table) {
  const row = db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM ${quoteIdent(table)}`).get();
  return Number(row.id);
}

function avatarColor(index) {
  return ["#0A8090", "#0D2B55", "#16A663", "#F5A623", "#D64550", "#274E84"][index % 6];
}

function count(db, table) {
  return db.prepare(`SELECT COUNT(*) AS total FROM ${quoteIdent(table)}`).get().total;
}
