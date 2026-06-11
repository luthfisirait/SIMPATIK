import ExcelJS from "exceljs";

import type {
  ImportAnalysis,
  ImportDatasetSummary,
  ImportPayload,
  ImportTemplateKey,
} from "@/types";

// ---------------------------------------------------------------------------
// Parser workbook -> sheet sederhana
// ---------------------------------------------------------------------------

type ParsedSheet = {
  name: string;
  headerRows: string[][]; // beberapa baris awal (untuk header gabungan)
  rows: Array<Array<string | number | Date | null>>;
  headerIndex: number; // index baris header utama (relatif terhadap rows yang dipakai)
};

type RowAccessor = {
  pick: (...keys: string[]) => unknown;
  raw: Array<string | number | Date | null>;
};

const TEMPLATE_LABEL: Record<ImportTemplateKey, string> = {
  masterfile: "Masterfile Wajib Pajak",
  penerimaan: "Data Penerimaan (Setoran)",
  pelaporan: "Pelaporan SPT Masa",
  pegawai: "Daftar Pegawai Instansi",
  sosialisasi: "Rencana/Realisasi Sosialisasi",
};

// ---------------------------------------------------------------------------
// Spesifikasi template (header + contoh baris) untuk unduhan contoh file
// ---------------------------------------------------------------------------

type TemplateSpec = {
  label: string;
  sheetName: string;
  headers: string[];
  samples: Array<Array<string | number>>;
};

