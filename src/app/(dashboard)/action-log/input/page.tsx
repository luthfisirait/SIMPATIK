import { ClipboardList, History, Send } from "lucide-react";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { authOptions } from "@/lib/auth";
import { createActionLog, getActionLog, getOpd, listOpdOptions } from "@/lib/queries";
import { firstParam, type PageSearchParams } from "@/lib/search";
import { formatNumber } from "@/lib/utils";
import type { Role } from "@/types";

const actionOptions = ["Koordinasi", "Deteksi", "Sosialisasi", "Exec Summary", "Imbauan", "Kunjungan"];

const resultOptions = [
  "Berhasil Dihubungi",
  "Belum Ada Respons",
  "Data Perlu Diperbarui",
  "Perlu Eskalasi",
  "Selesai",
  "Perlu Pemantauan",
];

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function submitActionLog(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Autentikasi diperlukan.");

  const opdId = Number(formData.get("opd_id"));
  if (!Number.isFinite(opdId) || opdId <= 0) throw new Error("OPD wajib dipilih.");

  const opd = getOpd(opdId);
  if (!opd) throw new Error("OPD tidak ditemukan.");

  if (session.user.role === "ar" && String(opd.ar_id ?? "") !== String(session.user.id)) {
    throw new Error("AR hanya dapat mengisi action log untuk OPD ampuannya.");
  }

  const action = cleanText(formData.get("jenis_tindakan"));
  if (!action) throw new Error("Jenis tindakan wajib diisi.");

  createActionLog({
    user_id: Number(session.user.id),
    opd_id: opd.id,
    action,
    target_type: "opd",
    target_name: opd.nama,
    description: cleanText(formData.get("deskripsi")),
    result: cleanText(formData.get("hasil")),
    follow_up: cleanText(formData.get("follow_up")),
    next_follow_up_at: cleanText(formData.get("next_follow_up_at")),
  });

  revalidatePath("/action-log/input");
  revalidatePath("/dashboard");
  redirect("/action-log/input?success=1");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ActionLogInputPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const role = session?.user.role as Role | undefined;
  const userId = session?.user.id;
  const isAr = role === "ar";
  const success = firstParam(searchParams, "success") === "1";
  const opdOptions = listOpdOptions({ ar: isAr ? userId : undefined });
  const recentLogs = getActionLog(8, isAr ? { userId } : {});

  return (
    <>
      <PageHeader
        title="Input Action Log AR"
        description="Form tindak lanjut OPD dengan struktur respons Microsoft Forms."
      />

      {success ? <div className="alert">Action log berhasil disimpan ke database SQLite.</div> : null}

      <section className="kpi-grid">
        <KpiCard
          label="OPD Tersedia"
          value={formatNumber(opdOptions.length)}
          sub={isAr ? "Sesuai ampuan AR" : "Seluruh OPD aktif"}
          accent="navy"
          icon={<ClipboardList size={18} />}
        />
        <KpiCard
          label="Log Terakhir"
          value={formatNumber(recentLogs.length)}
          sub="Ditampilkan di halaman ini"
          accent="teal"
          icon={<History size={18} />}
        />
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Form Tindak Lanjut</div>
              <div className="card-subtitle">Isian tersimpan pada tabel ACTION_LOG.</div>
            </div>
          </div>
          <div className="card-body">
            <form action={submitActionLog}>
              <div className="form-grid">
                <label className="field">
                  <span>Nama AR Anda</span>
                  <input value={session?.user.name ?? ""} readOnly />
                </label>
                <label className="field">
                  <span>OPD yang Ditindaklanjuti</span>
                  <select name="opd_id" required defaultValue="">
                    <option value="" disabled>
                      Pilih OPD
                    </option>
                    {opdOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nama} - {item.wilayah_nama}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Jenis Tindakan yang Dilakukan</span>
                  <select name="jenis_tindakan" required defaultValue="">
                    <option value="" disabled>
                      Pilih jenis tindakan
                    </option>
                    {actionOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Hasil Tindakan</span>
                  <select name="hasil" defaultValue="">
                    <option value="">Belum ditentukan</option>
                    {resultOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field span-2">
                  <span>Deskripsi Singkat Tindakan</span>
                  <textarea name="deskripsi" rows={4} placeholder="Catatan koordinasi, deteksi, sosialisasi, atau executive summary" />
                </label>
                <label className="field span-2">
                  <span>Tindak Lanjut yang Direncanakan</span>
                  <textarea name="follow_up" rows={3} placeholder="Rencana follow up berikutnya" />
                </label>
                <label className="field">
                  <span>Tanggal Rencana Tindak Lanjut Berikutnya</span>
                  <input name="next_follow_up_at" type="date" />
                </label>
              </div>
              <div className="modal-footer" style={{ margin: "22px -22px -22px" }}>
                <button className="btn btn-primary" type="submit">
                  <Send size={16} />
                  Simpan Action Log
                </button>
              </div>
            </form>
          </div>
        </div>

        <aside className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Riwayat Terbaru</div>
              <div className="card-subtitle">Log tindak lanjut yang baru tersimpan</div>
            </div>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {recentLogs.map((item) => (
                <div className="activity-item" key={item.id}>
                  <strong>{item.target_name}</strong>
                  <span className="muted">{item.action}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {item.result ? <Badge tone="teal">{item.result}</Badge> : null}
                    {item.follow_up ? <Badge tone="amber">Ada tindak lanjut</Badge> : null}
                  </div>
                  <span className="muted">{formatDateTime(item.created_at)}</span>
                </div>
              ))}
              {recentLogs.length === 0 ? <div className="muted">Belum ada action log.</div> : null}
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
