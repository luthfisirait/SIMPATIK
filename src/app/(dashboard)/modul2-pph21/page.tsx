import { BarChart3, Download, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiListDialog, type KpiDialogCard, type KpiDialogColumn } from "@/components/ui/KpiListDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listPph21, listPph21DialogRows, listPphMasaPeriods } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, formatPercent, monthFullLabel } from "@/lib/utils";

type BadgeTone = "green" | "red" | "amber" | "teal" | "navy";

const statusBayarLabel: Record<string, string> = {
  tepat_waktu: "Tepat Waktu",
  terlambat: "Terlambat",
  belum_setor: "Belum Bayar",
};

function statusBayarTone(value: string): BadgeTone {
  if (value === "tepat_waktu") return "green";
  if (value === "terlambat") return "amber";
  if (value === "belum_setor") return "red";
  return "teal";
}

function statusLaporLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("tepat") || normalized.includes("normal") || normalized.includes("submitted")) return "Tepat Waktu";
  if (normalized.includes("terlambat")) return "Terlambat";
  if (normalized.includes("bukan")) return "Bukan Pemungut";
  if (normalized.includes("nihil") || normalized.includes("belum") || !normalized) return "Belum Lapor";
  return value ?? "-";
}

function statusLaporTone(value: string | null | undefined): BadgeTone {
  const label = statusLaporLabel(value);
  if (label === "Tepat Waktu" || label === "Bukan Pemungut") return "green";
  if (label === "Terlambat") return "amber";
  if (label === "Belum Lapor") return "red";
  return "teal";
}

function kepatuhanTone(value: number): BadgeTone {
  if (value >= 90) return "green";
  if (value >= 70) return "amber";
  return "red";
}

