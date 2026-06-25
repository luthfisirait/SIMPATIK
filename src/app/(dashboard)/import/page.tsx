import { Clock3, Download, FileSpreadsheet, ListChecks } from "lucide-react";

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
    modul: "Reset penuh: hapus semua data import (pegawai, pelaporan, penerimaan, deposit, sosialisasi) lalu buat/perbarui OPD, AR, wilayah",
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
    key: "pelaporan_tahunan_op",
    nama: "Pelaporan SPT Tahunan OP",
    kolom: "NO, NPWP, NAMA WP, MASA PAJAK, JENIS SPT, STATUS PELAPORAN, TGL TERIMA",
    modul: "Modul 1 SPT Tahunan OP + Rincian Pegawai SPT (relasi ke NPWP pegawai)",
  },
  {
    key: "pegawai",
    nama: "Daftar Pegawai Instansi",
    kolom: "Nama, NIP, NPWP/NPWP_PEGAWAI, NPWP_SATKER, NIK, OPD, Email, No HP, PNS/P3K",
    modul: "Direktori Pegawai",
  },
  {
    key: "sosialisasi",
    nama: "Rekam Sosialisasi",
    kolom: "NPWP, Nama OPD, Wilayah Kerja, 2 blok tema, Hari/Tgl, Tempat, Jumlah Peserta",
    modul: "Modul 3 Sosialisasi (baris dilewati bila OPD tidak ada di Masterfile)",
  },
];

const importRules = [
  {
    urutan: "1",
    template: "Masterfile Wajib Pajak",
    aturan: "Wajib diimport paling awal. Masterfile adalah sumber final jumlah dan identitas OPD.",
    kunci: "NPWP16, NAMA_WP, NAMA_AR, NIP_AR",
  },
  {
    urutan: "2",
    template: "Daftar Pegawai Instansi",
    aturan: "Dipakai untuk menghitung ASN & PPPK per OPD dan rincian pegawai SPT.",
    kunci: "NPWP_SATKER = Masterfile.NPWP16",
  },
  {
    urutan: "3",
    template: "Pelaporan SPT Tahunan OP",
    aturan: "Dipakai untuk status sudah lapor pegawai. Baris tanpa NPWP pegawai dilewati.",
    kunci: "SPT Tahunan OP.NPWP = Data Instansi Pegawai.NPWP_PEGAWAI",
  },
  {
    urutan: "4",
    template: "Data Penerimaan",
    aturan: "Dipakai untuk setoran PPh Masa dan saldo deposit KD MAP 411618.",
    kunci: "Data Penerimaan.NPWP = Masterfile.NPWP16",
  },
  {
    urutan: "5",
    template: "Pelaporan SPT Masa PPh 21, Unifikasi, PPN",
    aturan: "Dipakai untuk status lapor PPh Masa dan SPT Masa per periode.",
    kunci: "SPT Masa.NPWP = Masterfile.NPWP16",
  },
  {
    urutan: "6",
    template: "Rekam Sosialisasi",
    aturan: "Dipakai untuk status sudah/belum sosialisasi per OPD. Tidak membuat OPD baru.",
    kunci: "Rekam Sosialisasi.NPWP = Masterfile.NPWP16; nama OPD hanya cadangan bila NPWP kosong",
  },
];

const relationRules = [
  "Masterfile.NPWP16 = SPT Masa PPh21.NPWP",
  "Masterfile.NPWP16 = SPT Masa Unifikasi.NPWP",
  "Masterfile.NPWP16 = SPT Masa PPN.NPWP",
  "Masterfile.NPWP16 = Data Penerimaan.NPWP",
  "Data Instansi Pegawai.NPWP_SATKER = Masterfile.NPWP16",
  "SPT Tahunan OP.NPWP = Data Instansi Pegawai.NPWP_PEGAWAI",
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
            <div className="card-title">Aturan import</div>
            <div className="card-subtitle">Urutan dan kunci relasi yang dipakai saat commit file Excel.</div>
          </div>
          <ListChecks size={18} />
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Urutan</th>
                  <th>Template</th>
                  <th>Aturan</th>
                  <th>Kunci relasi</th>
                </tr>
              </thead>
              <tbody>
                {importRules.map((item) => (
                  <tr key={item.urutan}>
                    <td className="td-mono">{item.urutan}</td>
                    <td>{item.template}</td>
                    <td>{item.aturan}</td>
                    <td className="muted">{item.kunci}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            {relationRules.map((item) => (
              <Badge key={item} tone="navy">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Template yang didukung</div>
            <div className="card-subtitle">Pencocokan ke OPD memakai NPWP sebagai kunci utama; nama OPD hanya cadangan bila NPWP kosong.</div>
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
