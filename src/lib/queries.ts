import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import type {
  ActionLog,
  Notification,
  Opd,
  PegawaiRecord,
  Pph21Record,
  SosialisasiRecord,
  SptRecord,
  User,
  Wilayah,
} from "@/types";

type ListParams = {
  q?: string;
  wilayah?: string;
  status?: string;
  ar?: string;
  page?: number;
  pageSize?: number;
};

type WriteOpdPayload = {
  nama: string;
  wilayah_id: number;
  jumlah_asn: number;
  nama_bendahara: string;
  hp_bendahara: string;
  nama_pic_kepeg: string;
  hp_pic_kepeg: string;
  ar_id?: number | null;
  status?: string;
};

function db() {
  ensureSeeded();
  return getDb();
}

function latestPeriod(tahunPajak = 2025) {
  return (
    (db().prepare("SELECT MAX(periode) AS periode FROM spt_monitoring WHERE tahun_pajak = ?").get(tahunPajak) as {
      periode: string | null;
    }).periode ?? "2026-03"
  );
}

function latestPphMonth() {
  return (
    (db().prepare("SELECT MAX(bulan) AS bulan FROM pph21_monitoring").get() as { bulan: string | null }).bulan ??
    "2026-03"
  );
}

export function getWilayah() {
  return db().prepare("SELECT * FROM wilayah ORDER BY id").all() as Wilayah[];
}

export function getDashboardData() {
  const database = db();
  const period = latestPeriod();
  const pphMonth = latestPphMonth();

  const spt = database
    .prepare(
      `
      SELECT
        SUM(jumlah_wajib_lapor) AS wajib,
        SUM(jumlah_sudah_lapor) AS sudah,
        ROUND(SUM(jumlah_sudah_lapor) * 100.0 / SUM(jumlah_wajib_lapor), 1) AS persen
      FROM spt_monitoring
      WHERE tahun_pajak = 2025 AND periode = ?
    `,
    )
    .get(period) as { wajib: number; sudah: number; persen: number };

  const pph = database
    .prepare(
      `
      SELECT
        SUM(CASE WHEN ketepatan = 'tepat_waktu' THEN 1 ELSE 0 END) AS tepat,
        SUM(CASE WHEN ketepatan != 'tepat_waktu' THEN 1 ELSE 0 END) AS belum,
        SUM(CASE WHEN status = 'under_reporting' THEN 1 ELSE 0 END) AS under_reporting,
        SUM(nominal_setor) AS total_setor
      FROM pph21_monitoring
      WHERE bulan = ?
    `,
    )
    .get(pphMonth) as { tepat: number; belum: number; under_reporting: number; total_setor: number };

  const totalOpd = (database.prepare("SELECT COUNT(*) AS total FROM opd").get() as { total: number }).total;
  const sudahSos = (
    database
      .prepare("SELECT COUNT(DISTINCT opd_id) AS total FROM sosialisasi WHERE status IN ('sudah','perlu_ulang')")
      .get() as { total: number }
  ).total;
  const totalPeserta = (
    database.prepare("SELECT COALESCE(SUM(jumlah_peserta), 0) AS total FROM sosialisasi").get() as {
      total: number;
    }
  ).total;

  const trend = database
    .prepare(
      `
      SELECT periode, tahun_pajak,
        ROUND(SUM(jumlah_sudah_lapor) * 100.0 / SUM(jumlah_wajib_lapor), 1) AS persen,
        SUM(jumlah_sudah_lapor) AS sudah
      FROM spt_monitoring
      WHERE tahun_pajak IN (2024, 2025)
      GROUP BY tahun_pajak, periode
      ORDER BY tahun_pajak, periode
    `,
    )
    .all() as Array<{ periode: string; tahun_pajak: number; persen: number; sudah: number }>;

  const wilayahDistribution = database
    .prepare(
      `
      SELECT w.nama,
        ROUND(SUM(s.jumlah_sudah_lapor) * 100.0 / SUM(s.jumlah_wajib_lapor), 1) AS persen,
        SUM(s.jumlah_sudah_lapor) AS sudah,
        SUM(s.jumlah_wajib_lapor) AS wajib,
        COUNT(o.id) AS opd
      FROM spt_monitoring s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      WHERE s.tahun_pajak = 2025 AND s.periode = ?
      GROUP BY w.id
      ORDER BY w.id
    `,
    )
    .all(period) as Array<{ nama: string; persen: number; sudah: number; wajib: number; opd: number }>;

  const trafficCounts = database
    .prepare(
      `
      SELECT traffic_light AS status, COUNT(*) AS total
      FROM spt_monitoring
      WHERE tahun_pajak = 2025 AND periode = ?
      GROUP BY traffic_light
    `,
    )
    .all(period) as Array<{ status: string; total: number }>;

  const trafficTop = database
    .prepare(
      `
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        s.tahun_pajak, s.periode, s.jumlah_wajib_lapor, s.jumlah_sudah_lapor,
        s.persen_kepatuhan, s.traffic_light
      FROM spt_monitoring s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE s.tahun_pajak = 2025 AND s.periode = ?
      ORDER BY s.persen_kepatuhan ASC, o.nama ASC
      LIMIT 8
    `,
    )
    .all(period) as SptRecord[];

  const activity = getActionLog(5);
  const notifications = getNotifications(5);

  return {
    period,
    pphMonth,
    kpis: {
      kepatuhanSpt: spt.persen,
      sptMasuk: spt.sudah,
      sptWajib: spt.wajib,
      pphBelumSetor: pph.belum,
      pphTepat: pph.tepat,
      pphUnderReporting: pph.under_reporting,
      totalSetorPph: pph.total_setor,
      belumSosialisasi: totalOpd - sudahSos,
      sudahSosialisasi: sudahSos,
      totalPeserta,
      totalOpd,
    },
    trend,
    wilayahDistribution,
    trafficCounts,
    trafficTop,
    activity,
    notifications,
  };
}

