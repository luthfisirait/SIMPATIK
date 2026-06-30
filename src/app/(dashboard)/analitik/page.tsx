import { BarChart3, LineChart, ScatterChart, TrendingUp } from "lucide-react";

import {
  DoughnutPanel,
  HorizontalBarChart,
  SingleBarChart,
  SptSosialisasiBarChart,
} from "@/components/charts/ChartPanels";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAnalyticsData } from "@/lib/queries";
import { formatCompactRupiah, formatNumber, formatPercent, monthLabel } from "@/lib/utils";

export default function AnalitikPage() {
  const { dashboard, pphTrend, sptSosialisasiBars, depositBySeksi, pegawaiBelumLaporBySeksi } = getAnalyticsData();
  const trendLabels = dashboard.trend.map((item) => monthLabel(item.periode));
  const opdMerah = dashboard.trafficCounts.find((item) => item.status === "merah")?.total ?? 0;
  const totalDepositBySeksi = depositBySeksi.reduce((sum, item) => sum + item.total_deposit, 0);
  const totalPegawaiBelumLapor = pegawaiBelumLaporBySeksi.reduce((sum, item) => sum + item.belum_lapor, 0);
  const hasDepositBySeksi = depositBySeksi.some((item) => item.total_deposit !== 0);

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
            <div>
              <div className="card-title">Jumlah Saldo Deposit per Seksi</div>
              <div className="card-subtitle">Total saldo: {formatCompactRupiah(totalDepositBySeksi)}</div>
            </div>
          </div>
          <div className="card-body">
            {!hasDepositBySeksi ? (
              <span className="muted">Belum ada saldo deposit.</span>
            ) : (
              <div className="chart-wrap">
                <HorizontalBarChart
                  labels={depositBySeksi.map((item) => item.seksi)}
                  values={depositBySeksi.map((item) => item.total_deposit)}
                  label="Saldo deposit"
                  valueFormat="compact-rupiah"
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">SPT Pegawai Belum Lapor per Seksi</div>
              <div className="card-subtitle">Total belum lapor: {formatNumber(totalPegawaiBelumLapor)} pegawai</div>
            </div>
          </div>
          <div className="card-body">
            {pegawaiBelumLaporBySeksi.length === 0 ? (
              <span className="muted">Tidak ada pegawai yang belum lapor.</span>
            ) : (
              <div className="chart-wrap">
                <HorizontalBarChart
                  labels={pegawaiBelumLaporBySeksi.map((item) => item.seksi)}
                  values={pegawaiBelumLaporBySeksi.map((item) => item.belum_lapor)}
                  label="Pegawai belum lapor"
                  barColor="red"
                />
              </div>
            )}
          </div>
        </div>
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
            <div>
              <div className="card-title">Tren Penyetoran PPh 21 Masa per Bulan</div>
              <div className="card-subtitle">KD MAP 411121 berdasarkan tanggal setor</div>
            </div>
          </div>
          <div className="card-body">
            {pphTrend.length === 0 ? (
              <span className="muted">Belum ada data tren PPh 21.</span>
            ) : (
              <div className="chart-wrap">
                <SingleBarChart
                  labels={pphTrend.map((item) => monthLabel(item.periode))}
                  values={pphTrend.map((item) => item.nilai_setor)}
                  label="Nilai setor PPh 21"
                  valueFormat="compact-rupiah"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Kepatuhan SPT vs Sosialisasi</div>
              <div className="card-subtitle">Rata-rata kepatuhan per status OPD</div>
            </div>
          </div>
          <div className="card-body">
            {sptSosialisasiBars.length === 0 ? (
              <span className="muted">Belum ada data korelasi.</span>
            ) : (
              <div className="chart-wrap-sm">
                <SptSosialisasiBarChart data={sptSosialisasiBars} />
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
