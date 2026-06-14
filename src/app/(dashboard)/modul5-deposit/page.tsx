import { Download, Landmark, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { getWilayah, listAr, listDeposit } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, monthLabel, trafficLabel } from "@/lib/utils";

function statusTone(value: string | null | undefined): "green" | "amber" | "red" | "teal" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("tepat") || normalized.includes("bukan")) return "green";
  if (normalized.includes("terlambat")) return "amber";
  if (normalized.includes("nihil")) return "red";
  return "teal";
}

export default async function ModulDepositPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  await ensureGoogleSheetsHydrated();
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listDeposit({ q, wilayah, overallStatus: status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const count = (key: string) => result.summary.find((item) => item.status === key)?.total ?? 0;
  const totalDeposit = result.summary.reduce((sum, item) => sum + item.nominal, 0);
  const exportQuery = queryString({ q, wilayah, status, ar, masa: result.masa });
  const exportHref = exportQuery ? `/api/export/deposit?${exportQuery}` : "/api/export/deposit";

  return (
    <>
      <PageHeader
        title="Monitoring Deposit Pajak OPD"
        description={`Realisasi setoran seluruh jenis pajak untuk ${monthLabel(result.masa)}.`}
        actions={
          <Link className="btn btn-secondary" href={exportHref} target="_blank">
            <Download size={16} />
            Export CSV
          </Link>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Total Deposit" value={formatCompactRupiah(totalDeposit)} sub="PPh21, unifikasi, dan PPN PUT" accent="navy" icon={<Landmark size={18} />} />
        <KpiCard label="Hijau" value={formatNumber(count("hijau"))} sub="Deposit aman" accent="green" icon={<Landmark size={18} />} />
        <KpiCard label="Kuning" value={formatNumber(count("kuning"))} sub="Ada keterlambatan" accent="gold" icon={<Landmark size={18} />} />
        <KpiCard label="Merah" value={formatNumber(count("merah"))} sub="Ada nihil setoran" accent="red" icon={<Landmark size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Realisasi Deposit per OPD</div>
            <div className="card-subtitle">Menjadi dasar komponen skor deposit di Scoring OPD.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD atau AR" defaultValue={q} style={{ maxWidth: 260 }} />
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
                <th>AR</th>
                <th>PPh 21</th>
                <th>PPh Unifikasi</th>
                <th>PPN PUT</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.opd_nama}</strong>
                    <div className="muted">{item.wilayah_nama}</div>
                  </td>
                  <td>{item.ar_nama ?? "-"}</td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.deposit_pph21)}</div>
                    <Badge tone={statusTone(item.status_pph21)}>{item.status_pph21 ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.deposit_pph_unifikasi)}</div>
                    <Badge tone={statusTone(item.status_unifikasi)}>{item.status_unifikasi ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.deposit_ppn_put)}</div>
                    <Badge tone={statusTone(item.status_ppn_put)}>{item.status_ppn_put ?? "-"}</Badge>
                  </td>
                  <td className="td-mono">{formatCompactRupiah(item.total_deposit)}</td>
                  <td>
                    <Badge tone={toneForTraffic(String(item.status_deposit_overall))}>{trafficLabel(String(item.status_deposit_overall))}</Badge>
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
          <Pagination page={result.page} pages={result.pages} basePath="/modul5-deposit" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
