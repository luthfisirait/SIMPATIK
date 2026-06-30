import { Search } from "lucide-react";
import { getServerSession } from "next-auth";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listRincianPphMasa, listRincianPphMasaPeriods } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, type PageSearchParams } from "@/lib/search";
import { formatNumber, formatRupiah, monthFullLabel } from "@/lib/utils";

function dateLabel(value: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function periodLabel(value: string) {
  return value ? monthFullLabel(value) : "-";
}

export default async function RincianPphMasaPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const jenis = firstParam(searchParams, "jenis", "all");
  const masa = firstParam(searchParams, "masa", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listRincianPphMasa({ q, wilayah, jenis, masa, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const periodOptions = listRincianPphMasaPeriods();

  return (
    <>
      <PageHeader
        title="Rincian PPh Masa OPD"
        description="Rincian setoran PPh Masa berdasarkan Data Penerimaan per OPD, periode, jenis pajak, dan tanggal setor."
      />

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Setoran PPh Masa per OPD</div>
            <div className="card-subtitle">KD MAP: 411121, 411122, 411124, 411128, 411211</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD" defaultValue={q} style={{ maxWidth: 260 }} />
            <select className="search-input" name="jenis" defaultValue={jenis} style={{ maxWidth: 180 }}>
              <option value="all">Semua Jenis</option>
              <option value="pph21">PPh Masa 21</option>
              <option value="unifikasi">Unifikasi</option>
              <option value="ppn">PPN</option>
            </select>
            <select className="search-input" name="masa" defaultValue={masa} style={{ maxWidth: 200 }}>
              <option value="all">Semua periode</option>
              {periodOptions.map((period) => (
                <option key={period} value={period}>
                  {monthFullLabel(period)}
                </option>
              ))}
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
                <th>Setor</th>
                <th>Periode</th>
                <th>Jenis PPh Masa</th>
                <th>Tgl Setor</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Belum ada data setoran PPh Masa. Import ulang Data Penerimaan jika data lama belum memuat detail KD MAP PPh Masa.
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
                      <strong>{formatRupiah(item.nilai_setor)}</strong>
                    </td>
                    <td>{periodLabel(item.masa_pajak)}</td>
                    <td>{item.jenis_pph_masa}</td>
                    <td className="td-mono">{dateLabel(item.tgl_setor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} setoran - Total setor {formatRupiah(result.totalSetor)}
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/rincian-pph-masa" query={keepQuery({ q, wilayah, jenis, masa, ar })} />
        </div>
      </section>
    </>
  );
}