export default async function ModulPph21Page({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const bulan = firstParam(searchParams, "bulan") || undefined;
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listPph21({ q, wilayah, pphStatus: status, ar, bulan, page, pageSize: 12 });
  const dialogRows = listPph21DialogRows({ q, wilayah, ar, bulan: result.bulan });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const periodOptions = Array.from(new Set([result.bulan, ...listPphMasaPeriods()]));
  const periodeLabel = monthFullLabel(result.bulan);
  const exportQuery = queryString({ q, wilayah, status, ar, bulan: result.bulan });
  const exportHref = exportQuery ? `/api/export/pph21?${exportQuery}` : "/api/export/pph21";
  const pphColumns: KpiDialogColumn[] = [
    { key: "opd", label: "Nama OPD" },
    { key: "wilayah", label: "Wilayah", className: "td-mono" },
    { key: "pembayaran", label: "Pembayaran", className: "td-mono" },
    { key: "status_bayar", label: "Status Bayar" },
    { key: "status_lapor", label: "Status Lapor" },
    { key: "bendahara", label: "Bendahara" },
    { key: "ar", label: "AR" },
  ];
  const pphRow = (item: (typeof dialogRows)[number]) => ({
    id: item.id,
    cells: {
      opd: { value: item.opd_nama, strong: true },
      wilayah: item.wilayah_nama,
      pembayaran: { value: item.ketepatan === "belum_setor" ? "-" : formatCompactRupiah(item.nominal_setor), strong: true },
      status_bayar: { value: statusBayarLabel[item.ketepatan], tone: statusBayarTone(item.ketepatan) },
      status_lapor: { value: statusLaporLabel(item.status_lapor), tone: statusLaporTone(item.status_lapor) },
      bendahara: item.nama_bendahara,
      ar: item.ar_nama ?? "-",
    },
  });
  const lengkapRows = dialogRows.filter((item) => item.ketepatan === "tepat_waktu" && statusLaporLabel(item.status_lapor) === "Tepat Waktu");
  const bayarBermasalahRows = dialogRows.filter((item) => item.ketepatan !== "tepat_waktu");
  const sudahBayarBelumLaporRows = dialogRows.filter((item) => item.ketepatan !== "belum_setor" && statusLaporLabel(item.status_lapor) === "Belum Lapor");
  const totalSetor = dialogRows.reduce((sum, item) => sum + item.nominal_setor, 0);
  const totalEstimasi = dialogRows.reduce((sum, item) => sum + item.estimasi_wajar, 0);
  const persenLengkap = dialogRows.length === 0 ? 0 : (lengkapRows.length * 100) / dialogRows.length;
  const pphDialogCards: KpiDialogCard[] = [
    {
      key: "lengkap",
      label: "Bayar & Lapor Lengkap",
      value: formatNumber(lengkapRows.length),
      sub: `${formatPercent(persenLengkap)} dari ${formatNumber(dialogRows.length)} OPD`,
      accent: "green",
      icon: "receipt",
      columns: pphColumns,
      rows: lengkapRows.map(pphRow),
    },
    {
      key: "bayar_bermasalah",
      label: "Belum / Terlambat Bayar",
      value: formatNumber(bayarBermasalahRows.length),
      sub: "Koordinasi AR segera",
      accent: "red",
      icon: "receipt",
      columns: pphColumns,
      rows: bayarBermasalahRows.map(pphRow),
    },
    {
      key: "belum_lapor",
      label: "Sudah Bayar, Belum Lapor",
      value: formatNumber(sudahBayarBelumLaporRows.length),
      sub: "SPT Masa belum disampaikan",
      accent: "gold",
      icon: "receipt",
      columns: pphColumns,
      rows: sudahBayarBelumLaporRows.map(pphRow),
    },
    {
      key: "total_setoran",
      label: `Total Setoran ${periodeLabel}`,
      value: formatCompactRupiah(totalSetor),
      sub: `dari estimasi ${formatCompactRupiah(totalEstimasi)}`,
      accent: "teal",
      icon: "receipt",
      columns: pphColumns,
      rows: dialogRows.map(pphRow),
      description: `${formatNumber(dialogRows.length)} OPD dengan total setoran ${formatCompactRupiah(totalSetor)}`,
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

      <div className="section-divider">Rekap Kepatuhan per Jenis PPh Masa</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Ringkasan Bayar & Lapor per Jenis PPh Masa</div>
          </div>
          <form className="filter-bar" method="get" style={{ marginBottom: 0 }}>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <input type="hidden" name="wilayah" value={wilayah} />
            <input type="hidden" name="status" value={status} />
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
          <table className="data-table wide-table">
            <thead>
              <tr>
                <th>Jenis PPh Masa</th>
                <th>Keterangan</th>
                <th>Wajib Bayar</th>
                <th>Sudah Bayar</th>
                <th>Belum Bayar</th>
                <th>Wajib Lapor</th>
                <th>Sudah Lapor</th>
                <th>Belum Lapor</th>
                <th>% Kepatuhan</th>
              </tr>
            </thead>
            <tbody>
              {result.jenisSummary.map((item) => (
                <tr key={item.jenis}>
                  <td>
                    <strong>{item.jenis}</strong>
                  </td>
                  <td className="muted">{item.keterangan}</td>
                  <td>{formatNumber(item.wajib_bayar)}</td>
                  <td>{formatNumber(item.sudah_bayar)}</td>
                  <td className={item.belum_bayar > 0 ? "text-red" : "text-green"}>
                    <strong>{formatNumber(item.belum_bayar)}</strong>
                  </td>
                  <td>{formatNumber(item.wajib_lapor)}</td>
                  <td>{formatNumber(item.sudah_lapor)}</td>
                  <td className={item.belum_lapor > 0 ? "text-red" : "text-green"}>
                    <strong>{formatNumber(item.belum_lapor)}</strong>
                  </td>
                  <td>
                    <Badge tone={kepatuhanTone(item.kepatuhan)}>{formatPercent(item.kepatuhan)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">Update harian 07.00 WIB dari Coretax DJP</span>
        </div>
      </div>

      <div className="section-divider">Detail Bayar & Lapor per OPD per Jenis Pajak</div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rincian PPh Masa per OPD - {periodeLabel}</div>
            <div className="card-subtitle">Nama OPD - Wilayah - Jenis PPh - Pembayaran - Status Lapor - Bendahara - AR</div>
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
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 190 }}>
              <option value="all">Semua Status</option>
              <option value="lengkap">Lengkap</option>
              <option value="terlambat">Terlambat</option>
              <option value="belum_bayar">Belum Bayar</option>
              <option value="belum_lapor">Belum Lapor</option>
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
                <th>Jenis PPh</th>
                <th>Jml Pembayaran</th>
                <th>Status Bayar</th>
                <th>Status Lapor</th>
                <th>Bendahara</th>
                <th>AR</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Belum ada data PPh Masa.
                  </td>
                </tr>
              ) : (
                result.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.opd_nama}</td>
                    <td className="td-mono">{item.wilayah_nama}</td>
                    <td>
                      <strong>PPh 21</strong>
                    </td>
                    <td className="td-mono">
                      <strong>{item.ketepatan === "belum_setor" ? "-" : formatCompactRupiah(item.nominal_setor)}</strong>
                    </td>
                    <td>
                      <Badge tone={statusBayarTone(item.ketepatan)}>{statusBayarLabel[item.ketepatan]}</Badge>
                    </td>
                    <td>
                      <Badge tone={statusLaporTone(item.status_lapor)}>{statusLaporLabel(item.status_lapor)}</Badge>
                    </td>
                    <td>{item.nama_bendahara}</td>
                    <td>{item.ar_nama ?? "-"}</td>
                    <td>
                      {item.ketepatan === "belum_setor" || statusLaporLabel(item.status_lapor) === "Belum Lapor" ? (
                        <button className="btn btn-danger btn-sm" type="button">
                          Urgent
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" type="button">
                          Detail
                        </button>
                      )}
                    </td>
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
          <Pagination page={result.page} pages={result.pages} basePath="/modul2-pph21" query={keepQuery({ q, wilayah, status, ar, bulan: result.bulan })} />
        </div>
      </div>
    </>
  );
}
