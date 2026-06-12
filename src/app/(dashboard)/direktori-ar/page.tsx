import { Mail, Phone } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureGoogleSheetsHydrated } from "@/lib/google-sheets-store";
import { listAr } from "@/lib/queries";
import { formatNumber, formatPercent, initials, toWaLink } from "@/lib/utils";

export default async function DirektoriArPage() {
  await ensureGoogleSheetsHydrated();
  const ar = listAr();

  return (
    <>
      <PageHeader title="Direktori AR" description="Daftar Account Representative dan cakupan OPD pengampu." />
      <section className="directory-grid">
        {ar.map((item) => (
          <article className="directory-card" key={item.id}>
            <div className="directory-head">
              <span className="user-avatar" style={item.avatar_color ? { background: item.avatar_color } : undefined}>
                {initials(item.nama)}
              </span>
              <div>
                <strong>{item.nama}</strong>
                <div className="muted">{item.jabatan}</div>
              </div>
            </div>
            <div className="metric-row">
              <span>OPD ampuan</span>
              <strong>{formatNumber(item.opd_count)}</strong>
            </div>
            <div className="metric-row">
              <span>Rata-rata kepatuhan</span>
              <strong>{item.avg_kepatuhan ? formatPercent(item.avg_kepatuhan) : "-"}</strong>
            </div>
            <div className="toolbar">
              <a className="btn btn-secondary btn-sm" href={`mailto:${item.email}`}>
                <Mail size={14} />
                Email
              </a>
              <a className="btn btn-secondary btn-sm" href={toWaLink(item.phone)} target="_blank">
                <Phone size={14} />
                WA
              </a>
              <Badge tone={item.status === "aktif" ? "green" : "amber"}>{item.status}</Badge>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
