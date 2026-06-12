import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { persistGoogleSheetsSnapshot } from "@/lib/google-sheets-store";
import { createOpd, listOpd } from "@/lib/queries";
import { validateOpdPayload, validationError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const ar = auth.session?.user.role === "ar" ? auth.session.user.id : (searchParams.get("ar") ?? undefined);
  return NextResponse.json(
    listOpd({
      q: searchParams.get("q") ?? undefined,
      wilayah: searchParams.get("wilayah") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      ar,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 12),
    }),
  );
}

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  const parsed = validateOpdPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(validationError(parsed.errors), { status: 400 });
  }

  try {
    const data = createOpd(parsed.data, {
      actor: { id: auth.session?.user.id, name: auth.session?.user.name },
    });
    await persistGoogleSheetsSnapshot();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Gagal menambah OPD." },
      { status: 409 },
    );
  }
}
