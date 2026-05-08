import { Database, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ImportDataClient } from "./ImportDataClient";

export default function ImportDataPage() {
  return (
    <>
      <PageHeader
        title="Import Data"
        description="Preview dan validasi dataset OPD sebelum disimpan ke database."
      />

      <section className="kpi-grid">
        <KpiCard label="Dataset" value="OPD" sub="Master data dan kontak" accent="teal" icon={<Database size={18} />} />
        <KpiCard label="Format" value="CSV/XLSX" sub="Header fleksibel" accent="green" icon={<FileSpreadsheet size={18} />} />
        <KpiCard label="Rollback" value="Aktif" sub="Commit memakai transaksi" accent="navy" icon={<ShieldCheck size={18} />} />
      </section>

      <ImportDataClient />
    </>
  );
}
