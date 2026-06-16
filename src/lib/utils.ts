import type { TrafficLight } from "@/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function safeNumber(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  return `${safeNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatNumber(value: number | null | undefined) {
  return safeNumber(value).toLocaleString("id-ID");
}

export function formatRupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

export function formatCompactRupiah(value: number | null | undefined) {
  const safeValue = safeNumber(value);

  if (safeValue >= 1_000_000_000) {
    return `Rp ${(safeValue / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }

  if (safeValue >= 1_000_000) {
    return `Rp ${(safeValue / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  return formatRupiah(safeValue);
}

export function monthLabel(period: string) {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

export function monthFullLabel(period: string) {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function trafficFromPercent(percent: number): TrafficLight {
  if (percent >= 70) return "hijau";
  if (percent >= 40) return "kuning";
  return "merah";
}

export function trafficLabel(value: string) {
  if (value === "hijau") return "Hijau";
  if (value === "kuning") return "Kuning";
  if (value === "merah") return "Merah";
  return value;
}

export function roleLabel(value: string) {
  const labels: Record<string, string> = {
    kepala_kpp: "Kepala KPP",
    kasiwas: "Kasiwas",
    ar: "Account Representative",
    teknisi: "Teknisi",
  };
  return labels[value] ?? value;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function toWaLink(phone: string | null | undefined) {
  if (!phone) return "#";
  const normalized = phone.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${normalized}`;
}
