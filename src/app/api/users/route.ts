import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { createUser, getUser, listUsers } from "@/lib/queries";
import { validateUserPayload, validationError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userWriteError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("UNIQUE") || message.includes("users.email")) {
    return "Username / email sudah digunakan.";
  }
  return fallback;
}

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
    const passwordHash = await bcrypt.hash(parsed.data.password ?? "", 10);
    const id = createUser(
      {
        nama: parsed.data.nama,
        email: parsed.data.email,
        password_hash: passwordHash,
        role: parsed.data.role,
        nip: parsed.data.nip,
        jabatan: parsed.data.jabatan,
        phone: parsed.data.phone,
        avatar_color: parsed.data.avatar_color,
      },
      {
        actor: { id: auth.session?.user.id, name: auth.session?.user.name },
      },
    );

    return NextResponse.json(getUser(id), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: userWriteError(error, "Gagal menambah pengguna.") }, { status: 409 });
  }
}
