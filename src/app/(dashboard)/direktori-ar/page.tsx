import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAr } from "@/lib/queries";
import { formatNumber, formatPercent, initials } from "@/lib/utils";

function statusTone(status: string): "green" | "amber" | "red" | "teal" {
  if (status === "aktif") return "green";
  if (status === "cuti") return "amber";
  if (status === "nonaktif") return "red";
  return "teal";
}

export default function DirektoriArPage() {
  const rows = listAr();

  return (
    <>
      <PageHeader
        title="Data Account Representative (AR)"
        description="Direktori AR beserta OPD pengampu, wilayah, dan kontak."
        actions={
          <button className="btn btn-primary" type="button">
            <Plus size={16} />
            Tambah AR
          </button>
        }
      />

      <div className="card">
        <div style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div className="user-row">
              <div className="muted">Belum ada akun AR.</div>
            </div>
          ) : (
            rows.map((item) => (
              <div className="user-row" key={item.id}>
                <span className="user-avatar" style={{ background: item.avatar_color ?? "var(--teal)" }}>
                  {initials(item.nama)}
                </span>
                <div>
                  <div className="user-name2">{item.nama}</div>
                  <div className="user-meta">
                    NIP: {item.nip ?? "-"} - {item.jabatan ?? "Account Representative"}
                  </div>
                </div>
                <div className="user-actions">
                  <Badge tone="teal">{formatNumber(item.opd_count)} OPD</Badge>
                  <Badge tone="navy">{item.avg_kepatuhan === null ? "-" : formatPercent(item.avg_kepatuhan)}</Badge>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  <button className="btn btn-ghost btn-sm" type="button">
                    Detail
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
