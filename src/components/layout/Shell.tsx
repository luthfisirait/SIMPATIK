"use client";

import {
  Award,
  BookUser,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ContactRound,
  FileCheck2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Presentation,
  ReceiptText,
  Search,
  Trophy,
  Upload,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { initials, roleLabel } from "@/lib/utils";
import { roleCanSeeNav } from "@/lib/rbac";
import type { Role } from "@/types";

type ShellProps = {
  children: React.ReactNode;
  user: {
    name?: string | null;
    role?: string;
    jabatan?: string;
    avatarColor?: string;
  };
};

const navGroups = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Modul Monitoring",
    items: [
      { href: "/modul1-spt", label: "Modul 1 SPT PPh OP", icon: FileCheck2 },
      { href: "/modul2-pph21", label: "Modul 2 PPh 21", icon: ReceiptText },
      { href: "/modul3-sosialisasi", label: "Modul 3 Jejak Coretax", icon: Presentation },
      { href: "/modul4-spt-masa", label: "Modul 4 SPT Masa", icon: ClipboardCheck },
      { href: "/modul5-deposit", label: "Modul 5 Deposit", icon: Landmark },
    ],
  },
  {
    label: "Analitik",
    items: [
      { href: "/scoring-opd", label: "Scoring OPD", icon: Trophy },
      { href: "/reward-punishment", label: "Reward & Punishment", icon: Award },
    ],
  },
  {
    label: "Direktori",
    items: [
      { href: "/direktori-ar", label: "Direktori AR", icon: ContactRound },
      { href: "/direktori-bendahara", label: "Direktori Bendahara", icon: BookUser },
    ],
  },
  {
    label: "Log",
    items: [{ href: "/action-log/input", label: "Action Log AR", icon: ClipboardList }],
  },
  {
    label: "Administrasi",
    items: [{ href: "/import", label: "Import Data", icon: Upload }],
  },
];

const meta: Record<string, { title: string; bc: string }> = {
  "/dashboard": { title: "Dashboard", bc: "/ Ringkasan Kepatuhan" },
  "/modul1-spt": { title: "Modul 1 - SPT PPh OP", bc: "/ Monitoring Kepatuhan SPT" },
  "/modul2-pph21": { title: "Modul 2 - PPh Pasal 21", bc: "/ Monitoring Kewajiban Bendahara" },
  "/modul3-sosialisasi": { title: "Modul 3 - Jejak Coretax", bc: "/ Rekam Jejak Sosialisasi" },
  "/modul4-spt-masa": { title: "Modul 4 - SPT Masa", bc: "/ PPh Unifikasi dan PPN PUT" },
  "/modul5-deposit": { title: "Modul 5 - Deposit", bc: "/ Realisasi Setoran Pajak" },
  "/scoring-opd": { title: "Scoring OPD", bc: "/ Skor Komposit Kepatuhan" },
  "/reward-punishment": { title: "Reward & Punishment", bc: "/ Tindak Lanjut Berbasis Scoring" },
  "/direktori-ar": { title: "Direktori AR", bc: "/ Contact Person" },
  "/direktori-bendahara": { title: "Direktori Bendahara", bc: "/ Kontak Bendahara Pengeluaran" },
  "/action-log/input": { title: "Action Log AR", bc: "/ Rekam Jejak Tindak Lanjut" },
};

export function Shell({ children, user }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const current = useMemo(() => meta[pathname] ?? meta["/dashboard"], [pathname]);
  const name = user.name ?? "Pengguna";
  const role = user.role as Role | undefined;

  return (
    <div className={collapsed ? "shell collapsed" : "shell"}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-brand-card">
            <Image
              src="/logos/simpatik-brand.svg"
              alt="Logo Kementerian Keuangan dan DJP"
              width={184}
              height={72}
              priority
              className="sidebar-brand-logo"
            />
          </div>
          <button
            className="sidebar-collapse-btn"
            type="button"
            title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => roleCanSeeNav(role, item.href));
            if (visibleItems.length === 0) return null;

            return (
            <div key={group.label}>
              <div className="nav-section">{group.label}</div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={active ? "nav-item active" : "nav-item"} title={item.label}>
                    <span className="nav-icon">
                      <Icon size={18} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" type="button" onClick={() => signOut({ callbackUrl: "/login" })} title="Keluar">
            <span className="nav-icon">
              <LogOut size={18} />
            </span>
            <span className="nav-label">Keluar</span>
          </button>
        </div>
      </aside>

      <header className="topbar">
        <div>
          <div className="topbar-title">{current.title}</div>
          <div className="topbar-breadcrumb">{current.bc}</div>
        </div>
        <div className="topbar-spacer" />
        <form className="topbar-search" action="/modul1-spt">
          <Search size={15} />
          <input name="q" placeholder="Cari OPD, AR, pegawai" />
        </form>
        <div className="user-pill">
          <span className="user-avatar" style={user.avatarColor ? { background: user.avatarColor } : undefined}>
            {initials(name)}
          </span>
          <div>
            <div className="user-name">{name}</div>
            <div className="user-role">{roleLabel(user.role ?? "")}</div>
          </div>
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
