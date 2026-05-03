export type Role = "kepala_kpp" | "kasiwas" | "ar" | "teknisi";

export type TrafficLight = "hijau" | "kuning" | "merah";

export type Wilayah = {
  id: number;
  nama: string;
  kode: string;
};

export type User = {
  id: number;
  nama: string;
  email: string;
  nip: string | null;
  jabatan: string | null;
  role: Role;
  phone: string | null;
  avatar_color: string | null;
  status: "aktif" | "cuti" | "nonaktif";
};

export type Opd = {
  id: number;
  nama: string;
  wilayah_id: number;
  wilayah_nama: string;
  wilayah_kode: string;
  jumlah_asn: number;
  nama_bendahara: string;
  hp_bendahara: string;
  nama_pic_kepeg: string;
  hp_pic_kepeg: string;
  ar_id: number | null;
  ar_nama: string | null;
  status: "aktif" | "tidak_aktif" | "perlu_update";
};

export type SptRecord = {
  id: number;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  tahun_pajak: number;
  periode: string;
  jumlah_wajib_lapor: number;
  jumlah_sudah_lapor: number;
  persen_kepatuhan: number;
  traffic_light: TrafficLight;
};

export type Pph21Record = {
  id: number;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  bulan: string;
  jumlah_dipotong: number;
  nominal_setor: number;
  estimasi_wajar: number;
  ketepatan: "tepat_waktu" | "terlambat" | "belum_setor";
  status: "normal" | "under_reporting" | "kritis";
};

export type SosialisasiRecord = {
  id: number;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  tanggal: string;
  jumlah_peserta: number;
  penyuluh_id: number | null;
  penyuluh_nama: string | null;
  status: "sudah" | "belum" | "perlu_ulang";
};

export type PegawaiRecord = {
  id: number;
  nama: string;
  nip: string;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  jabatan: string;
  status_coretax: "aktif_belum_lapor" | "belum_aktivasi" | "sudah_lapor";
  ar_nama: string | null;
  phone: string | null;
};

export type ActionLog = {
  id: number;
  user_id: number | null;
  user_nama: string | null;
  action: string;
  target_type: string;
  target_name: string;
  created_at: string;
};

export type Notification = {
  id: number;
  title: string;
  body: string;
  type: "info" | "warning" | "success" | "danger";
  is_read: number;
  created_at: string;
};
