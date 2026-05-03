import { Download, Search } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { getWilayah, listOpd } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, toWaLink } from "@/lib/utils";

const statusTone: Record<string, "green" | "amber" | "red"> = {
  aktif: "green",
  perlu_update: "amber",
  tidak_aktif: "red",
};

export default function DirektoriOpdPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const page = numericParam(searchParams, "page");
  const result = listOpd({ q, wilayah, page, pageSize: 14 });
  const wilayahOptions = getWilayah();
  const exportQuery = queryString({ q, wilayah });
  const exportHref = exportQuery ? `/api/export/opd?${exportQuery}` : "/api/export/opd";

  return (
    <>
      <PageHeader
        title="Direktori OPD"
        description="Kontak bendahara dan PIC kepegawaian per OPD."
        actions={
          <Link className="btn btn-secondary" href={exportHref} target="_blank">
            <Download size={16} />
            Export CSV
          </Link>
        }
      />
      <div className="card">
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD atau kontak" defaultValue={q} style={{ maxWidth: 280 }} />
            <select className="search-input" name="wilayah" defaultValue={wilayah} style={{ maxWidth: 220 }}>
              <option value="all">Semua wilayah</option>
              {wilayahOptions.map((item) => (
                <option key={item.kode} value={item.kode}>
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
                <th>Wilayah</th>
                <th>Bendahara</th>
                <th>Kontak Bendahara</th>
                <th>PIC Kepegawaian</th>
                <th>Kontak PIC</th>
                <th>AR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nama}</strong>
                  </td>
                  <td>{item.wilayah_nama}</td>
                  <td>{item.nama_bendahara}</td>
                  <td>
                    <a className="wa-link" href={toWaLink(item.hp_bendahara)} target="_blank">
                      {item.hp_bendahara}
                    </a>
                  </td>
                  <td>{item.nama_pic_kepeg}</td>
                  <td>
                    <a className="wa-link" href={toWaLink(item.hp_pic_kepeg)} target="_blank">
                      {item.hp_pic_kepeg}
                    </a>
                  </td>
                  <td>{item.ar_nama}</td>
                  <td>
                    <Badge tone={statusTone[item.status]}>{item.status.replace("_", " ")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} kontak
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/direktori-opd" query={keepQuery({ q, wilayah })} />
        </div>
      </div>
    </>
  );
}
