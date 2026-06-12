import {
  Building2,
  CalendarPlus,
  Download,
  FileCheck2,
  Presentation,
  ReceiptText,
  Send,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { DoughnutPanel, SptTrendChart } from "@/components/charts/ChartPanels";
import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { getDashboardData } from "@/lib/queries";
import { firstParam, type PageSearchParams } from "@/lib/search";
import { formatCompactRupiah, formatNumber, formatPercent, monthLabel, trafficLabel } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams?: PageSearchParams }) {
  await ensureGoogleSheetsHydrated();
  const data = getDashboardData();
  const denied = firstParam(searchParams, "denied") === "1";
  const isDataEmpty = data.kpis.totalOpd === 0;
  const labels = data.trend.filter((item) => item.tahun_pajak === 2025).map((item) => monthLabel(item.periode));
  const current = data.trend.filter((item) => item.tahun_pajak === 2025).map((item) => item.persen);
  const previous = data.trend.filter((item) => item.tahun_pajak === 2024).map((item) => item.persen);

  if (isDataEmpty) {
    return (
      <>
        <PageHeader
          title="Dashboard SIMPATIK"
          description="Login sudah aktif, tetapi database monitoring belum berisi data."
        />

        {denied ? <div className="alert">Role Anda tidak memiliki akses ke halaman yang diminta.</div> : null}

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Belum ada data monitoring</div>
              <div className="card-subtitle">
                Dashboard, grafik, KPI, dan tabel prioritas akan muncul setelah data OPD dan data monitoring pajak tersedia.
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="empty">
              <strong>Database aktif masih kosong.</strong>
              <p style={{ margin: "8px auto 0", maxWidth: 760 }}>
                Isi data lewat skrip import: <code>npm run import:contoh</code> atau <code>npm run import:excel</code> dengan
                menunjuk file sumber. Setelah import, dashboard dan seluruh modul monitoring akan menampilkan angka.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard SIMPATIK"
        description={`Periode monitoring ${monthLabel(data.period)}. Data dummy siap diganti integrasi Coretax/BKPSDM.`}
        actions={
          <>
            <Link className="btn btn-secondary" href="/api/dashboard" target="_blank">
              <Download size={16} />
              JSON
            </Link>
            <Link className="btn btn-primary" href="/modul1-spt">
              <Send size={16} />
              Tindak Lanjut
            </Link>
          </>
        }
      />

      {denied ? <div className="alert">Role Anda tidak memiliki akses ke halaman yang diminta.</div> : null}

      <section className="quick-strip">
        <Link className="quick-card" href="/modul1-spt">
          <span className="quick-card-icon">
            <FileCheck2 size={19} />
          </span>
          <span className="quick-card-copy">
            <span className="quick-card-label">Monitoring SPT</span>
            <span className="quick-card-sub">Traffic light OPD</span>
          </span>
        </Link>
        <Link className="quick-card" href="/modul2-pph21">
          <span className="quick-card-icon" style={{ background: "var(--navy)" }}>
            <ReceiptText size={19} />
          </span>
          <span className="quick-card-copy">
            <span className="quick-card-label">PPh 21</span>
            <span className="quick-card-sub">Status bendahara</span>
          </span>
        </Link>
        <Link className="quick-card" href="/modul3-sosialisasi">
          <span className="quick-card-icon" style={{ background: "var(--gold)" }}>
            <Presentation size={19} />
          </span>
          <span className="quick-card-copy">
            <span className="quick-card-label">Sosialisasi</span>
            <span className="quick-card-sub">Jadwal dan rekam jejak</span>
          </span>
        </Link>
        <Link className="quick-card" href="/scoring-opd">
          <span className="quick-card-icon" style={{ background: "var(--green)" }}>
            <ReceiptText size={19} />
          </span>
          <span className="quick-card-copy">
            <span className="quick-card-label">Scoring OPD</span>
            <span className="quick-card-sub">Skor komposit kepatuhan</span>
          </span>
        </Link>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Kepatuhan SPT"
          value={formatPercent(data.kpis.kepatuhanSpt)}
          sub={`${formatNumber(data.kpis.sptMasuk)} dari ${formatNumber(data.kpis.sptWajib)} wajib lapor`}
          change="+ dibanding bulan lalu"
          changeTone="up"
          accent="teal"
          icon={<TrendingUp size={18} />}
        />
        <KpiCard
          label="SPT Masuk"
          value={formatNumber(data.kpis.sptMasuk)}
          sub={`Tahun pajak 2025 per ${monthLabel(data.period)}`}
          accent="green"
          icon={<FileCheck2 size={18} />}
        />
        <KpiCard
          label="PPh 21 Belum Setor"
          value={formatNumber(data.kpis.pphBelumSetor)}
          sub={`${formatNumber(data.kpis.pphUnderReporting)} under-reporting`}
          change={formatCompactRupiah(data.kpis.totalSetorPph)}
          changeTone="neutral"
          accent="red"
          icon={<ReceiptText size={18} />}
        />
        <KpiCard
          label="Belum Sosialisasi"
          value={formatNumber(data.kpis.belumSosialisasi)}
          sub={`${formatNumber(data.kpis.sudahSosialisasi)} OPD sudah tercatat`}
          accent="gold"
          icon={<Presentation size={18} />}
        />
        <KpiCard
          label="Total OPD"
          value={formatNumber(data.kpis.totalOpd)}
          sub={`${formatNumber(data.kpis.totalPeserta)} peserta sosialisasi`}
          accent="navy"
          icon={<Building2 size={18} />}
        />
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Tren Kepatuhan SPT Bulanan</div>
              <div className="card-subtitle">Perbandingan realisasi tahun pajak berjalan dan historis</div>
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
              <div className="card-title">Distribusi Wilayah</div>
              <div className="card-subtitle">SPT masuk per wilayah</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap-sm">
              <DoughnutPanel labels={data.wilayahDistribution.map((item) => item.nama)} data={data.wilayahDistribution.map((item) => item.sudah)} />
            </div>
            <div className="insight-list" style={{ marginTop: 16 }}>
              {data.wilayahDistribution.map((item) => (
                <ProgressBar key={item.nama} label={item.nama} value={item.persen} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid-main-rev">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Aktivitas Terbaru</div>
              <div className="card-subtitle">Log tindak lanjut AR</div>
            </div>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {data.activity.map((item) => (
                <div className="activity-item" key={item.id}>
                  <strong>{item.action}</strong>
                  <span className="muted">{item.target_name}</span>
                  <span className="muted">
                    {item.user_nama ?? "Sistem"} - {new Date(item.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Traffic Light OPD Prioritas</div>
              <div className="card-subtitle">Urutan dari kepatuhan terendah</div>
            </div>
            <Link href="/modul1-spt" className="btn btn-secondary btn-sm">
              Lihat semua
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>OPD</th>
                  <th>Wilayah</th>
                  <th>AR</th>
                  <th>Kepatuhan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.trafficTop.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.opd_nama}</strong>
                    </td>
                    <td>{item.wilayah_nama}</td>
                    <td>{item.ar_nama}</td>
                    <td className="td-mono">{formatPercent(item.persen_kepatuhan)}</td>
                    <td>
                      <Badge tone={toneForTraffic(item.traffic_light)}>{trafficLabel(item.traffic_light)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid-3">
        {data.notifications.slice(0, 3).map((item) => (
          <div className="card" key={item.id}>
            <div className="card-body">
              <Badge tone={item.type === "danger" ? "red" : item.type === "warning" ? "amber" : item.type === "success" ? "green" : "teal"}>
                {item.type}
              </Badge>
              <h3 style={{ marginTop: 12, fontSize: 15 }}>{item.title}</h3>
              <p className="text-2" style={{ marginTop: 6 }}>{item.body}</p>
            </div>
          </div>
        ))}
      </section>

      <Link className="btn btn-secondary" href="/modul3-sosialisasi">
        <CalendarPlus size={16} />
        Kelola Jadwal Sosialisasi
      </Link>
    </>
  );
}
