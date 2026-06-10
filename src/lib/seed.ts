import bcrypt from "bcryptjs";
import type Database from "better-sqlite3";

import { getDb } from "@/lib/db";
import { trafficFromPercent } from "@/lib/utils";

type SeedResult = {
  seeded: boolean;
  wilayah: number;
  users: number;
  opd: number;
  pegawai: number;
};

const PASSWORD = "simpatik123";

const wilayahSeed = [
  { nama: "Kota Padang", kode: "kota_padang", quota: 80, suffix: "Kota Padang" },
  { nama: "Prov. Sumbar", kode: "prov_sumbar", quota: 56, suffix: "Provinsi Sumatera Barat" },
  { nama: "Kota Pariaman", kode: "kota_pariaman", quota: 22, suffix: "Kota Pariaman" },
  { nama: "Kab. Padang Pariaman", kode: "kab_padang_pariaman", quota: 27, suffix: "Kabupaten Padang Pariaman" },
];

const userSeed = [
  {
    nama: "Elsa Trisni",
    email: "kasiwas@simpatik.local",
    role: "kasiwas",
    jabatan: "Kepala Seksi Pengawasan VI",
    color: "#0A8090",
  },
  {
    nama: "Rudi Hartono",
    email: "kepala@simpatik.local",
    role: "kepala_kpp",
    jabatan: "Kepala KPP Pratama Padang Satu",
    color: "#0D2B55",
  },
  {
    nama: "Fauzan Malik",
    email: "teknisi1@simpatik.local",
    role: "teknisi",
    jabatan: "Pelaksana Seksi PKD",
    color: "#1A3D6E",
  },
  {
    nama: "Nita Rahmayani",
    email: "teknisi2@simpatik.local",
    role: "teknisi",
    jabatan: "Operator Data",
    color: "#274E84",
  },
  ...[
    "Aditya Pratama",
    "Maya Safitri",
    "Rangga Saputra",
    "Nanda Putri",
    "Hendra Wijaya",
    "Nita Anggraini",
    "Dewi Lestari",
    "Bagus Firmansyah",
  ].map((nama, idx) => ({
    nama,
    email: `ar${idx + 1}@simpatik.local`,
    role: "ar",
    jabatan: "Account Representative",
    color: ["#0A8090", "#16A663", "#F5A623", "#D64550"][idx % 4],
  })),
] as const;

const unitNames = [
  "Sekretariat Daerah",
  "Sekretariat DPRD",
  "Inspektorat",
  "Badan Perencanaan Pembangunan Daerah",
  "Badan Kepegawaian dan Pengembangan SDM",
  "Badan Pengelolaan Keuangan dan Aset Daerah",
  "Badan Pendapatan Daerah",
  "Dinas Pendidikan dan Kebudayaan",
  "Dinas Kesehatan",
  "Dinas Pekerjaan Umum dan Penataan Ruang",
  "Dinas Perumahan Rakyat dan Kawasan Permukiman",
  "Dinas Sosial",
  "Dinas Tenaga Kerja dan Perindustrian",
  "Dinas Koperasi dan UKM",
  "Dinas Penanaman Modal dan PTSP",
  "Dinas Kependudukan dan Pencatatan Sipil",
  "Dinas Komunikasi dan Informatika",
  "Dinas Perhubungan",
  "Dinas Lingkungan Hidup",
  "Dinas Pariwisata",
  "Dinas Pertanian",
  "Dinas Perikanan dan Pangan",
  "Dinas Perdagangan",
  "Dinas Pemuda dan Olahraga",
  "Satuan Polisi Pamong Praja",
  "Badan Penanggulangan Bencana Daerah",
  "Rumah Sakit Umum Daerah",
  "Kantor Kesatuan Bangsa dan Politik",
  "Dinas Arsip dan Perpustakaan",
  "Dinas Pemberdayaan Perempuan dan Perlindungan Anak",
  "Dinas Pengendalian Penduduk dan Keluarga Berencana",
  "Dinas Pemadam Kebakaran",
  "Kecamatan Padang Barat",
  "Kecamatan Padang Timur",
  "Kecamatan Padang Selatan",
  "Kecamatan Padang Utara",
  "Kecamatan Koto Tangah",
  "Kecamatan Nanggalo",
  "Kecamatan Kuranji",
  "Kecamatan Lubuk Begalung",
  "Kecamatan Lubuk Kilangan",
  "Kecamatan Pauh",
  "Kecamatan Bungus Teluk Kabung",
  "Puskesmas Andalas",
  "Puskesmas Lubuk Buaya",
  "Puskesmas Pauh",
  "Puskesmas Belimbing",
  "Puskesmas Seberang Padang",
  "SMP Negeri 1",
  "SMP Negeri 2",
  "SMP Negeri 3",
  "SMP Negeri 4",
  "SMP Negeri 5",
  "SMP Negeri 6",
  "SMP Negeri 7",
  "SMP Negeri 8",
  "SMP Negeri 9",
  "SMP Negeri 10",
  "UPTD Balai Latihan Kerja",
  "UPTD Laboratorium Kesehatan",
  "UPTD Pengelolaan Jalan dan Jembatan",
  "UPTD Perlindungan Tanaman",
  "UPTD Museum dan Taman Budaya",
  "UPTD Samsat",
];

