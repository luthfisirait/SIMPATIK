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
      jumlah_asn INTEGER NOT NULL DEFAULT 0,
      nama_bendahara TEXT NOT NULL,
      hp_bendahara TEXT NOT NULL,
      nama_pic_kepeg TEXT NOT NULL,
      hp_pic_kepeg TEXT NOT NULL,
      ar_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'aktif' CHECK(status IN ('aktif','tidak_aktif','perlu_update')),
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
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_name TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_pegawai_status ON pegawai(status_coretax);
  `);
}
