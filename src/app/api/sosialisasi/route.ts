import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { persistGoogleSheetsSnapshot } from "@/lib/google-sheets-store";
import { createSosialisasi, getOpd, listSosialisasi } from "@/lib/queries";
import { validateSosialisasiPayload, validationError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const ar = auth.session?.user.role === "ar" ? auth.session.user.id : (searchParams.get("ar") ?? undefined);
  return NextResponse.json(
    listSosialisasi({
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
  const parsed = validateSosialisasiPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(validationError(parsed.errors), { status: 400 });
  }

  const opd = getOpd(parsed.data.opd_id);
  if (!opd) {
    return NextResponse.json({ message: "OPD tidak ditemukan." }, { status: 404 });
  }

  if (auth.session?.user.role === "ar" && String(opd.ar_id ?? "") !== auth.session.user.id) {
    return NextResponse.json({ message: "AR hanya dapat menjadwalkan sosialisasi untuk OPD ampuannya." }, { status: 403 });
  }

  const id = createSosialisasi(parsed.data);
  await persistGoogleSheetsSnapshot();
  return NextResponse.json({ id }, { status: 201 });
}
