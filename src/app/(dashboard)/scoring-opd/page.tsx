import { Award, Download, Search, Trophy, TriangleAlert } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { getWilayah, listAr, listScoring } from "@/lib/queries";
import { firstParam, keepQuery, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber, formatPercent, monthLabel, trafficLabel } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  reward: "Reward",
  monitor: "Monitor",
  punishment: "Punishment",
};

const statusTone: Record<string, "green" | "amber" | "red" | "teal"> = {
  reward: "green",
  monitor: "amber",
  punishment: "red",
};

function score(value: number) {
  return formatPercent(value, 1);
}

export default async function ScoringOpdPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  await ensureGoogleSheetsHydrated();
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const kategori = firstParam(searchParams, "kategori", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const result = listScoring({ q, wilayah, kategori, statusRp: status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const byStatus = (key: string) => result.summary.filter((item) => item.status_rp === key).reduce((sum, item) => sum + item.total, 0);
  const avgScore =
    result.summary.length === 0
      ? 0
      : result.summary.reduce((sum, item) => sum + item.avg_score * item.total, 0) /
        result.summary.reduce((sum, item) => sum + item.total, 0);
  const exportQuery = queryString({ q, wilayah, kategori, status, ar, bulan: result.bulan });
  const exportHref = exportQuery ? `/api/export/scoring?${exportQuery}` : "/api/export/scoring";

  return (
    <>
      <PageHeader
        title="Scoring OPD"
        description={`Skor komposit reward dan punishment untuk ${monthLabel(result.bulan)}.`}
        actions={
          <Link className="btn btn-secondary" href={exportHref} target="_blank">
            <Download size={16} />
            Export CSV
          </Link>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Rata-rata Skor" value={score(avgScore)} sub="Bobot SPT, PPh21, SPT Masa, deposit" accent="navy" icon={<Trophy size={18} />} />
        <KpiCard label="Kandidat Reward" value={formatNumber(byStatus("reward"))} sub="Skor minimal 90" accent="green" icon={<Award size={18} />} />
        <KpiCard label="Monitor" value={formatNumber(byStatus("monitor"))} sub="Skor 70 sampai 89" accent="gold" icon={<Trophy size={18} />} />
        <KpiCard label="Kandidat Punishment" value={formatNumber(byStatus("punishment"))} sub="Skor di bawah 70" accent="red" icon={<TriangleAlert size={18} />} />
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Kandidat Reward</div>
              <div className="card-subtitle">Prioritas sertifikat OPD teladan pajak.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="insight-list">
              {result.topReward.length === 0 ? <span className="muted">Belum ada kandidat reward pada periode ini.</span> : null}
              {result.topReward.map((item) => (
                <div className="metric-row" key={item.id}>
                  <span>{item.opd_nama}</span>
                  <strong>{score(item.skor_total)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Kandidat Punishment</div>
              <div className="card-subtitle">Prioritas surat pembinaan dan kunjungan AR.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="insight-list">
              {result.topPunishment.length === 0 ? <span className="muted">Tidak ada kandidat punishment pada periode ini.</span> : null}
              {result.topPunishment.slice(0, 5).map((item) => (
                <div className="metric-row" key={item.id}>
                  <span>{item.opd_nama}</span>
                  <strong>{score(item.skor_total)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar Scoring Komposit</div>
            <div className="card-subtitle">Rumus: SPT OP 30%, PPh21 25%, SPT Masa 25%, deposit 20%.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD atau AR" defaultValue={q} style={{ maxWidth: 260 }} />
            <select className="search-input" name="wilayah" defaultValue={wilayah} style={{ maxWidth: 220 }}>
              <option value="all">Semua wilayah</option>
              {wilayahOptions.map((item) => (
                <option key={item.kode} value={item.kode}>
                  {item.nama}
                </option>
              ))}
            </select>
            <select className="search-input" name="kategori" defaultValue={kategori} style={{ maxWidth: 170 }}>
              <option value="all">Semua kategori</option>
              <option value="hijau">Hijau</option>
              <option value="kuning">Kuning</option>
              <option value="merah">Merah</option>
            </select>
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 180 }}>
              <option value="all">Semua status RP</option>
              <option value="reward">Reward</option>
              <option value="monitor">Monitor</option>
              <option value="punishment">Punishment</option>
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
                <th>AR</th>
                <th>SPT OP</th>
                <th>PPh21</th>
                <th>SPT Masa</th>
                <th>Deposit</th>
                <th>Total</th>
                <th>Kategori</th>
                <th>Status RP</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.opd_nama}</strong>
                    <div className="muted">{item.wilayah_nama}</div>
                  </td>
                  <td>{item.ar_nama ?? "-"}</td>
                  <td className="td-mono">{score(item.skor_spt_op)}</td>
                  <td className="td-mono">{score(item.skor_pph21)}</td>
                  <td className="td-mono">{score(item.skor_spt_masa)}</td>
                  <td className="td-mono">{score(item.skor_deposit)}</td>
                  <td className="td-mono">
                    <strong>{score(item.skor_total)}</strong>
                  </td>
                  <td>
                    <Badge tone={toneForTraffic(item.kategori)}>{trafficLabel(item.kategori)}</Badge>
                  </td>
                  <td>
                    <Badge tone={statusTone[item.status_rp]}>{statusLabel[item.status_rp]}</Badge>
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
          <Pagination page={result.page} pages={result.pages} basePath="/scoring-opd" query={keepQuery({ q, wilayah, kategori, status, ar })} />
        </div>
      </div>
    </>
  );
}
