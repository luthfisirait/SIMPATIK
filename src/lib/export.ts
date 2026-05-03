import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

type CsvValue = string | number | null | undefined;
type CsvRow = Record<string, CsvValue>;

function database() {
  ensureSeeded();
  return getDb();
}

function quote(value: CsvValue) {
  const text = String(value ?? "");
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

export function exportDataset(dataset: string, params: URLSearchParams) {
  const db = database();

  if (dataset === "opd") {
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "o.status" });
    return db
      .prepare(
        `
        SELECT o.id, o.nama, w.nama AS wilayah, o.jumlah_asn, o.nama_bendahara, o.hp_bendahara,
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
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "s.traffic_light" });
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
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "p.status" });
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
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "s.status" });
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

  if (dataset === "pegawai") {
    const { clause, values } = filteredClause(params, { wilayah: "w.kode", status: "p.status_coretax" });
    const prefix = clause ? `${clause} AND` : "WHERE";
    return db
      .prepare(
        `
        SELECT p.nama, p.nip, o.nama AS opd, w.nama AS wilayah, p.jabatan, p.status_coretax,
          u.nama AS ar_pengampu, p.phone
        FROM pegawai p
        JOIN opd o ON o.id = p.opd_id
        JOIN wilayah w ON w.id = o.wilayah_id
        LEFT JOIN users u ON u.id = o.ar_id
        ${prefix} p.status_coretax != 'sudah_lapor'
        ORDER BY w.id, o.nama, p.nama
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
