import { BarChart3, Download, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { KpiListDialog, type KpiDialogCard, type KpiDialogColumn } from "@/components/ui/KpiListDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listPph21, listPphMasaPaymentDialogRows, listPphMasaPayments, listPphMasaPeriods } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, monthFullLabel } from "@/lib/utils";

export default async function ModulPph21Page({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const bulan = firstParam(searchParams, "bulan") || undefined;
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listPph21({ q, wilayah, ar, bulan, page: 1, pageSize: 5 });
  const paymentResult = listPphMasaPayments({ q, wilayah, ar, bulan: result.bulan, page, pageSize: 12 });
  const paymentDialogRows = listPphMasaPaymentDialogRows({ q, wilayah, ar, bulan: result.bulan });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const periodOptions = Array.from(new Set([result.bulan, ...listPphMasaPeriods()]));
  const periodeLabel = monthFullLabel(result.bulan);
  const exportQuery = queryString({ q, wilayah, ar, bulan: result.bulan });
  const exportHref = exportQuery ? `/api/export/pph21?${exportQuery}` : "/api/export/pph21";
  const laporColumns: KpiDialogColumn[] = [
    { key: "jenis", label: "Jenis PPh Masa" },
    { key: "keterangan", label: "Keterangan" },
    { key: "sudah_lapor", label: "Sudah Lapor", className: "td-mono" },
    { key: "belum_lapor", label: "Belum Lapor", className: "td-mono" },
  ];
  const paymentColumns: KpiDialogColumn[] = [
    { key: "opd", label: "Nama OPD" },
    { key: "wilayah", label: "Wilayah", className: "td-mono" },
    { key: "jenis_pph", label: "Jenis PPh" },
    { key: "pembayaran", label: "Jumlah Pembayaran", className: "td-mono" },
    { key: "bendahara", label: "Bendahara" },
  ];
  const laporRow = (item: (typeof result.jenisSummary)[number]) => ({
    id: item.jenis,
    cells: {
      jenis: { value: item.jenis, strong: true },
      keterangan: item.keterangan,
      sudah_lapor: formatNumber(item.sudah_lapor),
      belum_lapor: { value: formatNumber(item.belum_lapor), strong: true },
    },
  });
  const paymentRow = (item: (typeof paymentDialogRows)[number]) => ({
    id: item.id,
    cells: {
      opd: { value: item.opd_nama, strong: true },
      wilayah: item.wilayah_nama,
      jenis_pph: { value: item.jenis_pph, strong: true },
      pembayaran: { value: item.jumlah_pembayaran > 0 ? formatCompactRupiah(item.jumlah_pembayaran) : "-", strong: true },
      bendahara: item.nama_bendahara,
    },
  });
  const totalSudahLapor = result.jenisSummary.reduce((sum, item) => sum + item.sudah_lapor, 0);
  const totalBelumLapor = result.jenisSummary.reduce((sum, item) => sum + item.belum_lapor, 0);
  const totalKewajibanLapor = totalSudahLapor + totalBelumLapor;
  const belumLaporRows = result.jenisSummary.filter((item) => item.belum_lapor > 0);
  const sudahLaporRows = result.jenisSummary.filter((item) => item.sudah_lapor > 0);
  const pphDialogCards: KpiDialogCard[] = [
    {
      key: "belum_lapor",
      label: "Belum Lapor",
      value: formatNumber(totalBelumLapor),
      sub: `${formatNumber(totalKewajibanLapor)} kewajiban masa`,
      accent: "red",
      icon: "receipt",
      columns: laporColumns,
      rows: belumLaporRows.map(laporRow),
      description: `Ringkasan belum lapor per jenis PPh Masa periode ${periodeLabel}`,
    },
    {
      key: "sudah_lapor",
      label: "Sudah Lapor",
      value: formatNumber(totalSudahLapor),
      sub: `${formatNumber(totalKewajibanLapor)} kewajiban masa`,
      accent: "green",
      icon: "receipt",
      columns: laporColumns,
      rows: sudahLaporRows.map(laporRow),
      description: `Ringkasan sudah lapor per jenis PPh Masa periode ${periodeLabel}`,
    },
    {
      key: "total_setoran",
      label: `Total Setoran ${periodeLabel}`,
      value: formatCompactRupiah(paymentResult.totalSetor),
      sub: `${formatNumber(paymentResult.total)} baris pembayaran`,
      accent: "teal",
      icon: "receipt",
      columns: paymentColumns,
      rows: paymentDialogRows.map(paymentRow),
      description: `Menampilkan ${formatNumber(paymentDialogRows.length)} dari ${formatNumber(paymentResult.total)} baris pembayaran`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Monitoring PPh Masa OPD"
        description="Rekap dan rincian pembayaran serta pelaporan PPh Masa (PPh 21, 22, 23/26) dan PPN PUT per OPD melalui Coretax DJP."
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

      <KpiListDialog cards={pphDialogCards} />

      <div className="section-divider">Rekap Pelaporan per Jenis PPh Masa</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Ringkasan Lapor per Jenis PPh Masa</div>
          </div>
          <form className="filter-bar" method="get" style={{ marginBottom: 0 }}>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <input type="hidden" name="wilayah" value={wilayah} />
            <input type="hidden" name="ar" value={ar} />
            <select className="inline-select" name="bulan" defaultValue={result.bulan} aria-label="Periode PPh Masa">
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
              <col style={{ width: "22%" }} />
              <col style={{ width: "54%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Jenis PPh Masa</th>
                <th>Keterangan</th>
                <th>Sudah Lapor</th>
                <th>Belum Lapor</th>
              </tr>
            </thead>
            <tbody>
              {result.jenisSummary.map((item) => (
                <tr key={item.jenis}>
                  <td>
                    <strong>{item.jenis}</strong>
                  </td>
                  <td className="muted">{item.keterangan}</td>
                  <td>{formatNumber(item.sudah_lapor)}</td>
                  <td className={item.belum_lapor > 0 ? "text-red" : "text-green"}>
                    <strong>{formatNumber(item.belum_lapor)}</strong>
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

      <div className="section-divider">Detail Pembayaran per OPD per Jenis Pajak</div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rincian PPh Masa per OPD - {periodeLabel}</div>
            <div className="card-subtitle">Nama OPD - Wilayah OPD - Jenis PPh - Jumlah pembayaran - Bendahara</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input type="hidden" name="bulan" value={result.bulan} />
            <input className="search-input" name="q" placeholder="Cari OPD" defaultValue={q} style={{ maxWidth: 260 }} />
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
          <table className="data-table compact-table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Nama OPD</th>
                <th>Wilayah</th>
                <th>Jenis PPh</th>
                <th>Jml Pembayaran</th>
                <th>Bendahara</th>
              </tr>
            </thead>
            <tbody>
              {paymentResult.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Belum ada data PPh Masa.
                  </td>
                </tr>
              ) : (
                paymentResult.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.opd_nama}</td>
                    <td className="td-mono">{item.wilayah_nama}</td>
                    <td>
                      <strong>{item.jenis_pph}</strong>
                    </td>
                    <td className="td-mono">
                      <strong>{item.jumlah_pembayaran > 0 ? formatCompactRupiah(item.jumlah_pembayaran) : "-"}</strong>
                    </td>
                    <td>{item.nama_bendahara}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(paymentResult.data.length)} dari {formatNumber(paymentResult.total)} baris
          </span>
          <Pagination page={paymentResult.page} pages={paymentResult.pages} basePath="/modul2-pph21" query={keepQuery({ q, wilayah, ar, bulan: result.bulan })} />
        </div>
      </div>
    </>
  );
}
