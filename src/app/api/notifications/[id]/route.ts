import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { getNotification, markNotificationRead } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { id: string };
};

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const id = Number(context.params.id);
  const notification = getNotification(id);
  if (!notification) {
    return NextResponse.json({ message: "Notifikasi tidak ditemukan." }, { status: 404 });
  }

  const updated = markNotificationRead(id);
  return NextResponse.json({ updated });
}
