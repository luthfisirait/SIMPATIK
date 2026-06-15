import { CalendarPlus, Plus, Presentation, Search } from "lucide-react";
import { getServerSession } from "next-auth";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listSosialisasi } from "@/lib/queries";
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
  const wilayahOptions = getWilayah();
  const arOptions = listAr();

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

      <section className="kpi-grid">
        <KpiCard label="Sudah Disosialisasi" value={formatNumber(result.summary.sudah)} sub="OPD unik" accent="green" icon={<Presentation size={18} />} />
        <KpiCard label="Belum Disosialisasi" value={formatNumber(result.summary.belum)} sub="Prioritas jadwal berikutnya" accent="red" icon={<Presentation size={18} />} />
        <KpiCard label="Total Peserta" value={formatNumber(result.summary.peserta)} sub="ASN & PPPK terlatih" accent="teal" icon={<Presentation size={18} />} />
        <KpiCard label="Sesi Terlaksana" value={formatNumber(result.summary.sesi)} sub="Sosialisasi & asistensi" accent="gold" icon={<Presentation size={18} />} />
      </section>

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
