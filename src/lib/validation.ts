import type { WriteOpdPayload } from "@/lib/queries";
import type { Role } from "@/types";

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const ROLE_VALUES: Role[] = ["kepala_kpp", "kasiwas", "ar", "teknisi"];
const USER_STATUS_VALUES = ["aktif", "cuti", "nonaktif"];
const OPD_STATUS_VALUES = ["aktif", "tidak_aktif", "perlu_update"];
const SOSIALISASI_STATUS_VALUES = ["sudah", "belum", "perlu_ulang"];

function record(input: unknown) {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const result = text(value);
  return result || null;
}

function requiredText(source: Record<string, unknown>, key: string, label: string, errors: string[]) {
  const value = text(source[key]);
  if (!value) errors.push(`${label} wajib diisi.`);
  return value;
}

function numberValue(value: unknown, label: string, errors: string[], options: { min?: number; required?: boolean } = {}) {
  const raw = text(value);
  if (!raw && !options.required) return null;
  const result = Number(raw);
  if (!Number.isFinite(result)) {
    errors.push(`${label} harus berupa angka.`);
    return 0;
  }
  if (options.min !== undefined && result < options.min) {
    errors.push(`${label} minimal ${options.min}.`);
  }
  return result;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string,
  errors: string[],
) {
  const result = (text(value) || fallback) as T;
  if (!allowed.includes(result)) {
    errors.push(`${label} tidak valid.`);
    return fallback;
  }
  return result;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validationError(errors: string[]) {
  return { message: "Validasi gagal.", errors };
}

export function validateOpdPayload(input: unknown): ValidationResult<WriteOpdPayload> {
  const source = record(input);
  const errors: string[] = [];
  const wilayahId = numberValue(source.wilayah_id, "Wilayah", errors, { min: 1, required: true }) ?? 0;
  const jumlahAsn = numberValue(source.jumlah_asn, "Jumlah ASN", errors, { min: 0, required: true }) ?? 0;
  const jumlahPppk = numberValue(source.jumlah_pppk, "Jumlah PPPK", errors, { min: 0 }) ?? 0;
  const emailBendahara = optionalText(source.email_bendahara);

  if (emailBendahara && !validEmail(emailBendahara)) {
    errors.push("Email bendahara tidak valid.");
  }

  const arId = numberValue(source.ar_id, "AR", errors, { min: 1 });
  const statusPemungut = text(source.status_pemungut_ppn) || "TIDAK";
  if (!["YA", "TIDAK"].includes(statusPemungut)) {
    errors.push("Status pemungut PPN tidak valid.");
  }

  const data: WriteOpdPayload = {
    nama: requiredText(source, "nama", "Nama OPD", errors),
    wilayah_id: wilayahId,
    seksi: optionalText(source.seksi),
    jenis_instansi: optionalText(source.jenis_instansi),
    jumlah_asn: jumlahAsn,
    jumlah_pppk: jumlahPppk,
    npwp_opd: optionalText(source.npwp_opd),
    status_pemungut_ppn: statusPemungut,
    nama_bendahara: requiredText(source, "nama_bendahara", "Nama bendahara", errors),
    nip_bendahara: optionalText(source.nip_bendahara),
    hp_bendahara: requiredText(source, "hp_bendahara", "HP bendahara", errors),
    email_bendahara: emailBendahara,
    nama_bendahara_penerimaan: optionalText(source.nama_bendahara_penerimaan),
    hp_bendahara_penerimaan: optionalText(source.hp_bendahara_penerimaan),
    nama_pic_kepeg: requiredText(source, "nama_pic_kepeg", "Nama PIC kepegawaian", errors),
    hp_pic_kepeg: requiredText(source, "hp_pic_kepeg", "HP PIC", errors),
    ar_id: arId,
    status: enumValue(source.status, OPD_STATUS_VALUES, "aktif", "Status OPD", errors),
    tanggal_input: optionalText(source.tanggal_input),
    tanggal_update_kontak: optionalText(source.tanggal_update_kontak),
  };

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

export type UserWritePayload = {
  nama: string;
  email: string;
  password?: string;
  role: Role;
  nip?: string | null;
  jabatan?: string | null;
  phone?: string | null;
  avatar_color?: string | null;
  status?: string;
};

export function validateUserPayload(input: unknown, options: { requirePassword?: boolean } = {}): ValidationResult<UserWritePayload> {
  const source = record(input);
  const errors: string[] = [];
  const email = requiredText(source, "email", "Username / email", errors).toLowerCase();
  const password = text(source.password);

  if (email && email.includes("@") && !validEmail(email)) {
    errors.push("Email tidak valid.");
  }
  if (email && !email.includes("@") && !/^[a-z0-9._-]{3,40}$/.test(email)) {
    errors.push("Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung; minimal 3 karakter.");
  }
  if (options.requirePassword && password.length < 8) {
    errors.push("Password minimal 8 karakter.");
  }
  if (password && password.length < 8) {
    errors.push("Password minimal 8 karakter.");
  }

  const data: UserWritePayload = {
    nama: requiredText(source, "nama", "Nama", errors),
    email,
    password: password || undefined,
    role: enumValue(source.role, ROLE_VALUES, "ar", "Role", errors),
    nip: optionalText(source.nip),
    jabatan: optionalText(source.jabatan),
    phone: optionalText(source.phone),
    avatar_color: optionalText(source.avatar_color),
    status: enumValue(source.status, USER_STATUS_VALUES, "aktif", "Status user", errors),
  };

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

export type SosialisasiWritePayload = {
  opd_id: number;
  tanggal: string;
  jumlah_peserta: number;
  penyuluh_id?: number | null;
  status?: string;
};

export function validateSosialisasiPayload(input: unknown): ValidationResult<SosialisasiWritePayload> {
  const source = record(input);
  const errors: string[] = [];
  const tanggal = requiredText(source, "tanggal", "Tanggal", errors);
  if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    errors.push("Tanggal harus berformat YYYY-MM-DD.");
  }

  const data: SosialisasiWritePayload = {
    opd_id: numberValue(source.opd_id, "OPD", errors, { min: 1, required: true }) ?? 0,
    tanggal,
    jumlah_peserta: numberValue(source.jumlah_peserta, "Jumlah peserta", errors, { min: 1, required: true }) ?? 0,
    penyuluh_id: numberValue(source.penyuluh_id, "Penyuluh", errors, { min: 1 }),
    status: enumValue(source.status, SOSIALISASI_STATUS_VALUES, "sudah", "Status sosialisasi", errors),
  };

  return errors.length ? { ok: false, errors } : { ok: true, data };
}
