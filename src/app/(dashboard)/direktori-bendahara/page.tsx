import { BookUser, Download, Mail, Phone, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForPph } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listBendahara } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, formatPercent, monthLabel, toWaLink } from "@/lib/utils";

const pphLabel: Record<string, string> = {
  tepat_waktu: "Tepat waktu",
  terlambat: "Terlambat",
  belum_setor: "Belum setor",
};

export default async function DirektoriBendaharaPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listBendahara({ q, wilayah, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const exportQuery = queryString({ q, wilayah, ar });
  const exportHref = exportQuery ? `/api/export/bendahara?${exportQuery}` : "/api/export/bendahara";
  const withEmail = result.summary.withEmail;
  const withPenerimaan = result.summary.withPenerimaan;

  return (
    <>
      <PageHeader
        title="Direktori Bendahara"
        description={`Kontak bendahara pengeluaran dan penerimaan. Status PPh21 ${monthLabel(result.pphMonth)}.`}
        actions={
          <Link className="btn btn-secondary" href={exportHref} target="_blank">
            <Download size={16} />
            Export CSV
          </Link>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Kontak Ditampilkan" value={formatNumber(result.total)} sub="OPD sesuai filter" accent="navy" icon={<BookUser size={18} />} />
        <KpiCard label="Email Terisi" value={formatNumber(withEmail)} sub="OPD sesuai filter" accent="teal" icon={<Mail size={18} />} />
        <KpiCard label="Bendahara Penerimaan" value={formatNumber(withPenerimaan)} sub="OPD sesuai filter" accent="green" icon={<Phone size={18} />} />
        <KpiCard label="Periode Skor" value={monthLabel(result.scoringPeriod)} sub="Dipakai untuk prioritas kontak" accent="gold" icon={<BookUser size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Kontak Bendahara per OPD</div>
            <div className="card-subtitle">Diurutkan dari skor terendah agar AR menangani OPD prioritas lebih dulu.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD, bendahara, atau AR" defaultValue={q} style={{ maxWidth: 280 }} />
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
                <th>OPD</th>
                <th>Bendahara Pengeluaran</th>
                <th>Email</th>
                <th>Bendahara Penerimaan</th>
                <th>Status PPh21</th>
                <th>Skor</th>
                <th>AR</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nama}</strong>
                    <div className="muted">{item.wilayah_nama}</div>
                  </td>
                  <td>
                    <div>{item.nama_bendahara}</div>
                    <div className="muted">{item.nip_bendahara ?? "-"}</div>
                    <a className="wa-link" href={toWaLink(item.hp_bendahara)} target="_blank">
                      {item.hp_bendahara}
                    </a>
                  </td>
                  <td>
                    {item.email_bendahara ? (
                      <a className="wa-link" href={`mailto:${item.email_bendahara}`}>
                        {item.email_bendahara}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <div>{item.nama_bendahara_penerimaan ?? "-"}</div>
                    {item.hp_bendahara_penerimaan ? (
                      <a className="wa-link" href={toWaLink(item.hp_bendahara_penerimaan)} target="_blank">
                        {item.hp_bendahara_penerimaan}
                      </a>
                    ) : null}
                  </td>
                  <td>
                    {item.status_pph21_terakhir ? (
                      <Badge tone={toneForPph(item.status_pph21_terakhir)}>{pphLabel[item.status_pph21_terakhir] ?? item.status_pph21_terakhir}</Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="td-mono">{item.skor_terakhir === null ? "-" : formatPercent(item.skor_terakhir)}</td>
                  <td>{item.ar_nama ?? "-"}</td>
                  <td>{item.tanggal_update_kontak ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} kontak
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/direktori-bendahara" query={keepQuery({ q, wilayah, ar })} />
        </div>
      </div>
    </>
  );
}
