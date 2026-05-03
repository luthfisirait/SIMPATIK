import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { listSpt } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  return NextResponse.json(
    listSpt({
      q: searchParams.get("q") ?? undefined,
      wilayah: searchParams.get("wilayah") ?? undefined,
      traffic: searchParams.get("status") ?? undefined,
      ar: searchParams.get("ar") ?? undefined,
      periode: searchParams.get("periode") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 12),
    }),
  );
}