const firstNames = [
  "Aulia",
  "Budi",
  "Citra",
  "Dedi",
  "Elvira",
  "Fikri",
  "Gita",
  "Hafiz",
  "Indah",
  "Joko",
  "Kartika",
  "Lukman",
  "Mira",
  "Nanda",
  "Oki",
  "Putri",
  "Rizal",
  "Sari",
  "Taufik",
  "Vina",
];

const lastNames = [
  "Pratama",
  "Saputra",
  "Rahmayani",
  "Permata",
  "Firmansyah",
  "Safitri",
  "Wijaya",
  "Lestari",
  "Syahputra",
  "Amelia",
  "Yulanda",
  "Hidayat",
];

const jabatanPegawai = [
  "Analis Kebijakan Ahli Muda",
  "Pengelola Keuangan",
  "Bendahara Pengeluaran",
  "Staf Administrasi",
  "Guru Ahli Pertama",
  "Perawat Terampil",
  "Penyuluh Lapangan",
  "Pranata Komputer",
  "Pengadministrasi Umum",
];

function rng(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function phone(prefix: number, index: number) {
  return `08${prefix}${String(9000000 + index * 137).slice(-7)}`;
}

function nip(index: number) {
  const year = 1975 + (index % 25);
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 27) + 1).padStart(2, "0");
  return `${year}${month}${day}20${String(10 + (index % 15)).padStart(2, "0")}01${String(index).padStart(4, "0")}`;
}

function reset(database: Database.Database) {
  database.exec(`
    DELETE FROM settings;
    DELETE FROM audit_log;
    DELETE FROM notifications;
    DELETE FROM action_log;
    DELETE FROM pegawai;
    DELETE FROM sosialisasi;
    DELETE FROM scoring_opd;
    DELETE FROM deposit_monitoring;
    DELETE FROM spt_masa_monitoring;
    DELETE FROM pph21_monitoring;
    DELETE FROM spt_monitoring;
    DELETE FROM opd;
    DELETE FROM users;
    DELETE FROM wilayah;
    DELETE FROM sqlite_sequence WHERE name IN (
      'wilayah','users','opd','spt_monitoring','pph21_monitoring',
      'spt_masa_monitoring','deposit_monitoring','scoring_opd',
      'sosialisasi','pegawai','action_log','notifications','audit_log'
    );
  `);
}

