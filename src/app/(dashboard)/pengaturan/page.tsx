import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toggle } from "@/components/ui/Toggle";

export default function PengaturanPage() {
  return (
    <>
      <PageHeader title="Pengaturan Sistem" />

      <section className="grid-2">
        <div className="settings-card">
          <div className="settings-block-header">Notifikasi</div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Alert PPh Masa Belum Setor</div>
              <div className="settings-row-desc">H+1 setelah batas waktu setor</div>
            </div>
            <Toggle active label="Alert PPh Masa Belum Setor" />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Alert Deposit Pajak Rendah</div>
              <div className="settings-row-desc">Saldo OPD &lt; Rp 100 juta</div>
            </div>
            <Toggle active label="Alert Deposit Pajak Rendah" />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Executive Summary Mingguan</div>
              <div className="settings-row-desc">Kirim otomatis setiap Senin pukul 07.00</div>
            </div>
            <Toggle active label="Executive Summary Mingguan" />
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-block-header">Integrasi Data</div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Coretax DJP</div>
              <div className="settings-row-desc">Sumber utama SPT, setoran, deposit</div>
            </div>
            <Badge tone="green">Terhubung</Badge>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">BKPSDM (Data Kepegawaian)</div>
              <div className="settings-row-desc">Rekonsiliasi jumlah ASN & PPPK</div>
            </div>
            <Badge tone="green">Terhubung</Badge>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Microsoft 365 / SharePoint</div>
              <div className="settings-row-desc">Sinkronisasi ke Power BI</div>
            </div>
            <Badge tone="amber">Sinkronisasi Tertunda</Badge>
          </div>
        </div>
      </section>
    </>
  );
}
