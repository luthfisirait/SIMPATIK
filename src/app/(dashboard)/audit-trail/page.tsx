import { ClipboardList, Download } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAuditLogs } from "@/lib/queries";

function actionTone(action: string): "green" | "amber" | "red" | "teal" {
  if (action === "create" || action === "import") return "green";
  if (action === "update") return "amber";
  if (action === "delete") return "red";
  return "teal";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function changedKeys(beforeJson: string | null, afterJson: string | null) {
  if (!beforeJson || !afterJson) return "-";
  try {
    const before = JSON.parse(beforeJson) as Record<string, unknown>;
    const after = JSON.parse(afterJson) as Record<string, unknown>;
    return Object.keys(after)
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .slice(0, 8)
      .join(", ") || "-";
  } catch {
    return "-";
  }
}

export default function AuditTrailPage() {
  const logs = listAuditLogs(120);
  const opdCount = logs.filter((item) => item.entity_type === "opd").length;
  const userCount = logs.filter((item) => item.entity_type === "user").length;

  return (
    <>
      <PageHeader
        title="Audit Trail"
        description="Riwayat create, update, delete, dan import untuk master OPD serta user."
        actions={
          <Link className="btn btn-secondary" href="/api/audit" target="_blank">
            <Download size={16} />
            JSON
          </Link>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Log OPD" value={opdCount.toLocaleString("id-ID")} sub="Perubahan master data" accent="teal" icon={<ClipboardList size={18} />} />
        <KpiCard label="Log User" value={userCount.toLocaleString("id-ID")} sub="Perubahan akses pengguna" accent="navy" icon={<ClipboardList size={18} />} />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Riwayat Perubahan</div>
            <div className="card-subtitle">Data terbaru berada di baris paling atas.</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktor</th>
                <th>Aksi</th>
                <th>Entitas</th>
                <th>Nama</th>
                <th>Field berubah</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((item) => (
                <tr key={item.id}>
                  <td className="td-mono">{formatDate(item.created_at)}</td>
                  <td>{item.actor_name ?? "Sistem"}</td>
                  <td>
                    <Badge tone={actionTone(item.action)}>{item.action}</Badge>
                  </td>
                  <td>{item.entity_type.toUpperCase()}</td>
                  <td>
                    <strong>{item.entity_name}</strong>
                  </td>
                  <td>{changedKeys(item.before_json, item.after_json)}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Belum ada audit trail.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
