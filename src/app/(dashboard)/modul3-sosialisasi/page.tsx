import { CalendarPlus, Plus, Search } from "lucide-react";
import { getServerSession } from "next-auth";

import { Badge } from "@/components/ui/Badge";
import { KpiListDialog, type KpiDialogCard, type KpiDialogColumn } from "@/components/ui/KpiListDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listSosialisasi, listSosialisasiDialogData } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, type PageSearchParams } from "@/lib/search";
import { formatNumber } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  sudah: "Sudah",
  belum: "Belum",
  perlu_ulang: "Perlu ulang",
};

const statusTone: Record<string, "green" | "amber" | "red" | "teal"> = {
  sudah: "green",
  belum: "red",
  perlu_ulang: "amber",
};

export default async function ModulSosialisasiPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listSosialisasi({ q, wilayah, status, ar, page, pageSize: 12 });
  const dialogData = listSosialisasiDialogData({ q, wilayah, ar });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const opdColumns: KpiDialogColumn[] = [
    { key: "opd", label: "Nama OPD" },
    { key: "wilayah", label: "Wilayah", className: "td-mono" },
    { key: "sesi", label: "Sesi" },
    { key: "peserta", label: "Peserta" },
    { key: "asn", label: "ASN" },
    { key: "ar", label: "AR" },
  ];
  const sessionColumns: KpiDialogColumn[] = [
    { key: "opd", label: "Nama OPD" },
    { key: "tanggal", label: "Tanggal", className: "td-mono" },
    { key: "peserta", label: "Peserta" },
    { key: "tema", label: "Tema" },
    { key: "penyuluh", label: "Penyuluh" },
    { key: "status", label: "Status" },
  ];
  const opdRow = (item: (typeof dialogData.sudah)[number]) => ({
    id: item.id,
    cells: {
      opd: { value: item.nama, strong: true },
      wilayah: item.wilayah_nama,
      sesi: formatNumber(item.sesi),
      peserta: formatNumber(item.peserta),
      asn: formatNumber(item.jumlah_asn),
      ar: item.ar_nama ?? "-",
    },
  });
  const sessionRow = (item: (typeof dialogData.sessions)[number]) => ({
    id: item.id,
    cells: {
      opd: { value: item.opd_nama, strong: true },
      tanggal: item.tanggal,
      peserta: formatNumber(item.jumlah_peserta),
      tema: item.tema ?? "-",
      penyuluh: item.penyuluh_nama ?? "-",
      status: { value: statusLabel[item.status], tone: statusTone[item.status] },
    },
  });
  const totalPeserta = dialogData.sessions.reduce((sum, item) => sum + item.jumlah_peserta, 0);
  const sosialisasiDialogCards: KpiDialogCard[] = [
    {
      key: "sudah",
      label: "Sudah Disosialisasi",
      value: formatNumber(dialogData.sudah.length),
      sub: "OPD unik",
      accent: "green",
      icon: "presentation",
      columns: opdColumns,
      rows: dialogData.sudah.map(opdRow),
    },
    {
      key: "belum",
      label: "Belum Disosialisasi",
      value: formatNumber(dialogData.belum.length),
      sub: "Prioritas jadwal berikutnya",
      accent: "red",
      icon: "presentation",
      columns: opdColumns,
      rows: dialogData.belum.map(opdRow),
    },
    {
      key: "peserta",
      label: "Total Peserta",
      value: formatNumber(totalPeserta),
      sub: "ASN & PPPK terlatih",
      accent: "teal",
      icon: "presentation",
      columns: sessionColumns,
      rows: dialogData.sessions.map(sessionRow),
      description: `${formatNumber(totalPeserta)} peserta dari ${formatNumber(dialogData.sessions.length)} sesi`,
    },
    {
      key: "sesi",
      label: "Sesi Terlaksana",
      value: formatNumber(dialogData.sessions.length),
      sub: "Sosialisasi & asistensi",
      accent: "gold",
      icon: "presentation",
      columns: sessionColumns,
      rows: dialogData.sessions.map(sessionRow),
    },
  ];

  return (
    <>
      <PageHeader
        title="Monitoring Sosialisasi Coretax"
        description="Rekam jejak sosialisasi Coretax per OPD. Dasar SE MenPAN-RB No.7/2025."
        actions={
          <>
            <button className="btn btn-secondary" type="button">
              <CalendarPlus size={16} />
              Jadwalkan
            </button>
            <button className="btn btn-primary" type="button">
              <Plus size={16} />
              Tambah
            </button>
          </>
        }
      />

      <KpiListDialog cards={sosialisasiDialogCards} />

      <div className="card">
        <div className="card-header">
          <div className="card-title">Rekam Jejak Sosialisasi per OPD</div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD atau penyuluh" defaultValue={q} style={{ maxWidth: 260 }} />
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
              <option value="sudah">Sudah</option>
              <option value="belum">Belum</option>
              <option value="perlu_ulang">Perlu ulang</option>
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
                <th>Tanggal</th>
                <th>Tempat</th>
                <th>Tema</th>
                <th>Peserta</th>
                <th>Penyuluh</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    Belum ada data sosialisasi.
                  </td>
                </tr>
              ) : (
                result.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.opd_nama}</strong>
                    </td>
                    <td className="td-mono">{item.wilayah_nama}</td>
                    <td className="td-mono">{item.tanggal}</td>
                    <td>{item.tempat ?? "-"}</td>
                    <td>{item.tema ?? "-"}</td>
                    <td>{formatNumber(item.jumlah_peserta)}</td>
                    <td>{item.penyuluh_nama ?? "-"}</td>
                    <td>
                      <Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} sesi
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul3-sosialisasi" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
