import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/api-auth";
import { commitOpdImport } from "@/lib/import-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiPermission(request);
  if (auth.response) return auth.response;

  const body = await request.json();
  if (body?.dataset !== "opd") {
    return NextResponse.json({ message: "Dataset import belum didukung." }, { status: 400 });
  }

  try {
    const result = commitOpdImport(body.rows, {
      id: auth.session?.user.id,
      name: auth.session?.user.name,
    });
    revalidatePath("/data-opd");
    revalidatePath("/audit-trail");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Import dibatalkan. Tidak ada data yang disimpan.",
      },
      { status: 400 },
    );
  }
}
