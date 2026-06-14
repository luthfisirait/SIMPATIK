import { Mail, Phone, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { listUsers } from "@/lib/queries";
import { formatNumber, initials, roleLabel, toWaLink } from "@/lib/utils";

export default async function PenggunaPage() {
  const users = listUsers();
  const aktif = users.filter((item) => item.status === "aktif").length;
  const ar = users.filter((item) => item.role === "ar").length;
  const admin = users.filter((item) => item.role === "kasiwas" || item.role === "teknisi").length;

  return (
    <>
      <PageHeader title="Manajemen Pengguna" description="Daftar akun, role, dan status pengguna SIMPATIK." />

      <section className="kpi-grid">
        <KpiCard label="Total Pengguna" value={formatNumber(users.length)} sub="Seluruh akun terdaftar" accent="navy" icon={<UsersRound size={18} />} />
        <KpiCard label="Aktif" value={formatNumber(aktif)} sub="Bisa mengakses aplikasi" accent="green" icon={<UsersRound size={18} />} />
        <KpiCard label="Account Representative" value={formatNumber(ar)} sub="Mengampu OPD" accent="teal" icon={<UsersRound size={18} />} />
        <KpiCard label="Admin Data" value={formatNumber(admin)} sub="Kasiwas dan teknisi" accent="gold" icon={<UsersRound size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar Pengguna</div>
            <div className="card-subtitle">Akses halaman ini dibatasi untuk Kasiwas.</div>
          </div>
        </div>
        <div style={{ padding: 0 }}>
          {users.map((item) => (
            <div className="user-row" key={item.id}>
              <span className="user-avatar" style={item.avatar_color ? { background: item.avatar_color } : undefined}>
                {initials(item.nama)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="user-name2">{item.nama}</div>
                <div className="user-meta">
                  {item.jabatan ?? roleLabel(item.role)} {item.nip ? `- NIP ${item.nip}` : ""}
                </div>
              </div>
              <div className="user-actions">
                <Badge tone={item.status === "aktif" ? "green" : item.status === "cuti" ? "amber" : "red"}>{item.status}</Badge>
                <Badge tone="teal">{roleLabel(item.role)}</Badge>
                <a className="btn btn-secondary btn-sm" href={`mailto:${item.email}`}>
                  <Mail size={14} />
                  Email
                </a>
                {item.phone ? (
                  <a className="btn btn-secondary btn-sm" href={toWaLink(item.phone)} target="_blank">
                    <Phone size={14} />
                    WA
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
