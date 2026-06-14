import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { createActionLog, getActionLog, getOpd } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function GET(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;
  const session = auth.session;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);
  const params = session?.user.role === "ar" ? { ar: session.user.id } : {};
  return NextResponse.json(getActionLog(limit, params));
}

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;
  const session = auth.session;

  if (!session?.user) {
    return NextResponse.json({ message: "Autentikasi diperlukan." }, { status: 401 });
  }

  const body = await request.json();
  const action = cleanText(body.action ?? body.jenis_tindakan);
  if (!action) {
    return NextResponse.json({ message: "Jenis tindakan wajib diisi." }, { status: 400 });
  }

  const opdId = Number(body.opd_id ?? 0) || null;
  const opd = opdId ? getOpd(opdId) : undefined;

  if (opdId && !opd) {
    return NextResponse.json({ message: "OPD tidak ditemukan." }, { status: 404 });
  }

  if (session.user.role === "ar" && (!opd || String(opd.ar_id ?? "") !== String(session.user.id))) {
    return NextResponse.json({ message: "AR hanya dapat mengisi action log untuk OPD ampuannya." }, { status: 403 });
  }

  const id = createActionLog({
    user_id: Number(session.user.id),
    opd_id: opd?.id ?? null,
    action,
    target_type: cleanText(body.target_type) ?? "opd",
    target_name: opd?.nama ?? cleanText(body.target_name) ?? "OPD",
    description: cleanText(body.description ?? body.deskripsi),
    result: cleanText(body.result ?? body.hasil),
    follow_up: cleanText(body.follow_up ?? body.tindak_lanjut),
    next_follow_up_at: cleanText(body.next_follow_up_at),
    attachment_url: cleanText(body.attachment_url),
  });
  return NextResponse.json({ id }, { status: 201 });
}
