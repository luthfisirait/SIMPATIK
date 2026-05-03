import { DatabaseZap, MailCheck, Settings, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toggle } from "@/components/ui/Toggle";

export default function PengaturanPage() {
  return (
    <>
      <PageHeader title="Pengaturan" description="Konfigurasi sistem dummy-ready untuk integrasi data dan notifikasi." />

      <section className="kpi-grid">
        <KpiCard label="Coretax" value="Simulasi" sub="Endpoint siap diganti API real" accent="teal" icon={<DatabaseZap size={18} />} />
        <KpiCard label="BKPSDM" value="Simulasi" sub="Dataset pegawai sample" accent="green" icon={<DatabaseZap size={18} />} />
        <KpiCard label="Notifikasi Email" value="Nonaktif" sub="In-app aktif via tabel notifications" accent="gold" icon={<MailCheck size={18} />} />
        <KpiCard label="RBAC" value="Aktif" sub="4 role utama tersedia" accent="navy" icon={<ShieldCheck size={18} />} />
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Profil Sistem</div>
              <div className="card-subtitle">Identitas aplikasi dan unit kerja.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <label className="field span-2">
                <span>Nama aplikasi</span>
                <input defaultValue="SIMPATIK" />
              </label>
              <label className="field span-2">
                <span>Unit kerja</span>
                <input defaultValue="KPP Pratama Padang Satu" />
              </label>
              <label className="field">
                <span>Tahun pajak aktif</span>
                <input defaultValue="2025" />
              </label>
              <label className="field">
                <span>Periode aktif</span>
                <input defaultValue="2026-03" />
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Notifikasi</div>
              <div className="card-subtitle">Preferensi in-app dan integrasi eksternal.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="toggle-row">
              <div>
                <strong>OPD merah harian</strong>
                <div className="muted">Muncul saat ada kepatuhan di bawah 40%.</div>
              </div>
              <Toggle active label="OPD merah harian" />
            </div>
            <div className="toggle-row">
              <div>
                <strong>PPh 21 kritis</strong>
                <div className="muted">Muncul saat bendahara belum setor.</div>
              </div>
              <Toggle active label="PPh 21 kritis" />
            </div>
            <div className="toggle-row">
              <div>
                <strong>Email Power Automate</strong>
                <div className="muted">Disiapkan sebagai simulasi integrasi.</div>
              </div>
              <Toggle label="Email Power Automate" />
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Status Integrasi</div>
            <div className="card-subtitle">Semua endpoint memakai data dummy SQLite lokal.</div>
          </div>
          <Settings size={18} color="var(--text-3)" />
        </div>
        <div className="card-body">
          <div className="toolbar">
            <Badge tone="teal">/api/dashboard</Badge>
            <Badge tone="green">/api/opd</Badge>
            <Badge tone="green">/api/spt</Badge>
            <Badge tone="green">/api/pph21</Badge>
            <Badge tone="amber">/api/seed</Badge>
          </div>
        </div>
      </section>
    </>
  );
}
