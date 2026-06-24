"use client";

import { ClipboardCheck, Download, FileCheck2, Presentation, ReceiptText, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { downloadCsv, safeCsvFileName } from "@/lib/client-csv";

type KpiDialogIcon = "file-check" | "receipt" | "presentation" | "clipboard-check";

export type KpiDialogColumn = {
  key: string;
  label: string;
  className?: string;
};

export type KpiDialogCell = {
  value: string;
  tone?: BadgeTone;
  strong?: boolean;
  className?: string;
  href?: string;
  buttonLabel?: string;
};

export type KpiDialogRow = {
  id: string | number;
  cells: Record<string, string | KpiDialogCell>;
};

export type KpiDialogCard = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  accent?: "teal" | "green" | "red" | "gold" | "navy";
  icon: KpiDialogIcon;
  columns: KpiDialogColumn[];
  rows: KpiDialogRow[];
  description?: string;
  emptyText?: string;
  exportFileName?: string;
};

const iconMap = {
  "file-check": FileCheck2,
  receipt: ReceiptText,
  presentation: Presentation,
  "clipboard-check": ClipboardCheck,
};

function cellValue(cell: string | KpiDialogCell) {
  return typeof cell === "string" ? { value: cell } : cell;
}

export function KpiListDialog({ cards }: { cards: KpiDialogCard[] }) {
  const [activeCard, setActiveCard] = useState<KpiDialogCard | null>(null);

  function exportActiveCard(card: KpiDialogCard) {
    downloadCsv<KpiDialogRow>(
      card.exportFileName ?? safeCsvFileName(card.label),
      card.columns.map((column) => ({
        header: column.label,
        value: (row) => cellValue(row.cells[column.key] ?? "-").value,
      })),
      card.rows,
    );
  }

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
        {cards.map((card) => {
          const Icon = iconMap[card.icon];

          return (
            <KpiCard
              key={card.key}
              label={card.label}
              value={card.value}
              sub={card.sub}
              accent={card.accent}
              icon={<Icon size={18} />}
              onClick={() => setActiveCard(card)}
              ariaLabel={`Tampilkan daftar ${card.label}`}
            />
          );
        })}
      </section>

      {activeCard ? (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="kpi-dialog-title" onClick={() => setActiveCard(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title" id="kpi-dialog-title">
                  {activeCard.label}
                </div>
                <div className="card-subtitle">{activeCard.description ?? `${activeCard.rows.length.toLocaleString("id-ID")} data ditampilkan`}</div>
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
                      {activeCard.columns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeCard.rows.length === 0 ? (
                      <tr>
                        <td colSpan={activeCard.columns.length} className="muted">
                          {activeCard.emptyText ?? "Belum ada data untuk kategori ini."}
                        </td>
                      </tr>
                    ) : (
                      activeCard.rows.map((row) => (
                        <tr key={row.id}>
                          {activeCard.columns.map((column) => {
                            const cell = cellValue(row.cells[column.key] ?? "-");
                            const content = cell.href ? (
                              <Link className="btn btn-ghost btn-sm" href={cell.href}>
                                {cell.buttonLabel ?? cell.value}
                              </Link>
                            ) : cell.tone ? (
                              <Badge tone={cell.tone}>{cell.value}</Badge>
                            ) : cell.strong ? (
                              <strong>{cell.value}</strong>
                            ) : (
                              cell.value
                            );

                            return (
                              <td key={column.key} className={cell.className ?? column.className}>
                                {content}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              {activeCard.exportFileName ? (
                <button className="btn btn-primary" type="button" onClick={() => exportActiveCard(activeCard)} disabled={activeCard.rows.length === 0}>
                  <Download size={16} />
                  Ekspor
                </button>
              ) : null}
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
