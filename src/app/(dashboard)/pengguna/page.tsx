import { Plus, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { listUsers } from "@/lib/queries";
import { formatNumber, initials, roleLabel } from "@/lib/utils";

function statusTone(status: string): "green" | "amber" | "red" | "teal" {
  if (status === "aktif") return "green";
  if (status === "cuti") return "amber";
  if (status === "nonaktif") return "red";
  return "teal";
}

export default function PenggunaPage() {
  const rows = listUsers();
  const aktif = rows.filter((item) => item.status === "aktif").length;
  const ar = rows.filter((item) => item.role === "ar").length;
  const cuti = rows.filter((item) => item.status === "cuti").length;

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        actions={
          <button className="btn btn-primary" type="button">
            <Plus size={16} />
            Tambah
          </button>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Total Pengguna" value={formatNumber(rows.length)} sub="Akun pada database" accent="navy" icon={<UsersRound size={18} />} />
        <KpiCard label="Aktif" value={formatNumber(aktif)} sub="Bisa mengakses aplikasi" accent="green" icon={<UsersRound size={18} />} />
        <KpiCard label="Account Representative" value={formatNumber(ar)} sub="Mengampu OPD" accent="teal" icon={<UsersRound size={18} />} />
        <KpiCard label="Cuti" value={formatNumber(cuti)} sub="Akun tetap terdaftar" accent="gold" icon={<UsersRound size={18} />} />
      </section>

      <div className="card">
        <div style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div className="user-row">
              <div className="muted">Belum ada pengguna.</div>
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
                    {roleLabel(item.role)} - {item.email}
                  </div>
                </div>
                <div className="user-actions">
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  <button className="btn btn-ghost btn-sm" type="button">
                    Edit
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
