"use client";

import { Download, Eye, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { PphMasaJenisSummary, PphMasaLaporDetailRow, PphMasaLaporStatus } from "@/types";
import { downloadCsv, safeCsvFileName } from "@/lib/client-csv";
import { queryString } from "@/lib/search";
import { formatCompactRupiah, formatNumber, monthFullLabel } from "@/lib/utils";

type ActiveList = {
  jenis: string;
  status: PphMasaLaporStatus;
};

type PphMasaRekapTableProps = {
  summary: PphMasaJenisSummary[];
  detailRows: PphMasaLaporDetailRow[];
  q: string;
  wilayah: string;
  ar: string;
  bulan: string;
  periodOptions: string[];
};

function statusLabel(status: PphMasaLaporStatus) {
  return status === "sudah_lapor" ? "Sudah Lapor" : "Belum Lapor";
}

function detailHref(item: PphMasaJenisSummary, q: string, wilayah: string, ar: string, bulan: string) {
  const query = queryString({ q, wilayah, ar, masa: bulan, jenis: item.key });
  return query ? `/rincian-pph-masa?${query}` : "/rincian-pph-masa";
}

export function PphMasaRekapTable({ summary, detailRows, q, wilayah, ar, bulan, periodOptions }: PphMasaRekapTableProps) {
  const [activeList, setActiveList] = useState<ActiveList | null>(null);
  const activeRows = useMemo(
    () => (activeList ? detailRows.filter((row) => row.jenis === activeList.jenis && row.status === activeList.status) : []),
    [activeList, detailRows],
  );

  function exportActiveRows() {
    if (!activeList) return;

    downloadCsv(
      safeCsvFileName("pph-masa", activeList.jenis, activeList.status, bulan),
      [
        { header: "Nama OPD", value: (row) => row.opd_nama },
        { header: "Wilayah", value: (row) => row.wilayah_nama },
        { header: "Jenis PPh Masa", value: (row) => row.jenis },
        { header: "Status", value: () => statusLabel(activeList.status) },
        { header: "Status Lapor", value: (row) => row.status_lapor ?? "-" },
        { header: "Bendahara", value: (row) => row.nama_bendahara },
        { header: "AR", value: (row) => row.ar_nama ?? "-" },
      ],
      activeRows,
    );
  }

  useEffect(() => {
    if (!activeList) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveList(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeList]);

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Ringkasan Lapor per Jenis PPh Masa</div>
          </div>
          <form className="filter-bar" method="get" style={{ marginBottom: 0 }}>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <input type="hidden" name="wilayah" value={wilayah} />
            <input type="hidden" name="ar" value={ar} />
            <select className="inline-select" name="bulan" defaultValue={bulan} aria-label="Periode PPh Masa">
              {periodOptions.map((period) => (
                <option key={period} value={period}>
                  {monthFullLabel(period)}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" type="submit">
              Filter
            </button>
          </form>
        </div>
        <div className="table-wrap">
          <table className="data-table compact-table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "17%" }} />
              <col style={{ width: "32%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Jenis PPh Masa</th>
                <th>Keterangan</th>
                <th>Nilai Setor</th>
                <th>Wajib Lapor</th>
                <th>Sudah Lapor</th>
                <th>Belum Lapor</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item) => (
                <tr key={item.jenis}>
                  <td>
                    <strong>{item.jenis}</strong>
                  </td>
                  <td className="muted">{item.keterangan}</td>
                  <td className="td-mono">
                    <strong>{formatCompactRupiah(item.nilai_setor)}</strong>
                  </td>
                  <td>
                    <strong>{formatNumber(item.wajib_lapor)}</strong>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{formatNumber(item.sudah_lapor)}</span>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setActiveList({ jenis: item.jenis, status: "sudah_lapor" })}>
                        <Eye size={14} />
                        Lihat
                      </button>
                    </div>
                  </td>
                  <td className={item.belum_lapor > 0 ? "text-red" : "text-green"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong>{formatNumber(item.belum_lapor)}</strong>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setActiveList({ jenis: item.jenis, status: "belum_lapor" })}>
                        <Eye size={14} />
                        Lihat
                      </button>
                    </div>
                  </td>
                  <td>
                    <Link className="btn btn-ghost btn-sm" href={detailHref(item, q, wilayah, ar, bulan)}>
                      <Eye size={14} />
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">Periode mengikuti kolom Masa Pajak pada file Pelaporan SPT Masa.</span>
        </div>
      </div>

      {activeList ? (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="pph-masa-rekap-title" onClick={() => setActiveList(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title" id="pph-masa-rekap-title">
                  {statusLabel(activeList.status)} - {activeList.jenis}
                </div>
                <div className="card-subtitle">
                  {formatNumber(activeRows.length)} OPD pada periode {monthFullLabel(bulan)}
                </div>
              </div>
              <button className="icon-btn" type="button" aria-label="Tutup dialog" onClick={() => setActiveList(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="table-wrap">
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th>Nama OPD</th>
                      <th>Wilayah</th>
                      <th>Status Lapor</th>
                      <th>Bendahara</th>
                      <th>AR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          Tidak ada OPD pada kategori ini.
                        </td>
                      </tr>
                    ) : (
                      activeRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.opd_nama}</strong>
                          </td>
                          <td className="td-mono">{row.wilayah_nama}</td>
                          <td>{row.status_lapor ?? "-"}</td>
                          <td>{row.nama_bendahara}</td>
                          <td>{row.ar_nama ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" type="button" onClick={exportActiveRows} disabled={activeRows.length === 0}>
                <Download size={16} />
                Ekspor
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setActiveList(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}