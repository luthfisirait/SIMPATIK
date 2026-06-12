"use client";

import { Eye, EyeOff, Search } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { cn, formatNumber } from "@/lib/utils";
import type { SosialisasiRecord, Wilayah } from "@/types";

type PriorityRow = {
  id: number;
  nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  jumlah_asn: number;
};

type SosialisasiResult = {
  data: SosialisasiRecord[];
  summary: {
    sesi: number;
    sudah: number;
    peserta: number;
    belum: number;
  };
  priority: PriorityRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

type SosialisasiWorkspaceProps = {
  result: SosialisasiResult;
  wilayahOptions: Wilayah[];
  q: string;
  wilayah: string;
  status: string;
};

const statusTone: Record<SosialisasiRecord["status"], "green" | "amber" | "red"> = {
  sudah: "green",
  perlu_ulang: "amber",
  belum: "red",
};

const statusLabel: Record<SosialisasiRecord["status"], string> = {
  sudah: "Sudah",
  perlu_ulang: "Perlu ulang",
  belum: "Belum",
};

export function SosialisasiWorkspace({ result, wilayahOptions, q, wilayah, status }: SosialisasiWorkspaceProps) {
  const [showPriority, setShowPriority] = useState(true);

  return (
    <section className={cn("grid-main", "sosialisasi-layout", !showPriority && "sosialisasi-layout-wide")}>
      <div className="card sosialisasi-main-card">
        <div className="card-header">
          <div>
            <div className="card-title">Rekam Jejak Sosialisasi</div>
            <div className="card-subtitle">Filter berdasarkan wilayah dan status pelaksanaan.</div>
          </div>
          <button className="btn btn-secondary" type="button" aria-pressed={!showPriority} onClick={() => setShowPriority((value) => !value)}>
            {showPriority ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPriority ? "Sembunyikan prioritas" : "Tampilkan prioritas"}
          </button>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari nama OPD" defaultValue={q} style={{ maxWidth: 260 }} />
            <select className="search-input" name="wilayah" defaultValue={wilayah} style={{ maxWidth: 220 }}>
              <option value="all">Semua wilayah</option>
              {wilayahOptions.map((item) => (
                <option key={item.kode} value={item.kode}>
                  {item.nama}
                </option>
              ))}
            </select>
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 190 }}>
              <option value="all">Semua status</option>
              <option value="sudah">Sudah</option>
              <option value="perlu_ulang">Perlu ulang</option>
            </select>
            <button className="btn btn-primary" type="submit">
              <Search size={16} />
              Filter
            </button>
          </form>
        </div>
        <div className="table-wrap">
          <table className="data-table sosialisasi-table">
            <thead>
              <tr>
                <th>OPD</th>
                <th>Wilayah</th>
                <th>Tema</th>
                <th>Tanggal</th>
                <th>Tempat</th>
                <th>Peserta</th>
                <th>Penyuluh</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.opd_nama}</strong>
                  </td>
                  <td>{item.wilayah_nama}</td>
                  <td>{item.tema ?? "-"}</td>
                  <td className="td-mono">{new Date(item.tanggal).toLocaleDateString("id-ID")}</td>
                  <td>{item.tempat ?? "-"}</td>
                  <td className="td-mono">{formatNumber(item.jumlah_peserta)}</td>
                  <td>{item.penyuluh_nama ?? "-"}</td>
                  <td>
                    <Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} rekam jejak
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul3-sosialisasi" query={{ q, wilayah, status }} />
        </div>
      </div>

      {showPriority ? (
        <aside className="card sosialisasi-priority-card">
          <div className="card-header">
            <div>
              <div className="card-title">Prioritas Jadwal</div>
              <div className="card-subtitle">OPD belum tercatat, urut ASN terbesar</div>
            </div>
          </div>
          <div className="card-body">
            <div className="insight-list">
              {result.priority.map((item) => (
                <div className="insight-item" key={item.id}>
                  <strong>{item.nama}</strong>
                  <span className="muted">
                    {item.wilayah_nama} - {formatNumber(item.jumlah_asn)} ASN
                  </span>
                  <span className="muted">AR: {item.ar_nama ?? "-"}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
