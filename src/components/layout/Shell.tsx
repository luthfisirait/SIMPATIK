"use client";

import {
  BarChart3,
  BookUser,
  Building2,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Database,
  FileCheck2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Presentation,
  ReceiptText,
  Search,
  Settings,
  Upload,
  UsersRound,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { initials, roleLabel } from "@/lib/utils";
import { roleCanSeeNav } from "@/lib/rbac";
import type { Role } from "@/types";

type ShellProps = {
  children: React.ReactNode;
  dataLastUpdate?: string | null;
  user: {
    name?: string | null;
    role?: string;
    jabatan?: string;
    avatarColor?: string;
  };
};

const navGroups = [
  {
    label: "Utama",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/modul1-spt", label: "SPT Tahunan OP", icon: FileCheck2 },
      { href: "/modul2-pph21", label: "PPh Masa", icon: ReceiptText },
      { href: "/modul3-sosialisasi", label: "Sosialisasi Coretax", icon: Presentation },
      { href: "/modul5-deposit", label: "Deposit Pajak OPD", icon: Landmark },
    ],
  },
  {
    label: "Manajemen",
    items: [
      { href: "/pegawai-belum-lapor", label: "Rincian Pegawai SPT", icon: BookUser },
      { href: "/rincian-pph-masa", label: "Rincian PPh Masa OPD", icon: Database },
      { href: "/data-opd", label: "Data OPD", icon: Building2 },
      { href: "/import", label: "Import Data", icon: Upload },
      { href: "/direktori-ar", label: "Data AR", icon: ContactRound },
      { href: "/analitik", label: "Analitik", icon: BarChart3 },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/pengguna", label: "Pengguna", icon: UsersRound },
      { href: "/pengaturan", label: "Pengaturan", icon: Settings },
    ],
  },
];

const officeHeader = "KPP Pratama Padang Satu, Kanwil DJP Sumatera Barat dan Jambi";

function formatDataLastUpdate(value?: string | null) {
  if (!value) return "Belum ada import data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum ada import data";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function Shell({ children, dataLastUpdate, user }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
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
        <div className="topbar-heading">
          <div className="topbar-office">{officeHeader}</div>
          <div className="topbar-data-update">Data last update: {formatDataLastUpdate(dataLastUpdate)}</div>
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
