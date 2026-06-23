import { BarChart3, LineChart, ScatterChart, TrendingUp } from "lucide-react";

import {
  DoughnutPanel,
  ScatterPanel,
  SingleBarChart,
} from "@/components/charts/ChartPanels";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAnalyticsData } from "@/lib/queries";
import { formatNumber, formatPercent, monthLabel } from "@/lib/utils";

export default function AnalitikPage() {
  const { dashboard, pphTrend, scatter } = getAnalyticsData();
  const trendLabels = dashboard.trend.map((item) => monthLabel(item.periode));
  const opdMerah = dashboard.trafficCounts.find((item) => item.status === "merah")?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Analitik & Tren"
        description="Visualisasi data kepatuhan, perbandingan historis, dan insight berbasis data."
      />

      <section className="kpi-grid">
        <KpiCard label="Kepatuhan SPT" value={formatPercent(dashboard.kpis.kepatuhanSpt)} sub={monthLabel(dashboard.period)} accent="teal" icon={<TrendingUp size={18} />} />
        <KpiCard label="PPh Tepat Waktu" value={formatNumber(dashboard.kpis.pphTepat)} sub={`OPD pada ${monthLabel(dashboard.pphMonth)}`} accent="navy" icon={<BarChart3 size={18} />} />
        <KpiCard label="OPD Merah" value={formatNumber(opdMerah)} sub="Prioritas tindak lanjut" accent="red" icon={<LineChart size={18} />} />
        <KpiCard label="OPD Sosialisasi" value={formatNumber(dashboard.kpis.sudahSosialisasi)} sub="Sudah/perlu ulang" accent="gold" icon={<ScatterChart size={18} />} />
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Tren SPT Tahunan OP per Bulan</div>
          </div>
          <div className="card-body">
            {trendLabels.length === 0 ? (
              <span className="muted">Belum ada data tren SPT.</span>
            ) : (
              <div className="chart-wrap">
                <SingleBarChart
                  labels={trendLabels}
                  values={dashboard.trend.map((item) => item.sudah)}
                  label="SPT masuk per bulan"
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Tren Penyetoran PPh 21 Masa per Bulan</div>
          </div>
          <div className="card-body">
            {pphTrend.length === 0 ? (
              <span className="muted">Belum ada data tren PPh 21.</span>
            ) : (
              <div className="chart-wrap">
                <SingleBarChart
                  labels={pphTrend.map((item) => monthLabel(item.bulan))}
                  values={pphTrend.map((item) => item.tepat)}
                  label="OPD tepat waktu bayar PPh 21"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Korelasi SPT vs Sosialisasi</div>
          </div>
          <div className="card-body">
            {scatter.length === 0 ? (
              <span className="muted">Belum ada data korelasi.</span>
            ) : (
              <div className="chart-wrap-sm">
                <ScatterPanel data={scatter} />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Distribusi Status OPD</div>
          </div>
          <div className="card-body">
            {dashboard.trafficCounts.length === 0 ? (
              <span className="muted">Belum ada data distribusi status.</span>
            ) : (
              <div className="chart-wrap-sm">
                <DoughnutPanel
                  labels={dashboard.trafficCounts.map((item) => item.status)}
                  data={dashboard.trafficCounts.map((item) => item.total)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Insight Kritis</div>
          </div>
          <div className="card-body">
            <div className="insight-list">
              {dashboard.kpis.totalOpd === 0 ? (
                <div className="insight-item">
                  <strong>Belum ada data</strong>
                  <span>Import data OPD dan monitoring untuk menampilkan insight.</span>
                </div>
              ) : (
                <>
                  <div className="insight-item insight-red">
                    <strong>OPD merah</strong>
                    <span>{formatNumber(opdMerah)} OPD berada pada status merah.</span>
                  </div>
                  <div className="insight-item insight-green">
                    <strong>Kepatuhan SPT</strong>
                    <span>Rata-rata kepatuhan SPT {formatPercent(dashboard.kpis.kepatuhanSpt)}.</span>
                  </div>
                  <div className="insight-item insight-amber">
                    <strong>Sosialisasi</strong>
                    <span>{formatNumber(dashboard.kpis.belumSosialisasi)} OPD belum memiliki rekam sosialisasi.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
