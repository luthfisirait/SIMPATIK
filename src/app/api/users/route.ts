import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { createUser, listUsers } from "@/lib/queries";
import { validateUserPayload, validationError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  return NextResponse.json(listUsers());
}

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = validateUserPayload(body, { requirePassword: true });
  if (!parsed.ok) {
    return NextResponse.json(validationError(parsed.errors), { status: 400 });
  }

  try {
    const id = createUser(
      {
        ...parsed.data,
        password_hash: bcrypt.hashSync(parsed.data.password ?? "", 10),
      },
      { actor: { id: auth.session?.user.id, name: auth.session?.user.name } },
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Gagal menambah user." },
      { status: 409 },
    );
  }
}
