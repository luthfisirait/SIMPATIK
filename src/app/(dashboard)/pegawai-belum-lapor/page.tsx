import { Download, Search, Send, UsersRound } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listOpdOptions, listPegawai } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, formatPercent } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  aktif_belum_lapor: "Belum lapor",
  belum_aktivasi: "Belum aktivasi",
  sudah_lapor: "Sudah lapor",
};

const statusTone: Record<string, "green" | "amber" | "red" | "teal"> = {
  aktif_belum_lapor: "red",
  belum_aktivasi: "amber",
  sudah_lapor: "green",
};

export default async function PegawaiBelumLaporPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const opd = firstParam(searchParams, "opd", "all");
  const page = numericParam(searchParams, "page");
  const result = listPegawai({ q, wilayah, status, ar, opd, page, pageSize: 12, includeSudah: true });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const opdOptions = listOpdOptions(session?.user.role === "ar" ? { ar } : {});
  const selectedOpd = opdOptions.find((item) => String(item.id) === opd);
  const statusCount = (key: string) => result.summary.find((item) => item.status === key)?.total ?? 0;
  const sudah = statusCount("sudah_lapor");
  const belum = statusCount("aktif_belum_lapor") + statusCount("belum_aktivasi");
  const totalPegawai = sudah + belum;
  const kepatuhan = totalPegawai === 0 ? 0 : (sudah * 100) / totalPegawai;
  const exportQuery = queryString({ q, wilayah, status, ar, opd });
  const exportHref = exportQuery ? `/api/export/pegawai?${exportQuery}` : "/api/export/pegawai";

  return (
    <>
      <PageHeader
        title="Rincian Pegawai SPT Tahunan OP"
        description="Daftar ASN & PPPK per OPD berdasarkan data pegawai yang diimport."
        actions={
          <>
            <Link className="btn btn-secondary" href={exportHref} target="_blank">
              <Download size={16} />
              Ekspor CSV
            </Link>
            <Link className="btn btn-primary" href="/action-log/input">
              <Send size={16} />
              Imbauan Massal
            </Link>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Total Pegawai" value={formatNumber(totalPegawai)} sub="ASN & PPPK pada basis data" accent="navy" icon={<UsersRound size={18} />} />
        <KpiCard label="Sudah Lapor" value={formatNumber(sudah)} sub="Terekam sampai periode berjalan" accent="green" icon={<UsersRound size={18} />} />
        <KpiCard label="Belum Lapor" value={formatNumber(belum)} sub="Perlu imbauan OPD/pegawai" accent="red" icon={<UsersRound size={18} />} />
        <KpiCard label="Kepatuhan" value={formatPercent(kepatuhan)} sub="Rata-rata seluruh pegawai" accent="teal" icon={<UsersRound size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari nama, NIP, OPD, atau AR" defaultValue={q} style={{ maxWidth: 280 }} />
            <select className="search-input" name="opd" defaultValue={opd} style={{ maxWidth: 280 }}>
              <option value="all">Semua OPD</option>
              {opdOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama}
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
          <div className="toolbar">
            {selectedOpd ? <Badge tone="teal">OPD: {selectedOpd.nama}</Badge> : null}
            <Badge tone="green">{formatNumber(sudah)} Sudah</Badge>
            <Badge tone="red">{formatNumber(belum)} Belum</Badge>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Pegawai</th>
                <th>NIP</th>
                <th>NIK</th>
                <th>Jabatan</th>
                <th>OPD</th>
                <th>Wilayah</th>
                <th>Status SPT</th>
                <th>Kontak</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    Belum ada data pegawai.
                  </td>
                </tr>
              ) : (
                result.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nama}</strong>
                    </td>
                    <td className="td-mono">{item.nip}</td>
                    <td className="td-mono">{item.nik ?? "-"}</td>
                    <td>{item.jabatan}</td>
                    <td>{item.opd_nama}</td>
                    <td className="td-mono">{item.wilayah_nama}</td>
                    <td>
                      <Badge tone={statusTone[item.status_coretax]}>{statusLabel[item.status_coretax]}</Badge>
                    </td>
                    <td>{item.phone ?? item.email ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} pegawai
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/pegawai-belum-lapor" query={keepQuery({ q, wilayah, status, ar, opd })} />
        </div>
      </div>
    </>
  );
}
