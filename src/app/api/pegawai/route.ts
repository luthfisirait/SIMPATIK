import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { listPegawai } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const ar = auth.session?.user.role === "ar" ? auth.session.user.id : (searchParams.get("ar") ?? undefined);
  return NextResponse.json(
    listPegawai({
      q: searchParams.get("q") ?? undefined,
      wilayah: searchParams.get("wilayah") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      ar,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 12),
    }),
  );
}
