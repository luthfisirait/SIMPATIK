import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { exportDataset, toCsv } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { dataset: string };
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  if (auth.session?.user.role === "ar") {
    params.set("ar", auth.session.user.id);
  }
  const rows = exportDataset(context.params.dataset, params);

  if (!rows) {
    return NextResponse.json({ message: "Dataset export tidak dikenal." }, { status: 404 });
  }

  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="simpatik-${context.params.dataset}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
