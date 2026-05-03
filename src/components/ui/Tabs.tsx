import Link from "next/link";

import { cn } from "@/lib/utils";

export type TabItem = {
  label: string;
  href: string;
  active?: boolean;
};

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <Link key={item.href} className={cn("tab", item.active && "active")} href={item.href} role="tab" aria-selected={item.active}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
