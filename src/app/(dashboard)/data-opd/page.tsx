import { Download, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { authOptions } from "@/lib/auth";
import { createOpd, deleteOpd, getOpd, getWilayah, listAr, listOpd, updateOpd } from "@/lib/queries";
import { canCreateOpd, canDeleteOpd, canEditOpd } from "@/lib/rbac";
import { firstParam, keepQuery, numericParam, type PageSearchParams } from "@/lib/search";
import { formatNumber, toWaLink } from "@/lib/utils";
import type { Opd, Role } from "@/types";

async function addOpdAction(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!canCreateOpd(session?.user.role)) throw new Error("Role Anda tidak dapat menambah OPD.");

  createOpd({
    nama: String(formData.get("nama") ?? ""),
    wilayah_id: Number(formData.get("wilayah_id")),
    jumlah_asn: Number(formData.get("jumlah_asn") ?? 0),
    nama_bendahara: String(formData.get("nama_bendahara") ?? ""),
    hp_bendahara: String(formData.get("hp_bendahara") ?? ""),
    nama_pic_kepeg: String(formData.get("nama_pic_kepeg") ?? ""),
    hp_pic_kepeg: String(formData.get("hp_pic_kepeg") ?? ""),
    ar_id: Number(formData.get("ar_id")) || null,
    status: String(formData.get("status") ?? "aktif"),
  });

  revalidatePath("/data-opd");
  redirect("/data-opd");
}

async function updateOpdAction(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  const id = Number(formData.get("id"));
  const current = getOpd(id);
  if (!current) throw new Error("OPD tidak ditemukan.");
  if (!canEditOpd(session?.user.role, current.ar_id, session?.user.id)) {
    throw new Error("Role Anda tidak dapat mengedit OPD ini.");
  }

  updateOpd(id, {
    nama: String(formData.get("nama") ?? ""),
    wilayah_id: Number(formData.get("wilayah_id")),
    jumlah_asn: Number(formData.get("jumlah_asn") ?? 0),
    nama_bendahara: String(formData.get("nama_bendahara") ?? ""),
    hp_bendahara: String(formData.get("hp_bendahara") ?? ""),
    nama_pic_kepeg: String(formData.get("nama_pic_kepeg") ?? ""),
    hp_pic_kepeg: String(formData.get("hp_pic_kepeg") ?? ""),
    ar_id: Number(formData.get("ar_id")) || null,
    status: String(formData.get("status") ?? "aktif"),
  });

  revalidatePath("/data-opd");
  redirect("/data-opd");
}

async function deleteOpdAction(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!canDeleteOpd(session?.user.role)) throw new Error("Role Anda tidak dapat menghapus OPD.");

  deleteOpd(Number(formData.get("id")));
  revalidatePath("/data-opd");
  redirect("/data-opd");
}

const statusTone: Record<string, "green" | "amber" | "red"> = {
  aktif: "green",
  perlu_update: "amber",
  tidak_aktif: "red",
};

const statusLabel: Record<string, string> = {
  aktif: "Aktif",
  perlu_update: "Perlu update",
  tidak_aktif: "Tidak aktif",
};