const TEMPLATE_SPECS: Record<ImportTemplateKey, TemplateSpec> = {
  masterfile: {
    label: TEMPLATE_LABEL.masterfile,
    sheetName: "Masterfile",
    headers: ["NPWP16", "NAMA_WP", "SEKSI", "NIP_AR", "NAMA_AR", "KOTA", "TANGGAL_DAFTAR"],
    samples: [
      ["0012345678901000", "Dinas Pendidikan Kota Padang", "Waskon I", "198501012010011001", "Andi Pratama", "Padang", "2021-03-10"],
      ["0023456789012000", "Dinas Kesehatan Kota Padang", "Waskon II", "199002022015022002", "Siti Rahma", "Padang", "2021-04-05"],
    ],
  },
  penerimaan: {
    label: TEMPLATE_LABEL.penerimaan,
    sheetName: "Penerimaan",
    headers: ["NPWP", "NAMA WAJIB PAJAK", "MASA PAJAK", "KD MAP", "NILAI SETOR"],
    samples: [
      ["0012345678901000", "Dinas Pendidikan Kota Padang", "012025", "411121", 5000000],
      ["0012345678901000", "Dinas Pendidikan Kota Padang", "012025", "411211", 1500000],
    ],
  },
  pelaporan: {
    label: TEMPLATE_LABEL.pelaporan,
    sheetName: "Pelaporan SPT",
    headers: ["NPWP", "NAMA WP", "MASA PAJAK", "JENIS SPT", "STATUS PELAPORAN"],
    samples: [
      ["0012345678901000", "Dinas Pendidikan Kota Padang", "012025", "PPh 21", "Sudah Lapor"],
      ["0012345678901000", "Dinas Pendidikan Kota Padang", "012025", "PPN", "Belum Lapor"],
    ],
  },
  pegawai: {
    label: TEMPLATE_LABEL.pegawai,
    sheetName: "Pegawai",
    headers: ["NAMA", "NIP", "NPWP", "NIK", "OPD", "EMAIL", "NO HP", "PNS/P3K"],
    samples: [
      ["Budi Santoso", "198501012010011001", "0098765432101000", "1371010101850001", "Dinas Pendidikan Kota Padang", "budi@padang.go.id", "081234567890", "PNS"],
      ["Maya Sari", "199203032018032003", "0087654321012000", "1371020202920002", "Dinas Pendidikan Kota Padang", "maya@padang.go.id", "081298765432", "P3K"],
    ],
  },
  sosialisasi: {
    label: TEMPLATE_LABEL.sosialisasi,
    sheetName: "Sosialisasi",
    headers: ["NPWP", "NAMA OPD", "WILAYAH KERJA", "TEMA", "TANGGAL", "TEMPAT", "JUMLAH PESERTA"],
    samples: [
      ["0012345678901000", "Dinas Pendidikan Kota Padang", "Padang Utara", "Pemotongan PPh Pasal 21", "2025-02-15", "Aula KPP Padang Satu", 35],
      ["0023456789012000", "Dinas Kesehatan Kota Padang", "Padang Selatan", "Pelaporan SPT Masa Unifikasi", "2025-03-20", "Aula Dinkes", 28],
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_SPECS) as ImportTemplateKey[];

export function isTemplateKey(value: unknown): value is ImportTemplateKey {
  return typeof value === "string" && (TEMPLATE_KEYS as string[]).includes(value);
}

export function listTemplates() {
  return TEMPLATE_KEYS.map((key) => ({ key, label: TEMPLATE_SPECS[key].label }));
}

/** Membuat workbook contoh (header + beberapa baris contoh) untuk satu template. */
export async function buildTemplateBuffer(key: ImportTemplateKey): Promise<ArrayBuffer> {
  const spec = TEMPLATE_SPECS[key];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIMPATIK";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(spec.sheetName);

  sheet.addRow(spec.headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A8090" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  spec.samples.forEach((row) => sheet.addRow(row));

  spec.headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1);
    const longest = Math.max(header.length, ...spec.samples.map((row) => String(row[index] ?? "").length));
    column.width = Math.min(Math.max(longest + 2, 12), 40);
  });

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

const DATASET_META: Record<keyof ImportPayload, { label: string; modul: string }> = {
  opd: { label: "OPD / Wajib Pajak", modul: "Direktori OPD & Bendahara" },
  pph21: { label: "Setoran PPh 21", modul: "Modul 2 PPh 21" },
  deposit: { label: "Deposit pajak", modul: "Modul 5 Deposit" },
  sptMasa: { label: "Pelaporan SPT Masa", modul: "Modul 4 SPT Masa" },
  pegawai: { label: "Pegawai instansi", modul: "Direktori Pegawai" },
  sosialisasi: { label: "Sosialisasi", modul: "Modul 3 Sosialisasi" },
};

export async function parseWorkbook(buffer: ArrayBuffer | Buffer): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer));
  // exceljs mengharapkan Buffer; cast untuk menghindari ketidakcocokan generic Buffer @types/node.
  await workbook.xlsx.load(data as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  return workbook.worksheets.map((worksheet) => {
    const allRows: Array<Array<string | number | Date | null>> = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values: Array<string | number | Date | null> = [];
      for (let index = 1; index <= row.cellCount; index += 1) {
        values.push(cellValue(row.getCell(index).value));
      }
      allRows.push(values);
    });

    const headerIndex = allRows.findIndex((row) => row.some((value) => !isBlank(value)));
    const headerRows = headerIndex === -1 ? [] : allRows.slice(headerIndex, headerIndex + 2).map(toTextRow);

    return {
      name: worksheet.name,
      headerRows,
      rows: headerIndex === -1 ? [] : allRows.slice(headerIndex),
      headerIndex: 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Analisis + normalisasi
// ---------------------------------------------------------------------------

export function analyzeSheets(
  sheets: ParsedSheet[],
  expected?: ImportTemplateKey | null,
): { payload: ImportPayload; analysis: ImportAnalysis } {
  const payload: ImportPayload = {
    opd: [],
    pph21: [],
    deposit: [],
    sptMasa: [],
    pegawai: [],
    sosialisasi: [],
  };
  const detected = new Set<ImportTemplateKey>();
  const warnings: string[] = [];

  sheets.forEach((sheet) => {
    const type = detectSheet(sheet);
    if (!type) return;
    if (expected && type !== expected) {
      warnings.push(
        `Sheet "${sheet.name}" terdeteksi sebagai template ${TEMPLATE_LABEL[type]}, tidak sesuai pilihan ${TEMPLATE_LABEL[expected]} — dilewati.`,
      );
      return;
    }
    detected.add(type);

    switch (type) {
      case "masterfile":
        normalizeMasterfile(sheet, payload, warnings);
        break;
      case "penerimaan":
        normalizePenerimaan(sheet, payload, warnings);
        break;
      case "pelaporan":
        normalizePelaporan(sheet, payload);
        break;
      case "pegawai":
        normalizePegawai(sheet, payload, warnings);
        break;
      case "sosialisasi":
        normalizeSosialisasi(sheet, payload);
        break;
    }
  });

  const datasets: ImportDatasetSummary[] = (Object.keys(DATASET_META) as Array<keyof ImportPayload>)
    .map((key) => ({ key, label: DATASET_META[key].label, modul: DATASET_META[key].modul, rows: payload[key].length }))
    .filter((item) => item.rows > 0);

  const totalRows = datasets.reduce((sum, item) => sum + item.rows, 0);

  if (expected && !detected.has(expected)) {
    warnings.push(
      `File tidak mengandung data sesuai template "${TEMPLATE_LABEL[expected]}". Pastikan file dan jenis template yang dipilih cocok.`,
    );
  } else if (detected.size === 0) {
    warnings.push("Tidak ada sheet yang dikenali. Pastikan file sesuai salah satu template resmi.");
  }

  return {
    payload,
    analysis: {
      detected: [...detected],
      datasets,
      warnings,
      totalRows,
    },
  };
}

export function describeTemplate(key: ImportTemplateKey) {
  return TEMPLATE_LABEL[key];
}

// ---------------------------------------------------------------------------
// Deteksi tipe sheet berdasarkan header
// ---------------------------------------------------------------------------

function detectSheet(sheet: ParsedSheet): ImportTemplateKey | null {
  const keys = headerKeySet(sheet);
  const has = (...candidates: string[]) => candidates.some((c) => keys.has(c));

  if (has("npwp16") && has("nama_wp") && has("nip_ar")) return "masterfile";
  if (has("kd_map") && has("nilai_setor")) return "penerimaan";
  if (has("jenis_spt") && has("status_pelaporan")) return "pelaporan";
  if (has("nik") && has("pns_p3k", "pns_pppk", "pns/p3k") && (has("opd") || has("nama"))) return "pegawai";
  if (has("wilayah_kerja") && has("nama_opd")) return "sosialisasi";
  return null;
}

// ---------------------------------------------------------------------------
// Normalisasi per template
// ---------------------------------------------------------------------------

function normalizeMasterfile(sheet: ParsedSheet, payload: ImportPayload, warnings: string[]) {
  forEachRow(sheet, (row) => {
    const nama = textValue(row.pick("nama_wp"));
    if (!nama) return;
    const npwp = textValue(row.pick("npwp16", "npwp15"));
    const kota = textValue(row.pick("kota", "kabupaten", "propinsi"));
    payload.opd.push({
      npwp: npwp || null,
      nama,
      wilayah: kota || null,
      jenis_instansi: textValue(row.pick("jenis_wp", "kategori")) || null,
      ar_nama: textValue(row.pick("nama_ar")) || null,
      ar_nip: textValue(row.pick("nip_ar")) || null,
      tanggal_input: toIsoDate(row.pick("tanggal_daftar")),
    });
    if (!npwp) warnings.push(`Masterfile: WP "${nama}" tidak punya NPWP, pencocokan memakai nama.`);
  });
}

function normalizePenerimaan(sheet: ParsedSheet, payload: ImportPayload, warnings: string[]) {
  // Agregasi setoran per (npwp|nama, masa) menurut KD MAP.
  const bucket = new Map<
    string,
    { npwp: string | null; nama: string | null; masa: string; pph21: number; unifikasi: number; ppn: number }
  >();

  forEachRow(sheet, (row) => {
    const npwp = textValue(row.pick("npwp")) || null;
    const nama = textValue(row.pick("nama_wajib_pajak", "nama_wp")) || null;
    if (!npwp && !nama) return;
    const masa = parseMasaPajak(row.pick("masa_pajak"));
    if (!masa) {
      warnings.push(`Penerimaan: baris ${nama ?? npwp} dilewati karena MASA PAJAK tidak valid.`);
      return;
    }
    const map = textValue(row.pick("kd_map")).replace(/\D/g, "");
    const nilai = numberValue(row.pick("nilai_setor"));
    const key = `${npwp ?? nama}__${masa}`;
    const entry = bucket.get(key) ?? { npwp, nama, masa, pph21: 0, unifikasi: 0, ppn: 0 };
    if (map === "411121") entry.pph21 += nilai;
    else if (map.startsWith("4112")) entry.ppn += nilai;
    else entry.unifikasi += nilai;
    bucket.set(key, entry);
  });

  bucket.forEach((entry) => {
    payload.deposit.push({
      npwp: entry.npwp,
      nama_opd: entry.nama,
      masa_pajak: entry.masa,
      deposit_pph21: entry.pph21,
      deposit_pph_unifikasi: entry.unifikasi,
      deposit_ppn_put: entry.ppn,
    });
    if (entry.pph21 > 0) {
      payload.pph21.push({
        npwp: entry.npwp,
        nama_opd: entry.nama,
        bulan: entry.masa,
        nominal_setor: entry.pph21,
        ketepatan: "tepat_waktu",
      });
    }
  });
}

function normalizePelaporan(sheet: ParsedSheet, payload: ImportPayload) {
  // Satu sheet bisa memuat beberapa blok (PPh 21 / PPN / Unifikasi) dipisah baris kosong.
  // Karena tiap blok punya header sendiri, kita proses per baris dengan header aktif.
  const blocks = splitBlocks(sheet);
  blocks.forEach((block) => {
    forEachRowOf(block, (row) => {
      const npwp = textValue(row.pick("npwp")) || null;
      const nama = textValue(row.pick("nama_wp", "nama_wajib_pajak")) || null;
      if (!npwp && !nama) return;
      const masa = parseMasaPajak(row.pick("masa_pajak"));
      if (!masa) return;
      const jenis = textValue(row.pick("jenis_spt")).toLowerCase();
      const status = textValue(row.pick("status_pelaporan")) || null;
      const target = ensureSptMasaRow(payload, npwp, nama, masa);
      if (jenis.includes("ppn")) target.ppn_put_status = status;
      else if (jenis.includes("unifikasi")) target.pph23_status = status;
      else if (jenis.includes("21") || jenis.includes("26")) target.pph21_status = status;
    });
  });
}

function normalizePegawai(sheet: ParsedSheet, payload: ImportPayload, warnings: string[]) {
  forEachRow(sheet, (row) => {
    const nama = textValue(row.pick("nama"));
    if (!nama) return;
    const opd = textValue(row.pick("opd", "nama_opd")) || null;
    if (!opd) warnings.push(`Pegawai: "${nama}" tanpa OPD, akan dilewati saat commit bila OPD tak ditemukan.`);
    payload.pegawai.push({
      npwp: textValue(row.pick("npwp")) || null,
      nik: textValue(row.pick("nik")) || null,
      nama,
      nip: textValue(row.pick("nip")) || null,
      jabatan: textValue(row.pick("jabatan")) || null,
      email: textValue(row.pick("email")) || null,
      phone: textValue(row.pick("no_hp", "phone", "hp")) || null,
      jenis_kepegawaian: textValue(row.pick("pns_p3k", "pns_pppk", "pns/p3k")) || null,
      opd_nama: opd,
    });
  });
}

function normalizeSosialisasi(sheet: ParsedSheet, payload: ImportPayload) {
  forEachRow(sheet, (row) => {
    const nama = textValue(row.pick("nama_opd"));
    if (!nama) return;
    payload.sosialisasi.push({
      npwp: textValue(row.pick("npwp")) || null,
      nama_opd: nama,
      wilayah: textValue(row.pick("wilayah_kerja", "wilayah")) || null,
      tanggal: toIsoDate(row.pick("hari_tgl_pelaksanaan_sosialisasi", "tanggal", "hari_tgl")),
      tempat: textValue(row.pick("tempat")) || null,
      tema: textValue(row.pick("tema_pph_pasal_21", "tema", "tema_spt_pph_orang_pribadi")) || null,
      jumlah_peserta: numberValue(row.pick("jumlah_peserta")),
    });
  });
}

function ensureSptMasaRow(payload: ImportPayload, npwp: string | null, nama: string | null, masa: string) {
  const existing = payload.sptMasa.find(
    (item) => item.masa_pajak === masa && ((npwp && item.npwp === npwp) || (!npwp && item.nama_opd === nama)),
  );
  if (existing) return existing;
  const created = {
    npwp,
    nama_opd: nama,
    masa_pajak: masa,
    pph23_status: null,
    ppn_put_status: null,
    pph21_status: null,
  };
  payload.sptMasa.push(created);
  return created;
}

// ---------------------------------------------------------------------------
// Helper baris & header
// ---------------------------------------------------------------------------

type Block = { headers: Map<string, number>; rows: Array<Array<string | number | Date | null>> };

function splitBlocks(sheet: ParsedSheet): Block[] {
  const blocks: Block[] = [];
  let headers: Map<string, number> | null = null;
  let rows: Array<Array<string | number | Date | null>> = [];

  const flush = () => {
    if (headers && rows.length) blocks.push({ headers, rows });
    rows = [];
  };

  sheet.rows.forEach((row) => {
    if (row.every((value) => isBlank(value))) {
      flush();
      headers = null;
      return;
    }
    if (looksLikeHeader(row)) {
      flush();
      headers = headerMap(toTextRow(row));
      return;
    }
    if (headers) rows.push(row);
  });
  flush();
  return blocks;
}

function looksLikeHeader(row: Array<string | number | Date | null>) {
  const text = toTextRow(row).map((v) => slug(v));
  return text.includes("npwp") && (text.includes("jenis_spt") || text.includes("status_pelaporan") || text.includes("nama_wp"));
}

function forEachRow(sheet: ParsedSheet, callback: (row: RowAccessor) => void) {
  const headers = headerMap(sheet.headerRows[0] ?? []);
  sheet.rows.slice(1).forEach((raw) => {
    if (raw.every((value) => isBlank(value))) return;
    callback({ raw, pick: (...keys) => pickFrom(headers, raw, keys) });
  });
}

function forEachRowOf(block: Block, callback: (row: RowAccessor) => void) {
  block.rows.forEach((raw) => {
    if (raw.every((value) => isBlank(value))) return;
    callback({ raw, pick: (...keys) => pickFrom(block.headers, raw, keys) });
  });
}

function pickFrom(headers: Map<string, number>, raw: Array<string | number | Date | null>, keys: string[]) {
  for (const key of keys) {
    const index = headers.get(key);
    if (index !== undefined && !isBlank(raw[index])) return raw[index];
  }
  return null;
}

function headerMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((value, index) => {
    const key = slug(value);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function headerKeySet(sheet: ParsedSheet): Set<string> {
  const keys = new Set<string>();
  sheet.headerRows.forEach((rowText) => rowText.forEach((value) => {
    const key = slug(value);
    if (key) keys.add(key);
  }));
  return keys;
}

// ---------------------------------------------------------------------------
// Helper nilai
// ---------------------------------------------------------------------------

function cellValue(value: ExcelJS.CellValue): string | number | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if ("text" in obj) return String(obj.text);
    if ("result" in obj) return (obj.result as string | number) ?? null;
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text: string }>).map((part) => part.text).join("");
    }
    if ("hyperlink" in obj) return String(obj.text ?? obj.hyperlink ?? "");
  }
  return null;
}

