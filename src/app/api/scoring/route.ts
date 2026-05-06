import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { listScoring } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const ar = auth.session?.user.role === "ar" ? auth.session.user.id : (searchParams.get("ar") ?? undefined);
  return NextResponse.json(
    listScoring({
      q: searchParams.get("q") ?? undefined,
      wilayah: searchParams.get("wilayah") ?? undefined,
      kategori: searchParams.get("kategori") ?? undefined,
      statusRp: searchParams.get("status") ?? undefined,
      ar,
      bulan: searchParams.get("bulan") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 12),
    }),
  );
}
