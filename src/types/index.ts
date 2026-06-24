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
  jenis_instansi: string | null;
  jumlah_asn: number;
  jumlah_pppk: number;
  total_wajib_lapor?: number;
  npwp_opd: string | null;
  status_pemungut_ppn: "YA" | "TIDAK" | string;
  nama_bendahara: string;
  nip_bendahara: string | null;
  hp_bendahara: string;
  email_bendahara: string | null;
  nama_bendahara_penerimaan: string | null;
  hp_bendahara_penerimaan: string | null;
  nama_pic_kepeg: string;
  hp_pic_kepeg: string;
  ar_id: number | null;
  ar_nama: string | null;
  status: "aktif" | "tidak_aktif" | "perlu_update";
  tanggal_input: string | null;
  tanggal_update_kontak: string | null;
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
  ar_nama: string | null;
  nama_bendahara: string;
  bulan: string;
  jumlah_dipotong: number;
  nominal_setor: number;
  estimasi_wajar: number;
  ketepatan: "tepat_waktu" | "terlambat" | "belum_setor";
  status: "normal" | "under_reporting" | "kritis";
  status_lapor: string | null;
};

export type PphMasaJenisSummary = {
  jenis: string;
  keterangan: string;
  wajib_lapor: number;
  sudah_lapor: number;
  belum_lapor: number;
};

export type PphMasaLaporStatus = "sudah_lapor" | "belum_lapor";

export type PphMasaLaporDetailRow = {
  id: string;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  nama_bendahara: string;
  jenis: string;
  status_lapor: string | null;
  status: PphMasaLaporStatus;
};

export type PphMasaPaymentRecord = {
  id: string;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  nama_bendahara: string;
  bulan: string;
  jenis_pph: string;
  jumlah_pembayaran: number;
};

export type SptMasaRecord = {
  id: number;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  masa_pajak: string;
  pph21_status: string | null;
  pph22_nominal: number;
  pph22_status: string | null;
  pph23_nominal: number;
  pph23_status: string | null;
  ppn_put_nominal: number;
  ppn_put_status: string | null;
  status_opd_pemungut: string | null;
  status_keseluruhan: TrafficLight | string | null;
  catatan_ar: string | null;
};

export type DepositRecord = {
  id: number;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  masa_pajak: string;
  deposit_pph21: number;
  status_pph21: string | null;
  deposit_pph_unifikasi: number;
  status_unifikasi: string | null;
  deposit_ppn_put: number;
  status_ppn_put: string | null;
  deposit_kd_411618: number;
  total_deposit: number;
  status_deposit_overall: TrafficLight | string | null;
};

export type ScoringRecord = {
  id: number;
  opd_id: number;
  opd_nama: string;
  wilayah_nama: string;
  ar_nama: string | null;
  bulan_scoring: string;
  skor_spt_op: number;
  skor_pph21: number;
  skor_spt_masa: number;
  skor_deposit: number;
  skor_total: number;
  kategori: TrafficLight;
  status_rp: "reward" | "monitor" | "punishment";
  catatan: string | null;
};

export type BendaharaRecord = Opd & {
  status_pph21_terakhir: string | null;
  skor_terakhir: number | null;
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
  tempat: string | null;
  tema: string | null;
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
  npwp: string | null;
  nik: string | null;
  email: string | null;
  jenis_kepegawaian: string | null;
};