function hrefWith(base: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

function OpdForm({
  action,
  opd,
  wilayahOptions,
  arOptions,
}: {
  action: (formData: FormData) => Promise<void>;
  opd?: Opd;
  wilayahOptions: ReturnType<typeof getWilayah>;
  arOptions: ReturnType<typeof listAr>;
}) {
  return (
    <form action={action}>
      {opd ? <input type="hidden" name="id" value={opd.id} /> : null}
      <div className="form-grid">
        <label className="field span-2">
          <span>Nama OPD</span>
          <input name="nama" defaultValue={opd?.nama} required />
        </label>
        <label className="field">
          <span>Wilayah</span>
          <select name="wilayah_id" defaultValue={opd?.wilayah_id} required>
            {wilayahOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Jumlah ASN</span>
          <input name="jumlah_asn" type="number" min="0" defaultValue={opd?.jumlah_asn} required />
        </label>
        <label className="field">
          <span>Bendahara</span>
          <input name="nama_bendahara" defaultValue={opd?.nama_bendahara} required />
        </label>
        <label className="field">
          <span>HP Bendahara</span>
          <input name="hp_bendahara" defaultValue={opd?.hp_bendahara} required />
        </label>
        <label className="field">
          <span>PIC Kepegawaian</span>
          <input name="nama_pic_kepeg" defaultValue={opd?.nama_pic_kepeg} required />
        </label>
        <label className="field">
          <span>HP PIC</span>
          <input name="hp_pic_kepeg" defaultValue={opd?.hp_pic_kepeg} required />
        </label>
        <label className="field">
          <span>AR</span>
          <select name="ar_id" defaultValue={opd?.ar_id ?? undefined}>
            {arOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={opd?.status ?? "aktif"}>
            <option value="aktif">Aktif</option>
            <option value="perlu_update">Perlu update</option>
            <option value="tidak_aktif">Tidak aktif</option>
          </select>
        </label>
      </div>
      <div className="modal-footer" style={{ margin: "22px -22px -22px" }}>
        <Link className="btn btn-secondary" href="/data-opd">
          Batal
        </Link>
        <button className="btn btn-primary" type="submit">
          Simpan
        </button>
      </div>
    </form>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}

export default async function DataOpdPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const role = session?.user.role as Role | undefined;
  const userId = session?.user.id;
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const page = numericParam(searchParams, "page");
  const detailId = numericParam(searchParams, "detail", 0);
  const editId = numericParam(searchParams, "edit", 0);
  const createMode = firstParam(searchParams, "create") === "1";
  const result = listOpd({ q, wilayah, status, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const selectedOpd = detailId || editId ? getOpd(detailId || editId) : undefined;
  const baseParams = keepQuery({ q, wilayah, status, page });
  const baseHref = hrefWith("/data-opd", baseParams);
  const exportHref = hrefWith("/api/export/opd", keepQuery({ q, wilayah, status }));
  const canCreate = canCreateOpd(role);

  return (
    <>
      <PageHeader
        title="Data OPD"
        description="Master data OPD, bendahara, PIC kepegawaian, dan AR pengampu."
        actions={
          <>
            <Link className="btn btn-secondary" href={exportHref} target="_blank">
              <Download size={16} />
              Export CSV
            </Link>
            {canCreate ? (
              <Link className="btn btn-primary" href={hrefWith("/data-opd", { ...baseParams, create: 1 })}>
                <Plus size={16} />
                Tambah OPD
              </Link>
            ) : null}
          </>
        }
      />

      {role === "ar" ? (
        <div className="alert">Role AR dapat melihat semua OPD dan mengedit hanya OPD yang berada di bawah ampuannya.</div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar OPD</div>
            <div className="card-subtitle">CRUD lengkap dengan pembatasan role dan export CSV.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="filter-bar">
            <input className="search-input" name="q" placeholder="Cari OPD atau kontak" defaultValue={q} style={{ maxWidth: 260 }} />
            <select className="search-input" name="wilayah" defaultValue={wilayah} style={{ maxWidth: 220 }}>
              <option value="all">Semua wilayah</option>
              {wilayahOptions.map((item) => (
                <option key={item.id} value={item.kode}>
                  {item.nama}
                </option>
              ))}
            </select>
            <select className="search-input" name="status" defaultValue={status} style={{ maxWidth: 180 }}>
              <option value="all">Semua status</option>
              <option value="aktif">Aktif</option>
              <option value="perlu_update">Perlu update</option>
              <option value="tidak_aktif">Tidak aktif</option>
            </select>
            <button className="btn btn-primary" type="submit">
              <Search size={16} />
              Filter
            </button>
          </form>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>OPD</th>
                <th>Wilayah</th>
                <th>ASN</th>
                <th>Bendahara</th>
                <th>PIC Kepeg.</th>
                <th>AR</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => {
                const rowCanEdit = canEditOpd(role, item.ar_id, userId);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nama}</strong>
                    </td>
                    <td>{item.wilayah_nama}</td>
                    <td className="td-mono">{formatNumber(item.jumlah_asn)}</td>
                    <td>
                      <div>{item.nama_bendahara}</div>
                      <a className="wa-link" href={toWaLink(item.hp_bendahara)} target="_blank">
                        {item.hp_bendahara}
                      </a>
                    </td>
                    <td>
                      <div>{item.nama_pic_kepeg}</div>
                      <a className="wa-link" href={toWaLink(item.hp_pic_kepeg)} target="_blank">
                        {item.hp_pic_kepeg}
                      </a>
                    </td>
                    <td>{item.ar_nama}</td>
                    <td>
                      <Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge>
                    </td>
                    <td>
                      <div className="toolbar">
                        <Link className="btn btn-ghost btn-sm" href={hrefWith("/data-opd", { ...baseParams, detail: item.id })} title="Detail OPD">
                          <Eye size={14} />
                        </Link>
                        {rowCanEdit ? (
                          <Link className="btn btn-ghost btn-sm" href={hrefWith("/data-opd", { ...baseParams, edit: item.id })} title="Edit OPD">
                            <Pencil size={14} />
                          </Link>
                        ) : null}
                        {canDeleteOpd(role) ? (
                          <form action={deleteOpdAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <button className="btn btn-ghost btn-sm" type="submit" title="Hapus OPD">
                              <Trash2 size={14} />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <span className="muted">
            Menampilkan {formatNumber(result.data.length)} dari {formatNumber(result.total)} OPD
          </span>
          <Pagination page={result.page} pages={result.pages} basePath="/data-opd" query={keepQuery({ q, wilayah, status })} />
        </div>
      </div>

      {createMode && canCreate ? (
        <Modal title="Tambah OPD" description="Tambahkan master data OPD baru." closeHref={baseHref}>
          <OpdForm action={addOpdAction} wilayahOptions={wilayahOptions} arOptions={arOptions} />
        </Modal>
      ) : null}

      {selectedOpd && detailId ? (
        <Modal title="Detail OPD" description={selectedOpd.nama} closeHref={baseHref}>
          <div className="detail-grid">
            <DetailItem label="Wilayah" value={selectedOpd.wilayah_nama} />
            <DetailItem label="Jumlah ASN" value={formatNumber(selectedOpd.jumlah_asn)} />
            <DetailItem label="Bendahara" value={selectedOpd.nama_bendahara} />
            <DetailItem label="HP Bendahara" value={<a className="wa-link" href={toWaLink(selectedOpd.hp_bendahara)} target="_blank">{selectedOpd.hp_bendahara}</a>} />
            <DetailItem label="PIC Kepegawaian" value={selectedOpd.nama_pic_kepeg} />
            <DetailItem label="HP PIC" value={<a className="wa-link" href={toWaLink(selectedOpd.hp_pic_kepeg)} target="_blank">{selectedOpd.hp_pic_kepeg}</a>} />
            <DetailItem label="AR Pengampu" value={selectedOpd.ar_nama ?? "-"} />
            <DetailItem label="Status" value={<Badge tone={statusTone[selectedOpd.status]}>{statusLabel[selectedOpd.status]}</Badge>} />
          </div>
        </Modal>
      ) : null}

      {selectedOpd && editId && canEditOpd(role, selectedOpd.ar_id, userId) ? (
        <Modal title="Edit OPD" description={selectedOpd.nama} closeHref={baseHref}>
          <OpdForm action={updateOpdAction} opd={selectedOpd} wilayahOptions={wilayahOptions} arOptions={arOptions} />
        </Modal>
      ) : null}
    </>
  );
}
