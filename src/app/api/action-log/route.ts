import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { createActionLog, getActionLog } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  return NextResponse.json(getActionLog(Number(searchParams.get("limit") ?? 20)));
}

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  const id = createActionLog(body);
  return NextResponse.json({ id }, { status: 201 });
}
