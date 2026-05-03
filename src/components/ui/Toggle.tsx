import { cn } from "@/lib/utils";

export function Toggle({ active, label }: { active?: boolean; label?: string }) {
  return <span className={cn("toggle", active && "active")} role="switch" aria-checked={active ? "true" : "false"} aria-label={label} />;
}
