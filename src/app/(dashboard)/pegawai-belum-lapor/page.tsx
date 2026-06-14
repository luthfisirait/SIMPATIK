import { Download, Search, UsersRound } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { getWilayah, listAr, listPegawai } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, toWaLink } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  sudah_lapor: "Sudah Lapor",
  aktif_belum_lapor: "Belum Lapor",
  belum_aktivasi: "Belum Aktivasi",
};

function statusTone(status: string): "green" | "amber" | "red" | "teal" {
  if (status === "sudah_lapor") return "green";
  if (status === "belum_aktivasi") return "amber";
  if (status === "aktif_belum_lapor") return "red";
  return "teal";
}

export default async function PegawaiBelumLaporPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  await ensureGoogleSheetsHydrated();
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listPegawai({ q, wilayah, status, ar, page, pageSize: 12, includeSudah: true });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const count = (key: string) => result.summary.find((item) => item.status === key)?.total ?? 0;
  const exportQuery = queryString({ q, wilayah, status, ar });
  const exportHref = exportQuery ? `/api/export/pegawai?${exportQuery}` : "/api/export/pegawai";

  return (
    <>
      <PageHeader
        title="Rincian Pegawai SPT Tahunan OP"
        description="Daftar ASN dan PPPK per OPD berdasarkan status pelaporan SPT di Coretax."
        actions={
          <Link className="btn btn-primary" href={exportHref} target="_blank">
            <Download size={16} />
            Export CSV
          </Link>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Pegawai Ditampilkan" value={formatNumber(result.total)} sub="Sesuai filter aktif" accent="navy" icon={<UsersRound size={18} />} />
        <KpiCard label="Sudah Lapor" value={formatNumber(count("sudah_lapor"))} sub="Sudah terekam di Coretax" accent="green" icon={<UsersRound size={18} />} />
        <KpiCard label="Belum Lapor" value={formatNumber(count("aktif_belum_lapor"))} sub="Aktif tetapi belum menyampaikan SPT" accent="red" icon={<UsersRound size={18} />} />
        <KpiCard label="Belum Aktivasi" value={formatNumber(count("belum_aktivasi"))} sub="Perlu aktivasi akun Coretax" accent="gold" icon={<UsersRound size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar Pegawai per OPD</div>
            <div className="card-subtitle">Pencarian nama, NIP, OPD, wilayah, status, dan AR pengampu.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari nama, NIP, OPD, atau AR" defaultValue={q} style={{ maxWidth: 300 }} />
            <select className="search-input" name="wilayah" defaultValue={wilayah} style={{ maxWidth: 220 }}>
              <option value="all">Semua wilayah</option>
              {wilayahOptions.map((item) => (
                <option key={item.kode} value={item.kode}>
                  {item.nama}
                </option>
              ))}
            </select>
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 190 }}>
              <option value="all">Semua status</option>
              <option value="sudah_lapor">Sudah lapor</option>
              <option value="aktif_belum_lapor">Belum lapor</option>
              <option value="belum_aktivasi">Belum aktivasi</option>
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
                <th>Nama</th>
                <th>NIP</th>
                <th>Jabatan</th>
                <th>OPD</th>
                <th>Wilayah</th>
                <th>Status</th>
                <th>Kontak</th>
                <th>AR</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nama}</strong>
                    <div className="muted">{item.jenis_kepegawaian ?? "-"}</div>
                  </td>
                  <td className="td-mono">{item.nip}</td>
                  <td>{item.jabatan}</td>
                  <td>{item.opd_nama}</td>
                  <td>{item.wilayah_nama}</td>
                  <td>
                    <Badge tone={statusTone(item.status_coretax)}>{statusLabel[item.status_coretax] ?? item.status_coretax}</Badge>
                  </td>
                  <td>
                    {item.phone ? (
                      <a className="wa-link" href={toWaLink(item.phone)} target="_blank">
                        {item.phone}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{item.ar_nama ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} pegawai
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/pegawai-belum-lapor" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
