import { Download, Eye, Search, Send } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiListDialog, type KpiDialogCard, type KpiDialogColumn } from "@/components/ui/KpiListDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listSpt, listSptDialogRows } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, formatPercent, trafficLabel } from "@/lib/utils";

function pegawaiDetailHref(opdId: number) {
  return `/pegawai-belum-lapor?opd=${opdId}`;
}

export default async function ModulSptPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const traffic = firstParam(searchParams, "traffic", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listSpt({ q, wilayah, traffic, ar, page, pageSize: 12 });
  const dialogRows = listSptDialogRows({ q, wilayah, ar, periode: result.periode });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const exportQuery = queryString({ q, wilayah, traffic, ar, periode: result.periode });
  const exportHref = exportQuery ? `/api/export/spt?${exportQuery}` : "/api/export/spt";
  const sptColumns: KpiDialogColumn[] = [
    { key: "opd", label: "Nama OPD" },
    { key: "wilayah", label: "Wilayah", className: "td-mono" },
    { key: "seksi", label: "Seksi" },
    { key: "wajib", label: "Wajib Lapor" },
    { key: "sudah", label: "Sudah Lapor" },
    { key: "belum", label: "Belum Lapor" },
    { key: "persen", label: "%" },
    { key: "status", label: "Status" },
    { key: "ar", label: "AR" },
    { key: "aksi", label: "Aksi" },
  ];
  const sptRow = (item: (typeof dialogRows)[number]) => {
    const belum = item.jumlah_wajib_lapor - item.jumlah_sudah_lapor;

    return {
      id: item.id,
      cells: {
        opd: { value: item.opd_nama, strong: true },
        wilayah: item.wilayah_nama,
        seksi: item.seksi ?? "-",
        wajib: formatNumber(item.jumlah_wajib_lapor),
        sudah: formatNumber(item.jumlah_sudah_lapor),
        belum: formatNumber(belum),
        persen: { value: formatPercent(item.persen_kepatuhan), strong: true },
        status: { value: trafficLabel(item.traffic_light), tone: toneForTraffic(item.traffic_light) },
        ar: item.ar_nama ?? "-",
        aksi: { value: "Lihat detail", buttonLabel: "Detail", href: pegawaiDetailHref(item.opd_id) },
      },
    };
  };
  const byTraffic = (key: string) => dialogRows.filter((item) => item.traffic_light === key);
  const totalOpd = dialogRows.length;
  const belumRows = dialogRows.filter((item) => item.jumlah_wajib_lapor > item.jumlah_sudah_lapor);
  const totalBelum = belumRows.reduce((sum, item) => sum + item.jumlah_wajib_lapor - item.jumlah_sudah_lapor, 0);
  const sptDialogCards: KpiDialogCard[] = [
    {
      key: "hijau",
      label: "OPD Hijau (>70%)",
      value: formatNumber(byTraffic("hijau").length),
      sub: `Dari ${formatNumber(totalOpd)} OPD master`,
      accent: "green",
      icon: "file-check",
      columns: sptColumns,
      rows: byTraffic("hijau").map(sptRow),
    },
    {
      key: "kuning",
      label: "OPD Kuning (40-70%)",
      value: formatNumber(byTraffic("kuning").length),
      sub: `Dari ${formatNumber(totalOpd)} OPD master`,
      accent: "gold",
      icon: "file-check",
      columns: sptColumns,
      rows: byTraffic("kuning").map(sptRow),
    },
    {
      key: "merah",
      label: "OPD Merah (<40%)",
      value: formatNumber(byTraffic("merah").length),
      sub: `Dari ${formatNumber(totalOpd)} OPD master`,
      accent: "red",
      icon: "file-check",
      columns: sptColumns,
      rows: byTraffic("merah").map(sptRow),
    },
    {
      key: "belum_lapor",
      label: "Total Belum Lapor",
      value: formatNumber(totalBelum),
      sub: `${formatNumber(totalOpd)} OPD master`,
      accent: "teal",
      icon: "file-check",
      columns: sptColumns,
      rows: belumRows.map(sptRow),
      description: `${formatNumber(totalBelum)} wajib lapor belum menyampaikan SPT pada ${formatNumber(belumRows.length)} OPD`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Monitoring SPT Tahunan OP ASN & PPPK"
        description="Status kepatuhan pelaporan SPT Tahunan PPh OP per OPD"
        actions={
          <>
            <Link className="btn btn-secondary" href="/action-log/input">
              <Send size={16} />
              Imbauan
            </Link>
            <Link className="btn btn-primary" href={exportHref} target="_blank">
              <Download size={16} />
              Unduh
            </Link>
          </>
        }
      />

      <KpiListDialog cards={sptDialogCards} />

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar OPD - Status Kepatuhan SPT Tahunan</div>
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
            <select className="search-input" name="traffic" defaultValue={traffic} style={{ maxWidth: 180 }}>
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
                <th>Nama OPD</th>
                <th>Wilayah</th>
                <th>Seksi</th>
                <th>ASN & PPPK</th>
                <th>Sudah Lapor</th>
                <th>Belum Lapor</th>
                <th>%</th>
                <th>Status</th>
                <th>AR</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted">
                    Belum ada data SPT.
                  </td>
                </tr>
              ) : (
                result.data.map((item) => {
                  const belum = item.jumlah_wajib_lapor - item.jumlah_sudah_lapor;
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.opd_nama}</strong>
                      </td>
                      <td className="td-mono">{item.wilayah_nama}</td>
                      <td>{item.seksi ?? "-"}</td>
                      <td>{formatNumber(item.jumlah_wajib_lapor)}</td>
                      <td className="text-green">{formatNumber(item.jumlah_sudah_lapor)}</td>
                      <td className={item.traffic_light === "kuning" ? "text-amber" : item.traffic_light === "merah" ? "text-red" : ""}>
                        {formatNumber(belum)}
                      </td>
                      <td>
                        <strong>{formatPercent(item.persen_kepatuhan)}</strong>
                      </td>
                      <td>
                        <Badge tone={toneForTraffic(item.traffic_light)}>{trafficLabel(item.traffic_light)}</Badge>
                      </td>
                      <td>{item.ar_nama ?? "-"}</td>
                      <td>
                        <Link className="btn btn-ghost btn-sm" href={pegawaiDetailHref(item.opd_id)}>
                          <Eye size={14} />
                          Detail
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} OPD
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul1-spt" query={keepQuery({ q, wilayah, traffic, ar })} />
        </div>
      </div>
    </>
  );
}
