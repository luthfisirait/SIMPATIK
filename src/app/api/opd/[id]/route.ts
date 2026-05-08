import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { deleteOpd, getOpd, updateOpd } from "@/lib/queries";
import { canEditOpd } from "@/lib/rbac";
import { validateOpdPayload, validationError } from "@/lib/validation";

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
  const parsed = validateOpdPayload({ ...current, ...body });
  if (!parsed.ok) {
    return NextResponse.json(validationError(parsed.errors), { status: 400 });
  }

  try {
    const data = updateOpd(Number(context.params.id), parsed.data, {
      actor: { id: auth.session?.user.id, name: auth.session?.user.name },
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Gagal memperbarui OPD." },
      { status: 409 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const deleted = deleteOpd(Number(context.params.id), {
    actor: { id: auth.session?.user.id, name: auth.session?.user.name },
  });
  if (!deleted) return NextResponse.json({ message: "OPD tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
