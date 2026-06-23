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
  penerimaan: "Data Penerimaan",
  pelaporan_pph21: "Pelaporan SPT Masa PPh Pasal 21",
  pelaporan_unifikasi: "Pelaporan SPT Masa Unifikasi/PPN",
  pegawai: "Daftar Pegawai Instansi",
  sosialisasi: "Rekam Sosialisasi",
};

// ---------------------------------------------------------------------------
// Spesifikasi template (header + contoh baris) untuk unduhan contoh file
// ---------------------------------------------------------------------------

type TemplateSpec = {
  label: string;
  sheetName: string;
  headerRows: string[][];
  samples: Array<Array<string | number>>;
  merges?: string[];
};

const PELAPORAN_HEADERS = [
  "NO",
  "NPWP",
  "NAMA WP",
  "MASA PAJAK",
  "JENIS SPT",
  "NOMOR TANDA TERIMA",
  "TGL TERIMA",
  "NOP",
  "STATUS PELAPORAN",
  "PEMBE-TULAN",
  "KANAL PELAPORAN",
  "KPP ADMINISTRASI",
  "UNIT PENERIMA",
];

type PenerimaanKind = "pph21" | "pph22" | "pph23" | "ppn" | "deposit" | "pph_final";

const PENERIMAAN_KIND_BY_MAP: Record<string, PenerimaanKind> = {
  "411121": "pph21",
  "411122": "pph22",
  "411124": "pph23",
  "411211": "ppn",
  "411618": "deposit",
  "411128": "pph_final",
};

const MASTERFILE_HEADERS = [
  "NPWP16",
  "NPWP15",
  "NAMA_WP",
  "SEKSI",
  "NIP_AR",
  "NAMA_AR",
  "TANGGAL_DAFTAR",
  "TANGGAL_PINDAH",
  "TANGGAL_LAHIR",
  "ALAMAT",
  "KODE_WILAYAH",
  "KELURAHAN",
  "KECAMATAN",
  "KOTA",
  "PROPINSI",
  "KODE_POS",
  "NOMOR_TELEPON",
  "EMAIL",
  "NOMOR_IDENTITAS",
  "EMAIL_EFILING",
  "NOMOR_IDENTITAS_AKTA",
  "STATUS_WP",
  "JENIS_WP",
  "JENIS_IP",
  "KODE_KLU",
  "TANGGAL_PKP",
  "BENTUK_HUKUM",
  "MATA_UANG",
  "NO_SKT",
  "NO_PKP",
  "NO_PKP_CABUT",
  "TGL_PKP_CABUT",
  "NIP_EKS",
  "NIP_JS",
  "NAMA_JS",
  "KD_NOTE",
  "STATUS_MODAL",
  "KATEGORI",
  "KEWARGANEGARAAN",
  "ID_BL_BUKU_AWAL",
  "ID_BL_BUKU_AKHIR",
  "NITKU",
  "STS_16",
  "TGL_UPDATE16",
  "KODE_ZONA_PENGAWASAN",
  "FLAG_WPS_WPK",
  "JNS_ASSIGN",
  "KOORDINAT",
  "WAJIB_SPT_TAHUNAN",
  "WAJIB_SPT_PPH21",
  "WAJIB_SPT_PPN",
  "TEMPAT_LAHIR",
  "TARIF_DAFTAR",
  "TGL_NE",
  "NO_PROD_NE",
  "FLAG_WP_TUNGGAL",
  "DW_PROCESS_DATE",
  "WILAYAH_OPD",
];

