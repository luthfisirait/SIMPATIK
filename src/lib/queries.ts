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
  PphMasaLaporDetailRow,
  Opd,
  PegawaiRecord,
  Pph21Record,
  ScoringRecord,
  PphMasaPaymentRecord,
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

function depositPenerimaanAmountSql(alias = "d") {
  const prefix = alias ? `${alias}.` : "";
  return `COALESCE(${prefix}nilai_setor, 0)`;
}

function depositStatusForAmountSql(amount: string) {
  return `CASE WHEN ${amount} > 10000000 THEN 'hijau' WHEN ${amount} >= 2000000 THEN 'kuning' ELSE 'merah' END`;
}

function depositStatusSql(alias = "d") {
  return depositStatusForAmountSql(depositAmountSql(alias));
}

function depositPenerimaanStatusSql(alias = "d") {
  return depositStatusForAmountSql(depositPenerimaanAmountSql(alias));
}

// Saldo deposit per OPD: jumlahkan NILAI SETOR (boleh minus) untuk KD MAP 411618,
// dikelompokkan per NPWP16 (opd.id) lintas seluruh masa pajak. Semua OPD masterfile
// ditampilkan; OPD tanpa data penerimaan dianggap bersaldo 0.
function depositSaldoScoredSql(whereClause: string) {
  return `
    WITH base AS (
      SELECT o.id AS id, o.id AS opd_id, o.nama AS opd_nama,
        w.nama AS wilayah_nama, u.nama AS ar_nama,
        COALESCE(SUM(d.nilai_setor), 0) AS total_deposit
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      LEFT JOIN deposit_penerimaan d ON d.opd_id = o.id AND d.kd_map = '411618'
      ${whereClause}
      GROUP BY o.id, o.nama, w.nama, u.nama
    ),
    scored AS (
      SELECT base.*, ${depositStatusForAmountSql("total_deposit")} AS status_deposit_overall
      FROM base
    )
  `;
}

// Kepatuhan SPT Tahunan OP per OPD: ASN & PPPK dari Daftar Pegawai Instansi
// (pegawai.opd_id, relasi NPWP_SATKER = NPWP16), sudah lapor dari Pelaporan SPT
// Tahunan OP (spt_tahunan_op.npwp_pegawai = NPWP pegawai).
function sptTahunanScoredSql(whereClause: string) {
  const pegawaiNpwp = npwpDigitsSql("p.npwp");
  const pegawaiSatker = npwpDigitsSql("p.npwp_satker");
  const opdNpwp = npwpDigitsSql("o.npwp_opd");
  return `
    WITH base AS (
      SELECT o.id AS id, o.id AS opd_id, o.nama AS opd_nama,
        w.nama AS wilayah_nama,
        COALESCE(NULLIF(TRIM(o.nama_ar), ''), u.nama) AS ar_nama,
        COUNT(DISTINCT p.id) AS jumlah_wajib_lapor,
        COUNT(DISTINCT CASE WHEN sto.id IS NOT NULL THEN p.id END) AS jumlah_sudah_lapor
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      LEFT JOIN pegawai p ON p.opd_id = o.id
        OR (${pegawaiSatker} <> '' AND ${pegawaiSatker} = ${opdNpwp})
      LEFT JOIN spt_tahunan_op sto ON ${pegawaiNpwp} <> '' AND sto.npwp_pegawai = ${pegawaiNpwp}
      ${whereClause}
      GROUP BY o.id, o.nama, w.nama, u.nama, o.nama_ar
    ),
    scored AS (
      SELECT base.*,
        CASE WHEN jumlah_wajib_lapor = 0 THEN 0
          ELSE ROUND(jumlah_sudah_lapor * 100.0 / jumlah_wajib_lapor, 1) END AS persen_kepatuhan,
        CASE
          WHEN jumlah_wajib_lapor > 0 AND jumlah_sudah_lapor * 100.0 / jumlah_wajib_lapor >= 70 THEN 'hijau'
          WHEN jumlah_wajib_lapor > 0 AND jumlah_sudah_lapor * 100.0 / jumlah_wajib_lapor >= 40 THEN 'kuning'
          ELSE 'merah' END AS traffic_light
      FROM base
    )
  `;
}

