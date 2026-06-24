"use client";

import { Landmark, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge, toneForTraffic } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCompactRupiah, formatNumber, formatPercent } from "@/lib/utils";
import type { DepositRecord } from "@/types";

type DepositStatusKey = "all" | "hijau" | "kuning" | "merah";

type DepositDialogCard = {
  key: DepositStatusKey;
  label: string;
  value: string;
  sub?: string;
  accent: "teal" | "green" | "red" | "gold" | "navy";
};

function depositStatusLabel(value: string) {
  if (value === "hijau") return "Aman";
  if (value === "kuning") return "Rendah";
  if (value === "merah") return "Kritis";
  return value;
}

function rowsByStatus(rows: DepositRecord[], status: DepositStatusKey) {
  if (status === "all") return rows;
  return rows.filter((item) => String(item.status_deposit_overall) === status);
}

export function DepositKpiDialog({ rows }: { rows: DepositRecord[] }) {
  const [activeCard, setActiveCard] = useState<DepositDialogCard | null>(null);

  const cards = useMemo(() => {
    const totalRows = rows.length;
    const totalSaldo = rows.reduce((sum, item) => sum + item.total_deposit, 0);
    const count = (status: DepositStatusKey) => rowsByStatus(rows, status).length;
    const amanPercent = totalRows === 0 ? 0 : (count("hijau") * 100) / totalRows;

    return [
      {
        key: "all",
        label: `Total Saldo (${formatNumber(totalRows)} OPD)`,
        value: formatCompactRupiah(totalSaldo),
        accent: "navy",
      },
      {
        key: "hijau",
        label: "Saldo Aman (>Rp 10 jt)",
        value: formatNumber(count("hijau")),
        sub: `${formatPercent(amanPercent)} OPD`,
        accent: "green",
      },
      {
        key: "kuning",
        label: "Saldo Rendah (Rp 2-10 jt)",
        value: formatNumber(count("kuning")),
        sub: "Perlu top-up segera",
        accent: "gold",
      },
      {
        key: "merah",
        label: "Saldo Kritis (<Rp 2 jt)",
        value: formatNumber(count("merah")),
        sub: "Risiko gagal bayar",
        accent: "red",
      },
    ] satisfies DepositDialogCard[];
  }, [rows]);

  const dialogRows = activeCard ? rowsByStatus(rows, activeCard.key) : [];
  const dialogSaldo = dialogRows.reduce((sum, item) => sum + item.total_deposit, 0);

  useEffect(() => {
    if (!activeCard) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveCard(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCard]);

  return (
    <>
      <section className="kpi-grid">
        {cards.map((card) => (
          <KpiCard
            key={card.key}
            label={card.label}
            value={card.value}
            sub={card.sub}
            accent={card.accent}
            icon={<Landmark size={18} />}
            onClick={() => setActiveCard(card)}
            ariaLabel={`Tampilkan daftar ${card.label}`}
          />
        ))}
      </section>

      {activeCard ? (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="deposit-dialog-title" onClick={() => setActiveCard(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title" id="deposit-dialog-title">
                  {activeCard.label}
                </div>
                <div className="card-subtitle">
                  {formatNumber(dialogRows.length)} OPD - Total saldo {formatCompactRupiah(dialogSaldo)}
                </div>
              </div>
              <button className="icon-btn" type="button" aria-label="Tutup dialog" onClick={() => setActiveCard(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama OPD</th>
                      <th>Wilayah</th>
                      <th>Saldo Deposit</th>
                      <th>Status</th>
                      <th>AR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dialogRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          Belum ada data untuk kategori ini.
                        </td>
                      </tr>
                    ) : (
                      dialogRows.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.opd_nama}</strong>
                          </td>
                          <td className="td-mono">{item.wilayah_nama}</td>
                          <td className="td-mono">
                            <strong>{formatCompactRupiah(item.total_deposit)}</strong>
                          </td>
                          <td>
                            <Badge tone={toneForTraffic(String(item.status_deposit_overall))}>{depositStatusLabel(String(item.status_deposit_overall))}</Badge>
                          </td>
                          <td>{item.ar_nama ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setActiveCard(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
