import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { listAuditLogs } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  return NextResponse.json(listAuditLogs(Number(searchParams.get("limit") ?? 80)));
}
