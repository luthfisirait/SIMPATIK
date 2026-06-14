import { CalendarPlus, Download, Presentation } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { authOptions } from "@/lib/auth";
import { getWilayah, listSosialisasi } from "@/lib/queries";
import { firstParam, numericParam, queryString, type PageSearchParams } from "@/lib/search";
import { formatNumber } from "@/lib/utils";
import { SosialisasiWorkspace } from "./SosialisasiWorkspace";

export default async function ModulSosialisasiPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const session = await getServerSession(authOptions);
  const q = firstParam(searchParams, "q");
  const wilayah = firstParam(searchParams, "wilayah", "all");
  const status = firstParam(searchParams, "status", "all");
  const ar = session?.user.role === "ar" ? session.user.id : undefined;
  const page = numericParam(searchParams, "page");
  const result = listSosialisasi({ q, wilayah, status, ar, page, pageSize: 12 });
  const wilayahOptions = getWilayah();
  const exportQuery = queryString({ q, wilayah, status });
  const exportHref = exportQuery ? `/api/export/sosialisasi?${exportQuery}` : "/api/export/sosialisasi";

  return (
    <>
      <PageHeader
        title="Monitoring Sosialisasi Coretax"
        description="Rekam jejak sosialisasi, peserta, dan OPD prioritas yang belum terjangkau."
        actions={
          <>
            <Link className="btn btn-secondary" href={exportHref} target="_blank">
              <Download size={16} />
              Export CSV
            </Link>
            <button className="btn btn-primary" type="button">
              <CalendarPlus size={16} />
              Jadwalkan
            </button>
          </>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Sudah Disosialisasi" value={formatNumber(result.summary.sudah)} sub="OPD memiliki rekam jejak" accent="green" icon={<Presentation size={18} />} />
        <KpiCard label="Belum Disosialisasi" value={formatNumber(result.summary.belum)} sub="Masuk daftar prioritas" accent="red" icon={<Presentation size={18} />} />
        <KpiCard label="Total Peserta" value={formatNumber(result.summary.peserta)} sub="Akumulasi peserta tercatat" accent="gold" icon={<Presentation size={18} />} />
        <KpiCard label="Sesi Terlaksana" value={formatNumber(result.summary.sesi)} sub="Rekam jejak per OPD" accent="navy" icon={<Presentation size={18} />} />
      </section>

      <SosialisasiWorkspace result={result} wilayahOptions={wilayahOptions} q={q} wilayah={wilayah} status={status} />
    </>
  );
}
