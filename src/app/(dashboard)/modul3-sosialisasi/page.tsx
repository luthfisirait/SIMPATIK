import { CalendarPlus, Download, Presentation, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listSosialisasi } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber } from "@/lib/utils";

const statusTone: Record<string, "green" | "amber" | "red"> = {
  sudah: "green",
  perlu_ulang: "amber",
  belum: "red",
};

const statusLabel: Record<string, string> = {
  sudah: "Sudah",
  perlu_ulang: "Perlu ulang",
  belum: "Belum",
};

export default async function ModulSosialisasiPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : undefined;
  const page = numericParam(searchParams, "page");
  const result = listSosialisasi({ q, wilayah, status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const exportQuery = queryString({ q, wilayah, status });
  const exportHref = exportQuery ? `/api/export/sosialisasi?${exportQuery}` : "/api/export/sosialisasi";

  return (
    <>
      <PageHeader
        title="Modul 3 - Sosialisasi Coretax"
        description="Rekam jejak sosialisasi, peserta, dan OPD prioritas yang belum terjangkau."
        actions={
          <>
            <Link className="btn btn-secondary" href={exportHref} target="_blank">
              <Download size={16} />
              Export CSV
            </Link>
            <button className="btn btn-primary" type="button">
              <CalendarPlus size={16} />
              Jadwalkan
            </button>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Sudah Disosialisasi" value={formatNumber(result.summary.sudah)} sub="OPD memiliki rekam jejak" accent="green" icon={<Presentation size={18} />} />
        <KpiCard label="Belum Disosialisasi" value={formatNumber(result.summary.belum)} sub="Masuk daftar prioritas" accent="red" icon={<Presentation size={18} />} />
        <KpiCard label="Total Peserta" value={formatNumber(result.summary.peserta)} sub="Akumulasi peserta tercatat" accent="gold" icon={<Presentation size={18} />} />
        <KpiCard label="Sesi Terlaksana" value={formatNumber(result.summary.sesi)} sub="Rekam jejak per OPD" accent="navy" icon={<Presentation size={18} />} />
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Rekam Jejak Sosialisasi</div>
              <div className="card-subtitle">Filter berdasarkan wilayah dan status pelaksanaan.</div>
            </div>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>OPD</th>
                  <th>Wilayah</th>
                  <th>Tanggal</th>
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
                    <td className="td-mono">{new Date(item.tanggal).toLocaleDateString("id-ID")}</td>
                    <td className="td-mono">{formatNumber(item.jumlah_peserta)}</td>
                    <td>{item.penyuluh_nama}</td>
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
            <Pagination page={result.page} pages={result.pages} basePath="/modul3-sosialisasi" query={keepQuery({ q, wilayah, status })} />
          </div>
        </div>

        <aside className="card">
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
      </section>
    </>
  );
}