export function seedDatabase(options: { force?: boolean } = {}): SeedResult {
  const database = getDb();
  const existing = database.prepare("SELECT COUNT(*) AS total FROM opd").get() as { total: number };

  if (!options.force && existing.total > 0) {
    return counts(database, false);
  }

  const random = rng(20260430);
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  const trx = database.transaction(() => {
    reset(database);

    const insertWilayah = database.prepare("INSERT INTO wilayah (nama, kode) VALUES (?, ?)");
    const wilayahIds = wilayahSeed.map((item) => Number(insertWilayah.run(item.nama, item.kode).lastInsertRowid));

    const insertUser = database.prepare(`
      INSERT INTO users (nama, email, password_hash, nip, jabatan, role, phone, avatar_color, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif')
    `);

    userSeed.forEach((user, idx) => {
      insertUser.run(
        user.nama,
        user.email,
        passwordHash,
        nip(idx + 1),
        user.jabatan,
        user.role,
        phone(12 + idx, idx + 1),
        user.color,
      );
    });

    const arRows = database
      .prepare("SELECT id FROM users WHERE role = 'ar' ORDER BY id")
      .all() as Array<{ id: number }>;
    const arIds = arRows.map((row) => row.id);

    const insertOpd = database.prepare(`
      INSERT INTO opd (
        nama, wilayah_id, jenis_instansi, jumlah_asn, jumlah_pppk, npwp_opd, status_pemungut_ppn,
        nama_bendahara, nip_bendahara, hp_bendahara, email_bendahara,
        nama_bendahara_penerimaan, hp_bendahara_penerimaan,
        nama_pic_kepeg, hp_pic_kepeg, ar_id, status, tanggal_input, tanggal_update_kontak
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const opdRows: Array<{ id: number; index: number; jumlahAsn: number; wilayahIndex: number }> = [];
    let globalIndex = 1;

    wilayahSeed.forEach((wilayah, wilayahIndex) => {
      for (let local = 0; local < wilayah.quota; local += 1) {
        const base = unitNames[local % unitNames.length];
        const round = Math.floor(local / unitNames.length);
        const numbered = round > 0 ? ` Wilayah ${round + 1}` : "";
        const nama = `${base}${numbered} ${wilayah.suffix}`;
        const jumlahAsn = 35 + Math.floor(random() * 390);
        const bendahara = `${pick(firstNames, random)} ${pick(lastNames, random)}`;
        const bendaharaPenerimaan = `${pick(firstNames, random)} ${pick(lastNames, random)}`;
        const pic = `${pick(firstNames, random)} ${pick(lastNames, random)}`;
        const status = globalIndex % 49 === 0 ? "tidak_aktif" : globalIndex % 17 === 0 ? "perlu_update" : "aktif";
        const result = insertOpd.run(
          nama,
          wilayahIds[wilayahIndex],
          base.startsWith("Dinas")
            ? "Dinas"
            : base.startsWith("Badan")
              ? "Badan"
              : base.startsWith("Sekretariat")
                ? "Sekretariat"
                : base.includes("Rumah Sakit")
                  ? "Rumah Sakit"
                  : base.includes("SMP")
                    ? "Sekolah"
                    : "Lainnya",
          jumlahAsn,
          5 + Math.floor(random() * 85),
          `00.${String(100000 + globalIndex).slice(0, 6)}.${String(900 + (globalIndex % 99)).padStart(3, "0")}.0-201.000`,
          globalIndex % 4 === 0 ? "YA" : "TIDAK",
          bendahara,
          nip(1000 + globalIndex),
          phone(11 + (globalIndex % 8), globalIndex),
          `bendahara${globalIndex}@opd.local`,
          bendaharaPenerimaan,
          phone(41 + (globalIndex % 7), globalIndex),
          pic,
          phone(21 + (globalIndex % 8), globalIndex),
          arIds[globalIndex % arIds.length],
          status,
          "2026-01-02",
          "2026-04-30",
        );
        opdRows.push({
          id: Number(result.lastInsertRowid),
          index: globalIndex,
          jumlahAsn,
          wilayahIndex,
        });
        globalIndex += 1;
      }
    });

    const insertSpt = database.prepare(`
      INSERT INTO spt_monitoring (
        opd_id, tahun_pajak, periode, jumlah_wajib_lapor, jumlah_sudah_lapor, persen_kepatuhan, traffic_light
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const currentPeriods = ["2026-01", "2026-02", "2026-03"];
    const previousPeriods = ["2025-01", "2025-02", "2025-03"];

    opdRows.forEach((opd) => {
      const risk = opd.index % 15 === 0 ? "red" : opd.index % 7 === 0 ? "yellow" : "green";
      const finalPct =
        risk === "red"
          ? 24 + random() * 15
          : risk === "yellow"
            ? 44 + random() * 23
            : 72 + random() * 23;

      currentPeriods.forEach((period, idx) => {
        const factor = [0.16, 0.5, 1][idx];
        const pct = Math.min(99, Number((finalPct * factor).toFixed(2)));
        const sudah = Math.round((opd.jumlahAsn * pct) / 100);
        insertSpt.run(opd.id, 2025, period, opd.jumlahAsn, sudah, pct, trafficFromPercent(pct));
      });

      previousPeriods.forEach((period, idx) => {
        const pct = Math.min(98, Number(((finalPct - 6 + random() * 12) * [0.28, 0.62, 0.92][idx]).toFixed(2)));
        const sudah = Math.max(0, Math.round((opd.jumlahAsn * pct) / 100));
        insertSpt.run(opd.id, 2024, period, opd.jumlahAsn, sudah, pct, trafficFromPercent(pct));
      });
    });

    const insertPph = database.prepare(`
      INSERT INTO pph21_monitoring (
        opd_id, bulan, jumlah_dipotong, nominal_setor, estimasi_wajar, ketepatan, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const pphMonths = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
    opdRows.forEach((opd) => {
    pphMonths.forEach((bulan, idx) => {
        const estimasi = opd.jumlahAsn * (110_000 + Math.floor(random() * 95_000));
        const severity = (opd.index + idx) % 19 === 0 ? "kritis" : (opd.index + idx) % 8 === 0 ? "under_reporting" : "normal";
        const nominal = severity === "kritis" ? 0 : severity === "under_reporting" ? Math.round(estimasi * (0.48 + random() * 0.2)) : Math.round(estimasi * (0.92 + random() * 0.16));
        const ketepatan = severity === "kritis" ? "belum_setor" : severity === "under_reporting" || (opd.index + idx) % 11 === 0 ? "terlambat" : "tepat_waktu";
        insertPph.run(opd.id, bulan, Math.round(opd.jumlahAsn * (0.78 + random() * 0.2)), nominal, estimasi, ketepatan, severity);
      });
    });

    const insertSptMasa = database.prepare(`
      INSERT INTO spt_masa_monitoring (
        opd_id, masa_pajak, pph22_nominal, pph22_status, pph23_nominal, pph23_status,
        ppn_put_nominal, ppn_put_status, status_opd_pemungut, status_keseluruhan, catatan_ar
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDeposit = database.prepare(`
      INSERT INTO deposit_monitoring (
        opd_id, masa_pajak, deposit_pph21, status_pph21, deposit_pph_unifikasi,
        status_unifikasi, deposit_ppn_put, status_ppn_put, total_deposit, status_deposit_overall
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertScore = database.prepare(`
      INSERT INTO scoring_opd (
        opd_id, bulan_scoring, skor_spt_op, skor_pph21, skor_spt_masa, skor_deposit,
        skor_total, kategori, status_rp, catatan
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const latestSpt = database.prepare(`
      SELECT persen_kepatuhan FROM spt_monitoring WHERE opd_id = ? AND tahun_pajak = 2025 AND periode = '2026-03'
    `);
    const latestPph = database.prepare("SELECT ketepatan, nominal_setor FROM pph21_monitoring WHERE opd_id = ? AND bulan = '2026-03'");

    opdRows.forEach((opd) => {
      const isPemungut = opd.index % 4 === 0;
      const sptMasaRisk = opd.index % 18 === 0 ? "merah" : opd.index % 6 === 0 ? "kuning" : "hijau";
      const pph22Status: string = sptMasaRisk === "merah" ? "NIHIL" : sptMasaRisk === "kuning" ? "TERLAMBAT" : "TEPAT WAKTU";
      const pph23Status: string = opd.index % 13 === 0 ? "TERLAMBAT" : "TEPAT WAKTU";
      const ppnStatus: string = !isPemungut ? "BUKAN PEMUNGUT" : opd.index % 21 === 0 ? "NIHIL" : pph22Status;
      const statusKeseluruhan = pph22Status === "NIHIL" || pph23Status === "NIHIL" || ppnStatus === "NIHIL" ? "merah" : pph22Status === "TERLAMBAT" || pph23Status === "TERLAMBAT" || ppnStatus === "TERLAMBAT" ? "kuning" : "hijau";
      const pph22 = pph22Status === "NIHIL" ? 0 : Math.round(opd.jumlahAsn * (18_000 + random() * 42_000));
      const pph23 = pph23Status === "NIHIL" ? 0 : Math.round(opd.jumlahAsn * (15_000 + random() * 38_000));
      const ppn = ppnStatus === "NIHIL" || ppnStatus === "BUKAN PEMUNGUT" ? 0 : Math.round(opd.jumlahAsn * (30_000 + random() * 70_000));
      insertSptMasa.run(opd.id, "2026-03", pph22, pph22Status, pph23, pph23Status, ppn, ppnStatus, isPemungut ? "YA" : "TIDAK", statusKeseluruhan, null);

      const pph = latestPph.get(opd.id) as { ketepatan: string; nominal_setor: number };
      const statusPph21 = pph.ketepatan === "belum_setor" ? "NIHIL" : pph.ketepatan === "terlambat" ? "TERLAMBAT" : "TEPAT WAKTU";
      const statusUnifikasi = statusKeseluruhan === "merah" ? "NIHIL" : statusKeseluruhan === "kuning" ? "TERLAMBAT" : "TEPAT WAKTU";
      const statusDepositOverall = statusPph21 === "NIHIL" || statusUnifikasi === "NIHIL" || ppnStatus === "NIHIL" ? "merah" : statusPph21 === "TERLAMBAT" || statusUnifikasi === "TERLAMBAT" || ppnStatus === "TERLAMBAT" ? "kuning" : "hijau";
      const totalDeposit = pph.nominal_setor + pph22 + pph23 + ppn;
      insertDeposit.run(opd.id, "2026-03", pph.nominal_setor, statusPph21, pph22 + pph23, statusUnifikasi, ppn, ppnStatus, totalDeposit, statusDepositOverall);

      const spt = latestSpt.get(opd.id) as { persen_kepatuhan: number };
      const skorSpt = Math.min(100, spt.persen_kepatuhan);
      const skorPph21 = statusPph21 === "TEPAT WAKTU" ? 100 : statusPph21 === "TERLAMBAT" ? 60 : 0;
      const skorSptMasa = statusKeseluruhan === "hijau" ? 100 : statusKeseluruhan === "kuning" ? 60 : 0;
      const skorDeposit = statusDepositOverall === "hijau" ? 100 : statusDepositOverall === "kuning" ? 60 : 0;
      const skorTotal = Number((skorSpt * 0.3 + skorPph21 * 0.25 + skorSptMasa * 0.25 + skorDeposit * 0.2).toFixed(2));
      const kategori = skorTotal >= 90 ? "hijau" : skorTotal >= 70 ? "kuning" : "merah";
      const statusRp = skorTotal >= 90 ? "reward" : skorTotal < 70 ? "punishment" : "monitor";
      insertScore.run(opd.id, "2026-03", skorSpt, skorPph21, skorSptMasa, skorDeposit, skorTotal, kategori, statusRp, null);
    });

    const insertSos = database.prepare(`
      INSERT INTO sosialisasi (opd_id, tanggal, jumlah_peserta, penyuluh_id, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    opdRows.slice(0, 162).forEach((opd, idx) => {
      const date = new Date(2026, 0, 6 + (idx % 86));
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      insertSos.run(
        opd.id,
        `${yyyy}-${mm}-${dd}`,
        18 + Math.floor(random() * 85),
        arIds[idx % arIds.length],
        idx % 14 === 0 ? "perlu_ulang" : "sudah",
      );
    });

    const insertPegawai = database.prepare(`
      INSERT INTO pegawai (nama, nip, opd_id, jabatan, status_coretax, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 500; i += 1) {
      const opd = opdRows[(i * 17) % opdRows.length];
      const status =
        i % 10 === 0 ? "sudah_lapor" : i % 4 === 0 ? "belum_aktivasi" : "aktif_belum_lapor";
      insertPegawai.run(
        `${pick(firstNames, random)} ${pick(lastNames, random)}`,
        nip(3000 + i),
        opd.id,
        pick(jabatanPegawai, random),
        status,
        phone(31 + (i % 5), i),
      );
    }

    const insertLog = database.prepare(`
      INSERT INTO action_log (user_id, action, target_type, target_name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const actions = [
      "Mengirim imbauan SPT",
      "Memperbarui kontak bendahara",
      "Menandai OPD perlu tindak lanjut",
      "Mengunggah hasil sosialisasi",
      "Memvalidasi data PPh 21",
    ];
    for (let i = 0; i < 20; i += 1) {
      const opd = opdRows[(i * 13) % opdRows.length];
      const date = new Date(2026, 3, 29, 8 + (i % 9), 5 + i * 2);
      insertLog.run(
        arIds[i % arIds.length],
        actions[i % actions.length],
        "opd",
        database.prepare("SELECT nama FROM opd WHERE id = ?").pluck().get(opd.id),
        date.toISOString(),
      );
    }

    const insertNotif = database.prepare(`
      INSERT INTO notifications (title, body, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const notifTypes = ["warning", "info", "success", "danger"] as const;
    for (let i = 0; i < 10; i += 1) {
      insertNotif.run(
        i % 3 === 0 ? "Perlu tindak lanjut OPD merah" : i % 3 === 1 ? "Sinkronisasi data selesai" : "Jadwal sosialisasi pekan ini",
        i % 3 === 0
          ? "Beberapa OPD masih berada di bawah 40% kepatuhan SPT."
          : i % 3 === 1
            ? "Data dummy Coretax dan BKPSDM berhasil diproses."
            : "Ada sesi sosialisasi Coretax yang perlu dikonfirmasi.",
        notifTypes[i % notifTypes.length],
        i > 4 ? 1 : 0,
        new Date(2026, 3, 30, 8 + i).toISOString(),
      );
    }

    const insertSetting = database.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    insertSetting.run("data_source", "dummy_seed");
    insertSetting.run("integration_coretax", "simulated");
    insertSetting.run("integration_bkpsdm", "simulated");
    insertSetting.run("notification_email", "disabled");
  });

  trx();
  return counts(database, true);
}

export function ensureSeeded() {
  // Seed hanya dilakukan eksplisit via POST /api/seed { force: true }.
  // Jika DB kosong, aplikasi tetap berjalan — data diisi lewat import:contoh / import:excel.
  return;
}

function counts(database: Database.Database, seeded: boolean): SeedResult {
  const read = (table: string) =>
    (database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;

  return {
    seeded,
    wilayah: read("wilayah"),
    users: read("users"),
    opd: read("opd"),
    pegawai: read("pegawai"),
  };
}

export const dummyCredential = {
  email: "kasiwas@simpatik.local",
  password: PASSWORD,
};
