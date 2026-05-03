import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { dummyCredential, seedDatabase } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const result = seedDatabase({ force: true });
  return NextResponse.json({ ...result, credential: dummyCredential });
}
