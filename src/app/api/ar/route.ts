import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { listAr } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  return NextResponse.json(listAr());
}

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  return NextResponse.json({ message: "Dummy-ready endpoint. Tambah AR dapat diaktifkan lewat /api/users." }, { status: 202 });
}
