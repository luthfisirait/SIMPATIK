import { BarChart3, Download } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { KpiListDialog, type KpiDialogCard, type KpiDialogColumn, type KpiDialogRow } from "@/components/ui/KpiListDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { authOptions } from "@/lib/auth";
import { listPph21, listPphMasaLaporDetailRows, listPphMasaPeriods } from "@/lib/queries";
import { firstParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, monthFullLabel } from "@/lib/utils";

import { PphMasaRekapTable } from "./PphMasaRekapTable";

export default async function ModulPph21Page({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const bulan = firstParam(searchParams, "bulan") || undefined;
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const result = listPph21({ q, wilayah, ar, bulan, page: 1, pageSize: 5 });
  const laporDetailRows = listPphMasaLaporDetailRows({ q, wilayah, ar, bulan: result.bulan });
  const periodOptions = Array.from(new Set([result.bulan, ...listPphMasaPeriods()]));
  const periodeLabel = monthFullLabel(result.bulan);
  const exportQuery = queryString({ q, wilayah, ar, bulan: result.bulan });
  const exportHref = exportQuery ? `/api/export/pph21?${exportQuery}` : "/api/export/pph21";
  const laporColumns: KpiDialogColumn[] = [
    { key: "opd", label: "Nama OPD" },
    { key: "wilayah", label: "Wilayah", className: "td-mono" },
    { key: "jenis", label: "Jenis PPh Masa" },
    { key: "status", label: "Status Lapor" },
    { key: "bendahara", label: "Bendahara" },
    { key: "ar", label: "AR" },
  ];
  const laporRow = (item: (typeof laporDetailRows)[number]): KpiDialogRow => ({
    id: item.id,
    cells: {
      opd: { value: item.opd_nama, strong: true },
      wilayah: item.wilayah_nama,
      jenis: { value: item.jenis, strong: true },
      status: { value: item.status_lapor ?? "-", tone: item.status === "sudah_lapor" ? "green" : "red" },
      bendahara: item.nama_bendahara,
      ar: item.ar_nama ?? "-",
    },
  });
  const wajibLaporRows = laporDetailRows;
  const sudahLaporRows = laporDetailRows.filter((item) => item.status === "sudah_lapor");
  const belumLaporRows = laporDetailRows.filter((item) => item.status === "belum_lapor");
  const totalWajibLapor = result.jenisSummary.reduce((sum, item) => sum + item.wajib_lapor, 0);
  const totalSudahLapor = result.jenisSummary.reduce((sum, item) => sum + item.sudah_lapor, 0);
  const totalBelumLapor = result.jenisSummary.reduce((sum, item) => sum + item.belum_lapor, 0);
  const pphDialogCards: KpiDialogCard[] = [
    {
      key: "wajib_lapor",
      label: "Wajib Lapor",
      value: formatNumber(totalWajibLapor),
      sub: `${formatNumber(result.jenisSummary.length)} jenis SPT Masa`,
      accent: "navy",
      icon: "receipt",
      columns: laporColumns,
      rows: wajibLaporRows.map(laporRow),
      description: `Daftar wajib lapor PPh Masa periode ${periodeLabel}`,
    },
    {
      key: "belum_lapor",
      label: "Belum Lapor",
      value: formatNumber(totalBelumLapor),
      sub: `${formatNumber(totalWajibLapor)} wajib lapor`,
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
      sub: `${formatNumber(totalWajibLapor)} wajib lapor`,
      accent: "green",
      icon: "receipt",
      columns: laporColumns,
      rows: sudahLaporRows.map(laporRow),
      description: `Ringkasan sudah lapor per jenis PPh Masa periode ${periodeLabel}`,
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
      <PphMasaRekapTable summary={result.jenisSummary} detailRows={laporDetailRows} q={q} wilayah={wilayah} ar={ar} bulan={result.bulan} periodOptions={periodOptions} />
    </>
  );
}
