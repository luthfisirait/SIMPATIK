import { Bell, CheckCheck } from "lucide-react";
import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getNotifications, markNotificationRead, markNotificationsRead } from "@/lib/queries";

async function markOneAction(formData: FormData) {
  "use server";
  markNotificationRead(Number(formData.get("id")));
  revalidatePath("/notifikasi");
  revalidatePath("/dashboard");
}

async function markAllAction() {
  "use server";
  markNotificationsRead();
  revalidatePath("/notifikasi");
  revalidatePath("/dashboard");
}

function toneForType(type: string): "green" | "amber" | "red" | "teal" {
  if (type === "success") return "green";
  if (type === "warning") return "amber";
  if (type === "danger") return "red";
  return "teal";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NotifikasiPage() {
  const notifications = getNotifications(80);
  const unread = notifications.filter((item) => item.is_read === 0).length;

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description="Daftar peringatan sistem dan tindak lanjut yang bisa ditandai selesai per item."
        actions={
          <form action={markAllAction}>
            <button className="btn btn-secondary" type="submit" disabled={unread === 0}>
              <CheckCheck size={16} />
              Tandai semua dibaca
            </button>
          </form>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Belum Dibaca" value={unread.toLocaleString("id-ID")} sub="Perlu ditinjau" accent="red" icon={<Bell size={18} />} />
        <KpiCard
          label="Total Notifikasi"
          value={notifications.length.toLocaleString("id-ID")}
          sub="Riwayat terbaru"
          accent="teal"
          icon={<Bell size={18} />}
        />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Inbox Notifikasi</div>
            <div className="card-subtitle">Notifikasi yang belum dibaca ditampilkan paling atas.</div>
          </div>
        </div>
        <div className="card-body">
          <div className="activity-list">
            {notifications.map((item) => (
              <div className="activity-item notification-item" key={item.id}>
                <div className="notification-copy">
                  <div className="toolbar">
                    <Badge tone={toneForType(item.type)}>{item.type}</Badge>
                    {item.is_read ? <Badge tone="green">dibaca</Badge> : <Badge tone="amber">baru</Badge>}
                  </div>
                  <strong>{item.title}</strong>
                  <span className="muted">{item.body}</span>
                  <span className="muted">{formatDate(item.created_at)}</span>
                </div>
                {item.is_read ? null : (
                  <form action={markOneAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="btn btn-secondary btn-sm" type="submit">
                      Tandai dibaca
                    </button>
                  </form>
                )}
              </div>
            ))}
            {notifications.length === 0 ? <div className="muted">Belum ada notifikasi.</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}
