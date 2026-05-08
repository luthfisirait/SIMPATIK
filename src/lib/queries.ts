import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import type {
  ActionLog,
  BendaharaRecord,
  DepositRecord,
  Notification,
  Opd,
  PegawaiRecord,
  Pph21Record,
  ScoringRecord,
  SosialisasiRecord,
  SptMasaRecord,
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

function latestSptMasaPeriod() {
  return (
    (db().prepare("SELECT MAX(masa_pajak) AS period FROM spt_masa_monitoring").get() as { period: string | null }).period ??
    "2026-03"
  );
}

function latestDepositPeriod() {
  return (
    (db().prepare("SELECT MAX(masa_pajak) AS period FROM deposit_monitoring").get() as { period: string | null }).period ??
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

function auditActorId(actor: AuditActor | undefined) {
  const id = Number(actor?.id ?? 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function createAuditLog(payload: AuditLogPayload) {
  const result = db()
    .prepare(
      `
      INSERT INTO audit_log (
        actor_user_id, actor_name, action, entity_type, entity_id, entity_name, before_json, after_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      auditActorId(payload.actor),
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

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT
        SUM(CASE WHEN p.ketepatan = 'tepat_waktu' THEN 1 ELSE 0 END) AS tepat,
        SUM(CASE WHEN p.ketepatan != 'tepat_waktu' THEN 1 ELSE 0 END) AS belum,
        SUM(CASE WHEN p.status = 'under_reporting' THEN 1 ELSE 0 END) AS under_reporting,
        SUM(p.nominal_setor) AS total_setor
      FROM pph21_monitoring p
      JOIN opd o ON o.id = p.opd_id
      WHERE p.bulan = ? AND (? IS NULL OR o.ar_id = ?)
    `,
    )
    .get(bulan, arFilter, arFilter) as { tepat: number; belum: number; under_reporting: number; total_setor: number };

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, bulan };
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
        m.masa_pajak, m.pph22_nominal, m.pph22_status, m.pph23_nominal, m.pph23_status,
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

export function listDeposit(params: ListParams & { masa?: string; overallStatus?: string } = {}) {
  const database = db();
  const masa = params.masa ?? latestDepositPeriod();
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
    where.push("LOWER(d.status_deposit_overall) = ?");
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
        d.deposit_ppn_put, d.status_ppn_put, d.total_deposit,
        LOWER(COALESCE(d.status_deposit_overall, 'merah')) AS status_deposit_overall
      FROM deposit_monitoring d
      JOIN opd o ON o.id = d.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY CASE LOWER(d.status_deposit_overall) WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, d.total_deposit ASC, o.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as DepositRecord[];

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT LOWER(COALESCE(d.status_deposit_overall, 'merah')) AS status, COUNT(*) AS total,
        COALESCE(SUM(d.total_deposit), 0) AS nominal
      FROM deposit_monitoring d
      JOIN opd o ON o.id = d.opd_id
      WHERE d.masa_pajak = ? AND (? IS NULL OR o.ar_id = ?)
      GROUP BY LOWER(COALESCE(d.status_deposit_overall, 'merah'))
    `,
    )
    .all(masa, arFilter, arFilter) as Array<{ status: string; total: number; nominal: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, masa };
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
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
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

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT p.status_coretax AS status, COUNT(*) AS total
      FROM pegawai p
      JOIN opd o ON o.id = p.opd_id
      WHERE (? IS NULL OR o.ar_id = ?)
      GROUP BY p.status_coretax
    `,
    )
    .all(arFilter, arFilter) as Array<{ status: string; total: number }>;

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
