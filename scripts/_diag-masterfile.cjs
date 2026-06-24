// Diagnostic: jalankan parser asli pada file masterfile untuk menemukan baris OPD ekstra.
// Pakai: node scripts/_diag-masterfile.cjs "path/ke/masterfile.xlsx"
const path = require("path");
const ExcelJS = require("exceljs");
const { parseWorkbook, analyzeSheets } = require(path.resolve(process.cwd(), "tmp_build/import-data.js"));

const file = process.argv[2];
if (!file) {
  console.error("Beri path file: node scripts/_diag-masterfile.cjs \"<file.xlsx>\"");
  process.exit(1);
}

(async () => {
  const buf = require("fs").readFileSync(file);
  const sheets = await parseWorkbook(buf);
  console.log("Sheets:", sheets.map((s) => s.name).join(", "));

  const { payload, analysis } = analyzeSheets(sheets, "masterfile");
  console.log("\nanalysis.totalRows =", analysis.totalRows);
  console.log("payload.opd.length =", payload.opd.length);
  if (analysis.warnings.length) console.log("warnings:\n - " + analysis.warnings.join("\n - "));

  // Baris tanpa NPWP (sering jadi footer/judul/ekstra)
  const noNpwp = payload.opd.filter((o) => !o.npwp || !String(o.npwp).replace(/\D/g, ""));
  console.log("\nOPD tanpa NPWP =", noNpwp.length);
  noNpwp.forEach((o) => console.log("  - nama=" + JSON.stringify(o.nama) + " wilayah=" + JSON.stringify(o.wilayah)));

  // NPWP duplikat dalam payload
  const byNpwp = new Map();
  payload.opd.forEach((o) => {
    const k = (o.npwp || "").replace(/\D/g, "");
    if (!k) return;
    byNpwp.set(k, (byNpwp.get(k) || 0) + 1);
  });
  const dups = [...byNpwp.entries()].filter(([, n]) => n > 1);
  console.log("\nNPWP duplikat dalam payload =", dups.length);
  dups.forEach(([k, n]) => console.log("  - " + k + " x" + n));

  // Inspeksi sheet masterfile mentah (baris terakhir)
  const ms = sheets.find((s) => {
    const keys = new Set((s.headerRows.flat() || []).map((v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")));
    return keys.has("npwp16") && keys.has("nama_wp");
  });
  if (ms) {
    console.log("\nSheet masterfile = " + JSON.stringify(ms.name) + " | total baris (termasuk header) = " + ms.rows.length);
    console.log("3 baris terakhir (mentah):");
    ms.rows.slice(-3).forEach((r, i) => console.log("  [" + (ms.rows.length - 3 + i) + "] " + JSON.stringify(r.slice(0, 6))));
  }
})();