function latestDepositPeriod() {
  const database = db();
  const rawPeriod = (
    database.prepare("SELECT MAX(masa_pajak) AS period FROM deposit_penerimaan WHERE kd_map = '411618'").get() as {
      period: string | null;
    }
  ).period;
  if (rawPeriod) return rawPeriod;

  return (
    (
      database
        .prepare("SELECT MAX(masa_pajak) AS period FROM deposit_monitoring WHERE COALESCE(deposit_kd_411618, 0) <> 0")
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
  | "spt_tahunan_op"
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
  "pelaporan_tahunan_op",
  "pegawai",
  "sosialisasi",
];

const IMPORT_LABELS: Record<ImportTemplateKey, string> = {
  masterfile: "Masterfile Wajib Pajak",
  penerimaan: "Data Penerimaan",
  pelaporan_pph21: "Pelaporan SPT Masa PPh Pasal 21",
  pelaporan_unifikasi: "Pelaporan SPT Masa Unifikasi/PPN",
  pelaporan_tahunan_op: "Pelaporan SPT Tahunan OP",
  pegawai: "Daftar Pegawai Instansi",
  sosialisasi: "Rekam Sosialisasi",
};

function tableCount(database: ReturnType<typeof getDb>, table: CountTable) {
  return (database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
}

export function getDataStatus() {
  const database = db();
  const depositRows = (
    database.prepare("SELECT COUNT(*) AS total FROM deposit_penerimaan WHERE kd_map = '411618'").get() as { total: number }
  ).total;
  const depositMonitoringRows = (
    database
      .prepare("SELECT COUNT(*) AS total FROM deposit_monitoring WHERE COALESCE(deposit_kd_411618, 0) <> 0")
      .get() as { total: number }
  ).total;

  return {
    users: tableCount(database, "users"),
    opd: tableCount(database, "opd"),
    spt: tableCount(database, "spt_monitoring"),
    sptTahunanOp: tableCount(database, "spt_tahunan_op"),
    pph21: tableCount(database, "pph21_monitoring"),
    sptMasa: tableCount(database, "spt_masa_monitoring"),
    deposit: depositRows > 0 ? depositRows : depositMonitoringRows,
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

function sptMasaLaporSudahSql(statusSql: string) {
  return `(
    ${statusSql} NOT LIKE '%belum%'
    AND ${statusSql} NOT LIKE '%nihil%'
    AND ${statusSql} NOT LIKE '%gagal%'
    AND ${statusSql} NOT LIKE '%tidak lapor%'
    AND (
      ${statusSql} LIKE '%tepat%'
      OR ${statusSql} LIKE '%normal%'
      OR ${statusSql} LIKE '%submitted%'
      OR ${statusSql} LIKE '%terlambat%'
      OR ${statusSql} LIKE '%lapor%'
    )
  )`;
}

function pphMasaLaporFilters(params: ListParams) {
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
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

function pphMasaJenisDefinitions() {
  const pph21SudahLapor = sptMasaLaporSudahSql("LOWER(COALESCE(m.pph21_status, ''))");
  const pph22SudahLapor = sptMasaLaporSudahSql("LOWER(COALESCE(m.pph22_status, ''))");
  const pph23SudahLapor = sptMasaLaporSudahSql("LOWER(COALESCE(m.pph23_status, ''))");
  const ppnSudahLapor = sptMasaLaporSudahSql("LOWER(COALESCE(m.ppn_put_status, ''))");

  return [
    {
      key: "pph21",
      jenis: "PPh Pasal 21",
      keterangan: "SPT Masa PPh Pasal 21/26",
      statusSql: "COALESCE(m.pph21_status, 'Belum lapor')",
      sudahLaporSql: pph21SudahLapor,
    },
    {
      key: "unifikasi",
      jenis: "PPh Unifikasi",
      keterangan: "SPT Masa PPh Unifikasi",
      statusSql: "'PPh 22: ' || COALESCE(m.pph22_status, 'Belum lapor') || '; PPh 23: ' || COALESCE(m.pph23_status, 'Belum lapor')",
      sudahLaporSql: `(${pph22SudahLapor} OR ${pph23SudahLapor})`,
    },
    {
      key: "ppn",
      jenis: "PPN",
      keterangan: "SPT Masa PPN bagi Pemungut PPN dan Pihak Lain yang Bukan Merupakan PKP",
      statusSql: "COALESCE(m.ppn_put_status, 'Belum lapor')",
      sudahLaporSql: ppnSudahLapor,
    },
  ];
}

export function getWilayah() {
  return db().prepare("SELECT * FROM wilayah ORDER BY id").all() as Wilayah[];
}

export function getDashboardData() {
  const database = db();
  const fiscalPeriods = collectFiscalPeriods(database);
  const period = fiscalPeriods.at(-1) ?? latestPeriod();
  const pphMonth = latestPphMonth();
  const sptTahunanOpJenis = "SPT Tahunan PPh Wajib Pajak Orang Pribadi";
  const pegawaiNpwp = npwpDigitsSql("p.npwp");
  const sptScored = sptTahunanScoredSql("");

  const spt = database
    .prepare(
      `${sptScored}
      SELECT
        COALESCE(SUM(jumlah_wajib_lapor), 0) AS wajib,
        COALESCE(SUM(jumlah_sudah_lapor), 0) AS sudah,
        CASE
          WHEN COALESCE(SUM(jumlah_wajib_lapor), 0) = 0 THEN 0
          ELSE ROUND(SUM(jumlah_sudah_lapor) * 100.0 / SUM(jumlah_wajib_lapor), 1)
        END AS persen,
        COALESCE(SUM(CASE WHEN jumlah_sudah_lapor > 0 THEN 1 ELSE 0 END), 0) AS opd_sudah
      FROM scored
    `,
    )
    .get() as { wajib: number; sudah: number; persen: number; opd_sudah: number };

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

  const pphMasaSudahLapor = (
    database
      .prepare(
        `
        SELECT COUNT(DISTINCT m.opd_id) AS total
        FROM spt_masa_monitoring m
        WHERE m.masa_pajak = ?
          AND (
            (
              LOWER(COALESCE(m.pph21_status, '')) NOT LIKE '%belum%'
              AND LOWER(COALESCE(m.pph21_status, '')) NOT LIKE '%nihil%'
              AND LOWER(COALESCE(m.pph21_status, '')) NOT LIKE '%gagal%'
              AND LOWER(COALESCE(m.pph21_status, '')) NOT LIKE '%tidak lapor%'
              AND (
                LOWER(COALESCE(m.pph21_status, '')) LIKE '%tepat%'
                OR LOWER(COALESCE(m.pph21_status, '')) LIKE '%normal%'
                OR LOWER(COALESCE(m.pph21_status, '')) LIKE '%submitted%'
                OR LOWER(COALESCE(m.pph21_status, '')) LIKE '%terlambat%'
                OR LOWER(COALESCE(m.pph21_status, '')) LIKE '%lapor%'
              )
            )
            OR (
              LOWER(COALESCE(m.pph22_status, '')) NOT LIKE '%belum%'
              AND LOWER(COALESCE(m.pph22_status, '')) NOT LIKE '%nihil%'
              AND LOWER(COALESCE(m.pph22_status, '')) NOT LIKE '%gagal%'
              AND LOWER(COALESCE(m.pph22_status, '')) NOT LIKE '%tidak lapor%'
              AND (
                LOWER(COALESCE(m.pph22_status, '')) LIKE '%tepat%'
                OR LOWER(COALESCE(m.pph22_status, '')) LIKE '%normal%'
                OR LOWER(COALESCE(m.pph22_status, '')) LIKE '%submitted%'
                OR LOWER(COALESCE(m.pph22_status, '')) LIKE '%terlambat%'
                OR LOWER(COALESCE(m.pph22_status, '')) LIKE '%lapor%'
              )
            )
            OR (
              LOWER(COALESCE(m.pph23_status, '')) NOT LIKE '%belum%'
              AND LOWER(COALESCE(m.pph23_status, '')) NOT LIKE '%nihil%'
              AND LOWER(COALESCE(m.pph23_status, '')) NOT LIKE '%gagal%'
              AND LOWER(COALESCE(m.pph23_status, '')) NOT LIKE '%tidak lapor%'
              AND (
                LOWER(COALESCE(m.pph23_status, '')) LIKE '%tepat%'
                OR LOWER(COALESCE(m.pph23_status, '')) LIKE '%normal%'
                OR LOWER(COALESCE(m.pph23_status, '')) LIKE '%submitted%'
                OR LOWER(COALESCE(m.pph23_status, '')) LIKE '%terlambat%'
                OR LOWER(COALESCE(m.pph23_status, '')) LIKE '%lapor%'
              )
            )
            OR (
              LOWER(COALESCE(m.ppn_put_status, '')) NOT LIKE '%belum%'
              AND LOWER(COALESCE(m.ppn_put_status, '')) NOT LIKE '%nihil%'
              AND LOWER(COALESCE(m.ppn_put_status, '')) NOT LIKE '%gagal%'
              AND LOWER(COALESCE(m.ppn_put_status, '')) NOT LIKE '%tidak lapor%'
              AND (
                LOWER(COALESCE(m.ppn_put_status, '')) LIKE '%tepat%'
                OR LOWER(COALESCE(m.ppn_put_status, '')) LIKE '%normal%'
                OR LOWER(COALESCE(m.ppn_put_status, '')) LIKE '%submitted%'
                OR LOWER(COALESCE(m.ppn_put_status, '')) LIKE '%terlambat%'
                OR LOWER(COALESCE(m.ppn_put_status, '')) LIKE '%lapor%'
              )
            )
          )
      `,
      )
      .get(period) as { total: number }
  ).total;

  const deposit = database
    .prepare(
      `
      SELECT
        COALESCE(SUM(nilai_setor), 0) AS total_deposit,
        COUNT(DISTINCT opd_id) AS opd_deposit
      FROM deposit_penerimaan
      WHERE kd_map = '411618'
    `,
    )
    .get() as { total_deposit: number; opd_deposit: number };

  const totalOpd = (database.prepare("SELECT COUNT(*) AS total FROM opd").get() as { total: number }).total;
  const sudahSos = (
    database
      .prepare("SELECT COUNT(DISTINCT opd_id) AS total FROM sosialisasi WHERE status IN ('sudah','perlu_ulang')")
      .get() as { total: number }
  ).total;
  const totalPeserta = (
    database.prepare("SELECT COALESCE(SUM(jumlah_peserta), 0) AS total FROM sosialisasi WHERE status IN ('sudah','perlu_ulang')").get() as {
      total: number;
    }
  ).total;

  const sptTahunanOpPegawai = database
    .prepare(
      `
      SELECT
        COUNT(*) AS wajib,
        COALESCE(SUM(CASE WHEN EXISTS (
          SELECT 1
          FROM spt_tahunan_op sto
          WHERE sto.npwp_pegawai = ${pegawaiNpwp}
            AND sto.jenis_spt = ?
        ) THEN 1 ELSE 0 END), 0) AS sudah
      FROM pegawai p
    `,
    )
    .get(sptTahunanOpJenis) as { wajib: number; sudah: number };
  const sptTahunanOpPersen =
    sptTahunanOpPegawai.wajib === 0
      ? 0
      : Number(((sptTahunanOpPegawai.sudah * 100) / sptTahunanOpPegawai.wajib).toFixed(1));

  const trendPeriods = (
    database
      .prepare(
        `
        SELECT DISTINCT strftime('%Y-%m', tanggal_terima) AS periode
        FROM spt_tahunan_op
        WHERE jenis_spt = ?
          AND tanggal_terima IS NOT NULL
          AND tanggal_terima <> ''
        ORDER BY periode
      `,
      )
      .all(sptTahunanOpJenis) as Array<{ periode: string }>
  ).map((row) => row.periode);
  const trendStatement = database.prepare(
    `
      SELECT ? AS periode,
        COUNT(DISTINCT sto.npwp_pegawai) AS sudah
      FROM spt_tahunan_op sto
      WHERE sto.jenis_spt = ?
        AND sto.tanggal_terima IS NOT NULL
        AND sto.tanggal_terima <> ''
        AND strftime('%Y-%m', sto.tanggal_terima) = ?
    `,
  );
  const trend = trendPeriods.map((trendPeriod) =>
    trendStatement.get(trendPeriod, sptTahunanOpJenis, trendPeriod),
  ) as Array<{ periode: string; sudah: number }>;

  const wilayahDistribution = database
    .prepare(
      `${sptScored}
      SELECT w.nama,
        CASE
          WHEN COALESCE(SUM(scored.jumlah_wajib_lapor), 0) = 0 THEN 0
          ELSE ROUND(SUM(scored.jumlah_sudah_lapor) * 100.0 / SUM(scored.jumlah_wajib_lapor), 1)
        END AS persen,
        COALESCE(SUM(scored.jumlah_sudah_lapor), 0) AS sudah,
        COALESCE(SUM(scored.jumlah_wajib_lapor), 0) AS wajib,
        COUNT(scored.opd_id) AS opd
      FROM scored
      JOIN opd o ON o.id = scored.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      GROUP BY w.id
      ORDER BY w.id
    `,
    )
    .all() as Array<{ nama: string; persen: number; sudah: number; wajib: number; opd: number }>;

  const trafficCounts = database
    .prepare(
      `${sptScored}
      SELECT traffic_light AS status, COUNT(*) AS total
      FROM scored
      GROUP BY traffic_light
    `,
    )
    .all() as Array<{ status: string; total: number }>;

  const trafficTop = database
    .prepare(
      `${sptScored}
      SELECT id, opd_id, opd_nama, wilayah_nama, ar_nama,
        2025 AS tahun_pajak, ? AS periode, jumlah_wajib_lapor, jumlah_sudah_lapor,
        persen_kepatuhan, traffic_light
      FROM scored
      ORDER BY persen_kepatuhan ASC, opd_nama ASC
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
      sptOpdSudahLapor: spt.opd_sudah,
      sptTahunanOpPegawaiPersen: sptTahunanOpPersen,
      sptTahunanOpPegawaiSudah: sptTahunanOpPegawai.sudah,
      sptTahunanOpPegawaiWajib: sptTahunanOpPegawai.wajib,
      pphBelumSetor: pph.belum,
      pphTepat: pph.tepat,
      pphUnderReporting: pph.under_reporting,
      pphMasaSudahLapor,
      totalSetorPph: pph.total_setor,
      totalDeposit: deposit.total_deposit,
      opdDeposit: deposit.opd_deposit,
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

type SptScoredRow = Omit<SptRecord, "tahun_pajak" | "periode">;

function sptSptTahunanFilters(params: ListParams) {
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(COALESCE(u.nama, '')) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return { whereClause: where.length ? `WHERE ${where.join(" AND ")}` : "", values };
}

export function listSpt(params: ListParams & { periode?: string; traffic?: string } = {}) {
  const database = db();
  const periode = params.periode ?? latestPeriod();
  const { whereClause, values } = sptSptTahunanFilters(params);
  const scored = sptTahunanScoredSql(whereClause);

  const trafficFilter = params.traffic && params.traffic !== "all" ? params.traffic : null;
  const trafficClause = trafficFilter ? "WHERE traffic_light = ?" : "";
  const trafficValues = trafficFilter ? [trafficFilter] : [];

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;

  const total = (
    database
      .prepare(`${scored} SELECT COUNT(*) AS total FROM scored ${trafficClause}`)
      .get(...values, ...trafficValues) as { total: number }
  ).total;

  const rows = database
    .prepare(
      `${scored}
       SELECT id, opd_id, opd_nama, wilayah_nama, ar_nama,
         jumlah_wajib_lapor, jumlah_sudah_lapor, persen_kepatuhan, traffic_light
       FROM scored ${trafficClause}
       ORDER BY persen_kepatuhan ASC, opd_nama ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...values, ...trafficValues, pageSize, offset) as SptScoredRow[];
  const data: SptRecord[] = rows.map((row) => ({ ...row, tahun_pajak: 2025, periode }));

  const summary = database
    .prepare(
      `${scored}
       SELECT traffic_light AS status, COUNT(*) AS total,
         COALESCE(SUM(jumlah_wajib_lapor - jumlah_sudah_lapor), 0) AS belum_lapor
       FROM scored
       GROUP BY traffic_light`,
    )
    .all(...values) as Array<{ status: string; total: number; belum_lapor: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, periode };
}

export function listSptDialogRows(params: ListParams & { periode?: string; traffic?: string } = {}) {
  const database = db();
  const periode = params.periode ?? latestPeriod();
  const { whereClause, values } = sptSptTahunanFilters(params);
  const scored = sptTahunanScoredSql(whereClause);

  const trafficFilter = params.traffic && params.traffic !== "all" ? params.traffic : null;
  const trafficClause = trafficFilter ? "WHERE traffic_light = ?" : "";
  const trafficValues = trafficFilter ? [trafficFilter] : [];

  const rows = database
    .prepare(
      `${scored}
       SELECT id, opd_id, opd_nama, wilayah_nama, ar_nama,
         jumlah_wajib_lapor, jumlah_sudah_lapor, persen_kepatuhan, traffic_light
       FROM scored ${trafficClause}
       ORDER BY persen_kepatuhan ASC, opd_nama ASC`,
    )
    .all(...values, ...trafficValues) as SptScoredRow[];

  return rows.map((row) => ({ ...row, tahun_pajak: 2025, periode })) as SptRecord[];
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

  const laporFilters = pphMasaLaporFilters(params);

  function sptMasaLaporSummary(jenis: string, keterangan: string, sudahLaporSql: string) {
    return database
      .prepare(
        `
        SELECT
          ? AS jenis,
          ? AS keterangan,
          COUNT(o.id) AS wajib_lapor,
          COALESCE(SUM(CASE WHEN ${sudahLaporSql} THEN 1 ELSE 0 END), 0) AS sudah_lapor,
          COUNT(o.id) - COALESCE(SUM(CASE WHEN ${sudahLaporSql} THEN 1 ELSE 0 END), 0) AS belum_lapor
        FROM opd o
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        LEFT JOIN spt_masa_monitoring m ON m.opd_id = o.id AND m.masa_pajak = ?
        ${laporFilters.clause}
      `,
      )
      .get(jenis, keterangan, bulan, ...laporFilters.values) as PphMasaJenisSummary;
  }

  const jenisSummary = pphMasaJenisDefinitions().map((definition) => sptMasaLaporSummary(definition.jenis, definition.keterangan, definition.sudahLaporSql));

  return { data, summary, jenisSummary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, bulan };
}

function pphMasaPaymentFilters(params: ListParams) {
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(o.nama_bendahara) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return {
    clause: where.length ? `AND ${where.join(" AND ")}` : "",
    values,
  };
}

function pphMasaPaymentSql(filterClause: string) {
  return `
    WITH rows AS (
      SELECT
        'pph21-' || p.id AS id,
        o.id AS opd_id,
        o.nama AS opd_nama,
        w.nama AS wilayah_nama,
        u.nama AS ar_nama,
        o.nama_bendahara,
        p.bulan,
        'PPh Pasal 21' AS jenis_pph,
        COALESCE(p.nominal_setor, 0) AS jumlah_pembayaran,
        1 AS jenis_order
      FROM pph21_monitoring p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE p.bulan = ?
      ${filterClause}

      UNION ALL

      SELECT
        'unifikasi-' || m.id AS id,
        o.id AS opd_id,
        o.nama AS opd_nama,
        w.nama AS wilayah_nama,
        u.nama AS ar_nama,
        o.nama_bendahara,
        m.masa_pajak AS bulan,
        'PPh Unifikasi' AS jenis_pph,
        COALESCE(m.pph22_nominal, 0) + COALESCE(m.pph23_nominal, 0) AS jumlah_pembayaran,
        2 AS jenis_order
      FROM spt_masa_monitoring m
      JOIN opd o ON o.id = m.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE m.masa_pajak = ?
      ${filterClause}

      UNION ALL

      SELECT
        'ppn-' || m.id AS id,
        o.id AS opd_id,
        o.nama AS opd_nama,
        w.nama AS wilayah_nama,
        u.nama AS ar_nama,
        o.nama_bendahara,
        m.masa_pajak AS bulan,
        'PPN' AS jenis_pph,
        COALESCE(m.ppn_put_nominal, 0) AS jumlah_pembayaran,
        3 AS jenis_order
      FROM spt_masa_monitoring m
      JOIN opd o ON o.id = m.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      WHERE m.masa_pajak = ?
      ${filterClause}
    )
  `;
}

function repeatedPphMasaPaymentValues(bulan: string, filterValues: Array<string | number>) {
  return [bulan, ...filterValues, bulan, ...filterValues, bulan, ...filterValues];
}

export function listPphMasaLaporDetailRows(params: ListParams & { bulan?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestPphMonth();
  const filters = pphMasaLaporFilters(params);

  return pphMasaJenisDefinitions().flatMap((definition) =>
    database
      .prepare(
        `
        SELECT
          ? || '-' || o.id AS id,
          o.id AS opd_id,
          o.nama AS opd_nama,
          w.nama AS wilayah_nama,
          u.nama AS ar_nama,
          o.nama_bendahara,
          ? AS jenis,
          ${definition.statusSql} AS status_lapor,
          CASE WHEN ${definition.sudahLaporSql} THEN 'sudah_lapor' ELSE 'belum_lapor' END AS status
        FROM opd o
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        LEFT JOIN spt_masa_monitoring m ON m.opd_id = o.id AND m.masa_pajak = ?
        ${filters.clause}
        ORDER BY o.nama
      `,
      )
      .all(definition.key, definition.jenis, bulan, ...filters.values) as PphMasaLaporDetailRow[],
  );
}

export function listPphMasaPayments(params: ListParams & { bulan?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestPphMonth();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const filters = pphMasaPaymentFilters(params);
  const baseSql = pphMasaPaymentSql(filters.clause);
  const values = repeatedPphMasaPaymentValues(bulan, filters.values);
  const aggregate = database.prepare(`${baseSql} SELECT COUNT(*) AS total, COALESCE(SUM(jumlah_pembayaran), 0) AS total_setor FROM rows`).get(...values) as {
    total: number;
    total_setor: number;
  };
  const data = database
    .prepare(
      `
      ${baseSql}
      SELECT id, opd_id, opd_nama, wilayah_nama, ar_nama, nama_bendahara, bulan, jenis_pph, jumlah_pembayaran
      FROM rows
      ORDER BY CASE WHEN jumlah_pembayaran > 0 THEN 0 ELSE 1 END, opd_nama, jenis_order
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as PphMasaPaymentRecord[];

  return { data, total: aggregate.total, totalSetor: aggregate.total_setor, page, pageSize, pages: Math.ceil(aggregate.total / pageSize) || 1, bulan };
}

export function listPphMasaPaymentDialogRows(params: ListParams & { bulan?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestPphMonth();
  const filters = pphMasaPaymentFilters(params);
  const values = repeatedPphMasaPaymentValues(bulan, filters.values);

  return database
    .prepare(
      `
      ${pphMasaPaymentSql(filters.clause)}
      SELECT id, opd_id, opd_nama, wilayah_nama, ar_nama, nama_bendahara, bulan, jenis_pph, jumlah_pembayaran
      FROM rows
      ORDER BY CASE WHEN jumlah_pembayaran > 0 THEN 0 ELSE 1 END, opd_nama, jenis_order
    `,
    )
    .all(...values) as PphMasaPaymentRecord[];
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
    `,
    )
    .all(...values) as SptMasaRecord[];
}

function depositSaldoFilters(params: ListParams) {
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(COALESCE(d.nama_wajib_pajak, '')) LIKE ? OR LOWER(COALESCE(u.nama, '')) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
  }
  if (params.ar && params.ar !== "all") {
    where.push("o.ar_id = ?");
    values.push(Number(params.ar));
  }

  return { whereClause: where.length ? `WHERE ${where.join(" AND ")}` : "", values };
}

function mapDepositSaldoRow(row: {
  id: number;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  total_deposit: number;
  status_deposit_overall: string;
}, masa: string): DepositRecord {
  return {
    id: row.id,
    opd_id: row.opd_id,
    opd_nama: row.opd_nama,
    wilayah_nama: row.wilayah_nama,
    ar_nama: row.ar_nama,
    masa_pajak: masa,
    deposit_pph21: 0,
    status_pph21: null,
    deposit_pph_unifikasi: 0,
    status_unifikasi: null,
    deposit_ppn_put: 0,
    status_ppn_put: null,
    deposit_kd_411618: row.total_deposit,
    total_deposit: row.total_deposit,
    status_deposit_overall: row.status_deposit_overall,
  };
}

export function listDeposit(params: ListParams & { masa?: string; overallStatus?: string } = {}) {
  const database = db();
  const masa = params.masa ?? latestDepositPeriod();
  const { whereClause, values } = depositSaldoFilters(params);
  const scored = depositSaldoScoredSql(whereClause);

  const statusFilter = params.overallStatus && params.overallStatus !== "all" ? params.overallStatus.toLowerCase() : null;
  const statusClause = statusFilter ? "WHERE status_deposit_overall = ?" : "";
  const statusValues = statusFilter ? [statusFilter] : [];

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;

  const total = (
    database
      .prepare(`${scored} SELECT COUNT(*) AS total FROM scored ${statusClause}`)
      .get(...values, ...statusValues) as { total: number }
  ).total;

  const rows = database
    .prepare(
      `${scored}
       SELECT id, opd_id, opd_nama, wilayah_nama, ar_nama, total_deposit, status_deposit_overall
       FROM scored ${statusClause}
        ORDER BY CASE status_deposit_overall WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, total_deposit ASC, opd_nama
        LIMIT ? OFFSET ?`,
    )
    .all(...values, ...statusValues, pageSize, offset) as Parameters<typeof mapDepositSaldoRow>[0][];
  const data = rows.map((row) => mapDepositSaldoRow(row, masa));

  const summary = database
    .prepare(
      `${scored}
       SELECT status_deposit_overall AS status, COUNT(*) AS total, COALESCE(SUM(total_deposit), 0) AS nominal
       FROM scored
       GROUP BY status_deposit_overall`,
    )
    .all(...values) as Array<{ status: string; total: number; nominal: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, masa };
}

export function listDepositDialogRows(params: ListParams & { masa?: string; overallStatus?: string } = {}) {
  const database = db();
  const masa = params.masa ?? latestDepositPeriod();
  const { whereClause, values } = depositSaldoFilters(params);
  const scored = depositSaldoScoredSql(whereClause);

  const statusFilter = params.overallStatus && params.overallStatus !== "all" ? params.overallStatus.toLowerCase() : null;
  const statusClause = statusFilter ? "WHERE status_deposit_overall = ?" : "";
  const statusValues = statusFilter ? [statusFilter] : [];

  const rows = database
    .prepare(
      `${scored}
       SELECT id, opd_id, opd_nama, wilayah_nama, ar_nama, total_deposit, status_deposit_overall
       FROM scored ${statusClause}
        ORDER BY CASE status_deposit_overall WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, total_deposit ASC, opd_nama`,
    )
    .all(...values, ...statusValues) as Parameters<typeof mapDepositSaldoRow>[0][];

  return rows.map((row) => mapDepositSaldoRow(row, masa));
}

export function listScoring(params: ListParams & { bulan?: string; kategori?: string; statusRp?: string } = {}) {
  const database = db();
  const bulan = params.bulan ?? latestScoringPeriod();
  const where = ["s.bulan_scoring = ?"];
  const values: Array<string | number> = [bulan];
  const summaryWhere = ["s.bulan_scoring = ?"];
  const summaryValues: Array<string | number> = [bulan];

  if (params.q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    summaryWhere.push("(LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q);
    summaryValues.push(q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    values.push(params.wilayah);
    summaryWhere.push("w.kode = ?");
    summaryValues.push(params.wilayah);
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
    summaryWhere.push("o.ar_id = ?");
    summaryValues.push(Number(params.ar));
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const clause = `WHERE ${where.join(" AND ")}`;
  const summaryClause = `WHERE ${summaryWhere.join(" AND ")}`;

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

  const summary = database
    .prepare(
      `
      SELECT s.kategori, s.status_rp, COUNT(*) AS total, ROUND(AVG(s.skor_total), 1) AS avg_score
      FROM scoring_opd s
      JOIN opd o ON o.id = s.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${summaryClause}
      GROUP BY s.kategori, s.status_rp
    `,
    )
    .all(...summaryValues) as Array<{ kategori: string; status_rp: string; total: number; avg_score: number }>;

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
      ${summaryClause} AND s.status_rp = 'reward'
      ORDER BY s.skor_total DESC, o.nama
      LIMIT 5
    `,
    )
    .all(...summaryValues) as ScoringRecord[];

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
      ${summaryClause} AND s.status_rp = 'punishment'
      ORDER BY s.skor_total ASC, o.nama
      LIMIT 10
    `,
    )
    .all(...summaryValues) as ScoringRecord[];

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
    where.push("(LOWER(base.opd_nama) LIKE ? OR LOWER(COALESCE(base.penyuluh_nama, '')) LIKE ? OR LOWER(COALESCE(base.ar_nama, '')) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("base.wilayah_kode = ?");
    values.push(params.wilayah);
  }
  if (params.status && params.status !== "all") {
    where.push("base.status = ?");
    values.push(params.status);
  }
  if (params.ar && params.ar !== "all") {
    where.push("base.ar_id = ?");
    values.push(Number(params.ar));
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const baseSql = `
    WITH sos_summary AS (
      SELECT opd_id,
        COUNT(CASE WHEN status IN ('sudah', 'perlu_ulang') THEN 1 END) AS sesi,
        COALESCE(SUM(CASE WHEN status IN ('sudah', 'perlu_ulang') THEN jumlah_peserta ELSE 0 END), 0) AS peserta,
        COALESCE(SUM(CASE WHEN status = 'sudah' THEN 1 ELSE 0 END), 0) AS sudah,
        COALESCE(SUM(CASE WHEN status = 'perlu_ulang' THEN 1 ELSE 0 END), 0) AS perlu_ulang
      FROM sosialisasi
      GROUP BY opd_id
    ),
    latest AS (
      SELECT id, opd_id, tanggal, jumlah_peserta, penyuluh_id, status, tempat, tema
      FROM (
        SELECT s.*,
          ROW_NUMBER() OVER (
            PARTITION BY s.opd_id
            ORDER BY CASE WHEN s.status IN ('sudah', 'perlu_ulang') THEN 0 ELSE 1 END, s.tanggal DESC, s.id DESC
          ) AS row_number
        FROM sosialisasi s
      )
      WHERE row_number = 1
    ),
    base AS (
      SELECT o.id, o.id AS opd_id, o.nama AS opd_nama, w.nama AS wilayah_nama, w.kode AS wilayah_kode,
        COALESCE(latest.tanggal, '-') AS tanggal,
        COALESCE(sos_summary.peserta, 0) AS jumlah_peserta,
        latest.penyuluh_id,
        penyuluh.nama AS penyuluh_nama,
        CASE
          WHEN COALESCE(sos_summary.perlu_ulang, 0) > 0 THEN 'perlu_ulang'
          WHEN COALESCE(sos_summary.sudah, 0) > 0 THEN 'sudah'
          ELSE 'belum'
        END AS status,
        latest.tempat,
        latest.tema,
        o.ar_id,
        ar.nama AS ar_nama,
        COALESCE(sos_summary.sesi, 0) AS sesi
      FROM opd o
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN sos_summary ON sos_summary.opd_id = o.id
      LEFT JOIN latest ON latest.opd_id = o.id
      LEFT JOIN users penyuluh ON penyuluh.id = latest.penyuluh_id
      LEFT JOIN users ar ON ar.id = o.ar_id
    )
  `;
  const total = (
    database
      .prepare(
        `${baseSql}
        SELECT COUNT(*) AS total
        FROM base
        ${clause}`,
      )
      .get(...values) as { total: number }
  ).total;

  const data = database
    .prepare(
      `${baseSql}
      SELECT id, opd_id, opd_nama, wilayah_nama,
        tanggal, jumlah_peserta, penyuluh_id, penyuluh_nama, status,
        tempat, tema
      FROM base
      ${clause}
      ORDER BY CASE status WHEN 'belum' THEN 1 WHEN 'perlu_ulang' THEN 2 ELSE 3 END, opd_nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as SosialisasiRecord[];

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT
        COUNT(CASE WHEN s.status IN ('sudah', 'perlu_ulang') THEN 1 END) AS sesi,
        COUNT(DISTINCT CASE WHEN s.status IN ('sudah', 'perlu_ulang') THEN s.opd_id END) AS sudah,
        COALESCE(SUM(CASE WHEN s.status IN ('sudah', 'perlu_ulang') THEN s.jumlah_peserta ELSE 0 END), 0) AS peserta
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
      WHERE NOT EXISTS (SELECT 1 FROM sosialisasi s WHERE s.opd_id = o.id AND s.status IN ('sudah', 'perlu_ulang'))
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
  const sessionWhere: string[] = ["s.status IN ('sudah', 'perlu_ulang')"];
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
      JOIN sosialisasi s ON s.opd_id = o.id AND s.status IN ('sudah', 'perlu_ulang')
      WHERE 1 = 1 ${opdBaseClause}
      GROUP BY o.id, o.nama, w.nama, ar.nama, o.jumlah_asn
      ORDER BY sesi DESC, peserta DESC, o.nama
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
      WHERE NOT EXISTS (SELECT 1 FROM sosialisasi s WHERE s.opd_id = o.id AND s.status IN ('sudah', 'perlu_ulang')) ${opdBaseClause}
      ORDER BY o.jumlah_asn DESC, o.nama
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
  const sptTahunanStatus = pegawaiSptTahunanStatusSql();
  const where = params.includeSudah ? [] : [`${sptTahunanStatus} != 'sudah_lapor'`];
  const values: Array<string | number> = [];
  const summaryWhere: string[] = [];
  const summaryValues: Array<string | number> = [];

  if (params.q) {
    where.push("(LOWER(p.nama) LIKE ? OR p.nip LIKE ? OR p.npwp LIKE ? OR LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    summaryWhere.push("(LOWER(p.nama) LIKE ? OR p.nip LIKE ? OR p.npwp LIKE ? OR LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
    const q = `%${params.q.toLowerCase()}%`;
    values.push(q, `%${params.q}%`, `%${params.q}%`, q, q);
    summaryValues.push(q, `%${params.q}%`, `%${params.q}%`, q, q);
  }
  if (params.wilayah && params.wilayah !== "all") {
    where.push("w.kode = ?");
    summaryWhere.push("w.kode = ?");
    values.push(params.wilayah);
    summaryValues.push(params.wilayah);
  }
  if (params.status && params.status !== "all") {
    where.push(`${sptTahunanStatus} = ?`);
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
        p.jabatan, ${sptTahunanStatus} AS status_coretax, u.nama AS ar_nama, p.phone,
        p.npwp, p.nik, p.email, p.jenis_kepegawaian
      FROM pegawai p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${clause}
      ORDER BY CASE ${sptTahunanStatus} WHEN 'aktif_belum_lapor' THEN 1 ELSE 2 END, w.id, p.nama
      LIMIT ? OFFSET ?
    `,
    )
    .all(...values, pageSize, offset) as PegawaiRecord[];

  const arFilter = params.ar && params.ar !== "all" ? Number(params.ar) : null;
  const summary = database
    .prepare(
      `
      SELECT ${sptTahunanStatus} AS status, COUNT(*) AS total
      FROM pegawai p
      JOIN opd o ON o.id = p.opd_id
      JOIN wilayah w ON w.id = o.wilayah_id
      LEFT JOIN users u ON u.id = o.ar_id
      ${summaryClause}
      GROUP BY ${sptTahunanStatus}
    `,
    )
    .all(...summaryValues) as Array<{ status: string; total: number }>;

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1 };
}

function npwpDigitsSql(expression: string) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${expression}, ''), '.', ''), '-', ''), '/', ''), ' ', '')`;
}

function pegawaiSptTahunanStatusSql() {
  const npwp = npwpDigitsSql("p.npwp");
  return `CASE
    WHEN ${npwp} <> ''
      AND EXISTS (
        SELECT 1
        FROM spt_tahunan_op sto
        WHERE sto.npwp_pegawai = ${npwp}
      )
    THEN 'sudah_lapor'
    ELSE 'aktif_belum_lapor'
  END`;
}

export function listAr() {
  return db()
    .prepare(
      `
      SELECT u.id, MIN(COALESCE(NULLIF(TRIM(o.nama_ar), ''), u.nama)) AS nama,
        u.email, u.nip, u.jabatan, u.role, u.phone, u.avatar_color, u.status,
        COUNT(DISTINCT o.id) AS opd_count,
        ROUND(AVG(s.persen_kepatuhan), 1) AS avg_kepatuhan
      FROM users u
      JOIN opd o ON o.ar_id = u.id
      LEFT JOIN spt_monitoring s ON s.opd_id = o.id AND s.tahun_pajak = 2025 AND s.periode = (SELECT MAX(periode) FROM spt_monitoring WHERE tahun_pajak = 2025)
      WHERE u.role = 'ar'
      GROUP BY u.id
      ORDER BY nama
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
  const summary = database
    .prepare(
      `
        SELECT
          COALESCE(SUM(CASE WHEN NULLIF(TRIM(COALESCE(o.email_bendahara, '')), '') IS NOT NULL THEN 1 ELSE 0 END), 0) AS withEmail,
          COALESCE(SUM(CASE
            WHEN NULLIF(TRIM(COALESCE(o.nama_bendahara_penerimaan, '')), '') IS NOT NULL
              OR NULLIF(TRIM(COALESCE(o.hp_bendahara_penerimaan, '')), '') IS NOT NULL
            THEN 1 ELSE 0 END), 0) AS withPenerimaan
        FROM opd o
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${clause}
      `,
    )
    .get(...values) as { withEmail: number; withPenerimaan: number };

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

  return { data, summary, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1, pphMonth, scoringPeriod };
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
  const sptScored = sptTahunanScoredSql("");
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
      `${sptScored}
      SELECT
        CASE WHEN EXISTS (SELECT 1 FROM sosialisasi so WHERE so.opd_id = scored.opd_id AND so.status IN ('sudah','perlu_ulang')) THEN 1 ELSE 0 END AS sosialisasi,
        scored.persen_kepatuhan AS kepatuhan,
        scored.jumlah_wajib_lapor AS asn,
        scored.opd_nama AS nama
      FROM scored
      ORDER BY scored.opd_id
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

function importNpwpDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
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
        database.prepare("SELECT 1 FROM deposit_penerimaan WHERE kd_map = '411618' LIMIT 1").get() !== undefined ||
        database.prepare("SELECT 1 FROM deposit_monitoring WHERE COALESCE(deposit_kd_411618, 0) <> 0 LIMIT 1").get() !==
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
    case "pelaporan_tahunan_op":
      return tableCount(database, "spt_tahunan_op") > 0;
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
    case "pelaporan_tahunan_op":
      return result.spt_tahunan_op;
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
      SELECT masa_pajak AS period FROM deposit_penerimaan
      UNION
      SELECT masa_pajak AS period FROM deposit_monitoring
      UNION
      SELECT masa_pajak AS period FROM spt_masa_monitoring
      UNION
      SELECT masa_pajak AS period FROM spt_tahunan_op
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
      FROM deposit_penerimaan
      WHERE kd_map = '411618'
      UNION
      SELECT masa_pajak AS period
      FROM deposit_monitoring
      WHERE COALESCE(deposit_kd_411618, 0) <> 0
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

  const selectRows = database.prepare(
    `
      SELECT o.id AS opd_id,
        COUNT(p.id) AS wajib,
        COALESCE(SUM(CASE
          WHEN ${npwpDigitsSql("p.npwp")} <> ''
            AND EXISTS (
              SELECT 1
              FROM spt_tahunan_op sto
              WHERE sto.npwp_pegawai = ${npwpDigitsSql("p.npwp")}
            )
          THEN 1 ELSE 0 END), 0) AS sudah
      FROM opd o
      LEFT JOIN pegawai p ON p.opd_id = o.id
      GROUP BY o.id
    `,
  );

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
    const rows = selectRows.all() as Array<{ opd_id: number; wajib: number; sudah: number }>;
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
    case "masterfile": {
      // Masterfile = titik awal data: reset penuh semua data hasil import
      // (daftar pegawai instansi, pelaporan, penerimaan, deposit, sosialisasi, scoring)
      // sebelum OPD ditulis ulang. Data pengguna/wilayah/action_log tetap dipertahankan.
      return (
        database.prepare("DELETE FROM spt_tahunan_op").run().changes +
        database.prepare("DELETE FROM spt_monitoring").run().changes +
        database.prepare("DELETE FROM pph21_monitoring").run().changes +
        database.prepare("DELETE FROM spt_masa_monitoring").run().changes +
        database.prepare("DELETE FROM deposit_penerimaan").run().changes +
        database.prepare("DELETE FROM deposit_monitoring").run().changes +
        database.prepare("DELETE FROM scoring_opd").run().changes +
        database.prepare("DELETE FROM sosialisasi").run().changes +
        database.prepare("DELETE FROM pegawai").run().changes +
        database.prepare("DELETE FROM opd").run().changes
      );
    }
    case "penerimaan": {
      const cleared =
        database.prepare("DELETE FROM pph21_monitoring").run().changes +
        database.prepare("DELETE FROM deposit_penerimaan").run().changes +
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
    case "pelaporan_tahunan_op":
      return database.prepare("DELETE FROM spt_tahunan_op").run().changes;
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
      spt_tahunan_op: 0,
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
    const registerOpdName = (nama: string, id: number) => {
      opdLookupAliases(nama).forEach((key) => {
        const existing = opdByName.get(key);
        if (existing === undefined) {
          opdByName.set(key, id);
        } else if (existing !== id) {
          opdByName.set(key, null);
        }
      });
    };
    (database.prepare("SELECT id, nama, npwp_opd FROM opd").all() as Array<{ id: number; nama: string; npwp_opd: string | null }>).forEach((o) => {
      registerOpdName(o.nama, o.id);
      const npwp = importNpwpDigits(o.npwp_opd);
      if (npwp) opdByNpwp.set(npwp, o.id);
    });
    const resolveOpd = (npwp: string | null, nama: string | null): number | null => {
      const digits = importNpwpDigits(npwp);
      if (digits) {
        const hit =
          opdByNpwp.get(digits) ??
          (digits.length === 15 ? opdByNpwp.get(`0${digits}`) : undefined) ??
          (digits.length === 16 && digits.startsWith("0") ? opdByNpwp.get(digits.slice(1)) : undefined);
        if (hit) return hit;
        return null;
      }
      if (nama) {
        const aliases = [...opdLookupAliases(nama)];
        for (const alias of aliases) {
          const hit = opdByName.get(alias);
          if (typeof hit === "number") return hit;
        }
      }
      return null;
    };

    // --- 1. OPD masterfile -----------------------------------------------
    const insertOpdMaster = database.prepare(
      `INSERT INTO opd (
         nama, wilayah_id, jenis_instansi, npwp_opd, status_pemungut_ppn,
         nama_bendahara, nip_bendahara, hp_bendahara, email_bendahara,
         nama_bendahara_penerimaan, hp_bendahara_penerimaan,
         nama_pic_kepeg, hp_pic_kepeg, ar_id, nama_ar, status, tanggal_input, tanggal_update_kontak
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateOpdMaster = database.prepare(
      `UPDATE opd SET
         nama = ?,
         wilayah_id = ?,
         jenis_instansi = COALESCE(?, jenis_instansi),
         npwp_opd = COALESCE(?, npwp_opd),
         ar_id = COALESCE(?, ar_id),
         nama_ar = COALESCE(?, nama_ar),
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
      const npwpDigits = importNpwpDigits(row.npwp);
      const wilayahId = ensureWilayah(row.wilayah);
      const arId = ensureAr(row.ar_nama, row.ar_nip);
      const existing = resolveOpd(row.npwp, row.nama);
      if (existing) {
        updateOpdMaster.run(
          row.nama,
          wilayahId,
          row.jenis_instansi,
          row.npwp,
          arId,
          row.ar_nama,
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
        registerOpdName(row.nama, existing);
        if (npwpDigits) opdByNpwp.set(npwpDigits, existing);
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
            row.ar_nama ?? null,
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
    const insertDepositRow = database.prepare(
      `INSERT INTO deposit_penerimaan (
         opd_id, npwp, nama_wajib_pajak, masa_pajak, kd_map, kd_setor, nilai_setor, tgl_setor, ntpn, sumber_data
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
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
    const depositTotals = new Map<string, { opdId: number; masaPajak: string; nilaiSetor: number }>();
    payload.deposit.forEach((row) => {
      const opdId = resolveOpd(row.npwp, row.nama_opd);
      if (!opdId) {
        addSkip("Deposit: OPD tidak ditemukan.");
        return;
      }
      const nilaiSetor = Math.round(row.nilai_setor);
      insertDepositRow.run(
        opdId,
        row.npwp,
        row.nama_opd,
        row.masa_pajak,
        row.kd_map,
        row.kd_setor,
        nilaiSetor,
        row.tgl_setor,
        row.ntpn,
        row.sumber_data,
      );
      const key = `${opdId}__${row.masa_pajak}`;
      const current = depositTotals.get(key) ?? { opdId, masaPajak: row.masa_pajak, nilaiSetor: 0 };
      current.nilaiSetor += nilaiSetor;
      depositTotals.set(key, current);
      result.deposit += 1;
    });
    depositTotals.forEach((row) => {
      upsertDeposit.run(row.opdId, row.masaPajak, row.nilaiSetor, row.nilaiSetor);
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

    // --- 5. SPT Tahunan OP ----------------------------------------------
    const upsertSptTahunanOp = database.prepare(
      `INSERT INTO spt_tahunan_op (
         npwp_pegawai, nama_pegawai, masa_pajak, jenis_spt, nomor_tanda_terima,
         tanggal_terima, status_pelaporan, pembetulan, kanal_pelaporan, kpp_administrasi
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(npwp_pegawai, masa_pajak) DO UPDATE SET
         nama_pegawai = excluded.nama_pegawai,
         jenis_spt = excluded.jenis_spt,
         nomor_tanda_terima = excluded.nomor_tanda_terima,
         tanggal_terima = excluded.tanggal_terima,
         status_pelaporan = excluded.status_pelaporan,
         pembetulan = excluded.pembetulan,
         kanal_pelaporan = excluded.kanal_pelaporan,
         kpp_administrasi = excluded.kpp_administrasi`,
    );
    payload.sptTahunanOp.forEach((row) => {
      const npwpPegawai = row.npwp_pegawai?.replace(/\D/g, "") ?? "";
      if (!npwpPegawai) {
        addSkip("SPT Tahunan OP: NPWP pegawai kosong.");
        return;
      }
      upsertSptTahunanOp.run(
        npwpPegawai,
        row.nama_pegawai,
        row.masa_pajak,
        row.jenis_spt,
        row.nomor_tanda_terima,
        row.tanggal_terima,
        row.status_pelaporan,
        row.pembetulan,
        row.kanal_pelaporan,
        row.kpp_administrasi,
      );
      result.spt_tahunan_op += 1;
    });

    // --- 6. Pegawai -------------------------------------------------------
    const upsertPegawai = database.prepare(
      `INSERT INTO pegawai (nama, nip, opd_id, jabatan, status_coretax, phone, npwp, npwp_satker, nik, email, jenis_kepegawaian)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(nip) DO UPDATE SET
         nama = excluded.nama, opd_id = excluded.opd_id, jabatan = excluded.jabatan,
         status_coretax = excluded.status_coretax,
         phone = excluded.phone, npwp = excluded.npwp, npwp_satker = excluded.npwp_satker, nik = excluded.nik,
         email = excluded.email, jenis_kepegawaian = excluded.jenis_kepegawaian`,
    );
    payload.pegawai.forEach((row, rowIndex) => {
      const opdId = resolveOpd(row.npwp_satker, row.opd_nama);
      if (!opdId) {
        addSkip("Pegawai: OPD tidak ditemukan.");
        return;
      }
      const pegawaiKey =
        row.nip?.trim() ||
        row.nik?.replace(/\D/g, "") ||
        row.npwp?.replace(/\D/g, "") ||
        `IMPORT-${opdId}-${importSlug(row.nama)}-${rowIndex + 1}`;
      try {
        upsertPegawai.run(
          row.nama,
          pegawaiKey,
          opdId,
          row.jabatan || "Pegawai",
          row.status_coretax ?? "belum_aktivasi",
          row.phone,
          row.npwp,
          row.npwp_satker,
          row.nik,
          row.email,
          row.jenis_kepegawaian,
        );
        result.pegawai += 1;
      } catch {
        addSkip("Pegawai: gagal disimpan.");
      }
    });

    // --- 7. Sosialisasi ---------------------------------------------------
    const findSosialisasi = database.prepare(
      "SELECT id FROM sosialisasi WHERE opd_id = ? AND tanggal = ? AND COALESCE(tema, '') = COALESCE(?, '')",
    );
    const insertSosialisasi = database.prepare(
      "INSERT INTO sosialisasi (opd_id, tanggal, jumlah_peserta, penyuluh_id, status, tempat, tema) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    payload.sosialisasi.forEach((row) => {
      const opdId = resolveOpd(row.npwp, row.nama_opd);
      if (!opdId) {
        addSkip("Sosialisasi: OPD tidak ditemukan di Masterfile.");
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
