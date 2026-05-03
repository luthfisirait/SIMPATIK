import Link from "next/link";

import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
};

export function Button({ children, href, type = "button", variant = "primary", size = "md", className, onClick }: ButtonProps) {
  const classes = cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", className);

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type={type} onClick={onClick}>
      {children}
    </button>
  );
}
