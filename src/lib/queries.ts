import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import type {
  ActionLog,
  BendaharaRecord,
  DepositRecord,
  ImportCommitResult,
  ImportPayload,
  ImportTemplateKey,
  Notification,
  PphMasaJenisSummary,
  Opd,
  PegawaiRecord,
  Pph21Record,
  ScoringRecord,
  SosialisasiRecord,
  SptMasaRecord,
  SptRecord,
  TrafficLight,
  User,
  Wilayah,
} from "@/types";

type ListParams = {
  q?: string;
  wilayah?: string;
  status?: string;
  ar?: string;
  opd?: string;
  page?: number;
  pageSize?: number;
  includeSudah?: boolean;
};

export type WriteOpdPayload = {
  nama: string;
  wilayah_id: number;
  jenis_instansi?: string | null;
  jumlah_asn: number;
  jumlah_pppk?: number;
  npwp_opd?: string | null;
  status_pemungut_ppn?: string;
  nama_bendahara: string;
  nip_bendahara?: string | null;
  hp_bendahara: string;
  email_bendahara?: string | null;
  nama_bendahara_penerimaan?: string | null;
  hp_bendahara_penerimaan?: string | null;
  nama_pic_kepeg: string;
  hp_pic_kepeg: string;
  ar_id?: number | null;
  status?: string;
  tanggal_input?: string | null;
  tanggal_update_kontak?: string | null;
};

export type AuditActor = {
  id?: string | number | null;
  name?: string | null;
};

export type AuditLogPayload = {
  actor?: AuditActor;
  action: "create" | "update" | "delete" | "import";
  entity_type: "opd" | "user";
  entity_id?: number | null;
  entity_name: string;
  before?: unknown;
  after?: unknown;
};

