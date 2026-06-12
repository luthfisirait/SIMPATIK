import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { persistGoogleSheetsSnapshot } from "@/lib/google-sheets-store";
import { dummyCredential, seedDatabase } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const result = seedDatabase({ force: true });
  await persistGoogleSheetsSnapshot();
  return NextResponse.json({ ...result, credential: dummyCredential });
}
