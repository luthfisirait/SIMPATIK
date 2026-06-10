import { Download, Search, Send, UsersRound } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listPegawai } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, toWaLink } from "@/lib/utils";

const statusTone: Record<string, "amber" | "red" | "green"> = {
  belum_aktivasi: "amber",
  aktif_belum_lapor: "red",
  sudah_lapor: "green",
};

const statusLabel: Record<string, string> = {
  belum_aktivasi: "Belum aktivasi",
  aktif_belum_lapor: "Aktif, belum lapor",
  sudah_lapor: "Sudah lapor",
};

export default async function PegawaiBelumLaporPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : undefined;
  const page = numericParam(searchParams, "page");
  const result = listPegawai({ q, wilayah, status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const count = (key: string) => result.summary.find((item) => item.status === key)?.total ?? 0;
  const exportQuery = queryString({ q, wilayah, status });
  const exportHref = exportQuery ? `/api/export/pegawai?${exportQuery}` : "/api/export/pegawai";

  return (
    <>
      <PageHeader
        title="Pegawai Belum Lapor SPT"
        description="Daftar individu dummy hasil padanan Coretax dan BKPSDM."
        actions={
          <>
            <Link className="btn btn-secondary" href={exportHref} target="_blank">
              <Download size={16} />
              Export CSV
            </Link>
            <button className="btn btn-primary" type="button">
              <Send size={16} />
              Bulk Imbauan
            </button>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Aktif Belum Lapor" value={formatNumber(count("aktif_belum_lapor"))} accent="red" icon={<UsersRound size={18} />} />
        <KpiCard label="Belum Aktivasi" value={formatNumber(count("belum_aktivasi"))} accent="gold" icon={<UsersRound size={18} />} />
        <KpiCard label="Sudah Lapor Sample" value={formatNumber(count("sudah_lapor"))} accent="green" icon={<UsersRound size={18} />} />
        <KpiCard label="Ditampilkan" value={formatNumber(result.total)} sub="Tidak termasuk sudah lapor" accent="navy" icon={<UsersRound size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar Individual</div>
            <div className="card-subtitle">Filter OPD, wilayah, dan status Coretax.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari nama, NIP, atau OPD" defaultValue={q} style={{ maxWidth: 280 }} />
            <select className="search-input" name="wilayah" defaultValue={wilayah} style={{ maxWidth: 220 }}>
              <option value="all">Semua wilayah</option>
              {wilayahOptions.map((item) => (
                <option key={item.kode} value={item.kode}>
                  {item.nama}
                </option>
              ))}
            </select>
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 210 }}>
              <option value="all">Semua status</option>
              <option value="aktif_belum_lapor">Aktif, belum lapor</option>
              <option value="belum_aktivasi">Belum aktivasi</option>
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
                <th>Nama</th>
                <th>NIP</th>
                <th>NIK</th>
                <th>OPD</th>
                <th>Jabatan</th>
                <th>Jenis</th>
                <th>Wilayah</th>
                <th>Status</th>
                <th>AR</th>
                <th>Kontak</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nama}</strong>
                  </td>
                  <td className="td-mono">{item.nip}</td>
                  <td className="td-mono">{item.nik ?? "-"}</td>
                  <td>{item.opd_nama}</td>
                  <td>{item.jabatan}</td>
                  <td>{item.jenis_kepegawaian ?? "-"}</td>
                  <td>{item.wilayah_nama}</td>
                  <td>
                    <Badge tone={statusTone[item.status_coretax]}>{statusLabel[item.status_coretax]}</Badge>
                  </td>
                  <td>{item.ar_nama}</td>
                  <td>
                    <a className="wa-link" href={toWaLink(item.phone)} target="_blank">
                      {item.phone}
                    </a>
                    {item.email ? <div className="muted">{item.email}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} pegawai
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/pegawai-belum-lapor" query={keepQuery({ q, wilayah, status })} />
        </div>
      </div>
    </>
  );
}
