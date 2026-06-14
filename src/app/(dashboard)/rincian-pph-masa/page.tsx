import { ArrowRight, ReceiptText } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/PageHeader";

export default function RincianPphMasaPage() {
  return (
    <>
      <PageHeader
        title="Rincian PPh Masa OPD"
        description="Rincian pembayaran dan pelaporan PPh Masa sudah digabung dalam Monitoring PPh Masa OPD."
      />

      <section className="card">
        <div className="card-body" style={{ textAlign: "center", padding: "42px 20px" }}>
          <ReceiptText size={34} style={{ color: "var(--teal)", marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Gunakan halaman Monitoring PPh Masa</h2>
          <p className="text-2" style={{ maxWidth: 680, margin: "0 auto 20px" }}>
            Halaman tersebut menampilkan status PPh 21, rekap setoran, serta pelaporan PPh Unifikasi dan PPN PUT per OPD.
          </p>
          <div className="toolbar" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary" href="/modul2-pph21">
              Buka Monitoring PPh Masa
              <ArrowRight size={16} />
            </Link>
            <Link className="btn btn-secondary" href="/modul4-spt-masa">
              Detail SPT Masa Lama
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
