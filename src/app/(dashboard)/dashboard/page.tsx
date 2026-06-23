import {
  Building2,
  FileCheck2,
  Landmark,
  Presentation,
  ReceiptText,
  Send,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { DoughnutPanel, SingleBarChart } from "@/components/charts/ChartPanels";
import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getDashboardData } from "@/lib/queries";
import { formatCompactRupiah, formatNumber, formatPercent, monthLabel, trafficLabel } from "@/lib/utils";

const quickIcon = {
  "/modul1-spt": FileCheck2,
  "/modul2-pph21": ReceiptText,
  "/modul3-sosialisasi": Presentation,
  "/modul5-deposit": Landmark,
  "/action-log/input": Send,
};

const kpiIcon = [TrendingUp, FileCheck2, ReceiptText, Landmark, Building2];

export default function DashboardPage() {
  const data = getDashboardData();
  const trendLabels = data.trend.map((item) => monthLabel(item.periode));
  const totalDepositKritis = data.trafficCounts.find((item) => item.status === "merah")?.total ?? 0;

  const quickCards = [
    { href: "/modul1-spt", label: "SPT Tahunan OP", sub: `${formatPercent(data.kpis.kepatuhanSpt)} terkini`, accent: "teal" },
    { href: "/modul2-pph21", label: "PPh Masa", sub: `${formatNumber(data.kpis.pphBelumSetor)} OPD bermasalah`, accent: "red" },
    { href: "/modul3-sosialisasi", label: "Sosialisasi", sub: `${formatNumber(data.kpis.belumSosialisasi)} OPD belum`, accent: "gold" },
    { href: "/modul5-deposit", label: "Deposit Pajak", sub: `${formatNumber(totalDepositKritis)} OPD kritis`, accent: "navy" },
    { href: "/action-log/input", label: "Kirim Imbauan", sub: "WA / Surat resmi", accent: "green" },
  ] as const;

  const kpis = [
    {
      label: "Kepatuhan SPT Tahunan OP",
      value: formatPercent(data.kpis.kepatuhanSpt),
      sub: monthLabel(data.period),
      accent: "teal",
    },
    {
      label: "SPT Masuk",
      value: formatNumber(data.kpis.sptMasuk),
      sub: `dari ${formatNumber(data.kpis.sptWajib)}`,
      accent: "green",
    },
    {
      label: "OPD Masalah PPh Masa",
      value: formatNumber(data.kpis.pphBelumSetor + data.kpis.pphUnderReporting),
      sub: monthLabel(data.pphMonth),
      accent: "red",
    },
    {
      label: "Total Setoran PPh",
      value: formatCompactRupiah(data.kpis.totalSetorPph),
      sub: monthLabel(data.pphMonth),
      accent: "gold",
    },
    {
      label: "Total OPD Dipantau",
      value: formatNumber(data.kpis.totalOpd),
      sub: "Sesuai database aktif",
      accent: "navy",
    },
  ] as const;

  return (
    <>
      <section className="quick-strip">
        {quickCards.map((item) => {
          const Icon = quickIcon[item.href];
          return (
            <Link className="quick-card" href={item.href} key={item.href}>
              <span className={`quick-card-icon quick-${item.accent}`}>
                <Icon size={19} />
              </span>
              <span className="quick-card-copy">
                <span className="quick-card-label">{item.label}</span>
                <span className="quick-card-sub">{item.sub}</span>
              </span>
            </Link>
          );
        })}
      </section>

      <section className="kpi-grid">
        {kpis.map((item, index) => {
          const Icon = kpiIcon[index];
          return (
            <KpiCard
              key={item.label}
              label={item.label}
              value={item.value}
              sub={item.sub}
              accent={item.accent}
              icon={<Icon size={18} />}
            />
          );
        })}
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Tren SPT Tahunan OP</div>
              <div className="card-subtitle">Akumulasi laporan per bulan</div>
            </div>
          </div>
          <div className="card-body">
            {trendLabels.length === 0 ? (
              <span className="muted">Belum ada data tren SPT.</span>
            ) : (
              <div className="chart-wrap-lg">
                <SingleBarChart
                  labels={trendLabels}
                  values={data.trend.map((item) => item.sudah)}
                  label="SPT masuk per bulan"
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Kepatuhan per Wilayah</div>
              <div className="card-subtitle">SPT masuk per wilayah</div>
            </div>
          </div>
          <div className="card-body">
            {data.wilayahDistribution.length === 0 ? (
              <span className="muted">Belum ada data wilayah.</span>
            ) : (
              <>
                <div className="chart-wrap-sm">
                  <DoughnutPanel
                    labels={data.wilayahDistribution.map((item) => item.nama)}
                    data={data.wilayahDistribution.map((item) => item.sudah)}
                  />
                </div>
                <div className="insight-list" style={{ marginTop: 16 }}>
                  {data.wilayahDistribution.map((item) => (
                    <ProgressBar key={item.nama} label={item.nama} value={item.persen} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Traffic Light OPD - SPT Tahunan</div>
            <Badge tone="teal">Live</Badge>
          </div>
          <div className="table-wrap">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Nama OPD</th>
                  <th>Wilayah</th>
                  <th>ASN</th>
                  <th>%</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.trafficTop.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Belum ada data SPT.
                    </td>
                  </tr>
                ) : (
                  data.trafficTop.map((item) => (
                    <tr key={item.id}>
                      <td>{item.opd_nama}</td>
                      <td className="td-mono">{item.wilayah_nama}</td>
                      <td>{formatNumber(item.jumlah_wajib_lapor)}</td>
                      <td>{formatPercent(item.persen_kepatuhan)}</td>
                      <td>
                        <Badge tone={toneForTraffic(item.traffic_light)}>{trafficLabel(item.traffic_light)}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="card-footer">
            <span className="muted">Merah &lt;40% - Kuning 40-70% - Hijau &gt;70%</span>
            <Link className="btn btn-ghost btn-sm" href="/modul1-spt">
              Lihat Semua
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Action Log AR</div>
              <div className="card-subtitle">Tindak lanjut terkini</div>
            </div>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {data.activity.length === 0 ? <span className="muted">Belum ada action log.</span> : null}
              {data.activity.map((item) => (
                <div className="feed-card feed-green" key={item.id}>
                  <strong>{item.user_nama ?? "SIMPATIK"} - {item.target_name}</strong>
                  <span>{item.description ?? item.action}</span>
                  <small>{new Date(item.created_at).toLocaleString("id-ID")}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
