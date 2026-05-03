import Link from "next/link";

import { cn } from "@/lib/utils";

export function FilterChip({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link className={cn("filter-chip", active && "active")} href={href}>
      {children}
    </Link>
  );
}
