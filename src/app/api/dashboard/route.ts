import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { getDashboardData } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  return NextResponse.json(getDashboardData());
}
