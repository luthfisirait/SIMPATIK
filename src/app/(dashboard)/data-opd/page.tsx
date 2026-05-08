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
import { validateOpdPayload } from "@/lib/validation";
import type { Opd, Role } from "@/types";

async function addOpdAction(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!canCreateOpd(session?.user.role)) throw new Error("Role Anda tidak dapat menambah OPD.");

  const payload = {
    nama: String(formData.get("nama") ?? ""),
    wilayah_id: Number(formData.get("wilayah_id")),
    jenis_instansi: String(formData.get("jenis_instansi") ?? "") || null,
    jumlah_asn: Number(formData.get("jumlah_asn") ?? 0),
    jumlah_pppk: Number(formData.get("jumlah_pppk") ?? 0),
    npwp_opd: String(formData.get("npwp_opd") ?? "") || null,
    status_pemungut_ppn: String(formData.get("status_pemungut_ppn") ?? "TIDAK"),
    nama_bendahara: String(formData.get("nama_bendahara") ?? ""),
    nip_bendahara: String(formData.get("nip_bendahara") ?? "") || null,
    hp_bendahara: String(formData.get("hp_bendahara") ?? ""),
    email_bendahara: String(formData.get("email_bendahara") ?? "") || null,
    nama_bendahara_penerimaan: String(formData.get("nama_bendahara_penerimaan") ?? "") || null,
    hp_bendahara_penerimaan: String(formData.get("hp_bendahara_penerimaan") ?? "") || null,
    nama_pic_kepeg: String(formData.get("nama_pic_kepeg") ?? ""),
    hp_pic_kepeg: String(formData.get("hp_pic_kepeg") ?? ""),
    ar_id: Number(formData.get("ar_id")) || null,
    status: String(formData.get("status") ?? "aktif"),
  };
  const parsed = validateOpdPayload(payload);
  if (!parsed.ok) throw new Error(parsed.errors.join(" "));

  createOpd(parsed.data, { actor: { id: session?.user.id, name: session?.user.name } });

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

  const payload = {
    nama: String(formData.get("nama") ?? ""),
    wilayah_id: Number(formData.get("wilayah_id")),
    jenis_instansi: String(formData.get("jenis_instansi") ?? "") || null,
    jumlah_asn: Number(formData.get("jumlah_asn") ?? 0),
    jumlah_pppk: Number(formData.get("jumlah_pppk") ?? 0),
    npwp_opd: String(formData.get("npwp_opd") ?? "") || null,
    status_pemungut_ppn: String(formData.get("status_pemungut_ppn") ?? "TIDAK"),
    nama_bendahara: String(formData.get("nama_bendahara") ?? ""),
    nip_bendahara: String(formData.get("nip_bendahara") ?? "") || null,
    hp_bendahara: String(formData.get("hp_bendahara") ?? ""),
    email_bendahara: String(formData.get("email_bendahara") ?? "") || null,
    nama_bendahara_penerimaan: String(formData.get("nama_bendahara_penerimaan") ?? "") || null,
    hp_bendahara_penerimaan: String(formData.get("hp_bendahara_penerimaan") ?? "") || null,
    nama_pic_kepeg: String(formData.get("nama_pic_kepeg") ?? ""),
    hp_pic_kepeg: String(formData.get("hp_pic_kepeg") ?? ""),
    ar_id: Number(formData.get("ar_id")) || null,
    status: String(formData.get("status") ?? "aktif"),
  };
  const parsed = validateOpdPayload(payload);
  if (!parsed.ok) throw new Error(parsed.errors.join(" "));

  updateOpd(id, parsed.data, { actor: { id: session?.user.id, name: session?.user.name } });

  revalidatePath("/data-opd");
  redirect("/data-opd");
}

