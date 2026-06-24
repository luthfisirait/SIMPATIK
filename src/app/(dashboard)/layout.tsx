import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth";
import { getDataStatus } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const dataStatus = getDataStatus();
  const monitoringKosong =
    dataStatus.opd === 0 ||
    dataStatus.spt === 0 ||
    dataStatus.sptTahunanOp === 0 ||
    dataStatus.pph21 === 0 ||
    dataStatus.sptMasa === 0 ||
    dataStatus.deposit === 0 ||
    dataStatus.pegawai === 0 ||
    dataStatus.scoring === 0;
  const statusText =
    dataStatus.opd === 0
      ? "Database monitoring belum berisi data OPD."
      : "Data OPD sudah ada, tetapi data monitoring pajak belum lengkap.";
  const storageNote =
    "Data disimpan di database SQLite lokal pada folder database. Isi data lewat halaman Import agar dashboard dan modul monitoring menampilkan angka.";

  return (
    <Shell user={session.user}>
      {monitoringKosong ? (
        <div className="alert data-status-banner">
          <div>
            <strong>{statusText}</strong>
            <div className="muted">{storageNote}</div>
          </div>
        </div>
      ) : null}
      {children}
    </Shell>
  );
}
