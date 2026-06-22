"use client";

import { Edit3, Plus, Save, Trash2, UserRound, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatNumber, initials, roleLabel } from "@/lib/utils";
import type { Role, User } from "@/types";

type PenggunaForm = {
  id?: number;
  nama: string;
  email: string;
  password: string;
  role: Role;
  nip: string;
  jabatan: string;
  phone: string;
  avatar_color: string;
  status: User["status"];
};

const roleOrder: Record<Role, number> = {
  kepala_kpp: 1,
  kasiwas: 2,
  ar: 3,
  teknisi: 4,
};

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "kepala_kpp", label: "Kepala KPP" },
  { value: "kasiwas", label: "Kasiwas" },
  { value: "ar", label: "Account Representative" },
  { value: "teknisi", label: "Teknisi" },
];

const statusOptions: Array<{ value: User["status"]; label: string }> = [
  { value: "aktif", label: "Aktif" },
  { value: "cuti", label: "Cuti" },
  { value: "nonaktif", label: "Nonaktif" },
];

function statusTone(status: string): "green" | "amber" | "red" | "teal" {
  if (status === "aktif") return "green";
  if (status === "cuti") return "amber";
  if (status === "nonaktif") return "red";
  return "teal";
}

function emptyForm(): PenggunaForm {
  return {
    nama: "",
    email: "",
    password: "",
    role: "ar",
    nip: "",
    jabatan: "",
    phone: "",
    avatar_color: "#0A8090",
    status: "aktif",
  };
}

function formFromUser(user: User): PenggunaForm {
  return {
    id: user.id,
    nama: user.nama,
    email: user.email,
    password: "",
    role: user.role,
    nip: user.nip ?? "",
    jabatan: user.jabatan ?? "",
    phone: user.phone ?? "",
    avatar_color: user.avatar_color ?? "#0A8090",
    status: user.status,
  };
}

function sortUsers(rows: User[]) {
  return [...rows].sort((left, right) => roleOrder[left.role] - roleOrder[right.role] || left.nama.localeCompare(right.nama, "id-ID"));
}

function apiMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "Permintaan gagal diproses.";
  const data = payload as { message?: string; errors?: string[] };
  return data.errors?.join(" ") ?? data.message ?? "Permintaan gagal diproses.";
}

export function PenggunaClient({ initialRows }: { initialRows: User[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => sortUsers(initialRows));
  const [form, setForm] = useState<PenggunaForm>(() => emptyForm());
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const stats = useMemo(() => {
    const aktif = rows.filter((item) => item.status === "aktif").length;
    const ar = rows.filter((item) => item.role === "ar").length;
    const cuti = rows.filter((item) => item.status === "cuti").length;
    return { aktif, ar, cuti };
  }, [rows]);

  function openCreate() {
    setForm(emptyForm());
    setError(null);
    setMode("create");
  }

  function openEdit(user: User) {
    setForm(formFromUser(user));
    setError(null);
    setMode("edit");
  }

  function closeModal() {
    if (busy) return;
    setMode(null);
    setError(null);
  }

  function updateForm<K extends keyof PenggunaForm>(key: K, value: PenggunaForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return;

    setBusy(true);
    setError(null);

    const payload = {
      nama: form.nama,
      email: form.email,
      password: form.password || undefined,
      role: form.role,
      nip: form.nip || null,
      jabatan: form.jabatan || null,
      phone: form.phone || null,
      avatar_color: form.avatar_color || null,
      status: form.status,
    };

    try {
      const response = await fetch(mode === "create" ? "/api/users" : `/api/users/${form.id}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as User | { message?: string; errors?: string[] } | null;

      if (!response.ok) {
        setError(apiMessage(data));
        return;
      }

      const saved = data as User;
      setRows((current) =>
        sortUsers(mode === "create" ? [...current, saved] : current.map((item) => (item.id === saved.id ? saved : item))),
      );
      setMode(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccess(user: User) {
    if (!window.confirm(`Hapus akses untuk ${user.nama}? Akun akan dinonaktifkan.`)) return;

    setDeletingId(user.id);
    setError(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as User | { message?: string; errors?: string[] } | null;

      if (!response.ok) {
        setError(apiMessage(data));
        return;
      }

      const updated = data as User;
      setRows((current) => sortUsers(current.map((item) => (item.id === updated.id ? updated : item))));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        actions={
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            <Plus size={16} />
            Tambah
          </button>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Total Pengguna" value={formatNumber(rows.length)} sub="Akun pada database" accent="navy" icon={<UsersRound size={18} />} />
        <KpiCard label="Aktif" value={formatNumber(stats.aktif)} sub="Bisa mengakses aplikasi" accent="green" icon={<UsersRound size={18} />} />
        <KpiCard label="Account Representative" value={formatNumber(stats.ar)} sub="Mengampu OPD" accent="teal" icon={<UsersRound size={18} />} />
        <KpiCard label="Cuti" value={formatNumber(stats.cuti)} sub="Akun tetap terdaftar" accent="gold" icon={<UsersRound size={18} />} />
      </section>

      {error && !mode ? <div className="form-alert danger">{error}</div> : null}

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
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => openEdit(item)}>
                    <Edit3 size={14} />
                    Edit
                  </button>
                  <button className="btn btn-danger btn-sm" type="button" disabled={deletingId === item.id} onClick={() => void deleteAccess(item)}>
                    <Trash2 size={14} />
                    Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {mode ? (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="pengguna-modal-title" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <form onSubmit={(event) => void submitForm(event)}>
              <div className="modal-header">
                <div>
                  <div className="modal-title" id="pengguna-modal-title">
                    {mode === "create" ? "Tambah Pengguna" : "Edit Pengguna"}
                  </div>
                  <div className="card-subtitle">Atur username, password, role, dan status akses.</div>
                </div>
                <button className="icon-btn" type="button" aria-label="Tutup modal" onClick={closeModal}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body">
                {error ? <div className="form-alert danger">{error}</div> : null}
                <div className="form-grid">
                  <label className="field">
                    <span>Nama</span>
                    <input value={form.nama} onChange={(event) => updateForm("nama", event.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Username / Email</span>
                    <input value={form.email} onChange={(event) => updateForm("email", event.target.value)} required />
                  </label>
                  <label className="field">
                    <span>{mode === "create" ? "Password" : "Password Baru"}</span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => updateForm("password", event.target.value)}
                      minLength={8}
                      required={mode === "create"}
                      placeholder={mode === "edit" ? "Kosongkan jika tidak diubah" : undefined}
                    />
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select value={form.role} onChange={(event) => updateForm("role", event.target.value as Role)}>
                      {roleOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select value={form.status} onChange={(event) => updateForm("status", event.target.value as User["status"])}>
                      {statusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>NIP</span>
                    <input value={form.nip} onChange={(event) => updateForm("nip", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Jabatan</span>
                    <input value={form.jabatan} onChange={(event) => updateForm("jabatan", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>No. HP</span>
                    <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Warna Avatar</span>
                    <input type="color" value={form.avatar_color} onChange={(event) => updateForm("avatar_color", event.target.value)} />
                  </label>
                  <div className="detail-item">
                    <div className="directory-head">
                      <span className="user-avatar" style={{ background: form.avatar_color || "var(--teal)" }}>
                        {initials(form.nama) || <UserRound size={16} />}
                      </span>
                      <div>
                        <div className="user-name2">{form.nama || "Pengguna Baru"}</div>
                        <div className="user-meta">{roleLabel(form.role)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" type="button" onClick={closeModal} disabled={busy}>
                  Batal
                </button>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  <Save size={16} />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