const TEMPLATE_SPECS: Record<ImportTemplateKey, TemplateSpec> = {
  masterfile: {
    label: TEMPLATE_LABEL.masterfile,
    sheetName: "Sheet1",
    headerRows: [MASTERFILE_HEADERS],
    samples: [
      [
        "1234567891234567",
        "123456789123456",
        "Instansi Pemerintah",
        "SEKSI PENGAWASAN II",
        "198501012010011001",
        "Budi",
        "07/07/2020 00:00",
        "",
        "2005-01-05",
        "Jl Tester",
        "1305072001",
        "KURANJI HULU",
        "SUNGAI GARINGGIANG",
        "KABUPATEN PADANG PARIAMAN",
        "SUMATERA BARAT",
        "25563",
        "",
        "",
        "",
        "",
        "1234567891234567",
        "AKTIF",
        "BENDAHARA",
        "",
        "12345",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "123456789",
        "Jursit",
        "KEP-300/PJ/2020",
        "",
        "Bendahara",
        "INDONESIA",
        "",
        "",
        "",
        "VALID",
        "2020/07/13 00:00:00.000000000",
        "201-0424071900-2023",
        "WPK",
        "AN2M",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "TUNGGAL",
        "2026/06/03 00:00:00.000",
        "Kabupaten Padang Pariaman",
      ],
    ],
  },
  penerimaan: {
    label: TEMPLATE_LABEL.penerimaan,
    sheetName: "Sheet1",
    headerRows: [["NO", "NPWP", "NAMA WAJIB PAJAK", "MASA PAJAK", "KD MAP", "KD SETOR", "NILAI SETOR", "TGL SETOR", "NTPN", "NO SK", "NOP", "ID BILLING", "SUMBER DATA"]],
    samples: [
      [1, "5091031123456780", "Instansi Pemerintah", "05052026", "411121", "100", 10000000, "2026-05-09", "360100123456789", "", "", "0", "SPM"],
      [2, "5091031123456780", "Instansi Pemerintah", "05052026", "411122", "100", 2500000, "2026-05-09", "360100123456790", "", "", "0", "SPM"],
      [3, "5091031123456780", "Instansi Pemerintah", "05052026", "411124", "100", 1500000, "2026-05-09", "360100123456791", "", "", "0", "SPM"],
      [4, "5091031123456780", "Instansi Pemerintah", "05052026", "411211", "910", 3000000, "2026-05-09", "360100123456792", "", "", "0", "SPM"],
      [5, "5091031123456780", "Instansi Pemerintah", "05052026", "411618", "100", 500000, "2026-05-09", "360100123456793", "", "", "0", "SPM"],
      [6, "5091031123456780", "Instansi Pemerintah", "05052026", "411128", "100", 750000, "2026-05-09", "360100123456794", "", "", "0", "SPM"],
    ],
  },
  pelaporan_pph21: {
    label: TEMPLATE_LABEL.pelaporan_pph21,
    sheetName: "PPh Pasal 21",
    headerRows: [PELAPORAN_HEADERS],
    samples: [
      [1, "1234567891234567", "Kantor Pemerintahan", "04042025", "SPT Masa PPh Pasal 21/26", "BPE-03738/CT/KPP.2704/2026", "12-01-2026", "", "Submitted", "Normal", "Portal Wajib Pajak", "788-KPP Pratama Pasar", "788-KPP Pratama Pasar"],
    ],
  },
  pelaporan_unifikasi: {
    label: TEMPLATE_LABEL.pelaporan_unifikasi,
    sheetName: "Sheet1",
    headerRows: [PELAPORAN_HEADERS],
    samples: [
      [1, "1000000000912729", "BBPMP DIREKTORAT JENDERAL PENDIDIKAN ANAK USIA DINI, PENDIDIKAN DASAR, DAN PENDIDIKAN MENENGAH KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH", "05052025", "SPT Masa PPh Unifikasi", "BPE-09759/CT/KPP.2704/2026", "02-01-2026", "", "Submitted", "Normal", "Portal Wajib Pajak", "201-KPP Pratama Padang Satu", "201-KPP Pratama Padang Satu"],
      [2, "1000000000912729", "BBPMP DIREKTORAT JENDERAL PENDIDIKAN ANAK USIA DINI, PENDIDIKAN DASAR, DAN PENDIDIKAN MENENGAH KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH", "05052025", "SPT Masa PPN bagi Pemungut PPN dan Pihak Lain yang Bukan Merupakan PKP", "BPE-09760/CT/KPP.2704/2026", "02-01-2026", "", "Submitted", "Normal", "Portal Wajib Pajak", "201-KPP Pratama Padang Satu", "201-KPP Pratama Padang Satu"],
    ],
  },
  pegawai: {
    label: TEMPLATE_LABEL.pegawai,
    sheetName: "Sheet1",
    headerRows: [["No", "Nama", "NIP", "npwp", "NIK", "OPD", "Email", "No HP", "PNS/P3K"]],
    samples: [
      [1, "INDRA", "199908222015211000", "1301072208940005", "1301072208940005", "BAGIAN UMUM", "indra2252@gmail.com", "081269078342", "PPPK"],
    ],
  },
  sosialisasi: {
    label: TEMPLATE_LABEL.sosialisasi,
    sheetName: "Sheet1",
    headerRows: [
      ["No", "NPWP", "Nama OPD", "Wilayah Kerja", "Tema PPh Pasal 21", "", "", "Tema SPT PPh Orang Pribadi", "", ""],
      ["", "", "", "", "Hari/Tgl Pelaksanaan sosialisasi", "Tempat", "Jumlah Peserta", "Hari/Tgl Pelaksanaan sosialisasi", "Tempat", "Jumlah Peserta"],
    ],
    merges: ["A1:A2", "B1:B2", "C1:C2", "D1:D2", "E1:G1", "H1:J1"],
    samples: [
      [1, "0781675361801000", "RUMAH SAKIT UMUM DAERAH", "OPD Kabupaten", "Senin, 1 Desember 2025", "RSUD Prof H. Muhammad Yamin SH, Jl Prof. M. Yamin,", "", "", "", ""],
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

  spec.headerRows.forEach((headerRow) => sheet.addRow(headerRow));
  spec.merges?.forEach((range) => sheet.mergeCells(range));

  for (let index = 1; index <= spec.headerRows.length; index += 1) {
    const headerRow = sheet.getRow(index);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A8090" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD7E3EA" } },
        left: { style: "thin", color: { argb: "FFD7E3EA" } },
        bottom: { style: "thin", color: { argb: "FFD7E3EA" } },
        right: { style: "thin", color: { argb: "FFD7E3EA" } },
      };
    });
  }

  spec.samples.forEach((row) => {
    const added = sheet.addRow(row);
    added.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  const leafHeaders = spec.headerRows[spec.headerRows.length - 1];
  const topHeaders = spec.headerRows[0];
  const columnCount = Math.max(...spec.headerRows.map((row) => row.length), ...spec.samples.map((row) => row.length));
  for (let index = 0; index < columnCount; index += 1) {
    const column = sheet.getColumn(index + 1);
    const header = leafHeaders[index] || topHeaders[index] || "";
    const longest = Math.max(String(header).length, ...spec.samples.map((row) => String(row[index] ?? "").length));
    column.width = Math.min(Math.max(longest + 2, 12), 40);
  }

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
      let lastColumn = 0;
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const value = cellValue(cell.value);
        if (isBlank(value)) return;
        values[columnNumber - 1] = value;
        lastColumn = Math.max(lastColumn, columnNumber);
      });
      values.length = lastColumn;
      for (let index = 0; index < values.length; index += 1) {
        values[index] ??= null;
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
    const type = detectSheet(sheet, expected);
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
      case "pelaporan_pph21":
        normalizePelaporan(sheet, payload, "pph21");
        break;
      case "pelaporan_unifikasi":
        normalizePelaporan(sheet, payload, "unifikasi");
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

function detectSheet(sheet: ParsedSheet, expected?: ImportTemplateKey | null): ImportTemplateKey | null {
  const keys = headerKeySet(sheet);
  const has = (...candidates: string[]) => candidates.some((c) => keys.has(c));

  if (has("npwp16") && has("nama_wp") && has("nip_ar")) return "masterfile";
  if (has("kd_map") && has("nilai_setor")) return "penerimaan";
  if (has("jenis_spt") && has("status_pelaporan")) return detectPelaporanSheet(sheet, expected);
  if (
    has("nik") &&
    has("pns_p3k", "pns_pppk", "pns/p3k", "status_asn") &&
    (has("opd") || has("nama") || has("nama_pegawai") || has("nama_satker"))
  ) {
    return "pegawai";
  }
  if (has("wilayah_kerja") && has("nama_opd")) return "sosialisasi";
  return null;
}

function detectPelaporanSheet(sheet: ParsedSheet, expected?: ImportTemplateKey | null): ImportTemplateKey {
  let hasPph21 = false;
  let hasUnifikasi = false;
  let hasPpn = false;

  forEachRow(sheet, (row) => {
    const kind = pelaporanKindFromJenisSpt(row.pick("jenis_spt"));
    if (kind === "unifikasi") hasUnifikasi = true;
    if (kind === "ppn") hasPpn = true;
    if (kind === "pph21") hasPph21 = true;
  });

  if ((hasUnifikasi || hasPpn) && !hasPph21) return "pelaporan_unifikasi";
  if (hasPph21 && !hasUnifikasi && !hasPpn) return "pelaporan_pph21";
  if (expected === "pelaporan_pph21" || expected === "pelaporan_unifikasi") return expected;
  return hasUnifikasi || hasPpn ? "pelaporan_unifikasi" : "pelaporan_pph21";
}

// ---------------------------------------------------------------------------
// Normalisasi per template
// ---------------------------------------------------------------------------

function normalizeMasterfile(sheet: ParsedSheet, payload: ImportPayload, warnings: string[]) {
  forEachRow(sheet, (row) => {
    const nama = textValue(row.pick("nama_wp"));
    if (!nama) return;
    const npwp = textValue(row.pick("npwp16", "npwp15"));
    const wilayahOpd = textValue(row.pick("wilayah_opd", "wilayah"));
    const kota = textValue(row.pick("kota", "kabupaten", "propinsi"));
    payload.opd.push({
      npwp: npwp || null,
      nama,
      wilayah: wilayahOpd || kota || null,
      jenis_instansi: textValue(row.pick("jenis_wp", "kategori")) || null,
      ar_nama: textValue(row.pick("nama_ar")) || null,
      ar_nip: textValue(row.pick("nip_ar")) || null,
      status_pemungut_ppn: normalizeYesNo(row.pick("status_pemungut_ppn", "wajib_spt_ppn")),
      nama_bendahara: textValue(row.pick("nama_bendahara")) || null,
      nip_bendahara: textValue(row.pick("nip_bendahara")) || null,
      hp_bendahara: textValue(row.pick("hp_bendahara", "no_hp_bendahara")) || null,
      email_bendahara: textValue(row.pick("email_bendahara")) || null,
      nama_bendahara_penerimaan: textValue(row.pick("nama_bendahara_penerimaan")) || null,
      hp_bendahara_penerimaan: textValue(row.pick("hp_bendahara_penerimaan")) || null,
      nama_pic_kepeg: textValue(row.pick("nama_pic_kepeg", "nama_pic_kepegawaian")) || null,
      hp_pic_kepeg: textValue(row.pick("hp_pic_kepeg", "hp_pic_kepegawaian")) || null,
      status: normalizeOpdStatus(row.pick("status_opd")),
      tanggal_input: toIsoDate(row.pick("tanggal_daftar")),
      tanggal_update_kontak: toIsoDate(row.pick("tanggal_update_kontak")),
    });
    if (!npwp) warnings.push(`Masterfile: WP "${nama}" tidak punya NPWP, pencocokan memakai nama.`);
  });
}

function normalizePenerimaan(sheet: ParsedSheet, payload: ImportPayload, warnings: string[]) {
  // Agregasi setoran per (npwp|nama, masa) menurut KD MAP.
  const bucket = new Map<
    string,
    {
      npwp: string | null;
      nama: string | null;
      masa: string;
      pph21: number;
      pph22: number;
      pph23: number;
      pphFinal: number;
      ppn: number;
      depositUmum: number;
      jumlahDipotong: number;
      estimasiWajar: number;
      ketepatan: "tepat_waktu" | "terlambat" | "belum_setor";
      status: "normal" | "under_reporting" | "kritis";
    }
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
    const kind = penerimaanKindFromMap(map);
    if (!kind) {
      warnings.push(`Penerimaan: KD MAP ${map || "(kosong)"} untuk ${nama ?? npwp} belum dipetakan dan dilewati.`);
      return;
    }
    const key = `${npwp ?? nama}__${masa}`;
    const entry = bucket.get(key) ?? {
      npwp,
      nama,
      masa,
      pph21: 0,
      pph22: 0,
      pph23: 0,
      pphFinal: 0,
      ppn: 0,
      depositUmum: 0,
      jumlahDipotong: 0,
      estimasiWajar: 0,
      ketepatan: "tepat_waktu",
      status: "normal",
    };
    entry.jumlahDipotong = Math.max(entry.jumlahDipotong, numberValue(row.pick("jumlah_dipotong")));
    entry.estimasiWajar = Math.max(entry.estimasiWajar, numberValue(row.pick("estimasi_wajar")));
    entry.ketepatan = worstKetepatan(
      entry.ketepatan,
      normalizeKetepatan(row.pick("status_ketepatan", "ketepatan")),
    );
    entry.status = worstPphStatus(
      entry.status,
      normalizePphStatus(row.pick("status_nominal", "status_pph21")),
    );
    if (kind === "pph21") entry.pph21 += nilai;
    else if (kind === "pph22") entry.pph22 += nilai;
    else if (kind === "pph23") entry.pph23 += nilai;
    else if (kind === "pph_final") entry.pphFinal += nilai;
    else if (kind === "ppn") entry.ppn += nilai;
    else entry.depositUmum += nilai;
    bucket.set(key, entry);
  });

  bucket.forEach((entry) => {
    if (entry.depositUmum > 0) {
      payload.deposit.push({
        npwp: entry.npwp,
        nama_opd: entry.nama,
        masa_pajak: entry.masa,
        deposit_kd_411618: entry.depositUmum,
      });
    }
    if (entry.pph22 > 0 || entry.pph23 > 0 || entry.pphFinal > 0 || entry.ppn > 0) {
      const sptMasa = ensureSptMasaRow(payload, entry.npwp, entry.nama, entry.masa);
      sptMasa.pph22_nominal += entry.pph22;
      sptMasa.pph23_nominal += entry.pph23 + entry.pphFinal;
      sptMasa.ppn_put_nominal += entry.ppn;
    }
    if (entry.pph21 > 0) {
      payload.pph21.push({
        npwp: entry.npwp,
        nama_opd: entry.nama,
        bulan: entry.masa,
        jumlah_dipotong: entry.jumlahDipotong,
        nominal_setor: entry.pph21,
        estimasi_wajar: entry.estimasiWajar,
        ketepatan: entry.ketepatan,
        status: entry.status,
      });
    }
  });
}