async function deleteOpdAction(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!canDeleteOpd(session?.user.role)) throw new Error("Role Anda tidak dapat menghapus OPD.");

  deleteOpd(Number(formData.get("id")), { actor: { id: session?.user.id, name: session?.user.name } });
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
          <span>Jenis Instansi</span>
          <input name="jenis_instansi" defaultValue={opd?.jenis_instansi ?? ""} placeholder="Dinas / Badan / Sekolah" />
        </label>
        <label className="field">
          <span>Jumlah ASN</span>
          <input name="jumlah_asn" type="number" min="0" defaultValue={opd?.jumlah_asn} required />
        </label>
        <label className="field">
          <span>Jumlah PPPK</span>
          <input name="jumlah_pppk" type="number" min="0" defaultValue={opd?.jumlah_pppk ?? 0} />
        </label>
        <label className="field">
          <span>NPWP OPD</span>
          <input name="npwp_opd" defaultValue={opd?.npwp_opd ?? ""} />
        </label>
        <label className="field">
          <span>Pemungut PPN</span>
          <select name="status_pemungut_ppn" defaultValue={opd?.status_pemungut_ppn ?? "TIDAK"}>
            <option value="YA">YA</option>
            <option value="TIDAK">TIDAK</option>
          </select>
        </label>
        <label className="field">
          <span>Bendahara</span>
          <input name="nama_bendahara" defaultValue={opd?.nama_bendahara} required />
        </label>
        <label className="field">
          <span>NIP Bendahara</span>
          <input name="nip_bendahara" defaultValue={opd?.nip_bendahara ?? ""} />
        </label>
        <label className="field">
          <span>HP Bendahara</span>
          <input name="hp_bendahara" defaultValue={opd?.hp_bendahara} required />
        </label>
        <label className="field">
          <span>Email Bendahara</span>
          <input name="email_bendahara" type="email" defaultValue={opd?.email_bendahara ?? ""} />
        </label>
        <label className="field">
          <span>Bendahara Penerimaan</span>
          <input name="nama_bendahara_penerimaan" defaultValue={opd?.nama_bendahara_penerimaan ?? ""} />
        </label>
        <label className="field">
          <span>HP Penerimaan</span>
          <input name="hp_bendahara_penerimaan" defaultValue={opd?.hp_bendahara_penerimaan ?? ""} />
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
  const arFilter = role === "ar" ? String(userId) : firstParam(searchParams, "ar", "all");
  const page = numericParam(searchParams, "page");
  const detailId = numericParam(searchParams, "detail", 0);
  const editId = numericParam(searchParams, "edit", 0);
  const createMode = firstParam(searchParams, "create") === "1";
  const result = listOpd({ q, wilayah, status, ar: arFilter, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const arOptions = listAr();
  const rawSelectedOpd = detailId || editId ? getOpd(detailId || editId) : undefined;
  const selectedOpd =
    rawSelectedOpd && (role !== "ar" || String(rawSelectedOpd.ar_id ?? "") === String(userId ?? ""))
      ? rawSelectedOpd
      : undefined;
  const baseParams = keepQuery({ q, wilayah, status, page });
  const baseHref = hrefWith("/data-opd", baseParams);
  const exportHref = hrefWith("/api/export/opd", keepQuery({ q, wilayah, status }));
  const canCreate = canCreateOpd(role);

  return (
    <>
      <PageHeader
        title="Data OPD"
        description="Master data sekaligus direktori kontak OPD: NPWP, status pemungut PPN, bendahara, PIC kepegawaian, dan AR pengampu."
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
        <div className="alert">Role AR hanya melihat dan mengelola OPD yang berada di bawah ampuannya.</div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Daftar OPD</div>
            <div className="card-subtitle">Direktori kontak dan pengelolaan master data sesuai hak akses role.</div>
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
                <th>ASN/PPPK</th>
                <th>NPWP</th>
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
                    <td className="td-mono">
                      {formatNumber(item.jumlah_asn)} / {formatNumber(item.jumlah_pppk ?? 0)}
                    </td>
                    <td className="td-mono">{item.npwp_opd ?? "-"}</td>
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
            <DetailItem label="Jenis Instansi" value={selectedOpd.jenis_instansi ?? "-"} />
            <DetailItem label="Jumlah ASN" value={formatNumber(selectedOpd.jumlah_asn)} />
            <DetailItem label="Jumlah PPPK" value={formatNumber(selectedOpd.jumlah_pppk ?? 0)} />
            <DetailItem label="NPWP OPD" value={selectedOpd.npwp_opd ?? "-"} />
            <DetailItem label="Pemungut PPN" value={selectedOpd.status_pemungut_ppn ?? "TIDAK"} />
            <DetailItem label="Bendahara" value={selectedOpd.nama_bendahara} />
            <DetailItem label="NIP Bendahara" value={selectedOpd.nip_bendahara ?? "-"} />
            <DetailItem label="HP Bendahara" value={<a className="wa-link" href={toWaLink(selectedOpd.hp_bendahara)} target="_blank">{selectedOpd.hp_bendahara}</a>} />
            <DetailItem label="Email Bendahara" value={selectedOpd.email_bendahara ? <a className="wa-link" href={`mailto:${selectedOpd.email_bendahara}`}>{selectedOpd.email_bendahara}</a> : "-"} />
            <DetailItem label="Bendahara Penerimaan" value={selectedOpd.nama_bendahara_penerimaan ?? "-"} />
            <DetailItem label="HP Penerimaan" value={selectedOpd.hp_bendahara_penerimaan ? <a className="wa-link" href={toWaLink(selectedOpd.hp_bendahara_penerimaan)} target="_blank">{selectedOpd.hp_bendahara_penerimaan}</a> : "-"} />
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
