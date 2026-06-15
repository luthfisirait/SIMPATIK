"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut, Line, Scatter } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = "DM Sans, sans-serif";
ChartJS.defaults.color = "#4A637A";

const palette = {
  teal: "#0A8090",
  tealLt: "#0FB5CA",
  tealFaint: "rgba(10,128,144,.12)",
  navy: "#0D2B55",
  navyFaint: "rgba(13,43,85,.08)",
  green: "#16A663",
  amber: "#D97706",
  red: "#D64550",
};

export function SptTrendChart({
  current,
  previous,
  labels,
}: {
  labels: string[];
  current: number[];
  previous: number[];
}) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "SPT 2025",
            data: current,
            borderColor: palette.teal,
            backgroundColor: palette.tealFaint,
            fill: true,
            tension: 0.4,
          },
          {
            label: "SPT 2024",
            data: previous,
            borderColor: palette.navy,
            backgroundColor: palette.navyFaint,
            fill: true,
            borderDash: [5, 3],
            tension: 0.4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { grid: { display: false } },
          y: { min: 0, max: 100, ticks: { callback: (value) => `${value}%` } },
        },
      }}
    />
  );
}

export function SptVolumeTrendChart({
  current,
  previous,
  labels,
  currentLabel,
  previousLabel,
}: {
  labels: string[];
  current: number[];
  previous: number[];
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: currentLabel,
            data: current,
            borderColor: palette.teal,
            backgroundColor: palette.tealFaint,
            fill: true,
            tension: 0.4,
          },
          {
            label: previousLabel,
            data: previous,
            borderColor: palette.navy,
            backgroundColor: palette.navyFaint,
            fill: true,
            borderDash: [5, 3],
            tension: 0.4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" } },
        },
      }}
    />
  );
}

export function DoughnutPanel({ labels, data }: { labels: string[]; data: number[] }) {
  return (
    <Doughnut
      data={{
        labels,
        datasets: [
          {
            data,
            backgroundColor: [palette.green, palette.teal, palette.tealLt, palette.amber, palette.red],
            borderColor: "#fff",
            borderWidth: 2,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: { legend: { position: "bottom" } },
      }}
    />
  );
}

export function SingleBarChart({ labels, values, label }: { labels: string[]; values: number[]; label: string }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [{ label, data: values, backgroundColor: palette.teal, borderRadius: 6 }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.04)" } } },
      }}
    />
  );
}

export function PphBarChart({ labels, tepat, terlambat }: { labels: string[]; tepat: number[]; terlambat: number[] }) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label: "Tepat waktu", data: tepat, backgroundColor: palette.teal, borderRadius: 6 },
          { label: "Belum/terlambat", data: terlambat, backgroundColor: palette.red, borderRadius: 6 },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
      }}
    />
  );
}

export function SosialisasiScatterChart({
  sudah,
  belum,
}: {
  sudah: Array<{ x: number; y: number }>;
  belum: Array<{ x: number; y: number }>;
}) {
  return (
    <Scatter
      data={{
        datasets: [
          { label: "Sudah Disosialisasi", data: sudah, backgroundColor: palette.teal },
          { label: "Belum Disosialisasi", data: belum, backgroundColor: palette.red },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { title: { display: true, text: "Sesi Sosialisasi" }, grid: { display: false } },
          y: { title: { display: true, text: "Kepatuhan SPT (%)" }, min: 0, max: 100 },
        },
      }}
    />
  );
}

export function ScatterPanel({
  data,
}: {
  data: Array<{ sosialisasi: number; kepatuhan: number; asn: number; nama: string }>;
}) {
  return (
    <Scatter
      data={{
        datasets: [
          {
            label: "Sudah sosialisasi",
            data: data.filter((item) => item.sosialisasi).map((item) => ({ x: item.asn, y: item.kepatuhan })),
            backgroundColor: palette.teal,
          },
          {
            label: "Belum sosialisasi",
            data: data.filter((item) => !item.sosialisasi).map((item) => ({ x: item.asn, y: item.kepatuhan })),
            backgroundColor: palette.red,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { title: { display: true, text: "Jumlah ASN" }, grid: { display: false } },
          y: { title: { display: true, text: "Kepatuhan SPT (%)" }, min: 0, max: 100 },
        },
      }}
    />
  );
}
