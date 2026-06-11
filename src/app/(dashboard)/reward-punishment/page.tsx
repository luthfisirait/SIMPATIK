import { Award, Send, ShieldAlert, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getRewardPunishment } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

const rewardScheme = [
  "Sertifikat OPD Teladan Pajak digital dari SIMPATIK, ditandatangani Kepala KPP, diserahkan dalam Compliance Meeting.",
  "Publikasi nama OPD di dashboard SIMPATIK dan executive summary Kanwil DJP Sumbar-Jambi.",
  "Prioritas layanan konsultasi eksklusif AR dan akses jalur cepat bimtek Coretax.",
  "Rekomendasi tertulis Kepala KPP ke Kanwil sebagai input penilaian kinerja instansi.",
  "Early access fitur dan sosialisasi terbaru SIMPATIK sebagai apresiasi kelembagaan.",
];

const punishmentScheme = [
  "Surat peringatan tertulis resmi AR kepada pimpinan OPD, tembusan Kepala KPP, memuat rincian gap dari data SIMPATIK.",
  "Status merah permanen di dashboard SIMPATIK selama OPD belum mencapai target kepatuhan.",
  "Eskalasi pengawasan: kunjungan AR prioritas, monitoring harian, Compliance Meeting khusus pimpinan OPD.",
  "Laporan ke Kepala KPP dengan rekomendasi penerusan ke Kepala Dinas/Bupati/Walikota.",
  "Koordinasi Inspektorat Daerah & BPKAD/BPKPD: tembusan laporan untuk akuntabilitas internal OPD.",
];

export default function RewardPunishmentPage() {
  const { reward, punishment, summary } = getRewardPunishment();

  return (
    <>
      <PageHeader
        title="Reward & Punishment Kepatuhan OPD"
        description="Berbasis scoring otomatis. Reward skor ≥90, punishment skor <70, dengan pembinaan bertahap dalam koridor kewenangan KPP."
      />

      <section className="kpi-grid">
        <KpiCard label="Kandidat Reward" value={formatNumber(summary.reward)} sub="Skor ≥90" accent="green" icon={<Trophy size={18} />} />
        <KpiCard label="Monitoring Ketat" value={formatNumber(summary.monitor)} sub="Skor 70-89" accent="gold" icon={<ShieldAlert size={18} />} />
        <KpiCard label="Kandidat Punishment" value={formatNumber(summary.punishment)} sub="Skor <70" accent="red" icon={<ShieldAlert size={18} />} />
        <KpiCard label="Rata-rata Skor" value={summary.rata.toFixed(1)} sub="Target ≥85" accent="navy" icon={<Award size={18} />} />
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🏆 Skema Reward — Skor ≥ 90</div>
              <div className="card-subtitle">Apresiasi bertahap berbasis data scoring</div>
            </div>
          </div>
          <div className="card-body">
            <ol className="insight-list">
              {rewardScheme.map((item, index) => (
                <li className="insight-item" key={index}>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">⚠ Skema Punishment — Skor &lt; 70</div>
              <div className="card-subtitle">Pembinaan bertahap dalam koridor kewenangan KPP</div>
            </div>
          </div>
          <div className="card-body">
            <ol className="insight-list">
              {punishmentScheme.map((item, index) => (
                <li className="insight-item" key={index}>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Kandidat Reward</div>
              <div className="card-subtitle">OPD dengan skor komposit ≥90</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>OPD</th>
                  <th>Wilayah</th>
                  <th>AR</th>
                  <th>Skor</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {reward.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">Belum ada OPD yang memenuhi syarat reward.</td>
                  </tr>
                ) : (
                  reward.map((item) => (
                    <tr key={item.opd_id}>
                      <td>
                        <strong>{item.opd_nama}</strong>
                      </td>
                      <td>{item.wilayah_nama}</td>
                      <td>{item.ar_nama ?? "-"}</td>
                      <td className="td-mono">{item.skor_total.toFixed(1)}</td>
                      <td>
                        <Badge tone="green">🏅 Sertifikat</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Kandidat Punishment</div>
              <div className="card-subtitle">OPD dengan skor komposit &lt;70</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>OPD</th>
                  <th>Wilayah</th>
                  <th>AR</th>
                  <th>Skor</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {punishment.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">Belum ada OPD yang masuk kategori punishment.</td>
                  </tr>
                ) : (
                  punishment.map((item) => (
                    <tr key={item.opd_id}>
                      <td>
                        <strong>{item.opd_nama}</strong>
                      </td>
                      <td>{item.wilayah_nama}</td>
                      <td>{item.ar_nama ?? "-"}</td>
                      <td className="td-mono">{item.skor_total.toFixed(1)}</td>
                      <td>
                        <Badge tone="red">
                          <Send size={12} /> Surat Peringatan
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
