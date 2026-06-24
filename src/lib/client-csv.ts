type CsvValue = string | number | null | undefined;

export type CsvExportColumn<T> = {
  header: string;
  value: (row: T) => CsvValue;
};

function quoteCsv(value: CsvValue) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;

  return `"${safe.replace(/"/g, '""')}"`;
}

export function safeCsvFileName(...parts: Array<string | number | null | undefined>) {
  const name = parts
    .map((part) =>
      String(part ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("-");

  return name || "export";
}

export function downloadCsv<T>(filename: string, columns: CsvExportColumn<T>[], rows: T[]) {
  const header = columns.map((column) => quoteCsv(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => quoteCsv(column.value(row))).join(","));
  const csv = `\uFEFF${[header, ...body].join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}