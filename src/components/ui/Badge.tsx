import { cn } from "@/lib/utils";

export type BadgeTone = "green" | "red" | "amber" | "teal" | "navy";

export function Badge({ children, tone = "teal" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}

export function toneForTraffic(status: string): BadgeTone {
  if (status === "hijau") return "green";
  if (status === "kuning") return "amber";
  if (status === "merah") return "red";
  return "teal";
}

export function toneForPph(status: string): BadgeTone {
  if (status === "normal" || status === "tepat_waktu") return "green";
  if (status === "under_reporting" || status === "terlambat") return "amber";
  if (status === "kritis" || status === "belum_setor") return "red";
  return "teal";
}
