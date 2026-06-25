# SIMPATIK - Aturan Import Data

Dokumen ini menjadi rujukan urutan import dan relasi data Excel SIMPATIK. Prinsip utama: `Masterfile Wajib Pajak` adalah sumber final jumlah dan identitas OPD. Template lain hanya boleh mengisi data turunan untuk OPD yang sudah ada di Masterfile.

## Urutan Import

| Urutan | Template | Aturan | Kunci relasi |
|---|---|---|---|
| 1 | Masterfile Wajib Pajak | Wajib diimport paling awal. Import ini melakukan reset penuh data hasil import lama, lalu membentuk ulang OPD, wilayah, dan AR. | `NPWP16`, `NAMA_WP`, `NAMA_AR`, `NIP_AR` |
| 2 | Daftar Pegawai Instansi | Mengisi daftar ASN/PPPK dan menjadi sumber total wajib lapor SPT Tahunan OP. | `NPWP_SATKER = Masterfile.NPWP16` |
| 3 | Pelaporan SPT Tahunan OP | Mengisi status sudah lapor pegawai. | `SPT Tahunan OP.NPWP = Data Instansi Pegawai.NPWP_PEGAWAI` |
| 4 | Data Penerimaan | Mengisi setoran PPh Masa dan saldo deposit. KD MAP `411618` dihitung sebagai deposit. | `Data Penerimaan.NPWP = Masterfile.NPWP16` |
| 5 | Pelaporan SPT Masa PPh 21 | Mengisi status lapor PPh 21 masa. | `SPT Masa PPh21.NPWP = Masterfile.NPWP16` |
| 6 | Pelaporan SPT Masa Unifikasi/PPN | Mengisi status lapor PPh 22/23 dan PPN PUT. | `SPT Masa Unifikasi.NPWP = Masterfile.NPWP16`, `SPT Masa PPN.NPWP = Masterfile.NPWP16` |
| 7 | Rekam Sosialisasi | Mengisi sesi sosialisasi per OPD. Tidak membuat OPD baru. | `NPWP` atau `Nama OPD` harus cocok ke Masterfile |

## Relasi Utama

| Relasi | Dipakai untuk |
|---|---|
| `Masterfile.NPWP16 = SPT Masa PPh21.NPWP` | Wajib lapor dan status PPh 21 masa per OPD |
| `Masterfile.NPWP16 = SPT Masa Unifikasi.NPWP` | Wajib lapor dan status PPh Unifikasi per OPD |
| `Masterfile.NPWP16 = SPT Masa PPN.NPWP` | Wajib lapor dan status PPN PUT per OPD |
| `Masterfile.NPWP16 = Data Penerimaan.NPWP` | Setoran PPh Masa dan deposit pajak OPD |
| `Data Instansi Pegawai.NPWP_SATKER = Masterfile.NPWP16` | Penentuan OPD pegawai dan total ASN/PPPK |
| `SPT Tahunan OP.NPWP = Data Instansi Pegawai.NPWP_PEGAWAI` | Status sudah/belum lapor SPT Tahunan OP pegawai |

## Perilaku Saat Commit

- Masterfile melakukan reset penuh data hasil import: pegawai, pelaporan, penerimaan, deposit, sosialisasi, scoring, dan OPD lama dihapus lalu ditulis ulang.
- Template selain Masterfile tidak menambah OPD baru. Baris yang OPD-nya tidak cocok akan dilewati dan muncul pada alasan `Dilewati`.
- Pencocokan OPD memakai NPWP sebagai kunci utama. Nama OPD hanya cadangan saat NPWP tidak tersedia atau tidak cocok.
- NPWP 15 dan 16 digit dijembatani saat memungkinkan, termasuk variasi 15 digit dengan awalan `0`.
- Total OPD pada tab SPT Tahunan OP, PPh Masa, Sosialisasi, Deposit, Data OPD, dan Data AR mengikuti Masterfile.
- Total ASN/PPPK pada SPT Tahunan OP dan Rincian Pegawai SPT mengikuti `Daftar Pegawai Instansi`.
- Sudah lapor SPT Tahunan OP dihitung dari kecocokan NPWP pegawai terhadap sheet `Pelaporan SPT Tahunan OP`.

## Validasi Praktis Sebelum Commit

- Import Masterfile terlebih dahulu dan pastikan jumlah OPD sesuai file final.
- Pastikan `NPWP_SATKER` pada daftar pegawai berisi NPWP OPD, bukan NPWP pegawai.
- Pastikan `NPWP` pada SPT Tahunan OP adalah NPWP pegawai.
- Pastikan `NPWP` pada SPT Masa dan Data Penerimaan adalah NPWP OPD.
- Jalankan `Analisis / Pratinjau` dan cek jumlah baris serta alasan dilewati sebelum `Import sekarang`.