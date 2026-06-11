"use client";

import { CheckCircle2, Download, FileUp, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import type { ImportAnalysis, ImportCommitResult, ImportTemplateKey } from "@/types";

type PreviewResponse = { mode: "preview"; analysis: ImportAnalysis };
type CommitResponse = { mode: "commit"; analysis: ImportAnalysis; result: ImportCommitResult };
type ApiResponse = Partial<PreviewResponse> & Partial<CommitResponse> & { message?: string };

const TEMPLATE_OPTIONS: Array<{ key: ImportTemplateKey; label: string }> = [
  { key: "masterfile", label: "Masterfile Wajib Pajak" },
  { key: "penerimaan", label: "Data Penerimaan (Setoran)" },
  { key: "pelaporan", label: "Pelaporan SPT Masa" },
  { key: "pegawai", label: "Daftar Pegawai Instansi" },
  { key: "sosialisasi", label: "Rencana/Realisasi Sosialisasi" },
];

const RESULT_LABELS: Array<{ key: keyof ImportCommitResult; label: string }> = [
  { key: "opd_created", label: "OPD baru" },
  { key: "opd_updated", label: "OPD diperbarui" },
  { key: "pph21", label: "Setoran PPh 21" },
  { key: "deposit", label: "Deposit" },
  { key: "spt_masa", label: "SPT Masa" },
  { key: "pegawai", label: "Pegawai" },
  { key: "sosialisasi", label: "Sosialisasi" },
  { key: "skipped", label: "Dilewati" },
];

export function ImportClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<ImportTemplateKey | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);

  function reset(keepFile = false) {
    setAnalysis(null);
    setResult(null);
    setError(null);
    if (!keepFile) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function downloadTemplate() {
    if (!template) {
      setError("Pilih jenis template terlebih dahulu.");
      return;
    }
    window.location.href = `/api/import?template=${encodeURIComponent(template)}`;
  }

  async function send(mode: "preview" | "commit") {
    if (!template) {
      setError("Pilih jenis template terlebih dahulu.");
      return;
    }
    if (!file) {
      setError("Pilih file Excel (.xlsx) terlebih dahulu.");
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("mode", mode);
      body.append("template", template);
      const response = await fetch("/api/import", { method: "POST", body });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(data.message ?? "Gagal memproses file.");
        if (data.analysis) setAnalysis(data.analysis);
        return;
      }
      if (data.analysis) setAnalysis(data.analysis);
      if (mode === "commit" && data.result) {
        setResult(data.result);
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Unggah file</div>
          <div className="card-subtitle">
            Pilih jenis template terlebih dahulu, lalu unggah file .xlsx (maks. 10 MB). Data lama dengan kunci sama akan diperbarui.
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="form-grid">
          <label className="field">
            <span>Jenis template</span>
            <select
              value={template}
              onChange={(event) => {
                setTemplate(event.target.value as ImportTemplateKey | "");
                reset(true);
              }}
            >
              <option value="">— Pilih jenis template —</option>
              {TEMPLATE_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>File Excel (.xlsx)</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                reset(true);
              }}
            />
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <button className="btn btn-ghost" type="button" onClick={downloadTemplate} disabled={!template}>
            <Download size={16} />
            Unduh contoh template
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void send("preview")}
            disabled={busy !== null || !file || !template}
          >
            {busy === "preview" ? <Loader2 size={16} className="spin" /> : <FileUp size={16} />}
            Analisis / Pratinjau
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void send("commit")}
            disabled={busy !== null || !analysis || analysis.totalRows === 0}
          >
            {busy === "commit" ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />}
            Import sekarang
          </button>
        </div>

        {error ? (
          <div className="alert" style={{ marginTop: 16, borderColor: "var(--red)", color: "var(--red)" }}>
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="alert" style={{ marginTop: 16 }}>
            <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} /> Import selesai.
            </strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {RESULT_LABELS.map((item) => (
                <Badge key={item.key} tone={item.key === "skipped" ? "amber" : "teal"}>
                  {item.label}: {result[item.key]}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {analysis ? (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {analysis.detected.length === 0 ? (
                <Badge tone="amber">Tidak ada template terdeteksi</Badge>
              ) : (
                analysis.detected.map((key) => (
                  <Badge key={key} tone="navy">
                    {key}
                  </Badge>
                ))
              )}
            </div>

            {analysis.datasets.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dataset</th>
                      <th>Modul tujuan</th>
                      <th style={{ textAlign: "right" }}>Baris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.datasets.map((dataset) => (
                      <tr key={dataset.key}>
                        <td>{dataset.label}</td>
                        <td className="muted">{dataset.modul}</td>
                        <td style={{ textAlign: "right" }}>{dataset.rows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {analysis.warnings.length > 0 ? (
              <div className="alert" style={{ marginTop: 12, borderColor: "var(--amber)" }}>
                <strong>Catatan ({analysis.warnings.length})</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {analysis.warnings.slice(0, 10).map((warning, index) => (
                    <li key={index} className="muted">
                      {warning}
                    </li>
                  ))}
                  {analysis.warnings.length > 10 ? (
                    <li className="muted">…dan {analysis.warnings.length - 10} catatan lain.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
