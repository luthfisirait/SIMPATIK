"use client";

import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import type { ImportPreviewResult } from "@/lib/import-data";

type CommitResult = {
  created: number;
  ids: number[];
};

export function ImportDataClient() {
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setPreview(null);
    setLoadingPreview(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/import/preview", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    setLoadingPreview(false);

    if (!response.ok) {
      setError(payload.message ?? "Gagal membaca file import.");
      return;
    }

    setPreview(payload);
  }

  async function handleCommit() {
    if (!preview || preview.validCount === 0 || preview.invalidCount > 0) return;
    setError("");
    setSuccess("");
    setLoadingCommit(true);

    const response = await fetch("/api/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset: "opd", rows: preview.validRows }),
    });
    const payload = (await response.json()) as CommitResult & { message?: string };
    setLoadingCommit(false);

    if (!response.ok) {
      setError(payload.message ?? "Import dibatalkan. Tidak ada data yang disimpan.");
      return;
    }

    setSuccess(`${payload.created.toLocaleString("id-ID")} OPD berhasil diimpor.`);
    setPreview(null);
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Upload Dataset OPD</div>
          <div className="card-subtitle">Format CSV atau XLSX dengan header sesuai kolom master OPD.</div>
        </div>
        <FileSpreadsheet size={18} color="var(--text-3)" />
      </div>
      <div className="card-body">
        <form className="filter-bar" onSubmit={handlePreview}>
          <input type="hidden" name="dataset" value="opd" />
          <input className="search-input" name="file" type="file" accept=".csv,.xlsx" required style={{ maxWidth: 360 }} />
          <button className="btn btn-primary" type="submit" disabled={loadingPreview}>
            <UploadCloud size={16} />
            {loadingPreview ? "Membaca..." : "Preview"}
          </button>
        </form>

        {error ? <div className="badge badge-red import-message">{error}</div> : null}
        {success ? <div className="badge badge-green import-message">{success}</div> : null}

        {preview ? (
          <>
            <div className="toolbar import-summary">
              <Badge tone="green">{preview.validCount} valid</Badge>
              <Badge tone={preview.invalidCount ? "red" : "teal"}>{preview.invalidCount} error</Badge>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={handleCommit}
                disabled={loadingCommit || preview.invalidCount > 0 || preview.validCount === 0}
              >
                {loadingCommit ? "Menyimpan..." : "Commit Import"}
              </button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Baris</th>
                    <th>Nama OPD</th>
                    <th>Wilayah</th>
                    <th>Bendahara</th>
                    <th>PIC</th>
                    <th>Status Validasi</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 60).map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="td-mono">{row.rowNumber}</td>
                      <td>{row.values.nama || "-"}</td>
                      <td>{row.values.wilayah || row.values.wilayah_id || "-"}</td>
                      <td>{row.values.nama_bendahara || "-"}</td>
                      <td>{row.values.nama_pic_kepeg || "-"}</td>
                      <td>
                        {row.errors.length ? (
                          <Badge tone="red">{row.errors.join(" ")}</Badge>
                        ) : (
                          <Badge tone="green">Valid</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