function normalizePelaporan(sheet: ParsedSheet, payload: ImportPayload, fallbackKind: "pph21" | "unifikasi") {
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
      const kind = pelaporanKindFromJenisSpt(row.pick("jenis_spt"));
      const status = textValue(row.pick("status_pelaporan")) || null;
      const target = ensureSptMasaRow(payload, npwp, nama, masa);
      if (kind === "ppn") target.ppn_put_status = status;
      else if (kind === "unifikasi") setUnifikasiStatus(target, status);
      else if (kind === "pph21") target.pph21_status = status;
      else if (fallbackKind === "unifikasi") setUnifikasiStatus(target, status);
      else target.pph21_status = status;
    });
  });
}

function normalizePegawai(sheet: ParsedSheet, payload: ImportPayload, warnings: string[]) {
  forEachRow(sheet, (row) => {
    const nama = textValue(row.pick("nama", "nama_pegawai"));
    if (!nama) return;
    const opd = textValue(row.pick("nama_satker", "opd", "nama_opd")) || null;
    if (!opd) warnings.push(`Pegawai: "${nama}" tanpa OPD, akan dilewati saat commit bila OPD tak ditemukan.`);
    payload.pegawai.push({
      npwp: textValue(row.pick("npwp", "npwp_pegawai")) || null,
      nik: textValue(row.pick("nik")) || null,
      nama,
      nip: textValue(row.pick("nip", "nip_pegawai")) || null,
      jabatan: textValue(row.pick("jabatan")) || null,
      email: textValue(row.pick("email")) || null,
      phone: textValue(row.pick("no_hp", "phone", "hp", "telepon")) || null,
      jenis_kepegawaian: textValue(row.pick("pns_p3k", "pns_pppk", "pns/p3k", "status_asn")) || null,
      opd_nama: opd,
      status_coretax: normalizePegawaiStatus(
        row.pick("status_coretax", "status_spt", "status_pelaporan", "lapor_spt", "status"),
      ),
    });
  });
}

