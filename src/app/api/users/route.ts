import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { createUser, listUsers } from "@/lib/queries";

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
  const id = createUser({
    ...body,
    password_hash: bcrypt.hashSync(body.password ?? "simpatik123", 10),
  });
  return NextResponse.json({ id }, { status: 201 });
}
