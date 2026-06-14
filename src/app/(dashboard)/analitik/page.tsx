import { BarChart3, LineChart, ScatterChart, TrendingUp } from "lucide-react";

import { DoughnutPanel, PphBarChart, ScatterPanel, SptTrendChart } from "@/components/charts/ChartPanels";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAnalyticsData } from "@/lib/queries";
import { formatCompactRupiah, formatNumber, formatPercent, monthLabel } from "@/lib/utils";

export default async function AnalitikPage() {
  const data = getAnalyticsData();
  const trendCurrent = data.dashboard.trend.filter((item) => item.tahun_pajak === 2025);
  const trendPrevious = data.dashboard.trend.filter((item) => item.tahun_pajak === 2024);
  const pphLabels = data.pphTrend.map((item) => monthLabel(item.bulan));
  const pphTotalSetor = data.pphTrend.reduce((sum, item) => sum + item.setor, 0);
  const totalTraffic = data.dashboard.trafficCounts.reduce((sum, item) => sum + item.total, 0);
  const merah = data.dashboard.trafficCounts.find((item) => item.status === "merah")?.total ?? 0;
  const sudahSosialisasi = data.scatter.filter((item) => item.sosialisasi).length;

  return (
    <>
      <PageHeader
        title="Analitik & Tren"
        description="Visualisasi tren kepatuhan, PPh Masa, distribusi status OPD, dan korelasi sosialisasi."
      />

      <section className="kpi-grid">
        <KpiCard
          label="Kepatuhan SPT"
          value={formatPercent(data.dashboard.kpis.kepatuhanSpt)}
          sub={`Periode ${monthLabel(data.dashboard.period)}`}
          accent="teal"
          icon={<TrendingUp size={18} />}
        />
        <KpiCard label="Total Setoran PPh 21" value={formatCompactRupiah(pphTotalSetor)} sub="Akumulasi data tren" accent="navy" icon={<BarChart3 size={18} />} />
        <KpiCard label="OPD Merah" value={formatNumber(merah)} sub={`Dari ${formatNumber(totalTraffic)} OPD terhitung`} accent="red" icon={<LineChart size={18} />} />
        <KpiCard label="Sampel Sosialisasi" value={formatNumber(sudahSosialisasi)} sub="OPD pada plot korelasi" accent="gold" icon={<ScatterChart size={18} />} />
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">SPT Tahunan OP 2024 vs 2025</div>
              <div className="card-subtitle">Perbandingan persentase kepatuhan bulanan.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              <SptTrendChart
                labels={trendCurrent.map((item) => monthLabel(item.periode))}
                current={trendCurrent.map((item) => item.persen)}
                previous={trendPrevious.map((item) => item.persen)}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Tren Penyetoran PPh 21 Masa</div>
              <div className="card-subtitle">Jumlah OPD tepat waktu dibanding belum/terlambat.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              <PphBarChart
                labels={pphLabels}
                tepat={data.pphTrend.map((item) => item.tepat)}
                terlambat={data.pphTrend.map((item) => item.terlambat)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Korelasi SPT vs Sosialisasi</div>
          </div>
          <div className="card-body">
            <div className="chart-wrap-sm">
              <ScatterPanel data={data.scatter} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Distribusi Status OPD</div>
          </div>
          <div className="card-body">
            <div className="chart-wrap-sm">
              <DoughnutPanel labels={data.dashboard.trafficCounts.map((item) => item.status)} data={data.dashboard.trafficCounts.map((item) => item.total)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Insight Kritis</div>
          </div>
          <div className="card-body">
            <div className="insight-list">
              <div className="insight-item">
                <strong>OPD merah perlu prioritas AR</strong>
                <span className="muted">{formatNumber(merah)} OPD berada pada kategori merah di periode terakhir.</span>
              </div>
              <div className="insight-item">
                <strong>PPh Masa perlu rekonsiliasi rutin</strong>
                <span className="muted">Pantau selisih antara estimasi dan nominal setor dari grafik PPh 21.</span>
              </div>
              <div className="insight-item">
                <strong>Sosialisasi Coretax tetap relevan</strong>
                <span className="muted">Plot korelasi membantu memilih OPD sasaran sosialisasi ulang.</span>
              </div>
              <Badge tone="teal">Update dari data monitoring aktif</Badge>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
