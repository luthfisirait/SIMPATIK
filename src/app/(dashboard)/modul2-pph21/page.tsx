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
  const jenisCount = result.jenisSummary.length;
  const laporOpdMap = new Map<
    number,
    (typeof laporDetailRows)[number] & { jumlah_sudah: number; jumlah_belum: number }
  >();
  laporDetailRows.forEach((item) => {
    const current = laporOpdMap.get(item.opd_id) ?? { ...item, jumlah_sudah: 0, jumlah_belum: 0 };
    if (item.status === "sudah_lapor") current.jumlah_sudah += 1;
    else current.jumlah_belum += 1;
    laporOpdMap.set(item.opd_id, current);
  });
  const laporOpdRows = [...laporOpdMap.values()].sort((a, b) => a.opd_nama.localeCompare(b.opd_nama, "id"));
  const laporRow = (item: (typeof laporOpdRows)[number]): KpiDialogRow => ({
    id: item.opd_id,
    cells: {
      opd: { value: item.opd_nama, strong: true },
      wilayah: item.wilayah_nama,
      jenis: { value: `${formatNumber(jenisCount)} jenis`, strong: true },
      status: {
        value: `${formatNumber(item.jumlah_sudah)} dari ${formatNumber(jenisCount)} sudah`,
        tone: item.jumlah_belum === 0 ? "green" : "red",
      },
      bendahara: item.nama_bendahara,
      ar: item.ar_nama ?? "-",
    },
  });
  const wajibLaporRows = laporOpdRows;
  const sudahLaporRows = laporOpdRows.filter((item) => item.jumlah_belum === 0);
  const belumLaporRows = laporOpdRows.filter((item) => item.jumlah_belum > 0);
  const totalWajibLapor = wajibLaporRows.length;
  const totalSudahLapor = sudahLaporRows.length;
  const totalBelumLapor = belumLaporRows.length;
  const pphDialogCards: KpiDialogCard[] = [
    {
      key: "wajib_lapor",
      label: "Wajib Lapor",
      value: formatNumber(totalWajibLapor),
      sub: `${formatNumber(jenisCount)} jenis, basis OPD master`,
      accent: "navy",
      icon: "receipt",
      columns: laporColumns,
      rows: wajibLaporRows.map(laporRow),
      description: `Daftar OPD wajib lapor PPh Masa periode ${periodeLabel}`,
      exportFileName: `pph-masa-wajib-lapor-${result.bulan}`,
    },
    {
      key: "belum_lapor",
      label: "Belum Lapor",
      value: formatNumber(totalBelumLapor),
      sub: `Dari ${formatNumber(totalWajibLapor)} OPD master`,
      accent: "red",
      icon: "receipt",
      columns: laporColumns,
      rows: belumLaporRows.map(laporRow),
      description: `OPD yang masih memiliki jenis PPh Masa belum lapor periode ${periodeLabel}`,
      exportFileName: `pph-masa-belum-lapor-${result.bulan}`,
    },
    {
      key: "sudah_lapor",
      label: "Sudah Lapor",
      value: formatNumber(totalSudahLapor),
      sub: `Dari ${formatNumber(totalWajibLapor)} OPD master`,
      accent: "green",
      icon: "receipt",
      columns: laporColumns,
      rows: sudahLaporRows.map(laporRow),
      description: `OPD yang sudah lengkap seluruh jenis PPh Masa periode ${periodeLabel}`,
      exportFileName: `pph-masa-sudah-lapor-${result.bulan}`,
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