export type ActionLog = {
  id: number;
  user_id: number | null;
  user_nama: string | null;
  opd_id: number | null;
  action: string;
  target_type: string;
  target_name: string;
  description: string | null;
  result: string | null;
  follow_up: string | null;
  next_follow_up_at: string | null;
  attachment_url: string | null;
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

// ---------------------------------------------------------------------------
// Import data (template Excel resmi -> modul SIMPATIK)
// ---------------------------------------------------------------------------

export type ImportTemplateKey =
  | "masterfile"
  | "penerimaan"
  | "pelaporan_pph21"
  | "pelaporan_unifikasi"
  | "pelaporan_tahunan_op"
  | "pegawai"
  | "sosialisasi";

export type ImportOpdRow = {
  npwp: string | null;
  nama: string;
  wilayah: string | null;
  jenis_instansi: string | null;
  ar_nama: string | null;
  ar_nip: string | null;
  status_pemungut_ppn: "YA" | "TIDAK" | null;
  nama_bendahara: string | null;
  nip_bendahara: string | null;
  hp_bendahara: string | null;
  email_bendahara: string | null;
  nama_bendahara_penerimaan: string | null;
  hp_bendahara_penerimaan: string | null;
  nama_pic_kepeg: string | null;
  hp_pic_kepeg: string | null;
  status: "aktif" | "tidak_aktif" | "perlu_update" | null;
  tanggal_input: string | null;
  tanggal_update_kontak: string | null;
};

export type ImportPph21Row = {
  npwp: string | null;
  nama_opd: string | null;
  bulan: string; // YYYY-MM
  jumlah_dipotong: number;
  nominal_setor: number;
  estimasi_wajar: number;
  ketepatan: "tepat_waktu" | "terlambat" | "belum_setor";
  status: "normal" | "under_reporting" | "kritis";
};

export type ImportDepositRow = {
  npwp: string | null;
  nama_opd: string | null;
  masa_pajak: string; // YYYY-MM
  kd_map: string;
  kd_setor: string | null;
  nilai_setor: number;
  tgl_setor: string | null;
  ntpn: string | null;
  sumber_data: string | null;
};

export type ImportSptMasaRow = {
  npwp: string | null;
  nama_opd: string | null;
  masa_pajak: string; // YYYY-MM
  pph22_nominal: number;
  pph22_status: string | null; // dari SPT Unifikasi
  pph23_nominal: number;
  pph23_status: string | null; // dari SPT Unifikasi
  ppn_put_nominal: number;
  ppn_put_status: string | null; // dari SPT PPN
  pph21_status: string | null; // dari SPT PPh 21
};

export type ImportSptTahunanOpRow = {
  npwp_pegawai: string | null;
  nama_pegawai: string | null;
  masa_pajak: string; // YYYY-MM
  jenis_spt: string;
  nomor_tanda_terima: string | null;
  tanggal_terima: string | null;
  status_pelaporan: string | null;
  pembetulan: string | null;
  kanal_pelaporan: string | null;
  kpp_administrasi: string | null;
};

export type ImportPegawaiRow = {
  npwp: string | null;
  npwp_satker: string | null;
  nik: string | null;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  email: string | null;
  phone: string | null;
  jenis_kepegawaian: string | null;
  opd_nama: string | null;
  status_coretax?: "aktif_belum_lapor" | "belum_aktivasi" | "sudah_lapor";
};

export type ImportSosialisasiRow = {
  npwp: string | null;
  nama_opd: string | null;
  wilayah: string | null;
  tanggal: string | null; // YYYY-MM-DD
  tempat: string | null;
  tema: string | null;
  jumlah_peserta: number;
  penyuluh_nama: string | null;
  penyuluh_nip: string | null;
  status: "sudah" | "belum" | "perlu_ulang" | null;
};

export type ImportPayload = {
  opd: ImportOpdRow[];
  pph21: ImportPph21Row[];
  deposit: ImportDepositRow[];
  sptMasa: ImportSptMasaRow[];
  sptTahunanOp: ImportSptTahunanOpRow[];
  pegawai: ImportPegawaiRow[];
  sosialisasi: ImportSosialisasiRow[];
};

export type ImportDatasetSummary = {
  key: keyof ImportPayload;
  label: string;
  modul: string;
  rows: number;
};

export type ImportAnalysis = {
  detected: ImportTemplateKey[];
  datasets: ImportDatasetSummary[];
  warnings: string[];
  totalRows: number;
};

export type ImportSkipReason = {
  reason: string;
  count: number;
};

export type ImportCommitResult = {
  deleted: number;
  opd_created: number;
  opd_updated: number;
  pph21: number;
  deposit: number;
  spt_masa: number;
  spt_tahunan_op: number;
  pegawai: number;
  sosialisasi: number;
  derived_spt: number;
  derived_deposit_status: number;
  derived_spt_masa_status: number;
  derived_scoring: number;
  skipped: number;
  skipped_reasons: ImportSkipReason[];
};
