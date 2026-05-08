import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { deleteUser, getUser, updateUser } from "@/lib/queries";
import { validateUserPayload, validationError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { id: string };
};

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const id = Number(context.params.id);
  const current = getUser(id);
  if (!current) return NextResponse.json({ message: "User tidak ditemukan." }, { status: 404 });

  const body = await request.json();
  const parsed = validateUserPayload({ ...current, ...body });
  if (!parsed.ok) {
    return NextResponse.json(validationError(parsed.errors), { status: 400 });
  }

  try {
    const data = updateUser(
      id,
      {
        ...parsed.data,
        password_hash: parsed.data.password ? bcrypt.hashSync(parsed.data.password, 10) : undefined,
      },
      { actor: { id: auth.session?.user.id, name: auth.session?.user.name } },
    );
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Gagal memperbarui user." },
      { status: 409 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const deleted = deleteUser(Number(context.params.id), {
    actor: { id: auth.session?.user.id, name: auth.session?.user.name },
  });
  if (!deleted) return NextResponse.json({ message: "User tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
