import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbDir = path.join(process.cwd(), "database");
const dbPath = path.join(dbDir, "simpatik.db");

let db: Database.Database | null = null;

export function getDb() {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }

  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
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
      pph21_status TEXT,
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
      deposit_kd_411618 INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_name TEXT,
      action TEXT NOT NULL CHECK(action IN ('create','update','delete','import')),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('opd','user')),
      entity_id INTEGER,
      entity_name TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
  `);

  ensureExistingSchema(database);

  database.exec("CREATE INDEX IF NOT EXISTS idx_action_log_opd ON action_log(opd_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)");
}

function ensureExistingSchema(database: Database.Database) {
  const columns: Record<string, string[]> = {
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
    pegawai: [
      "npwp TEXT",
      "nik TEXT",
      "email TEXT",
      "jenis_kepegawaian TEXT",
    ],
    spt_masa_monitoring: [
      "pph21_status TEXT",
    ],
    deposit_monitoring: [
      "deposit_kd_411618 INTEGER NOT NULL DEFAULT 0",
    ],
    sosialisasi: [
      "tempat TEXT",
      "tema TEXT",
    ],
  };

  Object.entries(columns).forEach(([table, definitions]) => {
    const existing = new Set(
      (
        database.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>
      ).map((column) => column.name),
    );

    definitions.forEach((definition) => {
      const [name] = definition.split(/\s+/, 1);
      if (!existing.has(name)) {
        database.exec(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${definition}`);
      }
    });
  });

  // NIK adalah nomor unik pegawai (Contoh.xlsx). NULL diperbolehkan ganda di SQLite.
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_pegawai_nik ON pegawai(nik)");
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
