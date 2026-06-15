import { Download, Plus, Search, Upload } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { getWilayah, listAr, listOpd } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  aktif: "Aktif",
  tidak_aktif: "Tidak aktif",
  perlu_update: "Perlu update",
};

function statusTone(status: string): "green" | "amber" | "red" | "teal" {
  if (status === "aktif") return "green";
  if (status === "perlu_update") return "amber";
  if (status === "tidak_aktif") return "red";
  return "teal";
}

export default async function DataOpdPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listOpd({ q, wilayah, status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const exportQuery = queryString({ q, wilayah, status, ar });
  const exportHref = exportQuery ? `/api/export/opd?${exportQuery}` : "/api/export/opd";

  return (
    <>
      <PageHeader
        title="Data OPD"
        description="Basis data OPD wilayah KPP Pratama Padang Satu beserta PIC bendahara."
        actions={
          <>
            <Link className="btn btn-secondary" href={exportHref} target="_blank">
              <Download size={16} />
              Ekspor
            </Link>
            <Link className="btn btn-secondary" href="/import">
              <Upload size={16} />
              Import
            </Link>
            <button className="btn btn-primary" type="button">
              <Plus size={16} />
              Tambah
            </button>
          </>
        }
      />

      <div className="card">
        <div className="card-header">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD atau bendahara" defaultValue={q} style={{ maxWidth: 260 }} />
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
              <option value="aktif">Aktif</option>
              <option value="perlu_update">Perlu update</option>
              <option value="tidak_aktif">Tidak aktif</option>
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
                <th>Jml ASN</th>
                <th>Jml PPPK</th>
                <th>Bendahara</th>
                <th>No. HP</th>
                <th>AR</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Belum ada data OPD.
                  </td>
                </tr>
              ) : (
                result.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nama}</strong>
                    </td>
                    <td className="td-mono">{item.wilayah_nama}</td>
                    <td>{formatNumber(item.jumlah_asn)}</td>
                    <td>{formatNumber(item.jumlah_pppk)}</td>
                    <td>{item.nama_bendahara}</td>
                    <td className="td-mono">{item.hp_bendahara}</td>
                    <td>{item.ar_nama ?? "-"}</td>
                    <td>
                      <Badge tone={statusTone(item.status)}>{statusLabel[item.status]}</Badge>
                    </td>
                    <td>
                      <div className="toolbar compact-actions">
                        <button className="btn btn-secondary btn-sm" type="button">
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" type="button">
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} OPD
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/data-opd" query={keepQuery({ q, wilayah, status, ar })} />
        </div>
      </div>
    </>
  );
}
