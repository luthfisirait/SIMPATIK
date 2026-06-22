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

function userWriteError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("UNIQUE") || message.includes("users.email")) {
    return "Username / email sudah digunakan.";
  }
  return fallback;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const data = getUser(Number(context.params.id));
  if (!data) return NextResponse.json({ message: "Pengguna tidak ditemukan." }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const id = Number(context.params.id);
  const current = getUser(id);
  if (!current) return NextResponse.json({ message: "Pengguna tidak ditemukan." }, { status: 404 });

  const body = await request.json();
  const parsed = validateUserPayload({ ...current, ...body });
  if (!parsed.ok) {
    return NextResponse.json(validationError(parsed.errors), { status: 400 });
  }

  if (String(id) === auth.session?.user.id && (parsed.data.status !== "aktif" || parsed.data.role !== "kasiwas")) {
    return NextResponse.json({ message: "Akun sendiri harus tetap aktif dengan role Kasiwas." }, { status: 400 });
  }

  try {
    const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : undefined;
    const data = updateUser(
      id,
      {
        nama: parsed.data.nama,
        email: parsed.data.email,
        password_hash: passwordHash,
        role: parsed.data.role,
        nip: parsed.data.nip,
        jabatan: parsed.data.jabatan,
        phone: parsed.data.phone,
        avatar_color: parsed.data.avatar_color,
        status: parsed.data.status,
      },
      {
        actor: { id: auth.session?.user.id, name: auth.session?.user.name },
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ message: userWriteError(error, "Gagal memperbarui pengguna.") }, { status: 409 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const id = Number(context.params.id);
  if (String(id) === auth.session?.user.id) {
    return NextResponse.json({ message: "Akun sendiri tidak dapat dinonaktifkan." }, { status: 400 });
  }

  const deleted = deleteUser(id, {
    actor: { id: auth.session?.user.id, name: auth.session?.user.name },
  });
  if (!deleted) return NextResponse.json({ message: "Pengguna tidak ditemukan." }, { status: 404 });
  return NextResponse.json(getUser(id));
}
