import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

type CsvValue = string | number | null | undefined;
type CsvRow = Record<string, CsvValue>;

function database() {
  ensureSeeded();
  return getDb();
}

function quote(value: CsvValue) {
  const raw = String(value ?? "");
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvRow[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => quote(row[header])).join(","));
  return `\uFEFF${headers.map(quote).join(",")}\r\n${body.join("\r\n")}`;
}

function filteredClause(params: URLSearchParams, mapping: Record<string, string>) {
  const where: string[] = [];
  const values: Array<string | number> = [];

  Object.entries(mapping).forEach(([param, column]) => {
    const value = params.get(param);
    if (value && value !== "all") {
      where.push(`${column} = ?`);
      values.push(value);
    }
  });

  const q = params.get("q");
  if (q) {
    where.push("(LOWER(o.nama) LIKE ? OR LOWER(w.nama) LIKE ?)");
    values.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
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

export function exportDataset(dataset: string, params: URLSearchParams) {
  const db = database();

  if (dataset === "opd") {
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "o.status", ar: "o.ar_id" });
    return db
      .prepare(
        `
        SELECT o.id, o.nama, w.nama AS wilayah, o.jumlah_asn, o.nama_bendahara, o.hp_bendahara,
          o.jenis_instansi, o.jumlah_pppk, o.npwp_opd, o.status_pemungut_ppn,
          o.nip_bendahara, o.email_bendahara, o.nama_bendahara_penerimaan, o.hp_bendahara_penerimaan,
          o.nama_pic_kepeg, o.hp_pic_kepeg, u.nama AS ar_pengampu, o.status
        FROM opd o
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${clause}
        ORDER BY w.id, o.nama
      `,
      )
      .all(...values) as CsvRow[];
  }

  if (dataset === "spt") {
    const pegawaiNpwp = npwpDigitsSql("p.npwp");
    const baseWhere: string[] = [];
    const baseValues: Array<string | number> = [];
    const wilayah = params.get("wilayah");
    if (wilayah && wilayah !== "all") {
      baseWhere.push("w.kode = ?");
      baseValues.push(wilayah);
    }
    const ar = params.get("ar");
    if (ar && ar !== "all") {
      baseWhere.push("o.ar_id = ?");
      baseValues.push(ar);
    }
    const q = params.get("q");
    if (q) {
      baseWhere.push("(LOWER(o.nama) LIKE ? OR LOWER(w.nama) LIKE ?)");
      baseValues.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }
    const whereClause = baseWhere.length ? `WHERE ${baseWhere.join(" AND ")}` : "";
    const status = params.get("status");
    const trafficClause = status && status !== "all" ? "WHERE traffic_light = ?" : "";
    const trafficValues = status && status !== "all" ? [status] : [];
    return db
      .prepare(
        `
        WITH base AS (
          SELECT o.nama AS opd, w.nama AS wilayah, u.nama AS ar_pengampu,
            COUNT(DISTINCT p.id) AS asn_pppk,
            COUNT(DISTINCT CASE WHEN sto.id IS NOT NULL THEN p.id END) AS sudah_lapor
          FROM opd o
          JOIN wilayah w ON w.id = o.wilayah_id
          LEFT JOIN users u ON u.id = o.ar_id
          LEFT JOIN pegawai p ON p.opd_id = o.id
          LEFT JOIN spt_tahunan_op sto ON ${pegawaiNpwp} <> '' AND sto.npwp_pegawai = ${pegawaiNpwp}
          ${whereClause}
          GROUP BY o.id, o.nama, w.nama, u.nama
        ),
        scored AS (
          SELECT base.*, (asn_pppk - sudah_lapor) AS belum_lapor,
            CASE WHEN asn_pppk = 0 THEN 0 ELSE ROUND(sudah_lapor * 100.0 / asn_pppk, 1) END AS persen_kepatuhan,
            CASE
              WHEN asn_pppk > 0 AND sudah_lapor * 100.0 / asn_pppk >= 70 THEN 'hijau'
              WHEN asn_pppk > 0 AND sudah_lapor * 100.0 / asn_pppk >= 40 THEN 'kuning'
              ELSE 'merah' END AS traffic_light
          FROM base
        )
        SELECT opd, wilayah, ar_pengampu, asn_pppk, sudah_lapor, belum_lapor, persen_kepatuhan, traffic_light
        FROM scored ${trafficClause}
        ORDER BY persen_kepatuhan ASC, opd
      `,
      )
      .all(...baseValues, ...trafficValues) as CsvRow[];
  }

  if (dataset === "pph21") {
    const bulan = params.get("bulan") ?? ((db.prepare("SELECT MAX(bulan) AS bulan FROM pph21_monitoring").get() as { bulan: string }).bulan);
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "p.status", ar: "o.ar_id" });
    const prefix = clause ? `${clause} AND` : "WHERE";
    return db
      .prepare(
        `
        SELECT o.nama AS opd, w.nama AS wilayah, p.bulan, p.jumlah_dipotong,
          p.nominal_setor, p.estimasi_wajar, p.ketepatan, p.status
        FROM pph21_monitoring p
        JOIN opd o ON o.id = p.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        ${prefix} p.bulan = ?
        ORDER BY p.status, o.nama
      `,
      )
      .all(...values, bulan) as CsvRow[];
  }

  if (dataset === "sosialisasi") {
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "s.status", ar: "o.ar_id" });
    return db
      .prepare(
        `
        SELECT o.nama AS opd, w.nama AS wilayah, s.tanggal, s.jumlah_peserta,
          u.nama AS penyuluh, s.status
        FROM sosialisasi s
        JOIN opd o ON o.id = s.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = s.penyuluh_id
        ${clause}
        ORDER BY s.tanggal DESC
      `,
      )
      .all(...values) as CsvRow[];
  }

  if (dataset === "spt-masa") {
    const masa =
      params.get("masa") ??
      ((db.prepare("SELECT MAX(masa_pajak) AS masa FROM spt_masa_monitoring").get() as { masa: string }).masa);
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "LOWER(m.status_keseluruhan)", ar: "o.ar_id" });
    const prefix = clause ? `${clause} AND` : "WHERE";
    return db
      .prepare(
        `
        SELECT o.nama AS opd, w.nama AS wilayah, u.nama AS ar_pengampu, m.masa_pajak,
          m.pph21_status, m.pph22_nominal, m.pph22_status, m.pph23_nominal, m.pph23_status,
          m.ppn_put_nominal, m.ppn_put_status, m.status_opd_pemungut,
          m.status_keseluruhan, m.catatan_ar
        FROM spt_masa_monitoring m
        JOIN opd o ON o.id = m.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${prefix} m.masa_pajak = ?
        ORDER BY m.status_keseluruhan, o.nama
      `,
      )
      .all(...values, masa) as CsvRow[];
  }

  if (dataset === "deposit") {
    const baseWhere: string[] = [];
    const baseValues: Array<string | number> = [];
    const wilayah = params.get("wilayah");
    if (wilayah && wilayah !== "all") {
      baseWhere.push("w.kode = ?");
      baseValues.push(wilayah);
    }
    const ar = params.get("ar");
    if (ar && ar !== "all") {
      baseWhere.push("o.ar_id = ?");
      baseValues.push(ar);
    }
    const q = params.get("q");
    if (q) {
      baseWhere.push("(LOWER(o.nama) LIKE ? OR LOWER(w.nama) LIKE ?)");
      baseValues.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }
    const whereClause = baseWhere.length ? `WHERE ${baseWhere.join(" AND ")}` : "";
    const statusExpr =
      "CASE WHEN saldo_deposit > 10000000 THEN 'hijau' WHEN saldo_deposit >= 2000000 THEN 'kuning' ELSE 'merah' END";
    const status = params.get("status");
    const statusClause = status && status !== "all" ? "WHERE status = ?" : "";
    const statusValues = status && status !== "all" ? [status.toLowerCase()] : [];
    return db
      .prepare(
        `
        WITH base AS (
          SELECT o.nama AS opd, w.nama AS wilayah, u.nama AS ar_pengampu,
            COALESCE(SUM(d.nilai_setor), 0) AS saldo_deposit
          FROM opd o
          JOIN wilayah w ON w.id = o.wilayah_id
          LEFT JOIN users u ON u.id = o.ar_id
          LEFT JOIN deposit_penerimaan d ON d.opd_id = o.id AND d.kd_map = '411618'
          ${whereClause}
          GROUP BY o.id, o.nama, w.nama, u.nama
        ),
        scored AS (
          SELECT base.*, ${statusExpr} AS status FROM base
        )
        SELECT opd, wilayah, ar_pengampu, saldo_deposit, status
        FROM scored ${statusClause}
        ORDER BY CASE status WHEN 'merah' THEN 1 WHEN 'kuning' THEN 2 ELSE 3 END, saldo_deposit ASC, opd
      `,
      )
      .all(...baseValues, ...statusValues) as CsvRow[];
  }

  if (dataset === "scoring") {
    const bulan =
      params.get("bulan") ??
      ((db.prepare("SELECT MAX(bulan_scoring) AS bulan FROM scoring_opd").get() as { bulan: string }).bulan);
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", kategori: "s.kategori", status: "s.status_rp", ar: "o.ar_id" });
    const prefix = clause ? `${clause} AND` : "WHERE";
    return db
      .prepare(
        `
        SELECT o.nama AS opd, w.nama AS wilayah, u.nama AS ar_pengampu, s.bulan_scoring,
          s.skor_spt_op, s.skor_pph21, s.skor_spt_masa, s.skor_deposit,
          s.skor_total, s.kategori, s.status_rp, s.catatan
        FROM scoring_opd s
        JOIN opd o ON o.id = s.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${prefix} s.bulan_scoring = ?
        ORDER BY s.skor_total ASC, o.nama
      `,
      )
      .all(...values, bulan) as CsvRow[];
  }

  if (dataset === "bendahara") {
    const pphMonth = (db.prepare("SELECT MAX(bulan) AS bulan FROM pph21_monitoring").get() as { bulan: string }).bulan;
    const scoringPeriod = (db.prepare("SELECT MAX(bulan_scoring) AS bulan FROM scoring_opd").get() as { bulan: string }).bulan;
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", ar: "o.ar_id" });
    return db
      .prepare(
        `
        SELECT o.nama AS opd, w.nama AS wilayah, o.nama_bendahara, o.nip_bendahara, o.hp_bendahara,
          o.email_bendahara, o.nama_bendahara_penerimaan, o.hp_bendahara_penerimaan,
          p.ketepatan AS status_pph21_terakhir, s.skor_total AS skor_terakhir,
          u.nama AS ar_pengampu, o.tanggal_update_kontak
        FROM opd o
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        LEFT JOIN pph21_monitoring p ON p.opd_id = o.id AND p.bulan = ?
        LEFT JOIN scoring_opd s ON s.opd_id = o.id AND s.bulan_scoring = ?
        ${clause}
        ORDER BY COALESCE(s.skor_total, 999) ASC, o.nama
      `,
      )
      .all(pphMonth, scoringPeriod, ...values) as CsvRow[];
  }

  if (dataset === "pegawai") {
    const statusSpt = pegawaiSptTahunanStatusSql();
    const where: string[] = [];
    const values: Array<string | number> = [];
    const q = params.get("q");
    if (q) {
      const query = `%${q.toLowerCase()}%`;
      where.push("(LOWER(p.nama) LIKE ? OR p.nip LIKE ? OR p.npwp LIKE ? OR LOWER(o.nama) LIKE ? OR LOWER(u.nama) LIKE ?)");
      values.push(query, `%${q}%`, `%${q}%`, query, query);
    }
    const wilayah = params.get("wilayah");
    if (wilayah && wilayah !== "all") {
      where.push("w.kode = ?");
      values.push(wilayah);
    }
    const status = params.get("status");
    if (status && status !== "all") {
      where.push(`${statusSpt} = ?`);
      values.push(status);
    }
    const ar = params.get("ar");
    if (ar && ar !== "all") {
      where.push("o.ar_id = ?");
      values.push(ar);
    }
    const opd = params.get("opd");
    if (opd && opd !== "all") {
      where.push("o.id = ?");
      values.push(opd);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    return db
      .prepare(
        `
        SELECT p.nama, p.nip, p.npwp, o.nama AS opd, w.nama AS wilayah, p.jabatan,
          ${statusSpt} AS status_spt_tahunan_op, u.nama AS ar_pengampu, p.phone, p.email
        FROM pegawai p
        JOIN opd o ON o.id = p.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${clause}
        ORDER BY CASE ${statusSpt} WHEN 'aktif_belum_lapor' THEN 1 ELSE 2 END, w.id, o.nama, p.nama
      `,
      )
      .all(...values) as CsvRow[];
  }

  if (dataset === "users") {
    return db
      .prepare(
        `
        SELECT nama, email, nip, jabatan, role, phone, status
        FROM users
        ORDER BY role, nama
      `,
      )
      .all() as CsvRow[];
  }

  return null;
}
