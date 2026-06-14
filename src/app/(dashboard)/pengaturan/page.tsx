import { Database, Settings } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toggle } from "@/components/ui/Toggle";
import { getDataStatus, listSettings } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

const labels: Record<string, { label: string; desc: string }> = {
  data_source: { label: "Sumber Data", desc: "Sumber aktif untuk data monitoring SIMPATIK" },
  integration_coretax: { label: "Coretax DJP", desc: "Sumber utama SPT, setoran, dan deposit" },
  integration_bkpsdm: { label: "BKPSDM", desc: "Sumber rekonsiliasi ASN dan PPPK" },
  notification_email: { label: "Notifikasi Email", desc: "Kanal pengiriman ringkasan dan peringatan" },
};

function toneForSetting(value: string): "green" | "amber" | "red" | "teal" {
  if (value === "enabled" || value === "connected") return "green";
  if (value === "simulated" || value === "dummy_seed") return "amber";
  if (value === "disabled") return "red";
  return "teal";
}

function valueLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function PengaturanPage() {
  const settings = listSettings();
  const status = getDataStatus();

  return (
    <>
      <PageHeader title="Pengaturan Sistem" description="Status sumber data, integrasi, dan notifikasi SIMPATIK." />

      <section className="kpi-grid">
        <KpiCard label="OPD" value={formatNumber(status.opd)} sub="Master data aktif" accent="navy" icon={<Database size={18} />} />
        <KpiCard label="SPT" value={formatNumber(status.spt)} sub="Baris monitoring SPT" accent="teal" icon={<Settings size={18} />} />
        <KpiCard label="PPh 21" value={formatNumber(status.pph21)} sub="Baris monitoring PPh" accent="green" icon={<Settings size={18} />} />
        <KpiCard label="Pegawai" value={formatNumber(status.pegawai)} sub="Data individu ASN/PPPK" accent="gold" icon={<Database size={18} />} />
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Integrasi Data</div>
              <div className="card-subtitle">Status konfigurasi yang tersimpan di database.</div>
            </div>
          </div>
          <div className="card-body settings-block">
            {settings.map((item) => {
              const meta = labels[item.key] ?? { label: item.key, desc: "Konfigurasi sistem" };
              return (
                <div className="toggle-row" key={item.key}>
                  <div>
                    <div className="settings-row-label">{meta.label}</div>
                    <div className="settings-row-desc">{meta.desc}</div>
                  </div>
                  <Badge tone={toneForSetting(item.value)}>{valueLabel(item.value)}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Notifikasi</div>
              <div className="card-subtitle">Preferensi operasional untuk peringatan kepatuhan.</div>
            </div>
          </div>
          <div className="card-body settings-block">
            <div className="toggle-row">
              <div>
                <div className="settings-row-label">Alert PPh Masa Belum Setor</div>
                <div className="settings-row-desc">Dipakai untuk OPD yang belum atau terlambat setor.</div>
              </div>
              <Toggle active label="Alert PPh Masa Belum Setor" />
            </div>
            <div className="toggle-row">
              <div>
                <div className="settings-row-label">Alert Deposit Pajak Kritis</div>
                <div className="settings-row-desc">Dipakai untuk OPD dengan setoran/deposit berstatus merah.</div>
              </div>
              <Toggle active label="Alert Deposit Pajak Kritis" />
            </div>
            <div className="toggle-row">
              <div>
                <div className="settings-row-label">Executive Summary Mingguan</div>
                <div className="settings-row-desc">Ringkasan untuk pimpinan berbasis dashboard dan scoring.</div>
              </div>
              <Toggle active={settings.some((item) => item.key === "notification_email" && item.value !== "disabled")} label="Executive Summary Mingguan" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
