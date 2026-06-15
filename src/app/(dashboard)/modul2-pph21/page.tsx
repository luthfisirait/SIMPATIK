import { BarChart3, Download, ReceiptText, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForPph } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listPph21 } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, formatPercent, monthLabel } from "@/lib/utils";

const pphLabel: Record<string, string> = {
  tepat_waktu: "Tepat waktu",
  terlambat: "Terlambat",
  belum_setor: "Belum setor",
  normal: "Normal",
  under_reporting: "Under reporting",
  kritis: "Kritis",
};

export default async function ModulPph21Page({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listPph21({ q, wilayah, pphStatus: status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const totalBayar = result.summary.tepat + result.summary.belum;
  const persenTepat = totalBayar === 0 ? 0 : (result.summary.tepat * 100) / totalBayar;
  const exportQuery = queryString({ q, wilayah, status, ar, bulan: result.bulan });
  const exportHref = exportQuery ? `/api/export/pph21?${exportQuery}` : "/api/export/pph21";

  return (
    <>
      <PageHeader
        title="Monitoring PPh Masa OPD"
        description={`Rekap pembayaran PPh Pasal 21 per OPD untuk ${monthLabel(result.bulan)}.`}
        actions={
          <>
            <button className="btn btn-secondary" type="button">
              <BarChart3 size={16} />
              Rekonsiliasi
            </button>
            <Link className="btn btn-primary" href={exportHref} target="_blank">
              <Download size={16} />
              Unduh
            </Link>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Tepat Waktu" value={formatNumber(result.summary.tepat)} sub={formatPercent(persenTepat)} accent="green" icon={<ReceiptText size={18} />} />
        <KpiCard label="Belum / Terlambat Bayar" value={formatNumber(result.summary.belum)} sub="Koordinasi AR segera" accent="red" icon={<ReceiptText size={18} />} />
        <KpiCard label="Under Reporting" value={formatNumber(result.summary.under_reporting)} sub="Perlu rekonsiliasi" accent="gold" icon={<ReceiptText size={18} />} />
        <KpiCard label="Total Setoran" value={formatCompactRupiah(result.summary.total_setor)} sub={monthLabel(result.bulan)} accent="teal" icon={<ReceiptText size={18} />} />
      </section>

      <div className="section-divider">Rekap Kepatuhan PPh Pasal 21</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Ringkasan Bayar PPh Pasal 21</div>
          </div>
          <div className="muted">{monthLabel(result.bulan)}</div>
        </div>
        <div className="table-wrap">
          <table className="data-table wide-table">
            <thead>
              <tr>
                <th>Jenis PPh Masa</th>
                <th>Wajib Bayar</th>
                <th>Tepat Waktu</th>
                <th>Belum/Terlambat</th>
                <th>Under Reporting</th>
                <th>Total Setoran</th>
                <th>% Tepat Waktu</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>PPh Pasal 21</strong>
                </td>
                <td>{formatNumber(totalBayar)}</td>
                <td>{formatNumber(result.summary.tepat)}</td>
                <td className={result.summary.belum > 0 ? "text-red" : "text-green"}>
                  <strong>{formatNumber(result.summary.belum)}</strong>
                </td>
                <td>{formatNumber(result.summary.under_reporting)}</td>
                <td>{formatCompactRupiah(result.summary.total_setor)}</td>
                <td>
                  <Badge tone={persenTepat >= 90 ? "green" : persenTepat >= 70 ? "amber" : "red"}>{formatPercent(persenTepat)}</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-divider">Detail Bayar per OPD</div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rincian PPh Pasal 21 per OPD</div>
            <div className="card-subtitle">Nama OPD - wilayah - nominal setor - status pembayaran - bendahara - AR</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD" defaultValue={q} style={{ maxWidth: 260 }} />
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
              <option value="under_reporting">Under reporting</option>
              <option value="kritis">Kritis</option>
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
          <table className="data-table wide-table">
            <thead>
              <tr>
                <th>Nama OPD</th>
                <th>Wilayah</th>
                <th>Masa</th>
                <th>Jumlah Dipotong</th>
                <th>Nominal Setor</th>
                <th>Estimasi Wajar</th>
                <th>Ketepatan</th>
                <th>Status</th>
                <th>AR</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Belum ada data PPh Pasal 21.
                  </td>
                </tr>
              ) : (
                result.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.opd_nama}</td>
                    <td className="td-mono">{item.wilayah_nama}</td>
                    <td className="td-mono">{monthLabel(item.bulan)}</td>
                    <td>{formatNumber(item.jumlah_dipotong)}</td>
                    <td className="td-mono">
                      <strong>{formatCompactRupiah(item.nominal_setor)}</strong>
                    </td>
                    <td className="td-mono">{formatCompactRupiah(item.estimasi_wajar)}</td>
                    <td>
                      <Badge tone={toneForPph(item.ketepatan)}>{pphLabel[item.ketepatan]}</Badge>
                    </td>
                    <td>
                      <Badge tone={toneForPph(item.status)}>{pphLabel[item.status]}</Badge>
                    </td>
                    <td>{item.ar_nama ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} baris
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul2-pph21" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