export function listOpd(params: ListParams = {}) {
  const database = db();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (params.q) {
    where.push(
      "(LOWER(o.nama) LIKE ? OR LOWER(o.nama_bendahara) LIKE ? OR LOWER(o.nama_pic_kepeg) LIKE ? OR LOWER(u.nama) LIKE ?)",
    );
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q, q, q);
  }

  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }

  if (params.status && params.status !== "all") {
    where.push("o.status = ?");
    values.push(params.status);
  }

  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    database
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM opd o
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${clause}
      `,
      )
      .get(...values) as { total: number }
  ).total;

  const data = database
    .prepare(
      `
      SELECT o.*, w.nama AS wilayah_nama, w.kode AS wilayah_kode, u.nama AS ar_nama
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY w.id, o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as Opd[];

  return { data, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1 };
}

export function getOpd(id: number) {
  return db()
    .prepare(
      `
      SELECT o.*, w.nama AS wilayah_nama, w.kode AS wilayah_kode, u.nama AS ar_nama
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE o.id = ?
    `,
    )
    .get(id) as Opd | undefined;
}

export function createOpd(payload: WriteOpdPayload) {
  const database = db();
  const result = database
    .prepare(
      `
      INSERT INTO opd (
        nama, wilayah_id, jumlah_asn, nama_bendahara, hp_bendahara,
        nama_pic_kepeg, hp_pic_kepeg, ar_id, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      payload.nama,
      payload.wilayah_id,
      payload.jumlah_asn,
      payload.nama_bendahara,
      payload.hp_bendahara,
      payload.nama_pic_kepeg,
      payload.hp_pic_kepeg,
      payload.ar_id ?? null,
      payload.status ?? "aktif",
    );

  return getOpd(Number(result.lastInsertRowid));
}

export function updateOpd(id: number, payload: Partial<WriteOpdPayload>) {
  const current = getOpd(id);
  if (!current) return undefined;

  db()
    .prepare(
      `
      UPDATE opd SET
        nama = ?,
        wilayah_id = ?,
        jumlah_asn = ?,
        nama_bendahara = ?,
        hp_bendahara = ?,
        nama_pic_kepeg = ?,
        hp_pic_kepeg = ?,
        ar_id = ?,
        status = ?
      WHERE id = ?
    `,
    )
    .run(
      payload.nama ?? current.nama,
      payload.wilayah_id ?? current.wilayah_id,
      payload.jumlah_asn ?? current.jumlah_asn,
      payload.nama_bendahara ?? current.nama_bendahara,
      payload.hp_bendahara ?? current.hp_bendahara,
      payload.nama_pic_kepeg ?? current.nama_pic_kepeg,
      payload.hp_pic_kepeg ?? current.hp_pic_kepeg,
      payload.ar_id ?? current.ar_id,
      payload.status ?? current.status,
      id,
    );

  return getOpd(id);
}

export function deleteOpd(id: number) {
  const result = db().prepare("DELETE FROM opd WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listSpt(params: ListParams & { periode?: string; traffic?: string } = {}) {
  const database = db();
  const periode = params.periode ?? latestPeriod();
  const where = ["s.tahun_pajak = 2025", "s.periode = ?"];
  const values: Array<string | number> = [periode];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.traffic && params.traffic !== "all") {
    where.push("s.traffic_light = ?");
    values.push(params.traffic);
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const clause = `WHERE ${where.join(" AND ")}`;

  const total = (
    database
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM spt_monitoring s
        JOIN opd o ON o.id = s.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        ${clause}
      `,
      )
      .get(...values) as { total: number }
  ).total;

  const data = database
    .prepare(
      `
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        s.tahun_pajak, s.periode, s.jumlah_wajib_lapor, s.jumlah_sudah_lapor,
        s.persen_kepatuhan, s.traffic_light
      FROM spt_monitoring s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY s.persen_kepatuhan ASC, o.nama ASC
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as SptRecord[];

  const summary = database
    .prepare(
      `
      SELECT traffic_light AS status, COUNT(*) AS total,
        COALESCE(SUM(jumlah_wajib_lapor - jumlah_sudah_lapor), 0) AS belum_lapor
      FROM spt_monitoring
      WHERE tahun_pajak = 2025 AND periode = ?
      GROUP BY traffic_light
    `,
    )
    .all(periode) as Array<{ status: string; total: number; belum_lapor: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, periode };
}

export function listPph21(params: ListParams & { bulan?: string; pphStatus?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestPphMonth();
  const where = ["p.bulan = ?"];
  const values: Array<string | number> = [bulan];

  if (params.q) {
    where.push("LOWER(o.nama) LIKE ?");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.pphStatus && params.pphStatus !== "all") {
    where.push("p.status = ?");
    values.push(params.pphStatus);
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const clause = `WHERE ${where.join(" AND ")}`;
  const total = (
    database
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM pph21_monitoring p
        JOIN opd o ON o.id = p.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        ${clause}
      `,
      )
      .get(...values) as { total: number }
  ).total;

  const data = database
    .prepare(
      `
      SELECT p.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama,
        p.bulan, p.jumlah_dipotong, p.nominal_setor, p.estimasi_wajar, p.ketepatan, p.status
      FROM pph21_monitoring p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      ${clause}
      ORDER BY CASE p.status WHEN 'kritis' THEN 1 WHEN 'under_reporting' THEN 2 ELSE 3 END, o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as Pph21Record[];

  const summary = database
    .prepare(
      `
      SELECT
        SUM(CASE WHEN ketepatan = 'tepat_waktu' THEN 1 ELSE 0 END) AS tepat,
        SUM(CASE WHEN ketepatan != 'tepat_waktu' THEN 1 ELSE 0 END) AS belum,
        SUM(CASE WHEN status = 'under_reporting' THEN 1 ELSE 0 END) AS under_reporting,
        SUM(nominal_setor) AS total_setor
      FROM pph21_monitoring
      WHERE bulan = ?
    `,
    )
    .get(bulan) as { tepat: number; belum: number; under_reporting: number; total_setor: number };

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, bulan };
}

export function listSosialisasi(params: ListParams = {}) {
  const database = db();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.status && params.status !== "all") {
    where.push("s.status = ?");
    values.push(params.status);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    database
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM sosialisasi s
        JOIN opd o ON o.id = s.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        ${clause}
      `,
      )
      .get(...values) as { total: number }
  ).total;

  const data = database
    .prepare(
      `
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama,
        s.tanggal, s.jumlah_peserta, s.penyuluh_id, u.nama AS penyuluh_nama, s.status
      FROM sosialisasi s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = s.penyuluh_id
      ${clause}
      ORDER BY s.tanggal DESC
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as SosialisasiRecord[];

  const summary = database
    .prepare(
      `
      SELECT
        COUNT(*) AS sesi,
        COUNT(DISTINCT opd_id) AS sudah,
        COALESCE(SUM(jumlah_peserta), 0) AS peserta
      FROM sosialisasi
    `,
    )
    .get() as { sesi: number; sudah: number; peserta: number };
  const totalOpd = (database.prepare("SELECT COUNT(*) AS total FROM opd").get() as { total: number }).total;

  const priority = database
    .prepare(
      `
      SELECT o.id, o.nama, w.nama AS wilayah_nama, u.nama AS ar_nama, o.jumlah_asn
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE o.id NOT IN (SELECT DISTINCT opd_id FROM sosialisasi)
      ORDER BY o.jumlah_asn DESC
      LIMIT 6
    `,
    )
    .all() as Array<{ id: number; nama: string; wilayah_nama: string; ar_nama: string | null; jumlah_asn: number }>;

  return {
    data,
    summary: { ...summary, belum: totalOpd - summary.sudah },
    priority,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize) || 1,
  };
}

export function createSosialisasi(payload: {
  opd_id: number;
  tanggal: string;
  jumlah_peserta: number;
  penyuluh_id?: number | null;
  status?: string;
}) {
  const result = db()
    .prepare(
      `
      INSERT INTO sosialisasi (opd_id, tanggal, jumlah_peserta, penyuluh_id, status)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(payload.opd_id, payload.tanggal, payload.jumlah_peserta, payload.penyuluh_id ?? null, payload.status ?? "sudah");

  return result.lastInsertRowid;
}

