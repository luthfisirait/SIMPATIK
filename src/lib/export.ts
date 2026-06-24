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
    const period =
      params.get("periode") ??
      ((db.prepare("SELECT MAX(periode) AS periode FROM spt_monitoring WHERE tahun_pajak = 2025").get() as { periode: string }).periode);
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "s.traffic_light", ar: "o.ar_id" });
    const prefix = clause ? `${clause} AND` : "WHERE";
    return db
      .prepare(
        `
        SELECT o.nama AS opd, w.nama AS wilayah, u.nama AS ar_pengampu, s.tahun_pajak, s.periode,
          s.jumlah_wajib_lapor, s.jumlah_sudah_lapor, s.persen_kepatuhan, s.traffic_light
        FROM spt_monitoring s
        JOIN opd o ON o.id = s.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${prefix} s.tahun_pajak = 2025 AND s.periode = ?
        ORDER BY s.persen_kepatuhan ASC, o.nama
      `,
      )
      .all(...values, period) as CsvRow[];
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
    const depositAmount = "COALESCE(d.nilai_setor, 0)";
    const depositStatus = `CASE WHEN ${depositAmount} > 10000000 THEN 'hijau' WHEN ${depositAmount} >= 2000000 THEN 'kuning' ELSE 'merah' END`;
    const masa =
      params.get("masa") ??
      (
        db
          .prepare("SELECT MAX(masa_pajak) AS masa FROM deposit_penerimaan WHERE kd_map = '411618'")
          .get() as { masa: string | null }
      ).masa ??
      "";
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: depositStatus, ar: "o.ar_id" });
    const prefix = clause ? `${clause} AND` : "WHERE";
    return db
      .prepare(
        `
        SELECT o.nama AS opd, w.nama AS wilayah, d.nama_wajib_pajak, d.masa_pajak,
          d.kd_map, d.kd_setor, ${depositAmount} AS saldo_deposit, d.tgl_setor, d.ntpn, d.sumber_data,
          ${depositStatus} AS status, u.nama AS ar_pengampu
        FROM deposit_penerimaan d
        JOIN opd o ON o.id = d.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${prefix} d.kd_map = '411618' AND d.masa_pajak = ?
        ORDER BY ${depositStatus}, ${depositAmount} ASC, o.nama
      `,
      )
      .all(...values, masa) as CsvRow[];
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
