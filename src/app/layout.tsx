import type { Metadata } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SIMPATIK",
  description: "Sistem Monitoring Terintegrasi Kepatuhan Perpajakan KPP Pratama Padang Satu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${dmSans.className} ${dmSans.variable} ${dmMono.variable}`}>{children}</body>
    </html>
  );
}
