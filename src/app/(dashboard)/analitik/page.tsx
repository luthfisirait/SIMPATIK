import { BarChart3, Lightbulb, TrendingUp } from "lucide-react";

import { DoughnutPanel, PphBarChart, ScatterPanel, SptTrendChart } from "@/components/charts/ChartPanels";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getAnalyticsData } from "@/lib/queries";
import { formatCompactRupiah, formatNumber, formatPercent, monthLabel } from "@/lib/utils";

export default function AnalitikPage() {
  const { dashboard, pphTrend, scatter } = getAnalyticsData();
  const labels = dashboard.trend.filter((item) => item.tahun_pajak === 2025).map((item) => monthLabel(item.periode));
  const current = dashboard.trend.filter((item) => item.tahun_pajak === 2025).map((item) => item.persen);
  const previous = dashboard.trend.filter((item) => item.tahun_pajak === 2024).map((item) => item.persen);
  const trafficLabels = ["Hijau", "Kuning", "Merah"];
  const trafficData = ["hijau", "kuning", "merah"].map(
    (key) => dashboard.trafficCounts.find((item) => item.status === key)?.total ?? 0,
  );

  return (
    <>
      <PageHeader title="Analitik" description="Visualisasi tren kepatuhan, pembayaran, wilayah, dan korelasi sosialisasi." />

      <section className="kpi-grid">
        <KpiCard label="Kepatuhan Nasional" value={formatPercent(dashboard.kpis.kepatuhanSpt)} sub={monthLabel(dashboard.period)} accent="teal" icon={<TrendingUp size={18} />} />
        <KpiCard label="OPD Merah" value={formatNumber(trafficData[2])} sub="Butuh tindak lanjut cepat" accent="red" icon={<BarChart3 size={18} />} />
        <KpiCard label="Setoran PPh 21" value={formatCompactRupiah(dashboard.kpis.totalSetorPph)} sub="Masa pajak terakhir" accent="navy" icon={<BarChart3 size={18} />} />
        <KpiCard label="Belum Sosialisasi" value={formatNumber(dashboard.kpis.belumSosialisasi)} sub="Sisa OPD prioritas" accent="gold" icon={<Lightbulb size={18} />} />
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Perbandingan Kepatuhan SPT</div>
              <div className="card-subtitle">Tahun pajak 2025 dibanding historis 2024</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              <SptTrendChart labels={labels} current={current} previous={previous} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">PPh 21 per Masa Pajak</div>
              <div className="card-subtitle">OPD tepat waktu dan belum/terlambat</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              <PphBarChart
                labels={pphTrend.map((item) => monthLabel(item.bulan))}
                tepat={pphTrend.map((item) => item.tepat)}
                terlambat={pphTrend.map((item) => item.terlambat)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Korelasi Sosialisasi dan Kepatuhan</div>
              <div className="card-subtitle">Plot sample OPD berdasarkan jumlah ASN</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap-lg">
              <ScatterPanel data={scatter} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Traffic Light</div>
              <div className="card-subtitle">Distribusi status terbaru</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap-sm">
              <DoughnutPanel labels={trafficLabels} data={trafficData} />
            </div>
            <div className="insight-list" style={{ marginTop: 18 }}>
              {dashboard.wilayahDistribution.map((item) => (
                <ProgressBar key={item.nama} label={item.nama} value={item.persen} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="insight-item">
          <strong>OPD merah terkonsentrasi pada unit dengan basis ASN besar.</strong>
          <span className="muted">Gunakan prioritas dari Modul 1 untuk imbauan langsung oleh AR.</span>
        </div>
        <div className="insight-item">
          <strong>Under-reporting PPh 21 perlu validasi silang estimasi.</strong>
          <span className="muted">Endpoint dummy sudah memisahkan status normal, under-reporting, dan kritis.</span>
        </div>
        <div className="insight-item">
          <strong>Sosialisasi punya dampak paling jelas pada OPD risiko rendah-menengah.</strong>
          <span className="muted">Jadwalkan ulang OPD yang statusnya perlu ulang.</span>
        </div>
      </section>
    </>
  );
}
