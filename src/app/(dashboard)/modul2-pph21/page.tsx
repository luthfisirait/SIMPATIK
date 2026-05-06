import { Download, ReceiptText, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForPph } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listPph21 } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, monthLabel } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  normal: "Normal",
  under_reporting: "Under-reporting",
  kritis: "Kritis",
  tepat_waktu: "Tepat waktu",
  terlambat: "Terlambat",
  belum_setor: "Belum setor",
};

export default async function ModulPph21Page({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : undefined;
  const page = numericParam(searchParams, "page");
  const result = listPph21({ q, wilayah, pphStatus: status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const exportQuery = queryString({ q, wilayah, status });
  const exportHref = exportQuery ? `/api/export/pph21?${exportQuery}` : "/api/export/pph21";

  return (
    <>
      <PageHeader
        title="Modul 2 - PPh Pasal 21"
        description={`Monitoring status bendahara untuk masa ${monthLabel(result.bulan)}.`}
        actions={
          <Link className="btn btn-secondary" href={exportHref} target="_blank">
            <Download size={16} />
            Export CSV
          </Link>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Sudah Setor" value={formatNumber(result.summary.tepat)} sub="Bendahara tepat waktu" accent="green" icon={<ReceiptText size={18} />} />
        <KpiCard label="Belum/Terlambat" value={formatNumber(result.summary.belum)} sub="Perlu imbauan masa pajak" accent="red" icon={<ReceiptText size={18} />} />
        <KpiCard label="Under-reporting" value={formatNumber(result.summary.under_reporting)} sub="Setoran di bawah estimasi" accent="gold" icon={<ReceiptText size={18} />} />
        <KpiCard label="Total Setoran" value={formatCompactRupiah(result.summary.total_setor)} sub="Nominal PPh 21 tercatat" accent="navy" icon={<ReceiptText size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Status Bendahara per OPD</div>
            <div className="card-subtitle">Nominal setor dibanding estimasi wajar tiap masa pajak.</div>
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
              <option value="normal">Normal</option>
              <option value="under_reporting">Under-reporting</option>
              <option value="kritis">Kritis</option>
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
                <th>Dip/t</th>
                <th>Nominal Setor</th>
                <th>Estimasi</th>
                <th>Ketepatan</th>
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
                  <td className="td-mono">{formatNumber(item.jumlah_dipotong)}</td>
                  <td className="td-mono">{formatCompactRupiah(item.nominal_setor)}</td>
                  <td className="td-mono">{formatCompactRupiah(item.estimasi_wajar)}</td>
                  <td>
                    <Badge tone={toneForPph(item.ketepatan)}>{statusLabel[item.ketepatan]}</Badge>
                  </td>
                  <td>
                    <Badge tone={toneForPph(item.status)}>{statusLabel[item.status]}</Badge>
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
          <Pagination page={result.page} pages={result.pages} basePath="/modul2-pph21" query={keepQuery({ q, wilayah, status })} />
        </div>
      </div>
    </>
  );
}
