import { Clock3, Download, FileSpreadsheet } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getImportStatus } from "@/lib/queries";
import type { ImportTemplateKey } from "@/types";

import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

const templateInfo: Array<{ key: ImportTemplateKey; nama: string; kolom: string; modul: string }> = [
  {
    key: "masterfile",
    nama: "Masterfile Wajib Pajak",
    kolom: "NPWP16, NAMA_WP, SEKSI, NIP_AR, NAMA_AR, KOTA, TANGGAL_DAFTAR",
    modul: "Direktori OPD & Bendahara (buat/perbarui OPD, AR, wilayah)",
  },
  {
    key: "penerimaan",
    nama: "Data Penerimaan",
    kolom: "NO, NPWP, NAMA WAJIB PAJAK, MASA PAJAK, KD MAP (411121, 411122, 411124, 411211, 411618, 411128), NILAI SETOR",
    modul: "Modul 5 Deposit + Modul 2 PPh 21 (agregasi per masa pajak)",
  },
  {
    key: "pelaporan_pph21",
    nama: "Pelaporan SPT Masa PPh Pasal 21",
    kolom: "NO, NPWP, NAMA WP, MASA PAJAK, JENIS SPT, STATUS PELAPORAN",
    modul: "Modul 4 SPT Masa (status PPh 21)",
  },
  {
    key: "pelaporan_unifikasi",
    nama: "Pelaporan SPT Masa Unifikasi/PPN",
    kolom: "NO, NPWP, NAMA WP, MASA PAJAK, JENIS SPT, STATUS PELAPORAN",
    modul: "Modul 4 SPT Masa (status PPh 22/23 dan PPN)",
  },
  {
    key: "pegawai",
    nama: "Daftar Pegawai Instansi",
    kolom: "Nama, NIP, NPWP, NIK, OPD, Email, No HP, PNS/P3K",
    modul: "Direktori Pegawai",
  },
  {
    key: "sosialisasi",
    nama: "Rekam Sosialisasi",
    kolom: "NPWP, Nama OPD, Wilayah Kerja, 2 blok tema, Hari/Tgl, Tempat, Jumlah Peserta",
    modul: "Modul 3 Sosialisasi (buat OPD minimal bila belum ada)",
  },
];

function formatImportDate(value: string | null) {
  if (!value) return "Tidak ada data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tidak ada data";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export default function ImportPage() {
  const importStatus = getImportStatus();
  const templateStatus = new Map(importStatus.templates.map((item) => [item.key, item]));

  return (
    <>
      <PageHeader
        title="Import Data Excel"
        description="Unggah template resmi final sesuai kebutuhan. Setelah commit, sistem membentuk data turunan untuk dashboard, SPT, deposit, dan scoring."
      />

      <section className="kpi-grid">
        <KpiCard
          label="Import Terakhir"
          value={formatImportDate(importStatus.lastAt)}
          sub={importStatus.lastTemplate ? `Template: ${templateStatus.get(importStatus.lastTemplate)?.label ?? importStatus.lastTemplate}` : "Belum ada import"}
          accent={importStatus.lastAt ? "green" : "gold"}
          icon={<Clock3 size={18} />}
        />
      </section>

      <ImportClient />

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Template yang didukung</div>
            <div className="card-subtitle">Pencocokan ke OPD memakai NPWP (utama) atau nama OPD (cadangan).</div>
          </div>
          <FileSpreadsheet size={18} />
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Kolom kunci</th>
                  <th>Modul tujuan</th>
                  <th>Import terakhir</th>
                  <th>Contoh</th>
                </tr>
              </thead>
              <tbody>
                {templateInfo.map((item) => {
                  const status = templateStatus.get(item.key);
                  const hasImport = Boolean(status?.lastAt);
                  return (
                    <tr key={item.nama}>
                      <td>{item.nama}</td>
                      <td className="muted">{item.kolom}</td>
                      <td>{item.modul}</td>
                      <td>
                        <Badge tone={hasImport ? "green" : "amber"}>{formatImportDate(status?.lastAt ?? null)}</Badge>
                      </td>
                      <td>
                        <a
                          className="btn btn-ghost btn-sm"
                          href={`/api/import?template=${item.key}`}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <Download size={14} />
                          Unduh
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