function toTextRow(row: Array<string | number | Date | null>): string[] {
  return row.map((value) => (value instanceof Date ? value.toISOString() : String(value ?? "")));
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function textValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : 0;
}

function slug(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

// MASA PAJAK format DJP: "MMMMYYYY" (bulan awal + bulan akhir + tahun) atau "MMYYYY".
function parseMasaPajak(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 8) {
    const bulan = digits.slice(0, 2);
    const tahun = digits.slice(4, 8);
    return `${tahun}-${bulan}`;
  }
  if (digits.length === 6) {
    const bulan = digits.slice(0, 2);
    const tahun = digits.slice(2, 6);
    return `${tahun}-${bulan}`;
  }
  return null;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // dd-mm-yyyy atau dd/mm/yyyy atau d/m/yy
  const match = raw.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/);
  if (match) {
    let [, a, b, c] = match;
    let day: string;
    let month: string;
    let year: string;
    if (a.length === 4) {
      year = a;
      month = b.padStart(2, "0");
      day = c.padStart(2, "0");
    } else {
      day = a.padStart(2, "0");
      month = b.padStart(2, "0");
      year = c.length === 2 ? `20${c}` : c.padStart(4, "20");
    }
    if (Number(month) > 12 && Number(day) <= 12) {
      [day, month] = [month, day];
    }
    return `${year}-${month}-${day}`;
  }

  // teks Indonesia "Senin, 1 Desember 2025"
  const idMatch = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (idMatch) {
    const months: Record<string, string> = {
      januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
      juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12",
    };
    const month = months[idMatch[2].toLowerCase()];
    if (month) return `${idMatch[3]}-${month}-${idMatch[1].padStart(2, "0")}`;
  }
  return null;
}
