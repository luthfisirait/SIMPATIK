import type { TrafficLight } from "@/types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatNumber(value: number) {
  return value.toLocaleString("id-ID");
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactRupiah(value: number) {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }

  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  return formatRupiah(value);
}

export function monthLabel(period: string) {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
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
