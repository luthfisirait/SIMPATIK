import { Download, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiListDialog, type KpiDialogCard, type KpiDialogColumn } from "@/components/ui/KpiListDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listSptMasa, listSptMasaDialogRows } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, monthLabel, trafficLabel } from "@/lib/utils";

function statusTone(value: string | null | undefined): "green" | "amber" | "red" | "teal" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("tepat") || normalized.includes("bukan") || normalized.includes("submitted") || normalized.includes("normal")) return "green";
  if (normalized.includes("terlambat")) return "amber";
  if (normalized.includes("nihil") || normalized.includes("belum") || normalized.includes("gagal")) return "red";
  return "teal";
}

export default async function ModulSptMasaPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listSptMasa({ q, wilayah, overallStatus: status, ar, page, pageSize: 12 });
  const dialogRows = listSptMasaDialogRows({ q, wilayah, ar, masa: result.masa });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const exportQuery = queryString({ q, wilayah, status, ar, masa: result.masa });
  const exportHref = exportQuery ? `/api/export/spt-masa?${exportQuery}` : "/api/export/spt-masa";
  const sptMasaColumns: KpiDialogColumn[] = [
    { key: "opd", label: "Nama OPD" },
    { key: "wilayah", label: "Wilayah", className: "td-mono" },
    { key: "nominal", label: "Nominal Masa", className: "td-mono" },
    { key: "pph21", label: "PPh 21" },
    { key: "pph22", label: "PPh 22" },
    { key: "pph23", label: "PPh 23" },
    { key: "ppn", label: "PPN PUT" },
    { key: "overall", label: "Overall" },
    { key: "ar", label: "AR" },
  ];
  const nominalMasa = (item: (typeof dialogRows)[number]) => item.pph22_nominal + item.pph23_nominal + item.ppn_put_nominal;
  const sptMasaRow = (item: (typeof dialogRows)[number]) => ({
    id: item.id,
    cells: {
      opd: { value: item.opd_nama, strong: true },
      wilayah: item.wilayah_nama,
      nominal: { value: formatCompactRupiah(nominalMasa(item)), strong: true },
      pph21: { value: item.pph21_status ?? "-", tone: statusTone(item.pph21_status) },
      pph22: { value: item.pph22_status ?? "-", tone: statusTone(item.pph22_status) },
      pph23: { value: item.pph23_status ?? "-", tone: statusTone(item.pph23_status) },
      ppn: { value: item.ppn_put_status ?? "-", tone: statusTone(item.ppn_put_status) },
      overall: { value: trafficLabel(String(item.status_keseluruhan)), tone: toneForTraffic(String(item.status_keseluruhan)) },
      ar: item.ar_nama ?? "-",
    },
  });
  const byStatus = (key: string) => dialogRows.filter((item) => String(item.status_keseluruhan) === key);
  const nominal = dialogRows.reduce((sum, item) => sum + nominalMasa(item), 0);
  const sptMasaDialogCards: KpiDialogCard[] = [
    {
      key: "hijau",
      label: "Hijau",
      value: formatNumber(byStatus("hijau").length),
      sub: "Semua kewajiban tepat waktu",
      accent: "green",
      icon: "clipboard-check",
      columns: sptMasaColumns,
      rows: byStatus("hijau").map(sptMasaRow),
    },
    {
      key: "kuning",
      label: "Kuning",
      value: formatNumber(byStatus("kuning").length),
      sub: "Ada keterlambatan",
      accent: "gold",
      icon: "clipboard-check",
      columns: sptMasaColumns,
      rows: byStatus("kuning").map(sptMasaRow),
    },
    {
      key: "merah",
      label: "Merah",
      value: formatNumber(byStatus("merah").length),
      sub: "Ada nihil setor/lapor",
      accent: "red",
      icon: "clipboard-check",
      columns: sptMasaColumns,
      rows: byStatus("merah").map(sptMasaRow),
    },
    {
      key: "nominal",
      label: "Nominal Masa",
      value: formatCompactRupiah(nominal),
      sub: `${formatNumber(dialogRows.length)} OPD termonitor`,
      accent: "navy",
      icon: "clipboard-check",
      columns: sptMasaColumns,
      rows: dialogRows.map(sptMasaRow),
      description: `Total nominal masa ${formatCompactRupiah(nominal)} dari ${formatNumber(dialogRows.length)} OPD`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Detail SPT Masa"
        description={`Monitoring PPh Unifikasi dan PPN 1107 PUT untuk ${monthLabel(result.masa)}.`}
        actions={
          <Link className="btn btn-secondary" href={exportHref} target="_blank">
            <Download size={16} />
            Export CSV
          </Link>
        }
      />

      <KpiListDialog cards={sptMasaDialogCards} />

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">SPT Masa PPh Unifikasi dan PPN PUT</div>
            <div className="card-subtitle">Memantau PPh 22, PPh 23, dan PPN PUT per OPD dan masa pajak.</div>
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
                <th>PPh 22</th>
                <th>PPh 23</th>
                <th>PPN PUT</th>
                <th>Pemungut</th>
                <th>Overall</th>
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
                    <Badge tone={statusTone(item.pph21_status)}>{item.pph21_status ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.pph22_nominal)}</div>
                    <Badge tone={statusTone(item.pph22_status)}>{item.pph22_status ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.pph23_nominal)}</div>
                    <Badge tone={statusTone(item.pph23_status)}>{item.pph23_status ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.ppn_put_nominal)}</div>
                    <Badge tone={statusTone(item.ppn_put_status)}>{item.ppn_put_status ?? "-"}</Badge>
                  </td>
                  <td>{item.status_opd_pemungut ?? "-"}</td>
                  <td>
                    <Badge tone={toneForTraffic(String(item.status_keseluruhan))}>{trafficLabel(String(item.status_keseluruhan))}</Badge>
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
          <Pagination page={result.page} pages={result.pages} basePath="/modul4-spt-masa" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
