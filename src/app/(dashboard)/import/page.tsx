import { Download, FileSpreadsheet } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";

import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

const templateInfo = [
  {
    key: "masterfile",
    nama: "Masterfile Wajib Pajak",
    kolom: "NPWP16, NAMA_WP, SEKSI, NIP_AR, NAMA_AR, KOTA, TANGGAL_DAFTAR",
    modul: "Direktori OPD & Bendahara (buat/perbarui OPD, AR, wilayah)",
  },
  {
    key: "penerimaan",
    nama: "Data Penerimaan (Setoran)",
    kolom: "NPWP, MASA PAJAK, KD MAP, NILAI SETOR",
    modul: "Modul 5 Deposit + Modul 2 PPh 21 (agregasi per masa pajak)",
  },
  {
    key: "pelaporan",
    nama: "Pelaporan SPT Masa (PPh 21 / PPN / Unifikasi)",
    kolom: "NPWP, MASA PAJAK, JENIS SPT, STATUS PELAPORAN",
    modul: "Modul 4 SPT Masa (status PPN & Unifikasi)",
  },
  {
    key: "pegawai",
    nama: "Daftar Pegawai Instansi",
    kolom: "Nama, NIP, NPWP, NIK, OPD, Email, No HP, PNS/P3K",
    modul: "Direktori Pegawai",
  },
  {
    key: "sosialisasi",
    nama: "Rencana/Realisasi Sosialisasi",
    kolom: "NPWP, Nama OPD, Wilayah Kerja, Tema, Tanggal, Tempat, Jumlah Peserta",
    modul: "Modul 3 Sosialisasi",
  },
];

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import Data Excel"
        description="Unggah template resmi (Masterfile, Penerimaan, Pelaporan SPT, Pegawai, Sosialisasi). Sistem mendeteksi jenis template otomatis, menampilkan pratinjau, lalu menyimpan ke modul terkait."
      />

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
                  <th>Contoh</th>
                </tr>
              </thead>
              <tbody>
                {templateInfo.map((item) => (
                  <tr key={item.nama}>
                    <td>{item.nama}</td>
                    <td className="muted">{item.kolom}</td>
                    <td>{item.modul}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
