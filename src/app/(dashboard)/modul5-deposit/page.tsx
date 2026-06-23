import { Download, Search, Send } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listDeposit, listDepositDialogRows } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber } from "@/lib/utils";

import { DepositKpiDialog } from "./DepositKpiDialog";

function depositStatusLabel(value: string) {
  if (value === "hijau") return "Aman";
  if (value === "kuning") return "Rendah";
  if (value === "merah") return "Kritis";
  return value;
}

export default async function ModulDepositPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listDeposit({ q, wilayah, overallStatus: status, ar, page, pageSize: 12 });
  const dialogRows = listDepositDialogRows({ q, wilayah, ar, masa: result.masa });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const exportQuery = queryString({ q, wilayah, status, ar, masa: result.masa });
  const exportHref = exportQuery ? `/api/export/deposit?${exportQuery}` : "/api/export/deposit";

  return (
    <>
      <PageHeader
        title="Monitoring Deposit Pajak OPD"
        description="Pantau saldo deposit pajak OPD di Coretax DJP. Deteksi dini potensi gagal bayar."
        actions={
          <>
            <Link className="btn btn-secondary" href="/action-log/input">
              <Send size={16} />
              Peringatan
            </Link>
            <Link className="btn btn-primary" href={exportHref} target="_blank">
              <Download size={16} />
              Unduh
            </Link>
          </>
        }
      />

      <DepositKpiDialog rows={dialogRows} />

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Saldo Deposit Pajak per OPD</div>
            <div className="card-subtitle">Sumber: Data Penerimaan KD MAP 411618</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD" defaultValue={q} style={{ maxWidth: 260 }} />
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 180 }}>
              <option value="all">Semua Status</option>
              <option value="hijau">Aman</option>
              <option value="kuning">Rendah</option>
              <option value="merah">Kritis</option>
            </select>
            <select className="search-input" name="wilayah" defaultValue={wilayah} style={{ maxWidth: 220 }}>
              <option value="all">Semua wilayah</option>
              {wilayahOptions.map((item) => (
                <option key={item.kode} value={item.kode}>
                  {item.nama}
                </option>
              ))}
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
                <th>Saldo Deposit</th>
                <th>Status</th>
                <th>AR</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Belum ada data deposit.
                  </td>
                </tr>
              ) : (
                result.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.opd_nama}</strong>
                    </td>
                    <td className="td-mono">{item.wilayah_nama}</td>
                    <td className="td-mono">
                      <strong>{formatCompactRupiah(item.total_deposit)}</strong>
                    </td>
                    <td>
                      <Badge tone={toneForTraffic(String(item.status_deposit_overall))}>{depositStatusLabel(String(item.status_deposit_overall))}</Badge>
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
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} OPD - Kritis &lt;Rp 2 jt - Rendah Rp 2-10 jt - Aman &gt;Rp 10 jt
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul5-deposit" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
