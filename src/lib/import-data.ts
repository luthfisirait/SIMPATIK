import ExcelJS from "exceljs";

import { getDb } from "@/lib/db";
import { createOpd, getWilayah, listAr, type AuditActor, type WriteOpdPayload } from "@/lib/queries";
import { validateOpdPayload } from "@/lib/validation";

type RawRow = Record<string, string>;

export type ImportPreviewRow = {
  rowNumber: number;
  values: RawRow;
  data?: WriteOpdPayload;
  errors: string[];
};

export type ImportPreviewResult = {
  dataset: "opd";
  rows: ImportPreviewRow[];
  validRows: WriteOpdPayload[];
  validCount: number;
  invalidCount: number;
};

const HEADER_ALIASES: Record<string, string[]> = {
  nama: ["nama", "nama opd", "opd", "unit kerja"],
  wilayah_id: ["wilayah_id", "id wilayah"],
  wilayah: ["wilayah", "kode wilayah", "wilayah kode", "nama wilayah"],
  jenis_instansi: ["jenis instansi", "jenis_instansi", "jenis"],
  jumlah_asn: ["jumlah asn", "jumlah_asn", "asn"],
  jumlah_pppk: ["jumlah pppk", "jumlah_pppk", "pppk"],
  npwp_opd: ["npwp opd", "npwp_opd", "npwp"],
  status_pemungut_ppn: ["pemungut ppn", "status pemungut ppn", "status_pemungut_ppn"],
  nama_bendahara: ["nama bendahara", "nama_bendahara", "bendahara"],
  nip_bendahara: ["nip bendahara", "nip_bendahara"],
  hp_bendahara: ["hp bendahara", "hp_bendahara", "kontak bendahara"],
  email_bendahara: ["email bendahara", "email_bendahara"],
  nama_bendahara_penerimaan: ["nama bendahara penerimaan", "nama_bendahara_penerimaan"],
  hp_bendahara_penerimaan: ["hp bendahara penerimaan", "hp_bendahara_penerimaan"],
  nama_pic_kepeg: ["nama pic kepegawaian", "nama pic kepeg", "nama_pic_kepeg", "pic kepegawaian"],
  hp_pic_kepeg: ["hp pic", "hp pic kepegawaian", "hp_pic_kepeg"],
  ar_id: ["ar_id", "id ar"],
  ar: ["ar", "nama ar", "email ar", "ar pengampu"],
  status: ["status", "status opd"],
};

function canonicalHeader(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const entry = Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(normalized));
  return entry?.[0] ?? normalized.replace(/\s+/g, "_");
}

function parseCsv(text: string, delimiter = ",") {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((item) => item.text).join("");
  }
  return String(value);
}

async function readRows(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        values[columnNumber - 1] = (cell.text || cellText(cell.value)).trim();
      });
      if (values.some(Boolean)) rows.push(values);
    });
    return rows;
  }

  const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  return parseCsv(text, delimiter);
}

function tableToRawRows(rows: string[][]) {
  const [headerRow, ...bodyRows] = rows;
  if (!headerRow) return [];
  const headers = headerRow.map(canonicalHeader);

  return bodyRows.map((row, index) => {
    const values: RawRow = {};
    headers.forEach((header, cellIndex) => {
      values[header] = String(row[cellIndex] ?? "").trim();
    });
    return { rowNumber: index + 2, values };
  });
}

function resolveWilayah(value: string, wilayahId: string) {
  if (wilayahId) return Number(wilayahId);
  const normalized = value.trim().toLowerCase();
  const wilayah = getWilayah().find(
    (item) => item.kode.toLowerCase() === normalized || item.nama.toLowerCase() === normalized || String(item.id) === normalized,
  );
  return wilayah?.id ?? 0;
}

function resolveAr(value: string, arId: string) {
  if (arId) return Number(arId);
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const ar = listAr().find(
    (item) => item.email.toLowerCase() === normalized || item.nama.toLowerCase() === normalized || String(item.id) === normalized,
  );
  return ar?.id ?? 0;
}

export function previewOpdRows(rawRows: Array<{ rowNumber: number; values: RawRow }>): ImportPreviewResult {
  const rows = rawRows.slice(0, 500).map((row) => {
    const payload = {
      ...row.values,
      wilayah_id: resolveWilayah(row.values.wilayah ?? "", row.values.wilayah_id ?? ""),
      ar_id: resolveAr(row.values.ar ?? "", row.values.ar_id ?? ""),
      status_pemungut_ppn: row.values.status_pemungut_ppn || "TIDAK",
      status: row.values.status || "aktif",
    };
    const parsed = validateOpdPayload(payload);
    return {
      rowNumber: row.rowNumber,
      values: row.values,
      data: parsed.ok ? parsed.data : undefined,
      errors: parsed.ok ? [] : parsed.errors,
    };
  });
  const validRows = rows.flatMap((row) => (row.data ? [row.data] : []));

  return {
    dataset: "opd",
    rows,
    validRows,
    validCount: validRows.length,
    invalidCount: rows.length - validRows.length,
  };
}

export async function previewOpdImportFile(file: File) {
  const rows = await readRows(file);
  return previewOpdRows(tableToRawRows(rows));
}

export function commitOpdImport(rows: unknown, actor?: AuditActor) {
  if (!Array.isArray(rows)) {
    throw new Error("Payload import tidak valid.");
  }

  const parsedRows = rows.map((row) => validateOpdPayload(row));
  const errors = parsedRows.flatMap((row, index) => (row.ok ? [] : [`Baris ${index + 1}: ${row.errors.join(" ")}`]));
  if (errors.length) {
    throw new Error(errors.join(" "));
  }

  const validRows = parsedRows.flatMap((row) => (row.ok ? [row.data] : []));
  const created: number[] = [];

  const transaction = getDb().transaction(() => {
    validRows.forEach((row) => {
      const item = createOpd(row, { actor, action: "import" });
      if (!item) throw new Error(`Gagal mengimpor ${row.nama}.`);
      created.push(item.id);
    });
  });
  transaction();

  return { created: created.length, ids: created };
}