export type AuditLogRecord = {
  id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  action: "create" | "update" | "delete" | "import";
  entity_type: "opd" | "user";
  entity_id: number | null;
  entity_name: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
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

export function listPphMasaPeriods() {
  const rows = db()
    .prepare(
      `
      SELECT period
      FROM (
        SELECT bulan AS period FROM pph21_monitoring
        UNION
        SELECT masa_pajak AS period FROM spt_masa_monitoring
      )
      WHERE period IS NOT NULL AND period <> ''
      ORDER BY period DESC
    `,
    )
    .all() as Array<{ period: string }>;

  return rows.length > 0 ? rows.map((row) => row.period) : [latestPphMonth()];
}

function latestSptMasaPeriod() {
  return (
    (db().prepare("SELECT MAX(masa_pajak) AS period FROM spt_masa_monitoring").get() as { period: string | null }).period ??
    "2026-03"
  );
}

function depositAmountSql(alias = "d") {
  const prefix = alias ? `${alias}.` : "";
  return `COALESCE(${prefix}deposit_kd_411618, 0)`;
}

function depositStatusSql(alias = "d") {
  const amount = depositAmountSql(alias);
  return `CASE WHEN ${amount} > 10000000 THEN 'hijau' WHEN ${amount} >= 2000000 THEN 'kuning' ELSE 'merah' END`;
}

function latestDepositPeriod() {
  return (
    (
      db()
        .prepare("SELECT MAX(masa_pajak) AS period FROM deposit_monitoring WHERE COALESCE(deposit_kd_411618, 0) > 0")
        .get() as { period: string | null }
    ).period ??
    latestSptMasaPeriod()
  );
}

function latestScoringPeriod() {
  return (
    (db().prepare("SELECT MAX(bulan_scoring) AS period FROM scoring_opd").get() as { period: string | null }).period ??
    latestDepositPeriod()
  );
}

function jsonForAudit(value: unknown) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function auditActorId(actor: AuditActor | undefined, database: ReturnType<typeof getDb>) {
  const id = Number(actor?.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  const exists = database.prepare("SELECT 1 FROM users WHERE id = ?").get(id);
  return exists ? id : null;
}

type CountTable =
  | "users"
  | "opd"
  | "spt_monitoring"
  | "pph21_monitoring"
  | "spt_masa_monitoring"
  | "deposit_monitoring"
  | "scoring_opd"
  | "sosialisasi"
  | "pegawai";

const IMPORT_ORDER: ImportTemplateKey[] = [
  "masterfile",
  "penerimaan",
  "pelaporan_pph21",
  "pelaporan_unifikasi",
  "pegawai",
  "sosialisasi",
];

const IMPORT_LABELS: Record<ImportTemplateKey, string> = {
  masterfile: "Masterfile Wajib Pajak",
  penerimaan: "Data Penerimaan",
  pelaporan_pph21: "Pelaporan SPT Masa PPh Pasal 21",
  pelaporan_unifikasi: "Pelaporan SPT Masa Unifikasi/PPN",
  pegawai: "Daftar Pegawai Instansi",
  sosialisasi: "Rekam Sosialisasi",
};

function tableCount(database: ReturnType<typeof getDb>, table: CountTable) {
  return (database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
}

export function getDataStatus() {
  const database = db();

  return {
    users: tableCount(database, "users"),
    opd: tableCount(database, "opd"),
    spt: tableCount(database, "spt_monitoring"),
    pph21: tableCount(database, "pph21_monitoring"),
    sptMasa: tableCount(database, "spt_masa_monitoring"),
    deposit: (
      database
        .prepare("SELECT COUNT(*) AS total FROM deposit_monitoring WHERE COALESCE(deposit_kd_411618, 0) > 0")
        .get() as { total: number }
    ).total,
    scoring: tableCount(database, "scoring_opd"),
    sosialisasi: tableCount(database, "sosialisasi"),
    pegawai: tableCount(database, "pegawai"),
  };
}

export function createAuditLog(payload: AuditLogPayload) {
  const database = db();
  const result = database
    .prepare(
      `
      INSERT INTO audit_log (
        actor_user_id, actor_name, action, entity_type, entity_id, entity_name, before_json, after_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      auditActorId(payload.actor, database),
      payload.actor?.name ?? null,
      payload.action,
      payload.entity_type,
      payload.entity_id ?? null,
      payload.entity_name,
      jsonForAudit(payload.before),
      jsonForAudit(payload.after),
    );
  return Number(result.lastInsertRowid);
}

export function listAuditLogs(limit = 80) {
  return db()
    .prepare(
      `
      SELECT id, actor_user_id, actor_name, action, entity_type, entity_id, entity_name, before_json, after_json, created_at
      FROM audit_log
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    )
    .all(Math.min(200, Math.max(10, limit))) as AuditLogRecord[];
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
        COALESCE(SUM(jumlah_wajib_lapor), 0) AS wajib,
        COALESCE(SUM(jumlah_sudah_lapor), 0) AS sudah,
        CASE
          WHEN COALESCE(SUM(jumlah_wajib_lapor), 0) = 0 THEN 0
          ELSE ROUND(SUM(jumlah_sudah_lapor) * 100.0 / SUM(jumlah_wajib_lapor), 1)
        END AS persen
      FROM spt_monitoring
      WHERE tahun_pajak = 2025 AND periode = ?
    `,
    )
    .get(period) as { wajib: number; sudah: number; persen: number };

  const pph = database
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN ketepatan = 'tepat_waktu' THEN 1 ELSE 0 END), 0) AS tepat,
        COALESCE(SUM(CASE WHEN ketepatan != 'tepat_waktu' THEN 1 ELSE 0 END), 0) AS belum,
        COALESCE(SUM(CASE WHEN status = 'under_reporting' THEN 1 ELSE 0 END), 0) AS under_reporting,
        COALESCE(SUM(nominal_setor), 0) AS total_setor
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
      SELECT periode, 2025 AS tahun_pajak,
        CASE
          WHEN COALESCE(SUM(jumlah_wajib_lapor), 0) = 0 THEN 0
          ELSE ROUND(SUM(jumlah_sudah_lapor) * 100.0 / SUM(jumlah_wajib_lapor), 1)
        END AS persen,
        COALESCE(SUM(jumlah_sudah_lapor), 0) AS sudah
      FROM spt_monitoring
      WHERE tahun_pajak = 2025
      GROUP BY periode
      ORDER BY periode
    `,
    )
    .all() as Array<{ periode: string; tahun_pajak: number; persen: number; sudah: number }>;

  const wilayahDistribution = database
    .prepare(
      `
      SELECT w.nama,
        CASE
          WHEN COALESCE(SUM(s.jumlah_wajib_lapor), 0) = 0 THEN 0
          ELSE ROUND(SUM(s.jumlah_sudah_lapor) * 100.0 / SUM(s.jumlah_wajib_lapor), 1)
        END AS persen,
        COALESCE(SUM(s.jumlah_sudah_lapor), 0) AS sudah,
        COALESCE(SUM(s.jumlah_wajib_lapor), 0) AS wajib,
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
      SELECT o.*, (o.jumlah_asn + o.jumlah_pppk) AS total_wajib_lapor,
        w.nama AS wilayah_nama, w.kode AS wilayah_kode, u.nama AS ar_nama
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

export function listOpdOptions(params: { ar?: string } = {}) {
  const where: string[] = ["o.status != 'tidak_aktif'"];
  const values: Array<string | number> = [];

  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return db()
    .prepare(
      `
      SELECT o.id, o.nama, w.nama AS wilayah_nama, u.nama AS ar_nama, o.ar_id
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE ${where.join(" AND ")}
      ORDER BY w.id, o.nama
    `,
    )
    .all(...values) as Array<{ id: number; nama: string; wilayah_nama: string; ar_nama: string | null; ar_id: number | null }>;
}

export function getOpd(id: number) {
  return db()
    .prepare(
      `
      SELECT o.*, (o.jumlah_asn + o.jumlah_pppk) AS total_wajib_lapor,
        w.nama AS wilayah_nama, w.kode AS wilayah_kode, u.nama AS ar_nama
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE o.id = ?
    `,
    )
    .get(id) as Opd | undefined;
}

export function createOpd(payload: WriteOpdPayload, audit?: { actor?: AuditActor; action?: "create" | "import" }) {
  const database = db();
  const result = database
    .prepare(
      `
      INSERT INTO opd (
        nama, wilayah_id, jenis_instansi, jumlah_asn, jumlah_pppk, npwp_opd, status_pemungut_ppn,
        nama_bendahara, nip_bendahara, hp_bendahara, email_bendahara,
        nama_bendahara_penerimaan, hp_bendahara_penerimaan,
        nama_pic_kepeg, hp_pic_kepeg, ar_id, status, tanggal_input, tanggal_update_kontak
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      payload.nama,
      payload.wilayah_id,
      payload.jenis_instansi ?? null,
      payload.jumlah_asn,
      payload.jumlah_pppk ?? 0,
      payload.npwp_opd ?? null,
      payload.status_pemungut_ppn ?? "TIDAK",
      payload.nama_bendahara,
      payload.nip_bendahara ?? null,
      payload.hp_bendahara,
      payload.email_bendahara ?? null,
      payload.nama_bendahara_penerimaan ?? null,
      payload.hp_bendahara_penerimaan ?? null,
      payload.nama_pic_kepeg,
      payload.hp_pic_kepeg,
      payload.ar_id ?? null,
      payload.status ?? "aktif",
      payload.tanggal_input ?? new Date().toISOString().slice(0, 10),
      payload.tanggal_update_kontak ?? new Date().toISOString().slice(0, 10),
    );

  const created = getOpd(Number(result.lastInsertRowid));
  if (created && audit) {
    createAuditLog({
      actor: audit.actor,
      action: audit.action ?? "create",
      entity_type: "opd",
      entity_id: created.id,
      entity_name: created.nama,
      after: created,
    });
  }
  return created;
}

export function updateOpd(id: number, payload: Partial<WriteOpdPayload>, audit?: { actor?: AuditActor }) {
  const current = getOpd(id);
  if (!current) return undefined;

  db()
    .prepare(
      `
      UPDATE opd SET
        nama = ?,
        wilayah_id = ?,
        jenis_instansi = ?,
        jumlah_asn = ?,
        jumlah_pppk = ?,
        npwp_opd = ?,
        status_pemungut_ppn = ?,
        nama_bendahara = ?,
        nip_bendahara = ?,
        hp_bendahara = ?,
        email_bendahara = ?,
        nama_bendahara_penerimaan = ?,
        hp_bendahara_penerimaan = ?,
        nama_pic_kepeg = ?,
        hp_pic_kepeg = ?,
        ar_id = ?,
        status = ?,
        tanggal_input = ?,
        tanggal_update_kontak = ?
      WHERE id = ?
    `,
    )
    .run(
      payload.nama ?? current.nama,
      payload.wilayah_id ?? current.wilayah_id,
      payload.jenis_instansi ?? current.jenis_instansi,
      payload.jumlah_asn ?? current.jumlah_asn,
      payload.jumlah_pppk ?? current.jumlah_pppk,
      payload.npwp_opd ?? current.npwp_opd,
      payload.status_pemungut_ppn ?? current.status_pemungut_ppn,
      payload.nama_bendahara ?? current.nama_bendahara,
      payload.nip_bendahara ?? current.nip_bendahara,
      payload.hp_bendahara ?? current.hp_bendahara,
      payload.email_bendahara ?? current.email_bendahara,
      payload.nama_bendahara_penerimaan ?? current.nama_bendahara_penerimaan,
      payload.hp_bendahara_penerimaan ?? current.hp_bendahara_penerimaan,
      payload.nama_pic_kepeg ?? current.nama_pic_kepeg,
      payload.hp_pic_kepeg ?? current.hp_pic_kepeg,
      payload.ar_id ?? current.ar_id,
      payload.status ?? current.status,
      payload.tanggal_input ?? current.tanggal_input,
      payload.tanggal_update_kontak ?? new Date().toISOString().slice(0, 10),
      id,
    );

  const updated = getOpd(id);
  if (updated && audit) {
    createAuditLog({
      actor: audit.actor,
      action: "update",
      entity_type: "opd",
      entity_id: id,
      entity_name: updated.nama,
      before: current,
      after: updated,
    });
  }
  return updated;
}

export function deleteOpd(id: number, audit?: { actor?: AuditActor }) {
  const current = audit ? getOpd(id) : undefined;
  const result = db().prepare("DELETE FROM opd WHERE id = ?").run(id);
  if (result.changes > 0 && current && audit) {
    createAuditLog({
      actor: audit.actor,
      action: "delete",
      entity_type: "opd",
      entity_id: id,
      entity_name: current.nama,
      before: current,
    });
  }
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

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT s.traffic_light AS status, COUNT(*) AS total,
        COALESCE(SUM(s.jumlah_wajib_lapor - s.jumlah_sudah_lapor), 0) AS belum_lapor
      FROM spt_monitoring s
      JOIN opd o ON o.id = s.opd_id
      WHERE s.tahun_pajak = 2025 AND s.periode = ? AND (? IS NULL OR o.ar_id = ?)
      GROUP BY s.traffic_light
    `,
    )
    .all(periode, arFilter, arFilter) as Array<{ status: string; total: number; belum_lapor: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, periode };
}

export function listSptDialogRows(params: ListParams & { periode?: string; traffic?: string } = {}) {
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

  return database
    .prepare(
      `
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        s.tahun_pajak, s.periode, s.jumlah_wajib_lapor, s.jumlah_sudah_lapor,
        s.persen_kepatuhan, s.traffic_light
      FROM spt_monitoring s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE ${where.join(" AND ")}
      ORDER BY s.persen_kepatuhan ASC, o.nama ASC
      LIMIT 500
    `,
    )
    .all(...values) as SptRecord[];
}

export function listPph21(params: ListParams & { bulan?: string; pphStatus?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestPphMonth();
  const where = ["p.bulan = ?"];
  const values: Array<string | number> = [bulan];
  const laporValue = "LOWER(COALESCE(m.pph21_status, ''))";
  const laporTepat = `(${laporValue} LIKE '%tepat%' OR ${laporValue} LIKE '%normal%' OR ${laporValue} LIKE '%submitted%')`;
  const laporSudah = `(${laporTepat} OR ${laporValue} LIKE '%terlambat%')`;

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
    switch (params.pphStatus) {
      case "lengkap":
        where.push(`p.ketepatan = 'tepat_waktu' AND ${laporTepat}`);
        break;
      case "terlambat":
        where.push(`(p.ketepatan = 'terlambat' OR ${laporValue} LIKE '%terlambat%')`);
        break;
      case "belum_bayar":
        where.push("p.ketepatan = 'belum_setor'");
        break;
      case "belum_lapor":
        where.push(`NOT ${laporSudah}`);
        break;
      default:
        where.push("p.status = ?");
        values.push(params.pphStatus);
        break;
    }
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
        FROM pph21_monitoring p
        JOIN opd o ON o.id = p.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN spt_masa_monitoring m ON m.opd_id = p.opd_id AND m.masa_pajak = p.bulan
        ${clause}
      `,
      )
      .get(...values) as { total: number }
  ).total;

  const data = database
    .prepare(
      `
      SELECT p.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        o.nama_bendahara, p.bulan, p.jumlah_dipotong, p.nominal_setor, p.estimasi_wajar,
        p.ketepatan, p.status, m.pph21_status AS status_lapor
      FROM pph21_monitoring p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      LEFT JOIN spt_masa_monitoring m ON m.opd_id = p.opd_id AND m.masa_pajak = p.bulan
      ${clause}
      ORDER BY
        CASE
          WHEN p.ketepatan = 'belum_setor' OR NOT ${laporSudah} THEN 1
          WHEN p.ketepatan = 'terlambat' OR ${laporValue} LIKE '%terlambat%' THEN 2
          WHEN p.status = 'under_reporting' THEN 3
          ELSE 4
        END,
        o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as Pph21Record[];

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN p.ketepatan = 'tepat_waktu' AND ${laporTepat} THEN 1 ELSE 0 END), 0) AS lengkap,
        COALESCE(SUM(CASE WHEN p.ketepatan != 'tepat_waktu' THEN 1 ELSE 0 END), 0) AS bayar_bermasalah,
        COALESCE(SUM(CASE WHEN p.ketepatan != 'belum_setor' AND NOT ${laporSudah} THEN 1 ELSE 0 END), 0) AS sudah_bayar_belum_lapor,
        COALESCE(SUM(CASE WHEN p.status = 'under_reporting' THEN 1 ELSE 0 END), 0) AS under_reporting,
        COALESCE(SUM(p.nominal_setor), 0) AS total_setor,
        COALESCE(SUM(p.estimasi_wajar), 0) AS total_estimasi,
        COUNT(*) AS total_opd
      FROM pph21_monitoring p
      JOIN opd o ON o.id = p.opd_id
      LEFT JOIN spt_masa_monitoring m ON m.opd_id = p.opd_id AND m.masa_pajak = p.bulan
      WHERE p.bulan = ? AND (? IS NULL OR o.ar_id = ?)
    `,
    )
    .get(bulan, arFilter, arFilter) as {
    lengkap: number;
    bayar_bermasalah: number;
    sudah_bayar_belum_lapor: number;
    under_reporting: number;
    total_setor: number;
    total_estimasi: number;
    total_opd: number;
  };

  const pph21Jenis = database
    .prepare(
      `
      SELECT
        'PPh Pasal 21' AS jenis,
        'Pemotongan gaji ASN/PPPK' AS keterangan,
        COUNT(*) AS wajib_bayar,
        COALESCE(SUM(CASE WHEN p.ketepatan != 'belum_setor' THEN 1 ELSE 0 END), 0) AS sudah_bayar,
        COALESCE(SUM(CASE WHEN p.ketepatan = 'belum_setor' THEN 1 ELSE 0 END), 0) AS belum_bayar,
        COUNT(*) AS wajib_lapor,
        COALESCE(SUM(CASE WHEN ${laporSudah} THEN 1 ELSE 0 END), 0) AS sudah_lapor,
        COALESCE(SUM(CASE WHEN NOT ${laporSudah} THEN 1 ELSE 0 END), 0) AS belum_lapor,
        COALESCE(
          ROUND(
            100.0 * SUM(CASE WHEN p.ketepatan != 'belum_setor' AND ${laporSudah} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
            1
          ),
          0
        ) AS kepatuhan
      FROM pph21_monitoring p
      JOIN opd o ON o.id = p.opd_id
      LEFT JOIN spt_masa_monitoring m ON m.opd_id = p.opd_id AND m.masa_pajak = p.bulan
      WHERE p.bulan = ? AND (? IS NULL OR o.ar_id = ?)
    `,
    )
    .get(bulan, arFilter, arFilter) as PphMasaJenisSummary;

  function sptMasaJenisSummary(
    jenis: string,
    keterangan: string,
    nominalColumn: "pph22_nominal" | "pph23_nominal" | "ppn_put_nominal",
    statusColumn: "pph22_status" | "pph23_status" | "ppn_put_status",
  ) {
    const statusValue = `LOWER(COALESCE(m.${statusColumn}, ''))`;
    const statusSudah = `(${statusValue} LIKE '%tepat%' OR ${statusValue} LIKE '%normal%' OR ${statusValue} LIKE '%submitted%' OR ${statusValue} LIKE '%terlambat%')`;
    const paid = `(COALESCE(m.${nominalColumn}, 0) > 0 OR ${statusSudah})`;

    return database
      .prepare(
        `
        SELECT
          ? AS jenis,
          ? AS keterangan,
          COUNT(*) AS wajib_bayar,
          COALESCE(SUM(CASE WHEN ${paid} THEN 1 ELSE 0 END), 0) AS sudah_bayar,
          COALESCE(SUM(CASE WHEN NOT ${paid} THEN 1 ELSE 0 END), 0) AS belum_bayar,
          COUNT(*) AS wajib_lapor,
          COALESCE(SUM(CASE WHEN ${statusSudah} THEN 1 ELSE 0 END), 0) AS sudah_lapor,
          COALESCE(SUM(CASE WHEN NOT ${statusSudah} THEN 1 ELSE 0 END), 0) AS belum_lapor,
          COALESCE(
            ROUND(
              100.0 * SUM(CASE WHEN ${paid} AND ${statusSudah} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
              1
            ),
            0
          ) AS kepatuhan
        FROM spt_masa_monitoring m
        JOIN opd o ON o.id = m.opd_id
        WHERE m.masa_pajak = ? AND (? IS NULL OR o.ar_id = ?)
      `,
      )
      .get(jenis, keterangan, bulan, arFilter, arFilter) as PphMasaJenisSummary;
  }

  const jenisSummary = [
    pph21Jenis,
    sptMasaJenisSummary("PPh Pasal 22", "Pengadaan barang/jasa", "pph22_nominal", "pph22_status"),
    sptMasaJenisSummary("PPh Pasal 23/26", "Jasa dan sewa", "pph23_nominal", "pph23_status"),
    sptMasaJenisSummary("PPN 1107 PUT", "Pemungutan PPN oleh OPD pemungut", "ppn_put_nominal", "ppn_put_status"),
  ];

  return { data, summary, jenisSummary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, bulan };
}

export function listPph21DialogRows(params: ListParams & { bulan?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestPphMonth();
  const where = ["p.bulan = ?"];
  const values: Array<string | number> = [bulan];

  if (params.q) {
    where.push("LOWER(o.nama) LIKE ?");
    values.push(`%${params.q.toLowerCase()}%`);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return database
    .prepare(
      `
      SELECT p.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        o.nama_bendahara, p.bulan, p.jumlah_dipotong, p.nominal_setor, p.estimasi_wajar,
        p.ketepatan, p.status, m.pph21_status AS status_lapor
      FROM pph21_monitoring p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      LEFT JOIN spt_masa_monitoring m ON m.opd_id = p.opd_id AND m.masa_pajak = p.bulan
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE
          WHEN p.ketepatan = 'belum_setor' THEN 1
          WHEN p.ketepatan = 'terlambat' THEN 2
          WHEN p.status = 'under_reporting' THEN 3
          ELSE 4
        END,
        o.nama
      LIMIT 500
    `,
    )
    .all(...values) as Pph21Record[];
}

export function listSptMasa(params: ListParams & { masa?: string; overallStatus?: string } = {}) {
  const database = db();
  const masa = params.masa ?? latestSptMasaPeriod();
  const where = ["m.masa_pajak = ?"];
  const values: Array<string | number> = [masa];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.overallStatus && params.overallStatus !== "all") {
    where.push("LOWER(m.status_keseluruhan) = ?");
    values.push(params.overallStatus.toLowerCase());
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
        FROM spt_masa_monitoring m
        JOIN opd o ON o.id = m.opd_id
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
      SELECT m.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        m.masa_pajak, m.pph21_status, m.pph22_nominal, m.pph22_status, m.pph23_nominal, m.pph23_status,
        m.ppn_put_nominal, m.ppn_put_status, m.status_opd_pemungut,
        LOWER(COALESCE(m.status_keseluruhan, 'merah')) AS status_keseluruhan,
        m.catatan_ar
      FROM spt_masa_monitoring m
      JOIN opd o ON o.id = m.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY CASE LOWER(m.status_keseluruhan) WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as SptMasaRecord[];

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT LOWER(COALESCE(m.status_keseluruhan, 'merah')) AS status, COUNT(*) AS total,
        COALESCE(SUM(m.pph22_nominal + m.pph23_nominal + m.ppn_put_nominal), 0) AS nominal
      FROM spt_masa_monitoring m
      JOIN opd o ON o.id = m.opd_id
      WHERE m.masa_pajak = ? AND (? IS NULL OR o.ar_id = ?)
      GROUP BY LOWER(COALESCE(m.status_keseluruhan, 'merah'))
    `,
    )
    .all(masa, arFilter, arFilter) as Array<{ status: string; total: number; nominal: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, masa };
}

export function listSptMasaDialogRows(params: ListParams & { masa?: string; overallStatus?: string } = {}) {
  const database = db();
  const masa = params.masa ?? latestSptMasaPeriod();
  const where = ["m.masa_pajak = ?"];
  const values: Array<string | number> = [masa];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.overallStatus && params.overallStatus !== "all") {
    where.push("LOWER(m.status_keseluruhan) = ?");
    values.push(params.overallStatus.toLowerCase());
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return database
    .prepare(
      `
      SELECT m.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        m.masa_pajak, m.pph21_status, m.pph22_nominal, m.pph22_status, m.pph23_nominal, m.pph23_status,
        m.ppn_put_nominal, m.ppn_put_status, m.status_opd_pemungut,
        LOWER(COALESCE(m.status_keseluruhan, 'merah')) AS status_keseluruhan,
        m.catatan_ar
      FROM spt_masa_monitoring m
      JOIN opd o ON o.id = m.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE ${where.join(" AND ")}
      ORDER BY CASE LOWER(m.status_keseluruhan) WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, o.nama
      LIMIT 500
    `,
    )
    .all(...values) as SptMasaRecord[];
}

export function listDeposit(params: ListParams & { masa?: string; overallStatus?: string } = {}) {
  const database = db();
  const masa = params.masa ?? latestDepositPeriod();
  const depositAmount = depositAmountSql();
  const depositStatus = depositStatusSql();
  const where = ["d.masa_pajak = ?"];
  const values: Array<string | number> = [masa];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.overallStatus && params.overallStatus !== "all") {
    where.push(`${depositStatus} = ?`);
    values.push(params.overallStatus.toLowerCase());
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
        FROM deposit_monitoring d
        JOIN opd o ON o.id = d.opd_id
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
      SELECT d.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        d.masa_pajak, d.deposit_pph21, d.status_pph21, d.deposit_pph_unifikasi, d.status_unifikasi,
        d.deposit_ppn_put, d.status_ppn_put, d.deposit_kd_411618,
        ${depositAmount} AS total_deposit,
        ${depositStatus} AS status_deposit_overall
      FROM deposit_monitoring d
      JOIN opd o ON o.id = d.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY CASE ${depositStatus} WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, ${depositAmount} ASC, o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as DepositRecord[];

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT ${depositStatus} AS status, COUNT(*) AS total,
        COALESCE(SUM(${depositAmount}), 0) AS nominal
      FROM deposit_monitoring d
      JOIN opd o ON o.id = d.opd_id
      WHERE d.masa_pajak = ? AND (? IS NULL OR o.ar_id = ?)
      GROUP BY ${depositStatus}
    `,
    )
    .all(masa, arFilter, arFilter) as Array<{ status: string; total: number; nominal: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, masa };
}

export function listDepositDialogRows(params: ListParams & { masa?: string; overallStatus?: string } = {}) {
  const database = db();
  const masa = params.masa ?? latestDepositPeriod();
  const depositAmount = depositAmountSql();
  const depositStatus = depositStatusSql();
  const where = ["d.masa_pajak = ?"];
  const values: Array<string | number> = [masa];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.overallStatus && params.overallStatus !== "all") {
    where.push(`${depositStatus} = ?`);
    values.push(params.overallStatus.toLowerCase());
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return database
    .prepare(
      `
      SELECT d.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        d.masa_pajak, d.deposit_pph21, d.status_pph21, d.deposit_pph_unifikasi, d.status_unifikasi,
        d.deposit_ppn_put, d.status_ppn_put, d.deposit_kd_411618,
        ${depositAmount} AS total_deposit,
        ${depositStatus} AS status_deposit_overall
      FROM deposit_monitoring d
      JOIN opd o ON o.id = d.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE ${where.join(" AND ")}
      ORDER BY CASE ${depositStatus} WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, ${depositAmount} ASC, o.nama
      LIMIT 500
    `,
    )
    .all(...values) as DepositRecord[];
}

export function listScoring(params: ListParams & { bulan?: string; kategori?: string; statusRp?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestScoringPeriod();
  const where = ["s.bulan_scoring = ?"];
  const values: Array<string | number> = [bulan];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.kategori && params.kategori !== "all") {
    where.push("s.kategori = ?");
    values.push(params.kategori);
  }
  if (params.statusRp && params.statusRp !== "all") {
    where.push("s.status_rp = ?");
    values.push(params.statusRp);
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
        FROM scoring_opd s
        JOIN opd o ON o.id = s.opd_id
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
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        s.bulan_scoring, s.skor_spt_op, s.skor_pph21, s.skor_spt_masa, s.skor_deposit,
        s.skor_total, s.kategori, s.status_rp, s.catatan
      FROM scoring_opd s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY s.skor_total ASC, o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as ScoringRecord[];

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT s.kategori, s.status_rp, COUNT(*) AS total, ROUND(AVG(s.skor_total), 1) AS avg_score
      FROM scoring_opd s
      JOIN opd o ON o.id = s.opd_id
      WHERE s.bulan_scoring = ? AND (? IS NULL OR o.ar_id = ?)
      GROUP BY s.kategori, s.status_rp
    `,
    )
    .all(bulan, arFilter, arFilter) as Array<{ kategori: string; status_rp: string; total: number; avg_score: number }>;

  const topReward = database
    .prepare(
      `
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        s.bulan_scoring, s.skor_spt_op, s.skor_pph21, s.skor_spt_masa, s.skor_deposit,
        s.skor_total, s.kategori, s.status_rp, s.catatan
      FROM scoring_opd s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE s.bulan_scoring = ? AND s.status_rp = 'reward' AND (? IS NULL OR o.ar_id = ?)
      ORDER BY s.skor_total DESC, o.nama
      LIMIT 5
    `,
    )
    .all(bulan, arFilter, arFilter) as ScoringRecord[];

  const topPunishment = database
    .prepare(
      `
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
        s.bulan_scoring, s.skor_spt_op, s.skor_pph21, s.skor_spt_masa, s.skor_deposit,
        s.skor_total, s.kategori, s.status_rp, s.catatan
      FROM scoring_opd s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE s.bulan_scoring = ? AND s.status_rp = 'punishment' AND (? IS NULL OR o.ar_id = ?)
      ORDER BY s.skor_total ASC, o.nama
      LIMIT 10
    `,
    )
    .all(bulan, arFilter, arFilter) as ScoringRecord[];

  return { data, summary, topReward, topPunishment, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, bulan };
}

export type RewardPunishmentRow = {
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  skor_total: number;
  kategori: TrafficLight;
  status_rp: "reward" | "monitor" | "punishment";
};

export function getRewardPunishment() {
  const database = db();
  const bulan = latestScoringPeriod();
  const base = `
    SELECT s.opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, u.nama AS ar_nama,
      s.skor_total, s.kategori, s.status_rp
    FROM scoring_opd s
    JOIN opd o ON o.id = s.opd_id
    JOIN wilayah w ON w.id = o.wilayah_id
    LEFT JOIN users u ON u.id = o.ar_id
    WHERE s.bulan_scoring = ?
  `;
  const reward = database
    .prepare(`${base} AND s.skor_total >= 90 ORDER BY s.skor_total DESC`)
    .all(bulan) as RewardPunishmentRow[];
  const punishment = database
    .prepare(`${base} AND s.skor_total < 70 ORDER BY s.skor_total ASC`)
    .all(bulan) as RewardPunishmentRow[];
  const summary = database
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN skor_total >= 90 THEN 1 ELSE 0 END), 0) AS reward,
        COALESCE(SUM(CASE WHEN skor_total >= 70 AND skor_total < 90 THEN 1 ELSE 0 END), 0) AS monitor,
        COALESCE(SUM(CASE WHEN skor_total < 70 THEN 1 ELSE 0 END), 0) AS punishment,
        COALESCE(AVG(skor_total), 0) AS rata
      FROM scoring_opd
      WHERE bulan_scoring = ?
    `,
    )
    .get(bulan) as { reward: number; monitor: number; punishment: number; rata: number };

  return { bulan, reward, punishment, summary };
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
        s.tanggal, s.jumlah_peserta, s.penyuluh_id, u.nama AS penyuluh_nama, s.status,
        s.tempat, s.tema
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

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT
        COUNT(*) AS sesi,
        COUNT(DISTINCT s.opd_id) AS sudah,
        COALESCE(SUM(s.jumlah_peserta), 0) AS peserta
      FROM sosialisasi s
      JOIN opd o ON o.id = s.opd_id
      WHERE (? IS NULL OR o.ar_id = ?)
    `,
    )
    .get(arFilter, arFilter) as { sesi: number; sudah: number; peserta: number };
  const totalOpd = (
    database.prepare("SELECT COUNT(*) AS total FROM opd WHERE (? IS NULL OR ar_id = ?)").get(arFilter, arFilter) as {
      total: number;
    }
  ).total;

  const priority = database
    .prepare(
      `
      SELECT o.id, o.nama, w.nama AS wilayah_nama, u.nama AS ar_nama, o.jumlah_asn
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE o.id NOT IN (SELECT DISTINCT opd_id FROM sosialisasi)
        AND (? IS NULL OR o.ar_id = ?)
      ORDER BY o.jumlah_asn DESC
      LIMIT 6
    `,
    )
    .all(arFilter, arFilter) as Array<{ id: number; nama: string; wilayah_nama: string; ar_nama: string | null; jumlah_asn: number }>;

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

export type SosialisasiOpdDialogRow = {
  id: number;
  nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  jumlah_asn: number;
  sesi: number;
  peserta: number;
};

export function listSosialisasiDialogData(params: ListParams = {}) {
  const database = db();
  const sessionWhere: string[] = [];
  const sessionValues: Array<string | number> = [];
  const opdWhere: string[] = [];
  const opdValues: Array<string | number> = [];

  if (params.q) {
    const q = `%${params.q.toLowerCase()}%`;
    sessionWhere.push("(LOWER(o.nama) LIKE ? OR LOWER(p.nama) LIKE ?)");
    sessionValues.push(q, q);
    opdWhere.push("(LOWER(o.nama) LIKE ? OR LOWER(ar.nama) LIKE ?)");
    opdValues.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    sessionWhere.push("w.kode = ?");
    sessionValues.push(params.wilayah);
    opdWhere.push("w.kode = ?");
    opdValues.push(params.wilayah);
  }
  if (params.ar && params.ar !== "all") {
    sessionWhere.push("o.ar_id = ?");
    sessionValues.push(Number(params.ar));
    opdWhere.push("o.ar_id = ?");
    opdValues.push(Number(params.ar));
  }

  const sessionClause = sessionWhere.length ? `WHERE ${sessionWhere.join(" AND ")}` : "";
  const opdBaseClause = opdWhere.length ? `AND ${opdWhere.join(" AND ")}` : "";

  const sessions = database
    .prepare(
      `
      SELECT s.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama,
        s.tanggal, s.jumlah_peserta, s.penyuluh_id, p.nama AS penyuluh_nama, s.status,
        s.tempat, s.tema
      FROM sosialisasi s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users p ON p.id = s.penyuluh_id
      ${sessionClause}
      ORDER BY s.tanggal DESC, o.nama
      LIMIT 500
    `,
    )
    .all(...sessionValues) as SosialisasiRecord[];

  const sudah = database
    .prepare(
      `
      SELECT o.id, o.nama, w.nama AS wilayah_nama, ar.nama AS ar_nama, o.jumlah_asn,
        COUNT(s.id) AS sesi, COALESCE(SUM(s.jumlah_peserta), 0) AS peserta
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users ar ON ar.id = o.ar_id
      JOIN sosialisasi s ON s.opd_id = o.id
      WHERE 1 = 1 ${opdBaseClause}
      GROUP BY o.id, o.nama, w.nama, ar.nama, o.jumlah_asn
      ORDER BY sesi DESC, peserta DESC, o.nama
      LIMIT 500
    `,
    )
    .all(...opdValues) as SosialisasiOpdDialogRow[];

  const belum = database
    .prepare(
      `
      SELECT o.id, o.nama, w.nama AS wilayah_nama, ar.nama AS ar_nama, o.jumlah_asn,
        0 AS sesi, 0 AS peserta
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users ar ON ar.id = o.ar_id
      WHERE NOT EXISTS (SELECT 1 FROM sosialisasi s WHERE s.opd_id = o.id) ${opdBaseClause}
      ORDER BY o.jumlah_asn DESC, o.nama
      LIMIT 500
    `,
    )
    .all(...opdValues) as SosialisasiOpdDialogRow[];

  return { sessions, sudah, belum };
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
  const where = params.includeSudah ? [] : ["p.status_coretax != 'sudah_lapor'"];
  const values: Array<string | number> = [];
  const summaryWhere: string[] = [];
  const summaryValues: Array<string | number> = [];

  if (params.q) {
    where.push("(LOWER(p.nama) LIKE ? OR p.nip LIKE ? OR LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    summaryWhere.push("(LOWER(p.nama) LIKE ? OR p.nip LIKE ? OR LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, `%${params.q}%`, q, q);
    summaryValues.push(q, `%${params.q}%`, q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    summaryWhere.push("w.kode = ?");
    values.push(params.wilayah);
    summaryValues.push(params.wilayah);
  }
  if (params.status && params.status !== "all") {
    where.push("p.status_coretax = ?");
    values.push(params.status);
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    summaryWhere.push("o.ar_id = ?");
    values.push(Number(params.ar));
    summaryValues.push(Number(params.ar));
  }
  if (params.opd && params.opd !== "all") {
    const opdId = Number(params.opd);
    if (Number.isFinite(opdId) && opdId > 0) {
      where.push("o.id = ?");
      summaryWhere.push("o.id = ?");
      values.push(opdId);
      summaryValues.push(opdId);
    }
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const summaryClause = summaryWhere.length > 0 ? `WHERE ${summaryWhere.join(" AND ")}` : "";
  const total = (
    database
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM pegawai p
        JOIN opd o ON o.id = p.opd_id
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
      SELECT p.id, p.nama, p.nip, p.opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama,
        p.jabatan, p.status_coretax, u.nama AS ar_nama, p.phone,
        p.npwp, p.nik, p.email, p.jenis_kepegawaian
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

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT p.status_coretax AS status, COUNT(*) AS total
      FROM pegawai p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${summaryClause}
      GROUP BY p.status_coretax
    `,
    )
    .all(...summaryValues) as Array<{ status: string; total: number }>;

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

export function listBendahara(params: ListParams = {}) {
  const database = db();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const scoringPeriod = latestScoringPeriod();
  const pphMonth = latestPphMonth();
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (params.q) {
    where.push(
      "(LOWER(o.nama) LIKE ? OR LOWER(o.nama_bendahara) LIKE ? OR LOWER(o.nama_bendahara_penerimaan) LIKE ? OR LOWER(u.nama) LIKE ?)",
    );
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q, q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
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
      SELECT o.*, (o.jumlah_asn + o.jumlah_pppk) AS total_wajib_lapor,
        w.nama AS wilayah_nama, w.kode AS wilayah_kode, u.nama AS ar_nama,
        p.ketepatan AS status_pph21_terakhir,
        s.skor_total AS skor_terakhir
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      LEFT JOIN pph21_monitoring p ON p.opd_id = o.id AND p.bulan = ?
      LEFT JOIN scoring_opd s ON s.opd_id = o.id AND s.bulan_scoring = ?
      ${clause}
      ORDER BY COALESCE(s.skor_total, 999) ASC, w.id, o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(pphMonth, scoringPeriod, ...values, pageSize, offset) as BendaharaRecord[];

  return { data, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, pphMonth, scoringPeriod };
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

export function getUser(id: number) {
  return db()
    .prepare(
      `
      SELECT id, nama, email, nip, jabatan, role, phone, avatar_color, status
      FROM users
      WHERE id = ?
    `,
    )
    .get(id) as User | undefined;
}

export function createUser(payload: {
  nama: string;
  email: string;
  password_hash: string;
  role: string;
  nip?: string | null;
  jabatan?: string | null;
  phone?: string | null;
  avatar_color?: string | null;
}, audit?: { actor?: AuditActor }) {
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
  const id = Number(result.lastInsertRowid);
  const created = getUser(id);
  if (created && audit) {
    createAuditLog({
      actor: audit.actor,
      action: "create",
      entity_type: "user",
      entity_id: id,
      entity_name: created.nama,
      after: created,
    });
  }
  return id;
}

export function updateUser(
  id: number,
  payload: Partial<{
    nama: string;
    email: string;
    password_hash: string;
    role: string;
    nip?: string | null;
    jabatan?: string | null;
    phone?: string | null;
    avatar_color?: string | null;
    status?: string;
  }>,
  audit?: { actor?: AuditActor },
) {
  const current = getUser(id);
  if (!current) return undefined;

  db()
    .prepare(
      `
      UPDATE users SET
        nama = ?,
        email = ?,
        password_hash = COALESCE(?, password_hash),
        nip = ?,
        jabatan = ?,
        role = ?,
        phone = ?,
        avatar_color = ?,
        status = ?
      WHERE id = ?
    `,
    )
    .run(
      payload.nama ?? current.nama,
      payload.email ?? current.email,
      payload.password_hash ?? null,
      payload.nip ?? current.nip,
      payload.jabatan ?? current.jabatan,
      payload.role ?? current.role,
      payload.phone ?? current.phone,
      payload.avatar_color ?? current.avatar_color,
      payload.status ?? current.status,
      id,
    );

  const updated = getUser(id);
  if (updated && audit) {
    createAuditLog({
      actor: audit.actor,
      action: "update",
      entity_type: "user",
      entity_id: id,
      entity_name: updated.nama,
      before: current,
      after: updated,
    });
  }
  return updated;
}

export function deleteUser(id: number, audit?: { actor?: AuditActor }) {
  const current = getUser(id);
  if (!current) return false;
  const result = db().prepare("UPDATE users SET status = 'nonaktif' WHERE id = ?").run(id);
  if (result.changes > 0 && audit) {
    createAuditLog({
      actor: audit.actor,
      action: "delete",
      entity_type: "user",
      entity_id: id,
      entity_name: current.nama,
      before: current,
    });
  }
  return result.changes > 0;
}

export function getActionLog(limit = 20, params: { userId?: string; ar?: string } = {}) {
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (params.userId) {
    where.push("l.user_id = ?");
    values.push(Number(params.userId));
  }

  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return db()
    .prepare(
      `
      SELECT l.id, l.user_id, u.nama AS user_nama, l.opd_id, l.action, l.target_type, l.target_name,
        l.description, l.result, l.follow_up, l.next_follow_up_at, l.attachment_url, l.created_at
      FROM action_log l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN opd o ON o.id = l.opd_id
      ${clause}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ?
    `,
    )
    .all(...values, limit) as ActionLog[];
}

export function createActionLog(payload: {
  user_id?: number | null;
  opd_id?: number | null;
  action: string;
  target_type: string;
  target_name: string;
  description?: string | null;
  result?: string | null;
  follow_up?: string | null;
  next_follow_up_at?: string | null;
  attachment_url?: string | null;
}) {
  const result = db()
    .prepare(
      `
      INSERT INTO action_log (
        user_id, opd_id, action, target_type, target_name, description, result, follow_up, next_follow_up_at, attachment_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      payload.user_id ?? null,
      payload.opd_id ?? null,
      payload.action,
      payload.target_type,
      payload.target_name,
      payload.description ?? null,
      payload.result ?? null,
      payload.follow_up ?? null,
      payload.next_follow_up_at ?? null,
      payload.attachment_url ?? null,
    );
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

export function getNotification(id: number) {
  return db()
    .prepare(
      `
      SELECT id, title, body, type, is_read, created_at
      FROM notifications
      WHERE id = ?
    `,
    )
    .get(id) as Notification | undefined;
}

export function markNotificationRead(id: number) {
  return db().prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND is_read = 0").run(id).changes;
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

export function listSettings() {
  return db()
    .prepare("SELECT key, value FROM settings ORDER BY key")
    .all() as Array<{ key: string; value: string }>;
}

export function getImportStatus() {
  const database = db();
  const lastAt = readSetting(database, "import_last_at");
  const rawLastTemplate = readSetting(database, "import_last_template");
  const lastTemplate =
    rawLastTemplate && (IMPORT_ORDER as string[]).includes(rawLastTemplate)
      ? (rawLastTemplate as ImportTemplateKey)
      : null;

  return {
    lastAt,
    lastTemplate,
    templates: IMPORT_ORDER.map((template) => ({
      key: template,
      label: IMPORT_LABELS[template],
      lastAt: readSetting(database, `import_last_at_${template}`) ?? (lastTemplate === template ? lastAt : null),
    })),
  };
}

function readSetting(database: ReturnType<typeof getDb>, key: string) {
  return (database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
}

function writeSetting(database: ReturnType<typeof getDb>, key: string, value: string) {
  database
    .prepare(
      `
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    )
    .run(key, value);
}

// ---------------------------------------------------------------------------
// Import data dari template Excel resmi (commit transaksional + audit)
// ---------------------------------------------------------------------------

function importSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "wilayah";
}

function importLookup(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function opdLookupAliases(value: string | null | undefined) {
  const clean = importLookup(value);
  const aliases = new Set<string>();
  const add = (candidate: string) => {
    const normalized = importLookup(candidate);
    if (normalized) aliases.add(normalized);
  };

  add(clean);
  add(clean.replace(/\bkab\b/g, "kabupaten").replace(/\bprov\b/g, "provinsi"));

  [...aliases].forEach((alias) => {
    add(alias.replace(/\s+(?:kota|kabupaten|kab|provinsi|prov)\s+[a-z0-9 ]+$/, ""));
    add(alias.replace(/^pemerintah(?: daerah)?\s+(?:kota|kabupaten|kab|provinsi|prov)\s+[a-z0-9 ]+\s+/, ""));
  });

  return aliases;
}

export class ImportCommitError extends Error {
  result: ImportCommitResult;

  constructor(message: string, result: ImportCommitResult) {
    super(message);
    this.name = "ImportCommitError";
    this.result = result;
  }
}

function sptStatusLevel(status: string | null | undefined): "hijau" | "kuning" | "merah" | null {
  const value = importLookup(status);
  if (!value || value === "bukan pemungut") return null;
  if (value.includes("nihil") || value.includes("belum") || value.includes("tidak lapor") || value.includes("gagal")) return "merah";
  if (value.includes("terlambat") || value.includes("telat")) return "kuning";
  if (value.includes("tepat") || value.includes("submitted") || value.includes("normal") || value.includes("lapor")) return "hijau";
  return "hijau";
}

function sptOverallStatus(statuses: Array<string | null | undefined>): "hijau" | "kuning" | "merah" | null {
  const levels = statuses.map(sptStatusLevel).filter((level): level is "hijau" | "kuning" | "merah" => Boolean(level));
  if (levels.length === 0) return null;
  if (levels.includes("merah")) return "merah";
  if (levels.includes("kuning")) return "kuning";
  return "hijau";
}

function refreshSptMasaOverall(database: ReturnType<typeof getDb>) {
  const rows = database
    .prepare(
      "SELECT id, pph21_status, pph22_status, pph23_status, ppn_put_status FROM spt_masa_monitoring",
    )
    .all() as Array<{
      id: number;
      pph21_status: string | null;
      pph22_status: string | null;
      pph23_status: string | null;
      ppn_put_status: string | null;
    }>;
  const update = database.prepare("UPDATE spt_masa_monitoring SET status_keseluruhan = ? WHERE id = ?");
  rows.forEach((row) => {
    update.run(sptOverallStatus([row.pph21_status, row.pph22_status, row.pph23_status, row.ppn_put_status]), row.id);
  });
}

function deleteEmptySptMasaRows(database: ReturnType<typeof getDb>) {
  return database
    .prepare(
      `
      DELETE FROM spt_masa_monitoring
      WHERE pph21_status IS NULL
        AND pph22_status IS NULL
        AND pph23_status IS NULL
        AND ppn_put_status IS NULL
        AND COALESCE(pph22_nominal, 0) = 0
        AND COALESCE(pph23_nominal, 0) = 0
        AND COALESCE(ppn_put_nominal, 0) = 0
        AND status_opd_pemungut IS NULL
        AND catatan_ar IS NULL
    `,
    )
    .run().changes;
}

function importTemplateHasSourceData(database: ReturnType<typeof getDb>, template: ImportTemplateKey) {
  switch (template) {
    case "masterfile":
      return tableCount(database, "opd") > 0;
    case "penerimaan":
      return (
        tableCount(database, "pph21_monitoring") > 0 ||
        database.prepare("SELECT 1 FROM deposit_monitoring WHERE COALESCE(deposit_kd_411618, 0) > 0 LIMIT 1").get() !==
          undefined ||
        database
          .prepare(
            `SELECT 1 FROM spt_masa_monitoring
             WHERE COALESCE(pph22_nominal, 0) > 0
                OR COALESCE(pph23_nominal, 0) > 0
                OR COALESCE(ppn_put_nominal, 0) > 0
             LIMIT 1`,
          )
          .get() !== undefined
      );
    case "pelaporan_pph21":
      return (
        database.prepare("SELECT 1 FROM spt_masa_monitoring WHERE pph21_status IS NOT NULL LIMIT 1").get() !== undefined
      );
    case "pelaporan_unifikasi":
      return (
        database
          .prepare(
            "SELECT 1 FROM spt_masa_monitoring WHERE pph22_status IS NOT NULL OR pph23_status IS NOT NULL OR ppn_put_status IS NOT NULL LIMIT 1",
          )
          .get() !== undefined
      );
    case "pegawai":
      return tableCount(database, "pegawai") > 0;
    case "sosialisasi":
      return tableCount(database, "sosialisasi") > 0;
  }
}

function completedImportTemplates(database: ReturnType<typeof getDb>) {
  const raw = readSetting(database, "import_completed_templates");
  if (raw) {
    const values = new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is ImportTemplateKey => (IMPORT_ORDER as string[]).includes(item)),
    );
    if (values.size > 0) return values;
  }

  return new Set(IMPORT_ORDER.filter((template) => importTemplateHasSourceData(database, template)));
}

function markImportCompleted(database: ReturnType<typeof getDb>, template: ImportTemplateKey) {
  const completed = completedImportTemplates(database);
  completed.add(template);
  const now = new Date().toISOString();
  writeSetting(
    database,
    "import_completed_templates",
    IMPORT_ORDER.filter((item) => completed.has(item)).join(","),
  );
  writeSetting(database, "import_last_template", template);
  writeSetting(database, "import_last_at", now);
  writeSetting(database, `import_last_at_${template}`, now);
}

function importedRowCountForTemplate(result: ImportCommitResult, template: ImportTemplateKey) {
  switch (template) {
    case "masterfile":
      return result.opd_created + result.opd_updated;
    case "penerimaan":
      return result.pph21 + result.deposit + result.spt_masa;
    case "pelaporan_pph21":
    case "pelaporan_unifikasi":
      return result.spt_masa;
    case "pegawai":
      return result.pegawai;
    case "sosialisasi":
      return result.sosialisasi;
  }
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function collectFiscalPeriods(database: ReturnType<typeof getDb>) {
  const rows = database
    .prepare(
      `
      SELECT bulan AS period FROM pph21_monitoring
      UNION
      SELECT masa_pajak AS period FROM deposit_monitoring
      UNION
      SELECT masa_pajak AS period FROM spt_masa_monitoring
      ORDER BY period
    `,
    )
    .all() as Array<{ period: string | null }>;

  return rows.map((row) => row.period).filter((period): period is string => Boolean(period));
}

function collectDepositPeriods(database: ReturnType<typeof getDb>) {
  const rows = database
    .prepare(
      `
      SELECT masa_pajak AS period
      FROM deposit_monitoring
      WHERE COALESCE(deposit_kd_411618, 0) > 0
      ORDER BY period
    `,
    )
    .all() as Array<{ period: string | null }>;

  return rows.map((row) => row.period).filter((period): period is string => Boolean(period));
}

function trafficFromImportedPercent(percent: number): TrafficLight {
  if (percent >= 70) return "hijau";
  if (percent >= 40) return "kuning";
  return "merah";
}

function scoreFromTraffic(value: string | null | undefined) {
  if (value === "hijau") return 100;
  if (value === "kuning") return 60;
  return 0;
}

function scoreFromPph21(ketepatan: string | null | undefined, nominal: number | null | undefined) {
  if ((nominal ?? 0) <= 0) return 0;
  if (ketepatan === "tepat_waktu") return 100;
  if (ketepatan === "terlambat") return 60;
  return 0;
}

function deriveOpdPegawaiCounts(database: ReturnType<typeof getDb>) {
  return database
    .prepare(
      `
      UPDATE opd
      SET
        jumlah_asn = (
          SELECT COUNT(*)
          FROM pegawai p
          WHERE p.opd_id = opd.id
            AND LOWER(COALESCE(p.jenis_kepegawaian, '')) NOT LIKE '%ppp%'
            AND LOWER(COALESCE(p.jenis_kepegawaian, '')) NOT LIKE '%p3k%'
        ),
        jumlah_pppk = (
          SELECT COUNT(*)
          FROM pegawai p
          WHERE p.opd_id = opd.id
            AND (
              LOWER(COALESCE(p.jenis_kepegawaian, '')) LIKE '%ppp%'
              OR LOWER(COALESCE(p.jenis_kepegawaian, '')) LIKE '%p3k%'
            )
        )
      WHERE EXISTS (SELECT 1 FROM pegawai p WHERE p.opd_id = opd.id)
    `,
    )
    .run().changes;
}

function deriveSptMonitoring(database: ReturnType<typeof getDb>, periods: string[]) {
  const sourcePeriods = periods.length > 0 ? periods : tableCount(database, "pegawai") > 0 ? [currentMonth()] : [];
  if (sourcePeriods.length === 0) return 0;

  const rows = database
    .prepare(
      `
      SELECT o.id AS opd_id,
        CASE
          WHEN COUNT(p.id) > 0 THEN COUNT(p.id)
          ELSE COALESCE(o.jumlah_asn, 0) + COALESCE(o.jumlah_pppk, 0)
        END AS wajib,
        COALESCE(SUM(CASE WHEN p.status_coretax = 'sudah_lapor' THEN 1 ELSE 0 END), 0) AS sudah
      FROM opd o
      LEFT JOIN pegawai p ON p.opd_id = o.id
      GROUP BY o.id
    `,
    )
    .all() as Array<{ opd_id: number; wajib: number; sudah: number }>;

  const upsert = database.prepare(
    `
    INSERT INTO spt_monitoring (
      opd_id, tahun_pajak, periode, jumlah_wajib_lapor, jumlah_sudah_lapor, persen_kepatuhan, traffic_light
    )
    VALUES (?, 2025, ?, ?, ?, ?, ?)
    ON CONFLICT(opd_id, tahun_pajak, periode) DO UPDATE SET
      jumlah_wajib_lapor = excluded.jumlah_wajib_lapor,
      jumlah_sudah_lapor = excluded.jumlah_sudah_lapor,
      persen_kepatuhan = excluded.persen_kepatuhan,
      traffic_light = excluded.traffic_light
  `,
  );

  let changed = 0;
  sourcePeriods.forEach((period) => {
    rows.forEach((row) => {
      const wajib = Math.max(0, Number(row.wajib ?? 0));
      const sudah = Math.min(wajib, Math.max(0, Number(row.sudah ?? 0)));
      const persen = wajib === 0 ? 0 : Number(((sudah * 100) / wajib).toFixed(1));
      changed += upsert.run(row.opd_id, period, wajib, sudah, persen, trafficFromImportedPercent(persen)).changes;
    });
  });
  return changed;
}

function ensurePph21Rows(database: ReturnType<typeof getDb>, periods: string[]) {
  const insert = database.prepare(
    `
    INSERT INTO pph21_monitoring (opd_id, bulan, jumlah_dipotong, nominal_setor, estimasi_wajar, ketepatan, status)
    SELECT o.id, ?, 0, 0, 0, 'belum_setor', 'kritis'
    FROM opd o
    WHERE NOT EXISTS (
      SELECT 1 FROM pph21_monitoring p WHERE p.opd_id = o.id AND p.bulan = ?
    )
  `,
  );
  return periods.reduce((sum, period) => sum + insert.run(period, period).changes, 0);
}

function deriveDepositStatuses(database: ReturnType<typeof getDb>, periods: string[]) {
  if (periods.length === 0) return 0;

  const insert = database.prepare(
    `
    INSERT INTO deposit_monitoring (opd_id, masa_pajak, deposit_kd_411618, total_deposit)
    SELECT o.id, ?, 0, 0
    FROM opd o
    WHERE NOT EXISTS (
      SELECT 1 FROM deposit_monitoring d WHERE d.opd_id = o.id AND d.masa_pajak = ?
    )
  `,
  );
  periods.forEach((period) => insert.run(period, period));

  const depositStatus = depositStatusSql("");
  const update = database.prepare(
    `
    UPDATE deposit_monitoring
    SET
      total_deposit = COALESCE(deposit_kd_411618, 0),
      status_pph21 = NULL,
      status_unifikasi = CASE WHEN COALESCE(deposit_kd_411618, 0) > 0 THEN 'TEPAT WAKTU' ELSE 'NIHIL' END,
      status_ppn_put = NULL,
      status_deposit_overall = ${depositStatus}
    WHERE masa_pajak = ?
  `,
  );

  return periods.reduce((sum, period) => sum + update.run(period).changes, 0);
}

function deriveSptMasaStatuses(database: ReturnType<typeof getDb>, periods: string[]) {
  if (periods.length === 0) return 0;

  const insert = database.prepare(
    `
    INSERT INTO spt_masa_monitoring (opd_id, masa_pajak, status_keseluruhan)
    SELECT o.id, ?, NULL
    FROM opd o
    WHERE NOT EXISTS (
      SELECT 1 FROM spt_masa_monitoring m WHERE m.opd_id = o.id AND m.masa_pajak = ?
    )
  `,
  );
  periods.forEach((period) => insert.run(period, period));

  const updatePemungut = database.prepare(
    `
    UPDATE spt_masa_monitoring
    SET status_opd_pemungut = COALESCE(
      status_opd_pemungut,
      (SELECT status_pemungut_ppn FROM opd WHERE opd.id = spt_masa_monitoring.opd_id)
    )
    WHERE masa_pajak = ?
  `,
  );
  periods.forEach((period) => updatePemungut.run(period));

  const updateStatus = database.prepare(
    `
    UPDATE spt_masa_monitoring
    SET
      pph21_status = COALESCE(pph21_status, 'Belum Lapor'),
      pph22_status = COALESCE(pph22_status, 'Belum Lapor'),
      pph23_status = COALESCE(pph23_status, 'Belum Lapor'),
      ppn_put_status = COALESCE(
        ppn_put_status,
        CASE WHEN UPPER(COALESCE(status_opd_pemungut, 'TIDAK')) = 'YA' THEN 'Belum Lapor' ELSE 'Bukan Pemungut' END
      )
    WHERE masa_pajak = ?
  `,
  );

  const changed = periods.reduce((sum, period) => sum + updateStatus.run(period).changes, 0);
  refreshSptMasaOverall(database);
  return changed;
}

function deriveScoring(database: ReturnType<typeof getDb>, periods: string[]) {
  if (periods.length === 0) return 0;
  const depositStatus = depositStatusSql();

  const selectRows = database.prepare(
    `
    SELECT o.id AS opd_id,
      COALESCE(s.persen_kepatuhan, 0) AS skor_spt_op,
      p.ketepatan AS pph21_ketepatan,
      COALESCE(p.nominal_setor, 0) AS pph21_nominal,
      LOWER(COALESCE(m.status_keseluruhan, 'merah')) AS spt_masa_status,
      ${depositStatus} AS deposit_status
    FROM opd o
    LEFT JOIN spt_monitoring s ON s.opd_id = o.id AND s.tahun_pajak = 2025 AND s.periode = ?
    LEFT JOIN pph21_monitoring p ON p.opd_id = o.id AND p.bulan = ?
    LEFT JOIN spt_masa_monitoring m ON m.opd_id = o.id AND m.masa_pajak = ?
    LEFT JOIN deposit_monitoring d ON d.opd_id = o.id AND d.masa_pajak = ?
    ORDER BY o.id
  `,
  );
  const upsert = database.prepare(
    `
    INSERT INTO scoring_opd (
      opd_id, bulan_scoring, skor_spt_op, skor_pph21, skor_spt_masa, skor_deposit, skor_total, kategori, status_rp, catatan
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(opd_id, bulan_scoring) DO UPDATE SET
      skor_spt_op = excluded.skor_spt_op,
      skor_pph21 = excluded.skor_pph21,
      skor_spt_masa = excluded.skor_spt_masa,
      skor_deposit = excluded.skor_deposit,
      skor_total = excluded.skor_total,
      kategori = excluded.kategori,
      status_rp = excluded.status_rp,
      catatan = excluded.catatan
  `,
  );

  let changed = 0;
  periods.forEach((period) => {
    const rows = selectRows.all(period, period, period, period) as Array<{
      opd_id: number;
      skor_spt_op: number;
      pph21_ketepatan: string | null;
      pph21_nominal: number;
      spt_masa_status: string | null;
      deposit_status: string | null;
    }>;

    rows.forEach((row) => {
      const skorSpt = Math.min(100, Math.max(0, Number(row.skor_spt_op ?? 0)));
      const skorPph21 = scoreFromPph21(row.pph21_ketepatan, row.pph21_nominal);
      const skorSptMasa = scoreFromTraffic(row.spt_masa_status);
      const skorDeposit = scoreFromTraffic(row.deposit_status);
      const skorTotal = Number((skorSpt * 0.3 + skorPph21 * 0.25 + skorSptMasa * 0.25 + skorDeposit * 0.2).toFixed(2));
      const kategori: TrafficLight = skorTotal >= 90 ? "hijau" : skorTotal >= 70 ? "kuning" : "merah";
      const statusRp = skorTotal >= 90 ? "reward" : skorTotal < 70 ? "punishment" : "monitor";
      changed += upsert.run(
        row.opd_id,
        period,
        skorSpt,
        skorPph21,
        skorSptMasa,
        skorDeposit,
        skorTotal,
        kategori,
        statusRp,
        "Dihitung otomatis setelah import.",
      ).changes;
    });
  });

  return changed;
}

function deriveImportedMonitoring(database: ReturnType<typeof getDb>) {
  deriveOpdPegawaiCounts(database);
  const fiscalPeriods = collectFiscalPeriods(database);
  const depositPeriods = collectDepositPeriods(database);

  ensurePph21Rows(database, fiscalPeriods);
  const derivedSpt = deriveSptMonitoring(database, fiscalPeriods);
  const derivedDeposit = deriveDepositStatuses(database, depositPeriods);
  const derivedSptMasa = deriveSptMasaStatuses(database, fiscalPeriods);
  const derivedScoring = deriveScoring(database, fiscalPeriods);

  return {
    derived_spt: derivedSpt,
    derived_deposit_status: derivedDeposit,
    derived_spt_masa_status: derivedSptMasa,
    derived_scoring: derivedScoring,
  };
}

function clearImportDataForTemplate(database: ReturnType<typeof getDb>, template: ImportTemplateKey): number {
  switch (template) {
    case "masterfile":
      return database.prepare("DELETE FROM opd").run().changes;
    case "penerimaan": {
      const cleared =
        database.prepare("DELETE FROM pph21_monitoring").run().changes +
        database.prepare("DELETE FROM deposit_monitoring").run().changes +
        database
          .prepare(
            `UPDATE spt_masa_monitoring
             SET pph22_nominal = 0, pph23_nominal = 0, ppn_put_nominal = 0
             WHERE pph22_nominal <> 0 OR pph23_nominal <> 0 OR ppn_put_nominal <> 0`,
          )
          .run().changes;
      deleteEmptySptMasaRows(database);
      refreshSptMasaOverall(database);
      return cleared;
    }
    case "pelaporan_pph21": {
      const cleared = database.prepare("UPDATE spt_masa_monitoring SET pph21_status = NULL WHERE pph21_status IS NOT NULL").run().changes;
      deleteEmptySptMasaRows(database);
      refreshSptMasaOverall(database);
      return cleared;
    }
    case "pelaporan_unifikasi": {
      const cleared = database
        .prepare(
          `UPDATE spt_masa_monitoring
           SET pph22_status = NULL, pph23_status = NULL, ppn_put_status = NULL
           WHERE pph22_status IS NOT NULL OR pph23_status IS NOT NULL OR ppn_put_status IS NOT NULL`,
        )
        .run().changes;
      deleteEmptySptMasaRows(database);
      refreshSptMasaOverall(database);
      return cleared;
    }
    case "pegawai":
      return database.prepare("DELETE FROM pegawai").run().changes;
    case "sosialisasi":
      return database.prepare("DELETE FROM sosialisasi").run().changes;
  }
}

export async function commitImportData(template: ImportTemplateKey, payload: ImportPayload, actor?: AuditActor): Promise<ImportCommitResult> {
  const database = db();
  const today = new Date().toISOString().slice(0, 10);

  const run = database.transaction((): ImportCommitResult => {
    const result: ImportCommitResult = {
      deleted: 0,
      opd_created: 0,
      opd_updated: 0,
      pph21: 0,
      deposit: 0,
      spt_masa: 0,
      pegawai: 0,
      sosialisasi: 0,
      derived_spt: 0,
      derived_deposit_status: 0,
      derived_spt_masa_status: 0,
      derived_scoring: 0,
      skipped: 0,
      skipped_reasons: [],
    };
    const addSkip = (reason: string) => {
      result.skipped += 1;
      const existing = result.skipped_reasons.find((item) => item.reason === reason);
      if (existing) existing.count += 1;
      else result.skipped_reasons.push({ reason, count: 1 });
    };

    result.deleted = clearImportDataForTemplate(database, template);

    // --- Registry wilayah -------------------------------------------------
    const wilayahByName = new Map<string, number>();
    (database.prepare("SELECT id, nama FROM wilayah").all() as Array<{ id: number; nama: string }>).forEach((w) =>
      wilayahByName.set(importLookup(w.nama), w.id),
    );
    const insertWilayah = database.prepare("INSERT INTO wilayah (nama, kode) VALUES (?, ?)");
    const ensureWilayah = (nama: string | null): number => {
      const clean = (nama ?? "").trim() || "Tidak Diketahui";
      const key = importLookup(clean);
      const existing = wilayahByName.get(key);
      if (existing) return existing;
      let kode = importSlug(clean);
      while (database.prepare("SELECT 1 FROM wilayah WHERE kode = ?").get(kode)) {
        kode = `${kode}-${wilayahByName.size + 1}`;
      }
      const id = Number(insertWilayah.run(clean, kode).lastInsertRowid);
      wilayahByName.set(key, id);
      return id;
    };

    // --- Registry AR (users) ---------------------------------------------
    const userByName = new Map<string, number>();
    (database.prepare("SELECT id, nama FROM users").all() as Array<{ id: number; nama: string }>).forEach((u) =>
      userByName.set(importLookup(u.nama), u.id),
    );
    const insertUser = database.prepare(
      "INSERT INTO users (nama, email, password_hash, nip, jabatan, role, status) VALUES (?, ?, ?, ?, 'Account Representative', 'ar', 'aktif')",
    );
    const ensureAr = (nama: string | null, nip: string | null): number | null => {
      const clean = (nama ?? "").trim();
      if (!clean) return null;
      const key = importLookup(clean);
      const existing = userByName.get(key);
      if (existing) return existing;
      let email = `${importSlug(clean)}@simpatik.local`;
      let attempt = 2;
      while (database.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
        email = `${importSlug(clean)}-${attempt}@simpatik.local`;
        attempt += 1;
      }
      const id = Number(insertUser.run(clean, email, "!imported-no-login", nip || null).lastInsertRowid);
      userByName.set(key, id);
      return id;
    };

    // --- Registry OPD -----------------------------------------------------
    const opdByNpwp = new Map<string, number>();
    const opdByName = new Map<string, number | null>();
    const opdNameAliases: Array<{ key: string; id: number }> = [];
    const registerOpdName = (nama: string, id: number) => {
      opdLookupAliases(nama).forEach((key) => {
        const existing = opdByName.get(key);
        if (existing === undefined) {
          opdByName.set(key, id);
        } else if (existing !== id) {
          opdByName.set(key, null);
        }
        opdNameAliases.push({ key, id });
      });
    };
    (database.prepare("SELECT id, nama, npwp_opd FROM opd").all() as Array<{ id: number; nama: string; npwp_opd: string | null }>).forEach((o) => {
      registerOpdName(o.nama, o.id);
      if (o.npwp_opd) opdByNpwp.set(o.npwp_opd.replace(/\D/g, ""), o.id);
    });
    const resolveOpd = (npwp: string | null, nama: string | null): number | null => {
      if (npwp) {
        const hit = opdByNpwp.get(npwp.replace(/\D/g, ""));
        if (hit) return hit;
      }
      if (nama) {
        const aliases = [...opdLookupAliases(nama)];
        for (const alias of aliases) {
          const hit = opdByName.get(alias);
          if (typeof hit === "number") return hit;
        }

        const looseHits = new Set<number>();
        for (const alias of aliases) {
          if (alias.length < 8) continue;
          for (const candidate of opdNameAliases) {
            if (candidate.key.length < 8) continue;
            if (candidate.key.includes(alias) || alias.includes(candidate.key)) {
              looseHits.add(candidate.id);
              if (looseHits.size > 1) return null;
            }
          }
        }
        if (looseHits.size === 1) return [...looseHits][0];
      }
      return null;
    };

    // --- 1. OPD masterfile -----------------------------------------------
    const insertOpd = database.prepare(
      `INSERT INTO opd (nama, wilayah_id, jenis_instansi, npwp_opd, nama_bendahara, hp_bendahara, nama_pic_kepeg, hp_pic_kepeg, ar_id, tanggal_input, tanggal_update_kontak)
       VALUES (?, ?, ?, ?, 'Belum diisi', '-', 'Belum diisi', '-', ?, ?, ?)`,
    );
    const createMinimalOpd = (nama: string | null, npwp: string | null, wilayah: string | null): number | null => {
      const cleanNama = (nama ?? "").trim();
      if (!cleanNama) return null;
      const npwpDigits = npwp ? npwp.replace(/\D/g, "") : null;
      const wilayahId = ensureWilayah(wilayah);
      const id = Number(insertOpd.run(cleanNama, wilayahId, "OPD", npwp, null, today, today).lastInsertRowid);
      registerOpdName(cleanNama, id);
      if (npwpDigits) opdByNpwp.set(npwpDigits, id);
      result.opd_created += 1;
      return id;
    };
    const insertOpdMaster = database.prepare(
      `INSERT INTO opd (
         nama, wilayah_id, jenis_instansi, npwp_opd, status_pemungut_ppn,
         nama_bendahara, nip_bendahara, hp_bendahara, email_bendahara,
         nama_bendahara_penerimaan, hp_bendahara_penerimaan,
         nama_pic_kepeg, hp_pic_kepeg, ar_id, status, tanggal_input, tanggal_update_kontak
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateOpdMaster = database.prepare(
      `UPDATE opd SET
         wilayah_id = ?,
         jenis_instansi = COALESCE(?, jenis_instansi),
         ar_id = COALESCE(?, ar_id),
         status_pemungut_ppn = COALESCE(?, status_pemungut_ppn),
         nama_bendahara = COALESCE(?, nama_bendahara),
         nip_bendahara = COALESCE(?, nip_bendahara),
         hp_bendahara = COALESCE(?, hp_bendahara),
         email_bendahara = COALESCE(?, email_bendahara),
         nama_bendahara_penerimaan = COALESCE(?, nama_bendahara_penerimaan),
         hp_bendahara_penerimaan = COALESCE(?, hp_bendahara_penerimaan),
         nama_pic_kepeg = COALESCE(?, nama_pic_kepeg),
         hp_pic_kepeg = COALESCE(?, hp_pic_kepeg),
         status = COALESCE(?, status),
         tanggal_input = COALESCE(tanggal_input, ?),
         tanggal_update_kontak = COALESCE(?, tanggal_update_kontak)
       WHERE id = ?`,
    );
    payload.opd.forEach((row) => {
      const npwpDigits = row.npwp ? row.npwp.replace(/\D/g, "") : null;
      const wilayahId = ensureWilayah(row.wilayah);
      const arId = ensureAr(row.ar_nama, row.ar_nip);
      const existing = resolveOpd(row.npwp, row.nama);
      if (existing) {
        updateOpdMaster.run(
          wilayahId,
          row.jenis_instansi,
          arId,
          row.status_pemungut_ppn,
          row.nama_bendahara,
          row.nip_bendahara,
          row.hp_bendahara,
          row.email_bendahara,
          row.nama_bendahara_penerimaan,
          row.hp_bendahara_penerimaan,
          row.nama_pic_kepeg,
          row.hp_pic_kepeg,
          row.status,
          row.tanggal_input ?? today,
          row.tanggal_update_kontak,
          existing,
        );
        result.opd_updated += 1;
      } else {
        const id = Number(
          insertOpdMaster.run(
            row.nama,
            wilayahId,
            row.jenis_instansi,
            row.npwp,
            row.status_pemungut_ppn ?? "TIDAK",
            row.nama_bendahara ?? "Belum diisi",
            row.nip_bendahara,
            row.hp_bendahara ?? "-",
            row.email_bendahara,
            row.nama_bendahara_penerimaan,
            row.hp_bendahara_penerimaan,
            row.nama_pic_kepeg ?? "Belum diisi",
            row.hp_pic_kepeg ?? "-",
            arId,
            row.status ?? "aktif",
            row.tanggal_input ?? today,
            row.tanggal_update_kontak ?? today,
          ).lastInsertRowid,
        );
        registerOpdName(row.nama, id);
        if (npwpDigits) opdByNpwp.set(npwpDigits, id);
        result.opd_created += 1;
      }
    });

    // --- 2. PPh 21 (setoran) ---------------------------------------------
    const upsertPph21 = database.prepare(
      `INSERT INTO pph21_monitoring (opd_id, bulan, jumlah_dipotong, nominal_setor, estimasi_wajar, ketepatan, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(opd_id, bulan) DO UPDATE SET
         jumlah_dipotong = excluded.jumlah_dipotong,
         nominal_setor = excluded.nominal_setor,
         estimasi_wajar = excluded.estimasi_wajar,
         ketepatan = excluded.ketepatan,
         status = excluded.status`,
    );
    payload.pph21.forEach((row) => {
      const opdId = resolveOpd(row.npwp, row.nama_opd);
      if (!opdId) {
        addSkip("Setoran PPh 21: OPD tidak ditemukan.");
        return;
      }
      upsertPph21.run(
        opdId,
        row.bulan,
        Math.round(row.jumlah_dipotong),
        Math.round(row.nominal_setor),
        Math.round(row.estimasi_wajar),
        row.ketepatan,
        row.status,
      );
      result.pph21 += 1;
    });

    // --- 3. Deposit -------------------------------------------------------
    const upsertDeposit = database.prepare(
      `INSERT INTO deposit_monitoring (opd_id, masa_pajak, deposit_kd_411618, total_deposit)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(opd_id, masa_pajak) DO UPDATE SET
         deposit_pph21 = 0,
         deposit_pph_unifikasi = 0,
         deposit_ppn_put = 0,
         deposit_kd_411618 = excluded.deposit_kd_411618,
         total_deposit = excluded.total_deposit`,
    );
    payload.deposit.forEach((row) => {
      const opdId = resolveOpd(row.npwp, row.nama_opd);
      if (!opdId) {
        addSkip("Deposit: OPD tidak ditemukan.");
        return;
      }
      const deposit = Math.round(row.deposit_kd_411618);
      upsertDeposit.run(opdId, row.masa_pajak, deposit, deposit);
      result.deposit += 1;
    });

    // --- 4. SPT Masa (pelaporan) -----------------------------------------
    const upsertSptMasa = database.prepare(
      `INSERT INTO spt_masa_monitoring (
         opd_id, masa_pajak, pph21_status, pph22_nominal, pph22_status,
         pph23_nominal, pph23_status, ppn_put_nominal, ppn_put_status, status_keseluruhan
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(opd_id, masa_pajak) DO UPDATE SET
         pph21_status = COALESCE(excluded.pph21_status, pph21_status),
         pph22_nominal = CASE WHEN excluded.pph22_nominal <> 0 THEN excluded.pph22_nominal ELSE pph22_nominal END,
         pph22_status = COALESCE(excluded.pph22_status, pph22_status),
         pph23_nominal = CASE WHEN excluded.pph23_nominal <> 0 THEN excluded.pph23_nominal ELSE pph23_nominal END,
         pph23_status = COALESCE(excluded.pph23_status, pph23_status),
         ppn_put_nominal = CASE WHEN excluded.ppn_put_nominal <> 0 THEN excluded.ppn_put_nominal ELSE ppn_put_nominal END,
         ppn_put_status = COALESCE(excluded.ppn_put_status, ppn_put_status)`,
    );
    payload.sptMasa.forEach((row) => {
      const opdId = resolveOpd(row.npwp, row.nama_opd);
      if (!opdId) {
        addSkip("SPT Masa: OPD tidak ditemukan.");
        return;
      }
      upsertSptMasa.run(
        opdId,
        row.masa_pajak,
        row.pph21_status,
        Math.round(row.pph22_nominal),
        row.pph22_status,
        Math.round(row.pph23_nominal),
        row.pph23_status,
        Math.round(row.ppn_put_nominal),
        row.ppn_put_status,
      );
      result.spt_masa += 1;
    });
    if (payload.sptMasa.length > 0) refreshSptMasaOverall(database);

    // --- 5. Pegawai -------------------------------------------------------
    const upsertPegawai = database.prepare(
      `INSERT INTO pegawai (nama, nip, opd_id, jabatan, status_coretax, phone, npwp, nik, email, jenis_kepegawaian)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(nip) DO UPDATE SET
         nama = excluded.nama, opd_id = excluded.opd_id, jabatan = excluded.jabatan,
         status_coretax = excluded.status_coretax,
         phone = excluded.phone, npwp = excluded.npwp, nik = excluded.nik,
         email = excluded.email, jenis_kepegawaian = excluded.jenis_kepegawaian`,
    );
    payload.pegawai.forEach((row) => {
      const opdId = resolveOpd(null, row.opd_nama);
      if (!opdId || !row.nip) {
        addSkip(!opdId ? "Pegawai: OPD tidak ditemukan." : "Pegawai: NIP kosong.");
        return;
      }
      try {
        upsertPegawai.run(
          row.nama,
          row.nip,
          opdId,
          row.jabatan || "Pegawai",
          row.status_coretax ?? "belum_aktivasi",
          row.phone,
          row.npwp,
          row.nik,
          row.email,
          row.jenis_kepegawaian,
        );
        result.pegawai += 1;
      } catch {
        addSkip("Pegawai: gagal disimpan.");
      }
    });

    // --- 6. Sosialisasi ---------------------------------------------------
    const findSosialisasi = database.prepare(
      "SELECT id FROM sosialisasi WHERE opd_id = ? AND tanggal = ? AND COALESCE(tema, '') = COALESCE(?, '')",
    );
    const insertSosialisasi = database.prepare(
      "INSERT INTO sosialisasi (opd_id, tanggal, jumlah_peserta, penyuluh_id, status, tempat, tema) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    payload.sosialisasi.forEach((row) => {
      const opdId = resolveOpd(row.npwp, row.nama_opd) ?? createMinimalOpd(row.nama_opd, row.npwp, row.wilayah);
      if (!opdId) {
        addSkip("Sosialisasi: nama OPD kosong atau tidak valid.");
        return;
      }
      const tanggal = row.tanggal ?? today;
      const status = row.status ?? (row.tanggal ? "sudah" : "belum");
      const penyuluhId = ensureAr(row.penyuluh_nama, row.penyuluh_nip);
      if (findSosialisasi.get(opdId, tanggal, row.tema)) {
        addSkip("Sosialisasi: duplikat OPD, tanggal, dan tema.");
        return;
      }
      insertSosialisasi.run(
        opdId,
        tanggal,
        Math.max(0, Math.round(row.jumlah_peserta)),
        penyuluhId,
        status,
        row.tempat,
        row.tema,
      );
      result.sosialisasi += 1;
    });

    if (importedRowCountForTemplate(result, template) === 0) {
      throw new ImportCommitError(
        `${IMPORT_LABELS[template]} tidak menyimpan baris apa pun. Periksa hasil pratinjau dan alasan baris dilewati.`,
        result,
      );
    }

    const derived = deriveImportedMonitoring(database);
    result.derived_spt = derived.derived_spt;
    result.derived_deposit_status = derived.derived_deposit_status;
    result.derived_spt_masa_status = derived.derived_spt_masa_status;
    result.derived_scoring = derived.derived_scoring;
    markImportCompleted(database, template);

    return result;
  });

  const summary = run();

  createAuditLog({
    actor,
    action: "import",
    entity_type: "opd",
    entity_name: "Import data Excel",
    after: summary,
  });

  return summary;
}
