import { Building2, Download, Search, Upload } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { getWilayah, listAr, listOpd } from "@/lib/queries";
import { canCreateOpd } from "@/lib/rbac";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, toWaLink } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  aktif: "Aktif",
  perlu_update: "Perlu Update",
  tidak_aktif: "Tidak Aktif",
};

function statusTone(status: string): "green" | "amber" | "red" | "teal" {
  if (status === "aktif") return "green";
  if (status === "perlu_update") return "amber";
  if (status === "tidak_aktif") return "red";
  return "teal";
}

export default async function DataOpdPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  await ensureGoogleSheetsHydrated();
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listOpd({ q, wilayah, status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const canImport = canCreateOpd(session?.user.role);
  const activeCount = result.data.filter((item) => item.status === "aktif").length;
  const perluUpdateCount = result.data.filter((item) => item.status === "perlu_update").length;
  const wajibLapor = result.data.reduce((sum, item) => sum + (item.total_wajib_lapor ?? item.jumlah_asn + item.jumlah_pppk), 0);
  const exportQuery = queryString({ q, wilayah, status, ar });
  const exportHref = exportQuery ? `/api/export/opd?${exportQuery}` : "/api/export/opd";

  return (
    <>
      <PageHeader
        title="Data OPD"
        description="Basis data OPD, bendahara, PIC kepegawaian, dan AR pengampu."
        actions={
          <>
            {canImport ? (
              <Link className="btn btn-secondary" href="/import">
                <Upload size={16} />
                Import
              </Link>
            ) : null}
            <Link className="btn btn-primary" href={exportHref} target="_blank">
              <Download size={16} />
              Export CSV
            </Link>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="OPD Ditampilkan" value={formatNumber(result.total)} sub="Sesuai filter aktif" accent="navy" icon={<Building2 size={18} />} />
        <KpiCard label="Aktif" value={formatNumber(activeCount)} sub="Pada halaman ini" accent="green" icon={<Building2 size={18} />} />
        <KpiCard label="Perlu Update" value={formatNumber(perluUpdateCount)} sub="Kontak atau profil perlu cek ulang" accent="gold" icon={<Building2 size={18} />} />
        <KpiCard label="Wajib Lapor" value={formatNumber(wajibLapor)} sub="ASN dan PPPK pada halaman ini" accent="teal" icon={<Building2 size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Master OPD dan Kontak Bendahara</div>
            <div className="card-subtitle">Filter wilayah, status, dan AR untuk mempercepat rekonsiliasi data.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD, bendahara, PIC, atau AR" defaultValue={q} style={{ maxWidth: 300 }} />
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
              <option value="aktif">Aktif</option>
              <option value="perlu_update">Perlu update</option>
              <option value="tidak_aktif">Tidak aktif</option>
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
                <th>Nama OPD</th>
                <th>Wilayah</th>
                <th>ASN/PPPK</th>
                <th>Bendahara</th>
                <th>PIC Kepegawaian</th>
                <th>AR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nama}</strong>
                    <div className="muted">{item.jenis_instansi ?? "OPD"}</div>
                  </td>
                  <td>{item.wilayah_nama}</td>
                  <td className="td-mono">{formatNumber(item.total_wajib_lapor ?? item.jumlah_asn + item.jumlah_pppk)}</td>
                  <td>
                    <div>{item.nama_bendahara}</div>
                    <a className="wa-link" href={toWaLink(item.hp_bendahara)} target="_blank">
                      {item.hp_bendahara}
                    </a>
                  </td>
                  <td>
                    <div>{item.nama_pic_kepeg}</div>
                    <a className="wa-link" href={toWaLink(item.hp_pic_kepeg)} target="_blank">
                      {item.hp_pic_kepeg}
                    </a>
                  </td>
                  <td>{item.ar_nama ?? "-"}</td>
                  <td>
                    <Badge tone={statusTone(item.status)}>{statusLabel[item.status] ?? item.status}</Badge>
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
          <Pagination page={result.page} pages={result.pages} basePath="/data-opd" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
