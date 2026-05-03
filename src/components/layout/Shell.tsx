"use client";

import {
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Database,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Presentation,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { signOut } from "next-auth/react";
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
    label: "Monitoring",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/modul1-spt", label: "Modul 1 SPT", icon: FileCheck2 },
      { href: "/modul2-pph21", label: "Modul 2 PPh 21", icon: ReceiptText },
      { href: "/modul3-sosialisasi", label: "Modul 3 Sosialisasi", icon: Presentation },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/data-opd", label: "Data OPD", icon: Database },
      { href: "/pegawai-belum-lapor", label: "Pegawai Belum Lapor", icon: UsersRound, badge: "!" },
      { href: "/direktori-ar", label: "Direktori AR", icon: ContactRound },
      { href: "/direktori-opd", label: "Direktori OPD", icon: Building2 },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/analitik", label: "Analitik", icon: BarChart3 },
      { href: "/pengguna", label: "Pengguna", icon: ShieldCheck },
      { href: "/pengaturan", label: "Pengaturan", icon: Settings },
    ],
  },
];

const meta: Record<string, { title: string; bc: string }> = {
  "/dashboard": { title: "Dashboard", bc: "/ Ringkasan Kepatuhan" },
  "/modul1-spt": { title: "Modul 1 - SPT PPh OP", bc: "/ Monitoring Kepatuhan SPT" },
  "/modul2-pph21": { title: "Modul 2 - PPh Pasal 21", bc: "/ Monitoring Kewajiban Bendahara" },
  "/modul3-sosialisasi": { title: "Modul 3 - Sosialisasi Coretax", bc: "/ Rekam Jejak Sosialisasi" },
  "/data-opd": { title: "Data OPD", bc: "/ Manajemen Data" },
  "/pegawai-belum-lapor": { title: "Pegawai Belum Lapor SPT", bc: "/ Daftar Individu Belum Melapor" },
  "/direktori-ar": { title: "Direktori AR", bc: "/ Contact Person" },
  "/direktori-opd": { title: "Direktori OPD", bc: "/ Bendahara dan PIC" },
  "/analitik": { title: "Analitik", bc: "/ Visualisasi dan Tren" },
  "/pengguna": { title: "Pengguna", bc: "/ Manajemen Akses" },
  "/pengaturan": { title: "Pengaturan", bc: "/ Konfigurasi Sistem" },
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
          <span className="logo-icon">SP</span>
          <div className="logo-text">
            <div className="app-name">SIMPATIK</div>
            <div className="app-sub">KPP Pratama Padang Satu</div>
          </div>
          <button
            className="sidebar-collapse-btn"
            type="button"
            title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
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
                    {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
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
        <form className="topbar-search" action="/data-opd">
          <Search size={15} />
          <input name="q" placeholder="Cari OPD, AR, pegawai" />
        </form>
        <button className="icon-btn" type="button" title="Notifikasi">
          <Bell size={18} />
          <span className="notif-dot" />
        </button>
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
