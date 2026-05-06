import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { deleteOpd, getOpd, updateOpd } from "@/lib/queries";
import { canEditOpd } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { id: string };
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const data = getOpd(Number(context.params.id));
  if (!data) return NextResponse.json({ message: "OPD tidak ditemukan" }, { status: 404 });
  if (auth.session?.user.role === "ar" && String(data.ar_id ?? "") !== auth.session.user.id) {
    return NextResponse.json({ message: "AR hanya dapat membuka OPD ampuannya." }, { status: 403 });
  }
  return NextResponse.json(data);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const current = getOpd(Number(context.params.id));
  if (!current) return NextResponse.json({ message: "OPD tidak ditemukan" }, { status: 404 });
  if (!canEditOpd(auth.session?.user.role, current.ar_id, auth.session?.user.id)) {
    return NextResponse.json({ message: "Hanya AR pengampu atau role pengelola data yang dapat mengedit OPD ini." }, { status: 403 });
  }

  const body = await request.json();
  const data = updateOpd(Number(context.params.id), body);
  return NextResponse.json(data);
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const deleted = deleteOpd(Number(context.params.id));
  if (!deleted) return NextResponse.json({ message: "OPD tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
