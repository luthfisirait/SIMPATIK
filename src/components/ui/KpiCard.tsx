import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  sub?: string;
  change?: string;
  changeTone?: "up" | "down" | "neutral";
  icon: React.ReactNode;
  accent?: "teal" | "green" | "red" | "gold" | "navy";
  onClick?: () => void;
  ariaLabel?: string;
};

const accentClass = {
  teal: "",
  green: "accent-green",
  red: "accent-red",
  gold: "accent-gold",
  navy: "accent-navy",
};

export function KpiCard({ label, value, sub, change, changeTone = "neutral", icon, accent = "teal", onClick, ariaLabel }: KpiCardProps) {
  const content = (
    <>
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
      {change ? <span className={cn("kpi-change", changeTone)}>{change}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button className={cn("kpi-card", "kpi-card-clickable", accentClass[accent])} type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
        {content}
      </button>
    );
  }

  return (
    <section className={cn("kpi-card", accentClass[accent])}>
      {content}
    </section>
  );
}
