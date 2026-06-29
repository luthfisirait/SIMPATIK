import { ArrowDown, ArrowUp, Download, Search, Send } from "lucide-react";
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
  if (value === "hijau") return "Tinggi";
  if (value === "kuning") return "Sedang";
  if (value === "merah") return "Rendah";
  return value;
}

function normalizeSaldoSort(value: string) {
  return value === "saldo_asc" ? "saldo_asc" : "saldo_desc";
}

export default async function ModulDepositPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const sort = normalizeSaldoSort(firstParam(searchParams, "sort", "saldo_desc"));
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listDeposit({ q, wilayah, overallStatus: status, ar, sort, page, pageSize: 12 });
  const dialogRows = listDepositDialogRows({ q, wilayah, ar, sort, masa: result.masa });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const exportQuery = queryString({ q, wilayah, status, ar, sort, masa: result.masa });
  const exportHref = exportQuery ? `/api/export/deposit?${exportQuery}` : "/api/export/deposit";
  const nextSaldoSort = sort === "saldo_desc" ? "saldo_asc" : "saldo_desc";
  const saldoSortHref = `/modul5-deposit?${queryString({ q, wilayah, status, ar, sort: nextSaldoSort })}`;
  const SaldoSortIcon = sort === "saldo_desc" ? ArrowDown : ArrowUp;

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
            <input type="hidden" name="sort" value={sort} />
            <input className="search-input" name="q" placeholder="Cari OPD" defaultValue={q} style={{ maxWidth: 260 }} />
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 180 }}>
              <option value="all">Semua Kategori</option>
              <option value="hijau">Saldo Tinggi</option>
              <option value="kuning">Saldo Sedang</option>
              <option value="merah">Saldo Rendah</option>
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
                <th>Seksi</th>
                <th aria-sort={sort === "saldo_desc" ? "descending" : "ascending"}>
                  <Link
                    href={saldoSortHref}
                    aria-label={`Urutkan saldo deposit ${nextSaldoSort === "saldo_desc" ? "terbesar ke terkecil" : "terkecil ke terbesar"}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    title={sort === "saldo_desc" ? "Saat ini terbesar ke terkecil" : "Saat ini terkecil ke terbesar"}
                  >
                    Saldo Deposit
                    <SaldoSortIcon size={13} aria-hidden="true" />
                  </Link>
                </th>
                <th>Status</th>
                <th>AR</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
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
                    <td>{item.seksi ?? "-"}</td>
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
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} OPD - Rendah Rp 0-100 Jt - Sedang Rp 100 Jt-1 Miliar - Tinggi &gt;Rp 1 Miliar
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul5-deposit" query={keepQuery({ q, wilayah, status, ar, sort })} />
        </div>
      </div>
    </>
  );
}