export function listPegawai(params: ListParams = {}) {
  const database = db();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const where = ["p.status_coretax != 'sudah_lapor'"];
  const values: Array<string | number> = [];

  if (params.q) {
    where.push("(LOWER(p.nama) LIKE ? OR p.nip LIKE ? OR LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, `%${params.q}%`, q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.status && params.status !== "all") {
    where.push("p.status_coretax = ?");
    values.push(params.status);
  }

  const clause = `WHERE ${where.join(" AND ")}`;
  const total = (
    database
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM pegawai p
        JOIN opd o ON o.id = p.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        ${clause}
      `,
      )
      .get(...values) as { total: number }
  ).total;

  const data = database
    .prepare(
      `
      SELECT p.id, p.nama, p.nip, p.opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama,
        p.jabatan, p.status_coretax, u.nama AS ar_nama, p.phone
      FROM pegawai p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY CASE p.status_coretax WHEN 'belum_aktivasi' THEN 1 ELSE 2 END, w.id, p.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as PegawaiRecord[];

  const summary = database
    .prepare(
      `
      SELECT status_coretax AS status, COUNT(*) AS total
      FROM pegawai
      GROUP BY status_coretax
    `,
    )
    .all() as Array<{ status: string; total: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1 };
}

export function listAr() {
  return db()
    .prepare(
      `
      SELECT u.id, u.nama, u.email, u.nip, u.jabatan, u.role, u.phone, u.avatar_color, u.status,
        COUNT(o.id) AS opd_count,
        ROUND(AVG(s.persen_kepatuhan), 1) AS avg_kepatuhan
      FROM users u
      LEFT JOIN opd o ON o.ar_id = u.id
      LEFT JOIN spt_monitoring s ON s.opd_id = o.id AND s.tahun_pajak = 2025 AND s.periode = (SELECT MAX(periode) FROM spt_monitoring WHERE tahun_pajak = 2025)
      WHERE u.role = 'ar'
      GROUP BY u.id
      ORDER BY u.nama
    `,
    )
    .all() as Array<User & { opd_count: number; avg_kepatuhan: number | null }>;
}

export function listUsers() {
  return db()
    .prepare(
      `
      SELECT id, nama, email, nip, jabatan, role, phone, avatar_color, status
      FROM users
      ORDER BY CASE role WHEN 'kepala_kpp' THEN 1 WHEN 'kasiwas' THEN 2 WHEN 'ar' THEN 3 ELSE 4 END, nama
    `,
    )
    .all() as User[];
}

export function createUser(payload: {
  nama: string;
  email: string;
  password_hash: string;
  role: string;
  nip?: string;
  jabatan?: string;
  phone?: string;
  avatar_color?: string;
}) {
  const result = db()
    .prepare(
      `
      INSERT INTO users (nama, email, password_hash, nip, jabatan, role, phone, avatar_color, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif')
    `,
    )
    .run(
      payload.nama,
      payload.email,
      payload.password_hash,
      payload.nip ?? null,
      payload.jabatan ?? null,
      payload.role,
      payload.phone ?? null,
      payload.avatar_color ?? "#0A8090",
    );
  return result.lastInsertRowid;
}

export function getActionLog(limit = 20) {
  return db()
    .prepare(
      `
      SELECT l.id, l.user_id, u.nama AS user_nama, l.action, l.target_type, l.target_name, l.created_at
      FROM action_log l
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ?
    `,
    )
    .all(limit) as ActionLog[];
}

export function createActionLog(payload: { user_id?: number | null; action: string; target_type: string; target_name: string }) {
  const result = db()
    .prepare(
      `
      INSERT INTO action_log (user_id, action, target_type, target_name)
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(payload.user_id ?? null, payload.action, payload.target_type, payload.target_name);
  return result.lastInsertRowid;
}

export function getNotifications(limit = 20) {
  return db()
    .prepare(
      `
      SELECT id, title, body, type, is_read, created_at
      FROM notifications
      ORDER BY is_read ASC, created_at DESC
      LIMIT ?
    `,
    )
    .all(limit) as Notification[];
}

export function markNotificationsRead() {
  return db().prepare("UPDATE notifications SET is_read = 1 WHERE is_read = 0").run().changes;
}

export function getAnalyticsData() {
  const database = db();
  const dashboard = getDashboardData();
  const pphTrend = database
    .prepare(
      `
      SELECT bulan,
        SUM(CASE WHEN ketepatan = 'tepat_waktu' THEN 1 ELSE 0 END) AS tepat,
        SUM(CASE WHEN ketepatan != 'tepat_waktu' THEN 1 ELSE 0 END) AS terlambat,
        SUM(nominal_setor) AS setor
      FROM pph21_monitoring
      GROUP BY bulan
      ORDER BY bulan
    `,
    )
    .all() as Array<{ bulan: string; tepat: number; terlambat: number; setor: number }>;

  const scatter = database
    .prepare(
      `
      SELECT
        CASE WHEN EXISTS (SELECT 1 FROM sosialisasi so WHERE so.opd_id = o.id) THEN 1 ELSE 0 END AS sosialisasi,
        s.persen_kepatuhan AS kepatuhan,
        o.jumlah_asn AS asn,
        o.nama
      FROM opd o
      JOIN spt_monitoring s ON s.opd_id = o.id
      WHERE s.tahun_pajak = 2025 AND s.periode = (SELECT MAX(periode) FROM spt_monitoring WHERE tahun_pajak = 2025)
      ORDER BY o.id
      LIMIT 80
    `,
    )
    .all() as Array<{ sosialisasi: number; kepatuhan: number; asn: number; nama: string }>;

  return { dashboard, pphTrend, scatter };
}
