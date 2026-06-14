import { ClipboardCheck, Download, ReceiptText, Search } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForPph, toneForTraffic } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { getWilayah, listPph21, listSptMasa } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, monthLabel, trafficLabel } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  normal: "Normal",
  under_reporting: "Under-reporting",
  kritis: "Kritis",
  tepat_waktu: "Tepat waktu",
  terlambat: "Terlambat",
  belum_setor: "Belum setor",
};

function statusTone(value: string | null | undefined): "green" | "amber" | "red" | "teal" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("tepat") || normalized.includes("bukan") || normalized.includes("submitted") || normalized.includes("normal")) return "green";
  if (normalized.includes("terlambat")) return "amber";
  if (normalized.includes("nihil") || normalized.includes("belum") || normalized.includes("gagal")) return "red";
  return "teal";
}

export default async function ModulPph21Page({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  await ensureGoogleSheetsHydrated();
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : undefined;
  const page = numericParam(searchParams, "page");
  const masaPage = numericParam(searchParams, "masaPage");
  const result = listPph21({ q, wilayah, pphStatus: status, ar, page, pageSize: 12 });
  const masaResult = listSptMasa({ q, wilayah, ar, page: masaPage, pageSize: 8 });
  const wilayahOptions = getWilayah();
  const exportQuery = queryString({ q, wilayah, status });
  const exportHref = exportQuery ? `/api/export/pph21?${exportQuery}` : "/api/export/pph21";
  const sptMasaExportQuery = queryString({ q, wilayah, ar, masa: masaResult.masa });
  const sptMasaExportHref = sptMasaExportQuery ? `/api/export/spt-masa?${sptMasaExportQuery}` : "/api/export/spt-masa";
  const sptMasaMerah = masaResult.summary.find((item) => item.status === "merah")?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Monitoring PPh Masa OPD"
        description={`Rekap pembayaran PPh 21 dan pelaporan PPh Unifikasi/PPN PUT untuk ${monthLabel(result.bulan)}.`}
        actions={
          <>
            <Link className="btn btn-secondary" href={sptMasaExportHref} target="_blank">
              <Download size={16} />
              Export SPT Masa
            </Link>
            <Link className="btn btn-primary" href={exportHref} target="_blank">
              <Download size={16} />
              Export PPh 21
            </Link>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Bayar Tepat Waktu" value={formatNumber(result.summary.tepat)} sub="Bendahara tepat waktu" accent="green" icon={<ReceiptText size={18} />} />
        <KpiCard label="Belum/Terlambat" value={formatNumber(result.summary.belum)} sub="Perlu imbauan masa pajak" accent="red" icon={<ReceiptText size={18} />} />
        <KpiCard label="Under-reporting" value={formatNumber(result.summary.under_reporting)} sub="Setoran di bawah estimasi" accent="gold" icon={<ReceiptText size={18} />} />
        <KpiCard label="Total Setoran" value={formatCompactRupiah(result.summary.total_setor)} sub="Nominal PPh 21 tercatat" accent="navy" icon={<ReceiptText size={18} />} />
        <KpiCard label="SPT Masa Merah" value={formatNumber(sptMasaMerah)} sub="PPh 22/23 atau PPN PUT perlu tindak lanjut" accent="red" icon={<ClipboardCheck size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Status Pembayaran PPh 21 per OPD</div>
            <div className="card-subtitle">Nominal setor dibanding estimasi wajar tiap masa pajak.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari nama OPD" defaultValue={q} style={{ maxWidth: 260 }} />
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
              <option value="normal">Normal</option>
              <option value="under_reporting">Under-reporting</option>
              <option value="kritis">Kritis</option>
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
                <th>Dip/t</th>
                <th>Nominal Setor</th>
                <th>Estimasi</th>
                <th>Ketepatan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.opd_nama}</strong>
                  </td>
                  <td>{item.wilayah_nama}</td>
                  <td className="td-mono">{formatNumber(item.jumlah_dipotong)}</td>
                  <td className="td-mono">{formatCompactRupiah(item.nominal_setor)}</td>
                  <td className="td-mono">{formatCompactRupiah(item.estimasi_wajar)}</td>
                  <td>
                    <Badge tone={toneForPph(item.ketepatan)}>{statusLabel[item.ketepatan]}</Badge>
                  </td>
                  <td>
                    <Badge tone={toneForPph(item.status)}>{statusLabel[item.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} OPD
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/modul2-pph21" query={keepQuery({ q, wilayah, status, masaPage })} />
        </div>
      </div>

      <div className="section-divider">Pelaporan SPT Masa PPh Unifikasi dan PPN PUT</div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rincian PPh Masa per OPD - {monthLabel(masaResult.masa)}</div>
            <div className="card-subtitle">Memantau PPh 22, PPh 23, dan PPN PUT dalam satu halaman PPh Masa.</div>
          </div>
          <Link className="btn btn-secondary btn-sm" href="/modul4-spt-masa">
            Buka detail lama
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>OPD</th>
                <th>AR</th>
                <th>PPh 21</th>
                <th>PPh 22</th>
                <th>PPh 23</th>
                <th>PPN PUT</th>
                <th>Pemungut</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {masaResult.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.opd_nama}</strong>
                    <div className="muted">{item.wilayah_nama}</div>
                  </td>
                  <td>{item.ar_nama ?? "-"}</td>
                  <td>
                    <Badge tone={statusTone(item.pph21_status)}>{item.pph21_status ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.pph22_nominal)}</div>
                    <Badge tone={statusTone(item.pph22_status)}>{item.pph22_status ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.pph23_nominal)}</div>
                    <Badge tone={statusTone(item.pph23_status)}>{item.pph23_status ?? "-"}</Badge>
                  </td>
                  <td>
                    <div className="td-mono">{formatCompactRupiah(item.ppn_put_nominal)}</div>
                    <Badge tone={statusTone(item.ppn_put_status)}>{item.ppn_put_status ?? "-"}</Badge>
                  </td>
                  <td>{item.status_opd_pemungut ?? "-"}</td>
                  <td>
                    <Badge tone={toneForTraffic(String(item.status_keseluruhan))}>{trafficLabel(String(item.status_keseluruhan))}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(masaResult.data.length)} dari {formatNumber(masaResult.total)} OPD
          </span>
          <Pagination
            page={masaResult.page}
            pages={masaResult.pages}
            basePath="/modul2-pph21"
            query={keepQuery({ q, wilayah, status, page })}
            pageParam="masaPage"
          />
        </div>
      </div>
    </>
  );
}
