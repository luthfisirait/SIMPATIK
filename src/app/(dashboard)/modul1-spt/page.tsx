import { Download, FileCheck2, Search, Send } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listSpt } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, formatPercent, monthLabel, trafficLabel } from "@/lib/utils";

export default async function ModulSptPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listSpt({ q, wilayah, traffic: status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const count = (key: string) => result.summary.find((item) => item.status === key)?.total ?? 0;
  const belumLapor = result.summary.reduce((sum, item) => sum + item.belum_lapor, 0);
  const exportQuery = queryString({ q, wilayah, status, ar });
  const exportHref = exportQuery ? `/api/export/spt?${exportQuery}` : "/api/export/spt";

  return (
    <>
      <PageHeader
        title="Modul 1 - SPT PPh OP"
        description={`Monitoring kepatuhan SPT per OPD untuk ${monthLabel(result.periode)}.`}
        actions={
          <>
            <Link className="btn btn-secondary" href={exportHref} target="_blank">
              <Download size={16} />
              Export CSV
            </Link>
            <button className="btn btn-primary" type="button">
              <Send size={16} />
              Kirim Imbauan
            </button>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="OPD Hijau" value={formatNumber(count("hijau"))} sub="Kepatuhan di atas 70%" accent="green" icon={<FileCheck2 size={18} />} />
        <KpiCard label="OPD Kuning" value={formatNumber(count("kuning"))} sub="Perlu penguatan AR" accent="gold" icon={<FileCheck2 size={18} />} />
        <KpiCard label="OPD Merah" value={formatNumber(count("merah"))} sub="Prioritas tindak lanjut" accent="red" icon={<FileCheck2 size={18} />} />
        <KpiCard label="Total Belum Lapor" value={formatNumber(belumLapor)} sub={`${formatNumber(result.total)} OPD termonitor`} accent="navy" icon={<FileCheck2 size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar Lengkap OPD - Status Kepatuhan SPT</div>
            <div className="card-subtitle">Search, filter wilayah, AR, status, dan pagination server-side.</div>
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
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 180 }}>
              <option value="all">Semua status</option>
              <option value="hijau">Hijau</option>
              <option value="kuning">Kuning</option>
              <option value="merah">Merah</option>
            </select>
            <select className="search-input" name="ar" defaultValue={ar} style={{ maxWidth: 220 }}>
              <option value="all">Semua AR</option>
              {arOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama}
                </option>
              ))}
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
                <th>AR</th>
                <th>Wajib</th>
                <th>Sudah</th>
                <th>Kepatuhan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.opd_nama}</strong>
                  </td>
                  <td>{item.wilayah_nama}</td>
                  <td>{item.ar_nama}</td>
                  <td className="td-mono">{formatNumber(item.jumlah_wajib_lapor)}</td>
                  <td className="td-mono">{formatNumber(item.jumlah_sudah_lapor)}</td>
                  <td className="td-mono">{formatPercent(item.persen_kepatuhan)}</td>
                  <td>
                    <Badge tone={toneForTraffic(item.traffic_light)}>{trafficLabel(item.traffic_light)}</Badge>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" type="button">
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} OPD
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul1-spt" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