function normalizePegawaiStatus(value: unknown): "aktif_belum_lapor" | "belum_aktivasi" | "sudah_lapor" {
  const status = textValue(value).toLowerCase();
  if (status === "1" || status === "ya" || status === "y" || status === "true") return "sudah_lapor";
  if (status === "0" || status === "tidak" || status === "n" || status === "false") return "aktif_belum_lapor";
  if (status.includes("belum aktivasi") || status.includes("nonaktif")) return "belum_aktivasi";
  if (status.includes("sudah") || status.includes("submitted")) return "sudah_lapor";
  if (status.includes("belum lapor") || status.includes("aktif")) return "aktif_belum_lapor";
  return "belum_aktivasi";
}

function normalizeYesNo(value: unknown): "YA" | "TIDAK" | null {
  const text = textValue(value).toLowerCase();
  if (!text) return null;
  if (["1", "ya", "y", "true", "wajib"].includes(text)) return "YA";
  if (["0", "tidak", "n", "false", "bukan"].includes(text)) return "TIDAK";
  return null;
}

function normalizeOpdStatus(value: unknown): "aktif" | "tidak_aktif" | "perlu_update" | null {
  const text = textValue(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (text === "aktif") return "aktif";
  if (text === "tidak_aktif" || text === "nonaktif") return "tidak_aktif";
  if (text === "perlu_update") return "perlu_update";
  return null;
}

function normalizeKetepatan(value: unknown): "tepat_waktu" | "terlambat" | "belum_setor" {
  const text = textValue(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (text.includes("belum") || text.includes("nihil")) return "belum_setor";
  if (text.includes("terlambat")) return "terlambat";
  return "tepat_waktu";
}

function normalizePphStatus(value: unknown): "normal" | "under_reporting" | "kritis" {
  const text = textValue(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (text.includes("kritis")) return "kritis";
  if (text.includes("under")) return "under_reporting";
  return "normal";
}

function worstKetepatan(
  current: "tepat_waktu" | "terlambat" | "belum_setor",
  candidate: "tepat_waktu" | "terlambat" | "belum_setor",
) {
  const rank = { tepat_waktu: 0, terlambat: 1, belum_setor: 2 };
  return rank[candidate] > rank[current] ? candidate : current;
}

function worstPphStatus(
  current: "normal" | "under_reporting" | "kritis",
  candidate: "normal" | "under_reporting" | "kritis",
) {
  const rank = { normal: 0, under_reporting: 1, kritis: 2 };
  return rank[candidate] > rank[current] ? candidate : current;
}

function normalizeSosialisasiStatus(value: unknown): "sudah" | "belum" | "perlu_ulang" | null {
  const text = textValue(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!text) return null;
  if (text.includes("ulang")) return "perlu_ulang";
  if (text.includes("belum")) return "belum";
  if (text.includes("sudah")) return "sudah";
  return null;
}

function normalizeSosialisasi(sheet: ParsedSheet, payload: ImportPayload) {
  const groups = [
    {
      tema: "Tema PPh Pasal 21",
      tanggal: "tema_pph_pasal_21_hari_tgl_pelaksanaan_sosialisasi",
      tempat: "tema_pph_pasal_21_tempat",
      peserta: "tema_pph_pasal_21_jumlah_peserta",
    },
    {
      tema: "Tema SPT PPh Orang Pribadi",
      tanggal: "tema_spt_pph_orang_pribadi_hari_tgl_pelaksanaan_sosialisasi",
      tempat: "tema_spt_pph_orang_pribadi_tempat",
      peserta: "tema_spt_pph_orang_pribadi_jumlah_peserta",
    },
  ];

  forEachRow(sheet, (row) => {
    const nama = textValue(row.pick("nama_opd"));
    if (!nama) return;
    const base = {
      npwp: textValue(row.pick("npwp")) || null,
      nama_opd: nama,
      wilayah: textValue(row.pick("wilayah_kerja", "wilayah")) || null,
      penyuluh_nama: textValue(row.pick("nama_penyuluh", "penyuluh")) || null,
      penyuluh_nip: textValue(row.pick("nip_penyuluh")) || null,
      status: normalizeSosialisasiStatus(row.pick("status_sesi", "status")),
    };
    let hasGroupedSession = false;

    groups.forEach((group) => {
      const tanggal = toIsoDate(row.pick(group.tanggal));
      const tempat = textValue(row.pick(group.tempat)) || null;
      const jumlahPeserta = numberValue(row.pick(group.peserta));
      if (!tanggal && !tempat && jumlahPeserta <= 0) return;
      hasGroupedSession = true;
      payload.sosialisasi.push({
        ...base,
        tanggal,
        tempat,
        tema: group.tema,
        jumlah_peserta: jumlahPeserta,
      });
    });

    if (!hasGroupedSession) {
      payload.sosialisasi.push({
        ...base,
        tanggal: toIsoDate(row.pick("hari_tgl_pelaksanaan_sosialisasi", "tanggal", "hari_tgl")),
        tempat: textValue(row.pick("tempat")) || null,
        tema: textValue(row.pick("tema")) || null,
        jumlah_peserta: numberValue(row.pick("jumlah_peserta")),
      });
    }
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
    pph22_nominal: 0,
    pph22_status: null,
    pph23_nominal: 0,
    pph23_status: null,
    ppn_put_nominal: 0,
    ppn_put_status: null,
    pph21_status: null,
  };
  payload.sptMasa.push(created);
  return created;
}

function penerimaanKindFromMap(kdMap: string): PenerimaanKind | null {
  return PENERIMAAN_KIND_BY_MAP[kdMap] ?? null;
}

function pelaporanKindFromJenisSpt(value: unknown): "pph21" | "unifikasi" | "ppn" | null {
  const jenis = textValue(value).toLowerCase();
  if (jenis.includes("ppn")) return "ppn";
  if (jenis.includes("unifikasi")) return "unifikasi";
  if (jenis.includes("21") || jenis.includes("26")) return "pph21";
  return null;
}

function setUnifikasiStatus(row: ImportPayload["sptMasa"][number], status: string | null) {
  row.pph22_status = status;
  row.pph23_status = status;
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
      headers = headerMap([toTextRow(row)]);
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
  const depth = headerDepth(sheet);
  const headers = headerMap(sheet.headerRows.slice(0, depth));
  sheet.rows.slice(depth).forEach((raw) => {
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

function headerDepth(sheet: ParsedSheet): number {
  const first = new Set((sheet.headerRows[0] ?? []).map(slug));
  const second = new Set((sheet.headerRows[1] ?? []).map(slug));
  if (
    first.has("nama_opd") &&
    first.has("wilayah_kerja") &&
    (first.has("tema_pph_pasal_21") || first.has("tema_spt_pph_orang_pribadi")) &&
    second.has("hari_tgl_pelaksanaan_sosialisasi")
  ) {
    return 2;
  }
  return 1;
}

function pickFrom(headers: Map<string, number>, raw: Array<string | number | Date | null>, keys: string[]) {
  for (const key of keys) {
    const index = headers.get(key);
    if (index !== undefined && !isBlank(raw[index])) return raw[index];
  }
  return null;
}

function headerMap(headerRows: string[][]): Map<string, number> {
  const map = new Map<string, number>();
  const maxColumns = Math.max(0, ...headerRows.map((row) => row.length));

  for (let index = 0; index < maxColumns; index += 1) {
    const parts = headerRows.map((row) => row[index]).filter((value) => !isBlank(value));
    const uniqueParts = parts.filter((part, partIndex) => partIndex === 0 || slug(part) !== slug(parts[partIndex - 1]));
    const keys = [slug(uniqueParts.join(" ")), slug(parts[parts.length - 1])].filter(Boolean);
    keys.forEach((key) => {
      if (!map.has(key)) map.set(key, index);
    });
  }
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
