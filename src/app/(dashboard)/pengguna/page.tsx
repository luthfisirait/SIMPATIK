import { Download, Mail, ShieldCheck, UserPlus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { listUsers } from "@/lib/queries";
import { formatNumber, initials, roleLabel, toWaLink } from "@/lib/utils";

export default function PenggunaPage() {
  const users = listUsers();
  const count = (role: string) => users.filter((item) => item.role === role).length;

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Manajemen role dummy sesuai RBAC SIMPATIK."
        actions={
          <>
            <Link className="btn btn-secondary" href="/api/export/users" target="_blank">
              <Download size={16} />
              Export CSV
            </Link>
            <button className="btn btn-primary" type="button">
              <UserPlus size={16} />
              Tambah User
            </button>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Kepala KPP" value={formatNumber(count("kepala_kpp"))} sub="View dashboard dan analitik" accent="navy" icon={<ShieldCheck size={18} />} />
        <KpiCard label="Kasiwas" value={formatNumber(count("kasiwas"))} sub="Akses penuh" accent="teal" icon={<ShieldCheck size={18} />} />
        <KpiCard label="AR" value={formatNumber(count("ar"))} sub="Tindak lanjut OPD ampuan" accent="green" icon={<ShieldCheck size={18} />} />
        <KpiCard label="Teknisi" value={formatNumber(count("teknisi"))} sub="Data dan pengaturan" accent="gold" icon={<ShieldCheck size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">User List</div>
            <div className="card-subtitle">Dummy credentials memakai password default simpatik123.</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>NIP</th>
                <th>Jabatan</th>
                <th>Role</th>
                <th>Kontak</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="directory-head">
                      <span className="user-avatar" style={item.avatar_color ? { background: item.avatar_color } : undefined}>
                        {initials(item.nama)}
                      </span>
                      <strong>{item.nama}</strong>
                    </div>
                  </td>
                  <td>
                    <a className="wa-link" href={`mailto:${item.email}`}>
                      <Mail size={12} /> {item.email}
                    </a>
                  </td>
                  <td className="td-mono">{item.nip}</td>
                  <td>{item.jabatan}</td>
                  <td>
                    <Badge tone={item.role === "kasiwas" ? "teal" : item.role === "ar" ? "green" : "navy"}>{roleLabel(item.role)}</Badge>
                  </td>
                  <td>
                    <a className="wa-link" href={toWaLink(item.phone)} target="_blank">
                      {item.phone}
                    </a>
                  </td>
                  <td>
                    <Badge tone={item.status === "aktif" ? "green" : "amber"}>{item.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
